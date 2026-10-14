#!/usr/bin/env python3
"""
scripts/adicionar_modelo_desafio.py: acrescenta ao molde da apresentação o
slide-modelo "desafio" (problema e hipóteses à esquerda; soluções e impacto à
direita), derivado do "analises_2_colunas" com o título do "bullets". Idempotente:
um desafio já existente é substituído. Também chamado no fim de
preparar_molde_apresentacao.py, para o molde regenerado já sair com ele.

    python3 scripts/adicionar_modelo_desafio.py --molde .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
"""

from __future__ import annotations

import argparse
import copy
import sys
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.oxml.ns import qn

import apresentacao_pptx as ap


def adicionar(molde: Path, saida: Optional[Path] = None) -> None:
    prs = Presentation(molde)
    for slide in list(prs.slides):
        if ap.tipo_do_slide(slide) == "desafio":
            ap.remover_slide(prs, slide)
    modelos = {ap.tipo_do_slide(s): s for s in prs.slides}
    base = modelos["analises_2_colunas"]
    titulo_bullets = ap.campos(modelos["bullets"])["titulo"]

    novo = ap.duplicar_slide(prs, base)
    ap.marcar_tipo(novo, "desafio")
    copia = copy.deepcopy(titulo_bullets._element)
    proximo_id = max(sh.shape_id for sh in novo.shapes) + 1
    copia.find(".//" + qn("p:cNvPr")).set("id", str(proximo_id))
    novo.shapes._spTree.append(copia)

    c = ap.campos(novo)
    # o título do "bullets" ocupa o topo onde o "analises_2_colunas" já tem os blocos: desce os blocos
    for lado in ("esquerda", "direita"):
        c[lado].top += c["titulo"].height
    ap.preencher_texto(c["titulo"], "Desafio: **tema**")
    ap.preencher_bloco(c["esquerda"], "**Problema:** dado do problema", ["Hipótese 1", "Hipótese 2"])
    ap.preencher_bloco(c["direita"], "**Impacto:** R$ ou %", ["1. Solução 1", "2. Solução 2"])
    destino = saida or molde
    destino.parent.mkdir(parents=True, exist_ok=True)
    prs.save(destino)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Acrescenta o slide-modelo desafio ao molde.")
    p.add_argument("--molde", required=True, type=Path)
    p.add_argument("--saida", type=Path)
    a = p.parse_args(argv)
    adicionar(a.molde, a.saida)
    print(f"Slide-modelo desafio salvo em {a.saida or a.molde}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
