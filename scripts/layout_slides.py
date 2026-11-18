#!/usr/bin/env python3
"""
scripts/layout_slides.py: ajustes de geometria dos slides na hora de gerar a apresentação (python-pptx),
sem alterar o molde .pptx. Usado por gerar_apresentacao.py.

- alinhar_jornada: um item da jornada por caixa de texto, centrado na seta azul correspondente.
"""

from __future__ import annotations

import copy
from typing import List, Optional

from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls, qn

# Maior que uma linha de texto (a seta tem só 210 900 EMU): a caixa é centrada na seta, não do tamanho dela.
ALTURA_ITEM_JORNADA = 420_000


def _setas(slide) -> List[object]:
    """Setas azuis da jornada: auto-formas sem texto coladas na borda esquerda, de cima para baixo."""
    achadas = [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE and s.left == 0 and not s.text_frame.text.strip()]
    return sorted(achadas, key=lambda s: s.top)


def _lista_da_jornada(slide, itens: int) -> Optional[object]:
    """A caixa de texto com um parágrafo por item da jornada (a do título "JORNADA" tem só um)."""
    return next((s for s in slide.shapes if s.has_text_frame and len(s.text_frame.paragraphs) == itens), None)


def alinhar_jornada(slide) -> bool:
    """
    Troca a caixa única de itens (espaçamento de linha de 250%, que cada programa desenha de um jeito) por uma caixa por
    item, com o mesmo centro vertical da seta correspondente. A numeração automática continua de 1 a 5 (`startAt`).
    Devolve False, sem alterar nada, quando o slide não tem a estrutura esperada (setas e uma lista de mesmo tamanho).
    """
    flechas = _setas(slide)
    lista = _lista_da_jornada(slide, len(flechas)) if flechas else None
    if lista is None:
        return False
    original = lista._element
    ids = [int(el.get("id")) for el in slide.shapes._spTree.iter(qn("p:cNvPr"))]
    proximo_id = max(ids) + 1
    for indice, seta in enumerate(flechas):
        caixa = copy.deepcopy(original)
        corpo = caixa.find(qn("p:txBody"))
        paragrafos = corpo.findall(qn("a:p"))
        for j, p in enumerate(paragrafos):
            if j != indice:
                corpo.remove(p)
        propriedades = paragrafos[indice].find(qn("a:pPr"))
        propriedades.find(qn("a:lnSpc")).find(qn("a:spcPct")).set("val", "100000")
        propriedades.find(qn("a:buAutoNum")).set("startAt", str(indice + 1))
        envoltorio = corpo.find(qn("a:bodyPr"))
        envoltorio.set("anchor", "ctr")
        envoltorio.set("tIns", "0")
        envoltorio.set("bIns", "0")
        auto = envoltorio.find(qn("a:spAutoFit"))
        if auto is not None:
            envoltorio.replace(auto, parse_xml(f"<a:noAutofit {nsdecls('a')}/>"))
        xfrm = caixa.find(qn("p:spPr")).find(qn("a:xfrm"))
        xfrm.find(qn("a:off")).set("y", str(seta.top + seta.height // 2 - ALTURA_ITEM_JORNADA // 2))
        xfrm.find(qn("a:ext")).set("cy", str(ALTURA_ITEM_JORNADA))
        identificador = caixa.find(".//" + qn("p:cNvPr"))
        identificador.set("id", str(proximo_id + indice))
        identificador.set("name", f"Jornada item {indice + 1}")
        original.addprevious(caixa)
    original.getparent().remove(original)
    return True
