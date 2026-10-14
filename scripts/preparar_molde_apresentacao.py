#!/usr/bin/env python3
"""
scripts/preparar_molde_apresentacao.py: uso único. Transforma o deck de
referência da agência (exportado do Google Slides como .pptx) no molde da
apresentação final: um slide por tipo, campos marcados por texto alternativo,
tipo nas anotações, conteúdo do prospect trocado por textos de exemplo e
imagens por um retângulo neutro. O deck original nunca vai para o git.

    python3 scripts/preparar_molde_apresentacao.py --original <deck.pptx> --saida .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path
from typing import Dict, List

from PIL import Image
from pptx import Presentation
from pptx.oxml.ns import qn

import adicionar_modelo_desafio
import apresentacao_pptx as ap

# página do deck original (1-based) -> tipo; a ordem aqui é a ordem dos slides no molde
MODELOS: Dict[int, str] = {
    1: "capa", 2: "jornada", 3: "divisoria", 4: "grafico", 18: "tabela_lateral", 55: "imagem_larga",
    7: "analises_2_colunas", 27: "bullets", 26: "cartoes", 33: "benchmark", 61: "obrigado",
}

# (página, shape_id) -> campo
CAMPOS: Dict[tuple, str] = {
    (3, 78): "titulo", (3, 80): "numero",
    (4, 85): "titulo", (4, 88): "subtitulo", (4, 87): "conclusoes", (4, 89): "imagem",
    (18, 211): "titulo", (18, 212): "subtitulo", (18, 214): "conclusoes", (18, 213): "imagem",
    (55, 536): "titulo", (55, 537): "texto", (55, 538): "imagem",
    (7, 114): "esquerda", (7, 112): "direita",
    (27, 292): "titulo", (27, 293): "subtitulo", (27, 290): "itens",
    (26, 281): "titulo", (26, 282): "subtitulo", (26, 283): "cartao_1", (26, 284): "cartao_2", (26, 285): "cartao_3",
    (33, 338): "titulo", (33, 339): "subtitulo", (33, 340): "concorrente", (33, 341): "conclusoes",
    (33, 342): "link", (33, 343): "imagem_1", (33, 344): "imagem_2", (33, 345): "imagem_3",
}

EXEMPLOS_TEXTO: Dict[str, str] = {
    "titulo": "Título da seção",
    "subtitulo": "**Destaque** do subtítulo",
    "numero": "01.",
    "texto": "Texto explicativo do slide.",
    "concorrente": "Concorrente",
    "link": "Biblioteca de Anúncios",
    "cartao_1": "Pilar 1",
    "cartao_2": "Pilar 2",
    "cartao_3": "Pilar 3",
}
LINK_NEUTRO = "https://www.facebook.com/ads/library/"

EXEMPLOS_LISTA: Dict[str, List[str]] = {
    "conclusoes": ["Conclusão 1", "Conclusão 2"],
    "itens": ["Item 1", "Item 2", "Item 3"],
}


def _neutra(pasta: Path, largura: int, altura: int) -> Path:
    caminho = pasta / f"neutra-{largura}x{altura}.png"
    Image.new("RGB", (max(largura, 1), max(altura, 1)), (225, 228, 235)).save(caminho)
    return caminho


def preparar(original: Path, saida: Path) -> None:
    prs = Presentation(original)
    slides = list(prs.slides)
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        modelos = []
        for pagina, tipo in MODELOS.items():
            slide = slides[pagina - 1]
            ap.marcar_tipo(slide, tipo)
            for shape in slide.shapes:
                campo = CAMPOS.get((pagina, shape.shape_id))
                if campo is None:
                    continue
                ap.definir_texto_alternativo(shape, f"campo:{campo}")
                if campo.startswith("imagem"):
                    proporcao = shape.width / shape.height
                    ap.trocar_imagem(slide, shape, _neutra(pasta, int(400 * proporcao), 400))
                elif campo in EXEMPLOS_LISTA:
                    ap.preencher_lista(shape, EXEMPLOS_LISTA[campo])
                elif campo in ("esquerda", "direita"):
                    ap.preencher_bloco(shape, "Análises sobre o **tema**", ["Análise 1", "Análise 2"])
                else:
                    ap.preencher_texto(shape, EXEMPLOS_TEXTO[campo])
                    if campo == "link":
                        ap.definir_link(shape, LINK_NEUTRO)
            if tipo == "capa":
                # Só o nome do prospect (2º parágrafo) vira token: o título mistura fontes e fica intacto.
                for shape in slide.shapes:
                    if shape.has_text_frame and len(shape.text_frame.paragraphs) > 1:
                        textos = list(shape.text_frame.paragraphs[1]._p.iter(qn("a:t")))
                        if textos:
                            textos[0].text = "{{prospect}}"
                            for t in textos[1:]:
                                t.text = ""
            # Links do deck original (Drive, buscas na Biblioteca) e títulos internos das formas
            # (ex.: nome do vídeo do concorrente) não ficam no molde: só o campo link, neutro.
            for shape in slide.shapes:
                cnvpr = shape._element.find(".//" + qn("p:cNvPr"))
                if cnvpr is not None:
                    cnvpr.attrib.pop("title", None)
                    for link in cnvpr.findall(qn("a:hlinkClick")):
                        rid = link.get(qn("r:id"))
                        cnvpr.remove(link)
                        if rid:
                            slide.part.drop_rel(rid)
                if shape.has_text_frame and ap.texto_alternativo(shape) != "campo:link":
                    for paragrafo in shape.text_frame.paragraphs:
                        for run in paragrafo.runs:
                            if run.hyperlink.address:
                                run.hyperlink.address = None
            modelos.append(slide)
        for slide in slides:
            if slide not in modelos:
                ap.remover_slide(prs, slide)
        # reordena na ordem de MODELOS
        lista = prs.slides._sldIdLst
        ids = {prs.part.related_part(s.rId): s for s in lista}
        for slide in modelos:
            el = ids[slide.part]
            lista.remove(el)
            lista.append(el)
        # Autores e comentários do Google Slides (nomes da equipe) não vão para o deck do prospect.
        for parte in [prs.part] + [s.part for s in prs.slides]:
            for rid, rel in list(parte.rels.items()):
                if rel.reltype.endswith("/commentAuthors") or rel.reltype.endswith("/comments"):
                    parte.drop_rel(rid)
        saida.parent.mkdir(parents=True, exist_ok=True)
        prs.save(saida)
    adicionar_modelo_desafio.adicionar(saida)


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--original", required=True, type=Path)
    p.add_argument("--saida", required=True, type=Path)
    a = p.parse_args(argv)
    preparar(a.original, a.saida)
    print(f"Molde salvo em {a.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
