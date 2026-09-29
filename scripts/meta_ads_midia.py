#!/usr/bin/env python3
"""
scripts/meta_ads_midia.py: baixa a mídia de um anúncio (imagens, capas e
vídeos), converte imagens para JPEG, extrai quadros de vídeo com ffmpeg e
calcula o hash visual usado na deduplicação. Usado por
scripts/coleta_meta_ads.py.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any, List, Optional

from PIL import Image

from meta_ads_selecao import Anuncio, Midia

TIMEOUT_DOWNLOAD = 60


def baixar_arquivo(sessao: Any, url: str, destino: Path, tentativas: int = 2) -> bool:
    for _ in range(tentativas):
        try:
            r = sessao.get(url, timeout=TIMEOUT_DOWNLOAD)
        except Exception:  # noqa: BLE001 (qualquer falha de rede conta como tentativa perdida)
            continue
        if r.status_code == 200 and r.content:
            destino.write_bytes(r.content)
            return True
    return False


def baixar_imagem(sessao: Any, url: str, destino: Path) -> bool:
    """Baixa e regrava como JPEG; conteúdo que não é imagem (ex.: página de erro) é rejeitado."""
    if not baixar_arquivo(sessao, url, destino):
        return False
    try:
        img = Image.open(destino)
        img.load()
        rgb = img.convert("RGB")
        img.close()
        rgb.save(destino, "JPEG", quality=90)
        return True
    except Exception:  # noqa: BLE001
        destino.unlink(missing_ok=True)
        return False


def ahash(caminho: Path) -> Optional[int]:
    try:
        with Image.open(caminho) as img:
            pixels = list(img.convert("L").resize((8, 8)).getdata())
    except Exception:  # noqa: BLE001
        return None
    media = sum(pixels) / len(pixels)
    valor = 0
    for p in pixels:
        valor = (valor << 1) | (1 if p >= media else 0)
    return valor


def duracao_video(video: Path) -> Optional[float]:
    try:
        saida = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
            capture_output=True, text=True, timeout=60, check=True,
        ).stdout
        return float(saida.strip())
    except (subprocess.SubprocessError, ValueError, OSError):
        return None


def tempos_quadros(duracao: Optional[float]) -> List[float]:
    if not duracao or duracao <= 0:
        return [0.0]
    if duracao < 3:
        return [0.0, round(duracao / 2, 2), round(max(duracao - 0.25, 0.0), 2)]
    brutos = [2.0, duracao * 0.25, duracao * 0.5, duracao * 0.75, duracao - 0.5]
    return sorted({round(t, 2) for t in brutos})


def extrair_quadros(video: Path, pasta: Path, prefixo: str) -> List[Path]:
    quadros: List[Path] = []
    for i, t in enumerate(tempos_quadros(duracao_video(video)), start=1):
        saida = pasta / f"{prefixo}-quadro-{i}.jpg"
        try:
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video),
                 "-frames:v", "1", "-q:v", "3", str(saida)],
                capture_output=True, timeout=120, check=True,
            )
        except (subprocess.SubprocessError, OSError):
            continue
        if saida.exists() and saida.stat().st_size > 0:
            quadros.append(saida)
    return quadros


def ffmpeg_disponivel() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def baixar_midia(anuncio: Anuncio, pasta_marca: Path, sessao: Any) -> Optional[Midia]:
    """Grava em <pasta_marca>/midia/<ad_id>/. None se nada pôde ser baixado."""
    pasta = pasta_marca / "midia" / anuncio.ad_id
    pasta.mkdir(parents=True, exist_ok=True)
    salvos: List[Path] = []
    para_hash: List[Path] = []
    quadros_falharam = False

    for i, url in enumerate(anuncio.imagens[:3], start=1):
        destino = pasta / f"imagem-{i}.jpg"
        if baixar_imagem(sessao, url, destino):
            salvos.append(destino)
            para_hash.append(destino)

    for i, video in enumerate(anuncio.videos[:3], start=1):
        capa: Optional[Path] = None
        if video.get("capa"):
            destino = pasta / f"video-{i}-capa.jpg"
            if baixar_imagem(sessao, str(video["capa"]), destino):
                capa = destino
                salvos.append(destino)
                para_hash.append(destino)
        arquivo = pasta / f"video-{i}.mp4"
        quadros: List[Path] = []
        if baixar_arquivo(sessao, str(video["url"]), arquivo):
            quadros = extrair_quadros(arquivo, pasta, f"video-{i}")
            arquivo.unlink(missing_ok=True)
        if not quadros:
            quadros_falharam = True
        salvos.extend(quadros)
        if capa is None:
            para_hash.extend(quadros[:1])

    if not salvos:
        shutil.rmtree(pasta, ignore_errors=True)
        return None
    h = next((v for v in (ahash(c) for c in para_hash) if v is not None), None)
    return Midia(
        arquivos=[str(p.relative_to(pasta_marca)) for p in salvos],
        hash=h,
        quadros_falharam=quadros_falharam,
    )


def apagar_midia(pasta_marca: Path, anuncio: Anuncio) -> None:
    shutil.rmtree(pasta_marca / "midia" / anuncio.ad_id, ignore_errors=True)
