#!/usr/bin/env python3
"""
scripts/apresentacao_pptx.py: operações de baixo nível sobre o molde da
apresentação final (python-pptx). Campos são marcados pelo texto alternativo
"campo:<nome>" (editável no Google Slides); o tipo do slide-modelo fica nas
anotações ("tipo:<tipo>"). Usado por gerar_apresentacao.py e
preparar_molde_apresentacao.py.
"""

from __future__ import annotations

import copy
import math
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image
from pptx.oxml.ns import qn

NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
TAGS_FORMA = {qn("p:sp"), qn("p:pic"), qn("p:graphicFrame"), qn("p:grpSp"), qn("p:cxnSp")}


def _cnvpr(shape):
    return shape._element.find(".//" + qn("p:cNvPr"))


def texto_alternativo(shape) -> str:
    el = _cnvpr(shape)
    return (el.get("descr") or "") if el is not None else ""


def definir_texto_alternativo(shape, valor: str) -> None:
    _cnvpr(shape).set("descr", valor)


def campos(slide) -> Dict[str, object]:
    resultado: Dict[str, object] = {}
    for shape in slide.shapes:
        m = re.match(r"^campo:([\w-]+)$", texto_alternativo(shape).strip())
        if m:
            resultado[m.group(1)] = shape
    return resultado


def tipo_do_slide(slide) -> Optional[str]:
    if not slide.has_notes_slide:
        return None
    m = re.search(r"tipo:([\w-]+)", slide.notes_slide.notes_text_frame.text)
    return m.group(1) if m else None


def marcar_tipo(slide, tipo: str) -> None:
    slide.notes_slide.notes_text_frame.text = f"tipo:{tipo}"


def duplicar_slide(prs, modelo):
    """Cópia do slide (formas, imagens e links), no fim do deck, sem as anotações."""
    novo = prs.slides.add_slide(modelo.slide_layout)
    arvore = novo.shapes._spTree
    for el in list(arvore):
        if el.tag in TAGS_FORMA:
            arvore.remove(el)
    mapa: Dict[str, str] = {}
    for rid, rel in modelo.part.rels.items():
        if rel.reltype.endswith("/notesSlide") or rel.reltype.endswith("/slideLayout"):
            continue
        if rel.is_external:
            mapa[rid] = novo.part.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
        else:
            mapa[rid] = novo.part.rels.get_or_add(rel.reltype, rel.target_part)
    for el in modelo.shapes._spTree:
        if el.tag not in TAGS_FORMA:
            continue
        copia = copy.deepcopy(el)
        for no in copia.iter():
            for attr, valor in list(no.attrib.items()):
                if attr.startswith(NS_REL) and valor in mapa:
                    no.set(attr, mapa[valor])
        arvore.append(copia)
    return novo


def remover_slide(prs, slide) -> None:
    lista = prs.slides._sldIdLst
    for sld in list(lista):
        if prs.part.related_part(sld.rId) is slide.part:
            prs.part.drop_rel(sld.rId)
            lista.remove(sld)
            return
    raise ValueError("slide não pertence à apresentação")


def partes_negrito(texto: str) -> List[Tuple[str, bool]]:
    """'**a** b' -> [('a', True), (' b', False)]. '**' sem par fica como texto normal, sem asteriscos."""
    pedacos = texto.split("**")
    if len(pedacos) % 2 == 0:  # ímpar de '**': o último trecho aberto vira normal
        pedacos = pedacos[:-2] + [pedacos[-2] + pedacos[-1]]
    partes = [(p, i % 2 == 1) for i, p in enumerate(pedacos) if p]
    return partes or [("", False)]


def _paragrafos(shape):
    return shape.text_frame._txBody.findall(qn("a:p"))


def _tem_texto(p) -> bool:
    return any((t.text or "").strip() for t in p.iter(qn("a:t")))


def _paragrafo(modelo, texto: str):
    p = copy.deepcopy(modelo)
    run_modelo = p.find(qn("a:r"))
    rpr = copy.deepcopy(run_modelo.find(qn("a:rPr"))) if run_modelo is not None and run_modelo.find(qn("a:rPr")) is not None else None
    for filho in list(p):
        if filho.tag in (qn("a:r"), qn("a:br"), qn("a:fld")):
            p.remove(filho)
    fim = p.find(qn("a:endParaRPr"))
    for trecho, negrito in partes_negrito(texto) if texto else []:
        r = p.makeelement(qn("a:r"), {})
        novo_rpr = copy.deepcopy(rpr) if rpr is not None else r.makeelement(qn("a:rPr"), {"lang": "pt-BR"})
        novo_rpr.set("b", "1" if negrito else "0")
        r.append(novo_rpr)
        t = r.makeelement(qn("a:t"), {})
        t.text = trecho
        r.append(t)
        if fim is not None:
            fim.addprevious(r)
        else:
            p.append(r)
    return p


