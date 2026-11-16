#!/usr/bin/env python3
"""
scripts/previa_apresentacao.py: prévia da apresentação final no app.

    python3 scripts/previa_apresentacao.py gerar --pptx <deck.pptx> --saida <pasta>
    python3 scripts/previa_apresentacao.py recortar --slide <slide-NN.png> --regiao x,y,w,h --saida <recorte.png>

gerar: LibreOffice converte o .pptx em PDF e o poppler (pdftoppm) gera um PNG por
slide (slide-01.png…); grava mapa.json com o título e a área de cada campo (em %
do slide), lidos do próprio .pptx pelo texto alternativo. Imprime {"slides": n}.
recortar: recorta a região comentada (em %) com margem e contorno laranja, para o
agente ver exatamente o que o analista apontou.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from PIL import Image, ImageDraw
from pptx import Presentation

import apresentacao_pptx as ap

LARANJA = (200, 111, 0)
SOFFICE_MAC = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")

# Sem janela, o LibreOffice só enxerga as fontes que o fontconfig aponta: incluímos as
# pastas do sistema e do usuário e trocamos Century Gothic (da Microsoft, ausente no Mac)
# pelo clone métrico livre TeX Gyre Adventor, para as quebras de linha baterem.
FONTS_CONF = """<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/Applications/LibreOffice.app/Contents/Resources/fonts</dir>
  <dir>/System/Library/Fonts</dir>
  <dir>/Library/Fonts</dir>
  <dir>~/Library/Fonts</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>{cache}</cachedir>
  <alias binding="same"><family>Century Gothic</family><prefer><family>TeX Gyre Adventor</family></prefer></alias>
</fontconfig>
"""


class ErroPrevia(Exception):
    """Mensagem pronta para o analista, em português."""


def _titulo_da_tabela(forma) -> str:
    numeros = [r.cells[0].text.strip() for r in list(forma.table.rows)[1:] if r.cells[0].text.strip()]
    return f"Plano de ação · ações {numeros[0]} a {numeros[-1]}" if numeros else "Plano de ação"


def _titulo(slide) -> str:
    c = ap.campos(slide)
    if "tabela" in c:
        return _titulo_da_tabela(c["tabela"])
    partes: List[str] = []
    for nome in ("titulo", "subtitulo", "concorrente"):
        if nome in c:
            texto = " ".join(c[nome].text_frame.text.split())
            if texto:
                partes.append(texto)
    if not partes:
        # Sem campo de título (análises em 2 colunas, jornada…): 1ª linha do texto mais acima à esquerda.
        textos = [f for f in slide.shapes if f.has_text_frame and f.text_frame.text.strip()]
        textos.sort(key=lambda f: ((f.top or 0) // 100000, f.left or 0))
        for forma in textos[:1]:
            linha = next(p.text for p in forma.text_frame.paragraphs if p.text.strip())
            partes.append(" ".join(linha.split())[:80])
    return " · ".join(partes)


def mapa_do_pptx(pptx: Path) -> dict:
    prs = Presentation(pptx)
    return {
        "slides": [
            {
                "numero": i,
                "titulo": _titulo(s),
                "campos": {nome: ap.caixa_percentual(prs, forma) for nome, forma in ap.campos(s).items()},
            }
            for i, s in enumerate(prs.slides, start=1)
        ]
    }


def _soffice() -> str:
    caminho = shutil.which("soffice") or (str(SOFFICE_MAC) if SOFFICE_MAC.exists() else None)
    if not caminho:
        raise ErroPrevia("LibreOffice não encontrado. Instale com: brew install --cask libreoffice")
    return caminho


def converter(pptx: Path, pasta: Path) -> int:
    if not pptx.is_file():
        raise ErroPrevia(f"Arquivo da apresentação não encontrado: {pptx}")
    if not shutil.which("pdftoppm"):
        raise ErroPrevia("poppler não encontrado. Instale com: brew install poppler")
    soffice = _soffice()
    pasta.mkdir(parents=True, exist_ok=True)
    for antigo in pasta.glob("slide-*.png"):
        antigo.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        perfil = Path(tmp) / "perfil"
        conf = Path(tmp) / "fonts.conf"
        conf.write_text(FONTS_CONF.format(cache=Path(tmp) / "fc-cache"), encoding="utf-8")
        try:
            subprocess.run(
                [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(pptx)],
                capture_output=True, timeout=180, check=True, env={**os.environ, "FONTCONFIG_FILE": str(conf)},
            )
        except subprocess.TimeoutExpired:
            raise ErroPrevia("A conversão da apresentação passou de 3 minutos. Tente de novo.")
        except subprocess.CalledProcessError as e:
            raise ErroPrevia(f"O LibreOffice não conseguiu converter a apresentação ({e.returncode}).")
        pdf = Path(tmp) / f"{pptx.stem}.pdf"
        if not pdf.exists():
            raise ErroPrevia("O LibreOffice não gerou o PDF da apresentação.")
        subprocess.run(["pdftoppm", "-png", "-r", "110", str(pdf), str(pasta / "p")], capture_output=True, timeout=180, check=True)
    paginas = sorted(pasta.glob("p-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    for i, p in enumerate(paginas, start=1):
        p.rename(pasta / f"slide-{i:02d}.png")
    return len(paginas)


def recortar(slide_png: Path, regiao: Dict[str, float], saida: Path) -> None:
    x, y, w, h = (float(regiao[k]) for k in ("x", "y", "w", "h"))
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > 100.01 or y + h > 100.01:
        raise ErroPrevia("Região inválida para o recorte.")
    with Image.open(slide_png) as img:
        img = img.convert("RGB")
        W, H = img.size
        x0, y0, x1, y1 = x / 100 * W, y / 100 * H, (x + w) / 100 * W, (y + h) / 100 * H
        mx, my = 0.08 * W, 0.08 * H
        caixa = (int(max(0, x0 - mx)), int(max(0, y0 - my)), int(min(W, x1 + mx)), int(min(H, y1 + my)))
        desenho = ImageDraw.Draw(img)
        desenho.rectangle((x0, y0, x1, y1), outline=LARANJA, width=max(3, W // 250))
        saida.parent.mkdir(parents=True, exist_ok=True)
        img.crop(caixa).save(saida)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Prévia da apresentação final (PNG por slide, mapa e recortes).")
    sub = p.add_subparsers(dest="comando", required=True)
    g = sub.add_parser("gerar")
    g.add_argument("--pptx", required=True, type=Path)
    g.add_argument("--saida", required=True, type=Path)
    r = sub.add_parser("recortar")
    r.add_argument("--slide", required=True, type=Path)
    r.add_argument("--regiao", required=True)
    r.add_argument("--saida", required=True, type=Path)
    a = p.parse_args(argv)
    try:
        if a.comando == "gerar":
            n = converter(a.pptx, a.saida)
            (a.saida / "mapa.json").write_text(json.dumps(mapa_do_pptx(a.pptx), ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"slides": n}))
        else:
            valores = [float(v) for v in a.regiao.split(",")]
            if len(valores) != 4:
                raise ErroPrevia("A região precisa ser x,y,w,h.")
            recortar(a.slide, dict(zip(("x", "y", "w", "h"), valores)), a.saida)
    except (ErroPrevia, ValueError, OSError, subprocess.SubprocessError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
