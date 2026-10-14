#!/usr/bin/env python3
"""
scripts/meta_ads_selecao.py: normaliza os anúncios devolvidos pela Apify
(ator apify/facebook-ads-scraper) e aplica as regras mecânicas de seleção da
Skill 07 (até 5 criativos, no máximo 1 catálogo, sem duplicados, sem anúncio
sem mídia).

Sem rede e sem disco: o download entra por uma função injetada, o que deixa
tudo testável. Usado por scripts/coleta_meta_ads.py.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlparse

FORMATO_VIDEO = "Vídeo"
FORMATO_IMAGEM = "Imagem estática"
FORMATO_CARROSSEL = "Carrossel"
FORMATO_DPA = "Catálogo (DPA)"

PLATAFORMAS = {
    "FACEBOOK": "Facebook",
    "INSTAGRAM": "Instagram",
    "MESSENGER": "Messenger",
    "AUDIENCE_NETWORK": "Audience Network",
    "THREADS": "Threads",
    "WHATSAPP": "WhatsApp",
}
SEGUNDO_NIVEL = {"com", "net", "org", "gov", "edu", "art", "blog", "ind", "eco", "app", "co"}
LIMITE_HAMMING = 5


@dataclass
class Anuncio:
    ad_id: str
    page_id: str
    pagina: str
    formato: str
    texto: str = ""
    titulo: str = ""
    cta: str = ""
    dominio: Optional[str] = None
    plataformas: List[str] = field(default_factory=list)
    inicio: Optional[str] = None
    versoes: Optional[int] = None
    impressoes: Optional[str] = None
    collation_id: Optional[str] = None
    imagens: List[str] = field(default_factory=list)
    videos: List[Dict[str, Optional[str]]] = field(default_factory=list)
    curtidas_pagina: Optional[int] = None
    categorias_pagina: List[str] = field(default_factory=list)

    @property
    def link(self) -> str:
        return f"https://www.facebook.com/ads/library/?id={self.ad_id}"


@dataclass
class Midia:
    arquivos: List[str]
    hash: Optional[int] = None
    quadros_falharam: bool = False


@dataclass
class Selecionado:
    anuncio: Anuncio
    midia: Midia


def campo(d: Any, *nomes: str) -> Any:
    """Primeiro valor não vazio entre as chaves (a Apify já usou camelCase e snake_case)."""
    if not isinstance(d, dict):
        return None
    for nome in nomes:
        valor = d.get(nome)
        if valor not in (None, "", [], {}):
            return valor
    return None


def sem_acento(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")


def slug_marca(nome: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", sem_acento(nome).lower()).strip("-")
    return s or "marca"


def normalizar_texto(texto: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", sem_acento(texto or "").lower()).strip()


def dominio_base(valor: Optional[str]) -> Optional[str]:
    if not valor or not isinstance(valor, str):
        return None
    v = valor.strip().lower()
    if "://" not in v:
        v = "http://" + v
    try:
        host = urlparse(v).hostname or ""
    except ValueError:
        return None
    if host.startswith("www."):
        host = host[4:]
    partes = [p for p in host.split(".") if p]
    if len(partes) < 2 or " " in host:
        return None
    if len(partes) >= 3 and len(partes[-1]) == 2 and partes[-2] in SEGUNDO_NIVEL:
        return ".".join(partes[-3:])
    return ".".join(partes[-2:])


def _texto(valor: Any) -> str:
    if isinstance(valor, dict):
        valor = campo(valor, "text", "markup")
    return valor.strip() if isinstance(valor, str) else ""


def _url_imagem(d: Any) -> Optional[str]:
    return campo(d, "originalImageUrl", "original_image_url", "resizedImageUrl", "resized_image_url")


def _video(d: Any) -> Optional[Dict[str, Optional[str]]]:
    url = campo(d, "videoHdUrl", "video_hd_url", "videoSdUrl", "video_sd_url")
    if not url:
        return None
    return {"url": url, "capa": campo(d, "videoPreviewImageUrl", "video_preview_image_url")}


def _data_inicio(bruto: Dict[str, Any]) -> Optional[str]:
    formatada = campo(bruto, "startDateFormatted", "start_date_formatted")
    if isinstance(formatada, str) and len(formatada) >= 10:
        return formatada[:10]
    epoch = campo(bruto, "startDate", "start_date")
    if isinstance(epoch, (int, float)):
        return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%d")
    return None


def _inteiro(valor: Any) -> Optional[int]:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def normalizar_anuncio(bruto: Dict[str, Any]) -> Optional[Anuncio]:
    ad_id = campo(bruto, "adArchiveID", "ad_archive_id", "adArchiveId")
    if not ad_id:
        return None
    snap = campo(bruto, "snapshot") or {}
    cards = [c for c in (campo(snap, "cards") or []) if isinstance(c, dict)]
    imagens = [u for u in (_url_imagem(i) for i in (campo(snap, "images") or [])) if u]
    videos = [v for v in (_video(i) for i in (campo(snap, "videos") or [])) if v]
    for card in cards[:3]:
        v = _video(card)
        if v:
            videos.append(v)
        else:
            u = _url_imagem(card)
            if u:
                imagens.append(u)

    exibicao = str(campo(snap, "displayFormat", "display_format") or "").upper()
    # DCO (criativo dinâmico): os "cards" são variações do mesmo anúncio, não um carrossel.
    if exibicao == "DPA":
        formato = FORMATO_DPA
    elif exibicao == "DCO":
        formato = FORMATO_VIDEO if videos else FORMATO_IMAGEM
    elif exibicao == "CAROUSEL" or (exibicao != "VIDEO" and len(cards) >= 2):
        formato = FORMATO_CARROSSEL
    elif exibicao == "VIDEO" or videos:
        formato = FORMATO_VIDEO
    else:
        formato = FORMATO_IMAGEM

    primeiro_card = cards[0] if cards else {}
    dominio = (
        dominio_base(campo(snap, "linkUrl", "link_url"))
        or dominio_base(campo(snap, "caption"))
        or dominio_base(campo(primeiro_card, "linkUrl", "link_url"))
    )
    impressoes = campo(bruto, "impressionsWithIndex", "impressions_with_index")
    plataformas = [
        PLATAFORMAS.get(str(p).upper(), str(p).title())
        for p in (campo(bruto, "publisherPlatform", "publisher_platform") or [])
    ]
    categorias = [c for c in (campo(snap, "pageCategories", "page_categories") or []) if isinstance(c, str)]
    collation = campo(bruto, "collationID", "collation_id", "collationId")
    return Anuncio(
        ad_id=str(ad_id),
        page_id=str(campo(bruto, "pageID", "page_id", "pageId") or campo(snap, "pageId", "page_id") or ""),
        pagina=str(campo(bruto, "pageName", "page_name") or campo(snap, "pageName", "page_name") or ""),
        formato=formato,
        texto=_texto(campo(snap, "body")) or _texto(campo(primeiro_card, "body")),
        titulo=_texto(campo(snap, "title")) or _texto(campo(primeiro_card, "title")),
        cta=_texto(campo(snap, "ctaText", "cta_text")) or _texto(campo(primeiro_card, "ctaText", "cta_text")),
        dominio=dominio,
        plataformas=plataformas,
        inicio=_data_inicio(bruto),
        versoes=_inteiro(campo(bruto, "collationCount", "collation_count")),
        impressoes=campo(impressoes, "impressionsText", "impressions_text"),
        collation_id=str(collation) if collation else None,
        imagens=imagens,
        videos=videos,
        curtidas_pagina=_inteiro(campo(snap, "pageLikeCount", "page_like_count")),
        categorias_pagina=categorias,
    )


def distancia_hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _duplicado(anuncio: Anuncio, midia: Midia, escolhidos: List[Selecionado]) -> bool:
    texto = normalizar_texto(anuncio.texto)
    for s in escolhidos:
        if texto != normalizar_texto(s.anuncio.texto):
            continue
        if midia.hash is None or s.midia.hash is None:
            continue
        if distancia_hamming(midia.hash, s.midia.hash) <= LIMITE_HAMMING:
            return True
    return False


def selecionar(
    anuncios: List[Anuncio],
    limite: int,
    baixar: Callable[[Anuncio], Optional[Midia]],
    descartar: Optional[Callable[[Anuncio, Midia], None]] = None,
) -> Tuple[List[Selecionado], Dict[str, int]]:
    """Mais recentes primeiro; pula duplicados, o 2º catálogo e anúncio sem mídia; para em `limite`."""
    contagem = {"duplicados": 0, "catalogos_pulados": 0, "sem_midia": 0}
    escolhidos: List[Selecionado] = []
    colacoes = set()
    tem_dpa = False
    for a in sorted(anuncios, key=lambda x: x.inicio or "", reverse=True):
        if len(escolhidos) >= limite:
            break
        if a.collation_id and a.collation_id in colacoes:
            contagem["duplicados"] += 1
            continue
        if a.formato == FORMATO_DPA and tem_dpa:
            contagem["catalogos_pulados"] += 1
            continue
        if not a.imagens and not a.videos:
            contagem["sem_midia"] += 1
            continue
        midia = baixar(a)
        if midia is None:
            contagem["sem_midia"] += 1
            continue
        if _duplicado(a, midia, escolhidos):
            contagem["duplicados"] += 1
            if descartar:
                descartar(a, midia)
            continue
        if a.collation_id:
            colacoes.add(a.collation_id)
        tem_dpa = tem_dpa or a.formato == FORMATO_DPA
        escolhidos.append(Selecionado(a, midia))
    return escolhidos, contagem