def _substituir_paragrafos(shape, novos) -> None:
    corpo = shape.text_frame._txBody
    for p in _paragrafos(shape):
        corpo.remove(p)
    for p in novos:
        corpo.append(p)


def _modelos(shape):
    """(modelo de texto, espaçador vazio logo depois ou None, segundo modelo de texto ou None)."""
    ps = _paragrafos(shape)
    com_texto = [i for i, p in enumerate(ps) if _tem_texto(p)]
    i0 = com_texto[0] if com_texto else 0
    espacador = ps[i0 + 1] if i0 + 1 < len(ps) and not _tem_texto(ps[i0 + 1]) else None
    segundo = ps[com_texto[1]] if len(com_texto) > 1 else None
    return ps[i0], espacador, segundo


def preencher_texto(shape, texto: str) -> None:
    modelo, _, _ = _modelos(shape)
    _substituir_paragrafos(shape, [_paragrafo(modelo, linha) for linha in texto.split("\n")])


def preencher_lista(shape, itens: List[str]) -> None:
    modelo, espacador, _ = _modelos(shape)
    novos = []
    for i, item in enumerate(itens):
        if i and espacador is not None:
            novos.append(copy.deepcopy(espacador))
        novos.append(_paragrafo(modelo, item))
    _substituir_paragrafos(shape, novos)


def preencher_bloco(shape, titulo: str, itens: List[str]) -> None:
    modelo_titulo, espacador, modelo_item = _modelos(shape)
    modelo_item = modelo_item if modelo_item is not None else modelo_titulo
    novos = [_paragrafo(modelo_titulo, titulo)]
    for item in itens:
        if espacador is not None:
            novos.append(copy.deepcopy(espacador))
        novos.append(_paragrafo(modelo_item, item))
    _substituir_paragrafos(shape, novos)


def trocar_imagem(slide, shape, caminho: Path) -> None:
    """Troca a imagem mantendo a proporção da nova, centralizada na área original."""
    _, rid = slide.part.get_or_add_image_part(str(caminho))
    blip_fill = shape._element.find(qn("p:blipFill"))
    blip_fill.find(qn("a:blip")).set(qn("r:embed"), rid)
    recorte = blip_fill.find(qn("a:srcRect"))
    if recorte is not None:
        blip_fill.remove(recorte)
    with Image.open(caminho) as img:
        largura, altura = img.size
    x, y, w, h = shape.left, shape.top, shape.width, shape.height
    escala = min(w / largura, h / altura)
    nw, nh = int(largura * escala), int(altura * escala)
    shape.left, shape.top, shape.width, shape.height = x + (w - nw) // 2, y + (h - nh) // 2, nw, nh


def definir_link(shape, url: str) -> None:
    for p in shape.text_frame.paragraphs:
        for r in p.runs:
            r.hyperlink.address = url


def substituir_token(slide, token: str, valor: str) -> int:
    trocas = 0
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for t in shape.text_frame._txBody.iter(qn("a:t")):
            if t.text and token in t.text:
                t.text = t.text.replace(token, valor)
                trocas += 1
    return trocas


def _tamanho_pt(shape) -> float:
    for rpr in shape.text_frame._txBody.iter(qn("a:rPr")):
        if rpr.get("sz"):
            return int(rpr.get("sz")) / 100
    return 14.0


def ocupacao(shape) -> float:
    """Linhas estimadas / linhas que cabem. Aproximação (largura média de caractere ≈ 0,5 × tamanho)."""
    tamanho = _tamanho_pt(shape)
    largura_pt, altura_pt = shape.width / 12700, shape.height / 12700
    por_linha = max(1, int(largura_pt / (0.5 * tamanho)))
    linhas = sum(max(1, math.ceil(len(p.text) / por_linha)) for p in shape.text_frame.paragraphs)
    capacidade = max(1, int(altura_pt / (1.2 * tamanho)))
    return linhas / capacidade


def caixa_percentual(prs, shape) -> Dict[str, float]:
    W, H = prs.slide_width, prs.slide_height
    return {
        "x": round(shape.left / W * 100, 2),
        "y": round(shape.top / H * 100, 2),
        "w": round(shape.width / W * 100, 2),
        "h": round(shape.height / H * 100, 2),
    }
