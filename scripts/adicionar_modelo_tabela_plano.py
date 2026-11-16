#!/usr/bin/env python3
"""
scripts/adicionar_modelo_tabela_plano.py: acrescenta ao molde da apresentação o
slide-modelo "tabela_plano" (tabela nativa e editável com as ações do plano de
ação, no formato Ação | Horizonte | Quando | Quem | Frente, e a linha "Clique
aqui" que leva ao documento detalhado). Derivado do "analises_2_colunas", só
pelo fundo. Idempotente: um modelo já existente é substituído. Também chamado no
fim de preparar_molde_apresentacao.py, para o molde regenerado já sair com ele.

    python3 scripts/adicionar_modelo_tabela_plano.py --molde .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

import apresentacao_pptx as ap

# Colunas da tabela, na ordem em que aparecem no slide: (chave da linha, cabeçalho, largura em EMU).
COLUNAS = [
    ("num", "", 320000),
    ("acao", "Ação", 2800000),
    ("horizonte", "Horizonte", 850000),
    ("quando", "Quando", 1250000),
    ("quem", "Quem", 1150000),
    ("frente", "Frente", 1850000),
]
ESQUERDA = 457200
TOPO = 300000
ALTURA_LINHA = 228600
TAMANHO_FONTE = 9
FONTE = "Montserrat"
FUNDO_CABECALHO = RGBColor(0x00, 0x00, 0x00)
FUNDO_LINHA = RGBColor(0xFF, 0xFF, 0xFF)
TEXTO_LINHA = RGBColor(0x11, 0x11, 0x11)
BORDA = "9A9A9A"
TOPO_LINK = 4470000


def _bordas(tc) -> None:
    """Fio fino entre as linhas e nas laterais, como na tabela do deck de referência."""
    tc_pr = tc.get_or_add_tcPr()
    for nome in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
        for antigo in tc_pr.findall(qn(nome)):
            tc_pr.remove(antigo)
    xml = "".join(
        f'<a:{lado} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" w="6350" cap="flat" cmpd="sng" algn="ctr">'
        f'<a:solidFill><a:srgbClr val="{BORDA}"/></a:solidFill><a:prstDash val="solid"/></a:{lado}>'
        for lado in ("lnL", "lnR", "lnT", "lnB")
    )
    elementos = etree.fromstring(f'<r xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">{xml}</r>')
    for i, el in enumerate(list(elementos)):
        tc_pr.insert(i, el)


def _celula(cell, texto: str, cabecalho: bool, negrito: bool, direita: bool) -> None:
    cell.margin_left = cell.margin_right = Emu(54000)
    cell.margin_top = cell.margin_bottom = Emu(22860)
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    cell.fill.solid()
    cell.fill.fore_color.rgb = FUNDO_CABECALHO if cabecalho else FUNDO_LINHA
    tf = cell.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT if direita else PP_ALIGN.LEFT
    r = p.add_run()
    r.text = texto
    r.font.name = FONTE
    r.font.size = Pt(TAMANHO_FONTE)
    r.font.bold = cabecalho or negrito
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF) if cabecalho else TEXTO_LINHA
    _bordas(cell._tc)


def _tabela(slide):
    largura = sum(c[2] for c in COLUNAS)
    quadro = slide.shapes.add_table(2, len(COLUNAS), Emu(ESQUERDA), Emu(TOPO), Emu(largura), Emu(ALTURA_LINHA * 2))
    tabela = quadro.table
    # sem o estilo padrão do PowerPoint (faixas azuis): o visual é todo explícito nas células
    tbl_pr = tabela._tbl.tblPr
    for atributo in ("firstRow", "bandRow"):
        tbl_pr.attrib.pop(atributo, None)
    for filho in list(tbl_pr):
        tbl_pr.remove(filho)
    for i, (_, cabecalho, largura_coluna) in enumerate(COLUNAS):
        tabela.columns[i].width = Emu(largura_coluna)
    for linha in tabela.rows:
        linha.height = Emu(ALTURA_LINHA)
    for i, (chave, cabecalho, _) in enumerate(COLUNAS):
        _celula(tabela.cell(0, i), cabecalho, True, False, chave == "num")
        _celula(tabela.cell(1, i), "1" if chave == "num" else "Ação do plano", False, chave == "num", chave == "num")
    quadro.name = "Tabela do plano de ação"
    ap.definir_texto_alternativo(quadro, "campo:tabela")
    return quadro


def _linha_do_link(slide):
    caixa = slide.shapes.add_textbox(Emu(ESQUERDA), Emu(TOPO_LINK), Emu(sum(c[2] for c in COLUNAS)), Emu(260000))
    caixa.name = "Link do documento detalhado"
    tf = caixa.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    aqui = p.add_run()
    aqui.text = "Clique aqui"
    resto = p.add_run()
    resto.text = " para acessar o documento detalhado de cada ação"
    for r in (aqui, resto):
        r.font.name = FONTE
        r.font.size = Pt(10)
    aqui.font.underline = True
    aqui.font.color.theme_color = MSO_THEME_COLOR.HYPERLINK
    resto.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    ap.definir_texto_alternativo(caixa, "campo:link")
    return caixa


def adicionar(molde: Path, saida: Optional[Path] = None) -> None:
    prs = Presentation(molde)
    for slide in list(prs.slides):
        if ap.tipo_do_slide(slide) == "tabela_plano":
            ap.remover_slide(prs, slide)
    modelos = {ap.tipo_do_slide(s): s for s in prs.slides}
    novo = ap.duplicar_slide(prs, modelos["analises_2_colunas"])
    ap.marcar_tipo(novo, "tabela_plano")
    arvore = novo.shapes._spTree
    for nome, forma in ap.campos(novo).items():  # só o fundo interessa do slide-base
        arvore.remove(forma._element)
    _tabela(novo)
    _linha_do_link(novo)
    destino = saida or molde
    destino.parent.mkdir(parents=True, exist_ok=True)
    prs.save(destino)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Acrescenta o slide-modelo tabela_plano ao molde.")
    p.add_argument("--molde", required=True, type=Path)
    p.add_argument("--saida", type=Path)
    a = p.parse_args(argv)
    adicionar(a.molde, a.saida)
    print(f"Slide-modelo tabela_plano salvo em {a.saida or a.molde}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
