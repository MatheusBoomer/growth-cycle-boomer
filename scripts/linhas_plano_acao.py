#!/usr/bin/env python3
"""
scripts/linhas_plano_acao.py: lê a tabela-resumo do plano de ação aprovado
(plano-de-acao-estrategico.docx, Skill 08) e entrega os slides "tabela_plano" do
roteiro da apresentação, já divididos em páginas, para ninguém copiar ação na mão.

    python3 scripts/linhas_plano_acao.py --prospect clientes/<slug> [--link <url>] [--por-slide 15]

Imprime a lista JSON de slides (cole no roteiro, depois da divisória "Plano de
ação"). A ordem é a do docx; cada slide leva `linhas` e, com --link, o `link`
do documento detalhado.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Optional

from docx import Document

from adicionar_modelo_tabela_plano import COLUNAS, TAMANHO_FONTE

CAMINHO_DOCX = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx"
MAX_LINHAS_POR_SLIDE = 16
# Medido na prévia (LibreOffice, Montserrat 9 pt): cada linha da tabela gasta 17 de altura mais 11 por linha de texto;
# a área útil do slide, entre o topo e o link, comporta 500 dessas unidades (cabeçalho incluso).
ALTURA_BASE_LINHA = 17
ALTURA_LINHA_DE_TEXTO = 11
ALTURA_UTIL = 500
LARGURA_MEDIA_CARACTERE = 0.52  # em múltiplos do tamanho da fonte
# cabeçalho da coluna no docx (sem acento e minúsculo) -> chave da linha do roteiro
CABECALHOS = {"#": "num", "acao": "acao", "frente": "frente", "horizonte": "horizonte", "quando": "quando", "por quem": "quem", "quem": "quem"}


class ErroPlano(Exception):
    """Mensagem pronta para o analista, em português."""


def _normalizar(texto: str) -> str:
    return texto.strip().lower().replace("ç", "c").replace("ã", "a")


def ler_tabela_docx(caminho: Path) -> List[Dict[str, str]]:
    """Linhas da tabela-resumo (a que tem as colunas Ação e Horizonte), na ordem do documento."""
    if not caminho.is_file():
        raise ErroPlano(f"Plano de ação aprovado não encontrado: {caminho}")
    for tabela in Document(str(caminho)).tables:
        chaves = [CABECALHOS.get(_normalizar(c.text)) for c in tabela.rows[0].cells]
        if "acao" in chaves and "horizonte" in chaves:
            break
    else:
        raise ErroPlano("O .docx do plano de ação não tem a tabela-resumo (colunas Ação e Horizonte).")
    linhas = []
    for linha in tabela.rows[1:]:
        valores = {chave: " ".join(c.text.split()) for chave, c in zip(chaves, linha.cells) if chave}
        if valores.get("acao"):
            valores.setdefault("num", str(len(linhas) + 1))
            linhas.append({k: valores.get(k, "") for k in ("num", "acao", "horizonte", "quando", "quem", "frente")})
    if not linhas:
        raise ErroPlano("A tabela-resumo do plano de ação está vazia.")
    return linhas


def _linhas_de_texto(linha: Dict[str, str]) -> int:
    """Quantas linhas de texto a linha da tabela ocupa, contando a quebra dentro de cada célula."""
    maior = 1
    for chave, _, largura in COLUNAS:
        texto = str(linha.get(chave, ""))
        por_linha = max(1, int((largura / 12700 - 8.5) / (LARGURA_MEDIA_CARACTERE * TAMANHO_FONTE)))
        maior = max(maior, math.ceil(len(texto) / por_linha) if texto else 1)
    return maior


def altura_estimada(linhas: List[Dict[str, str]]) -> int:
    """Altura estimada da tabela (cabeçalho + linhas), na unidade de ALTURA_UTIL."""
    cabecalho = ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO
    return cabecalho + sum(ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO * _linhas_de_texto(l) for l in linhas)


def slides_do_roteiro(linhas: List[Dict[str, str]], link: Optional[str] = None, por_slide: Optional[int] = None) -> List[dict]:
    """Divide em slides na ordem do plano. Sem `por_slide`, cada slide leva o que cabe (texto longo gasta mais espaço)."""
    paginas: List[List[Dict[str, str]]] = []
    for linha in linhas:
        pagina = paginas[-1] if paginas else None
        cabe = pagina is not None and (
            len(pagina) < por_slide if por_slide
            else len(pagina) < MAX_LINHAS_POR_SLIDE and altura_estimada(pagina + [linha]) <= ALTURA_UTIL
        )
        if cabe:
            pagina.append(linha)
        else:
            paginas.append([linha])
    slides = []
    for pagina in paginas:
        slide = {"tipo": "tabela_plano", "linhas": pagina}
        if link:
            slide["link"] = link
        slides.append(slide)
    return slides


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Slides tabela_plano do roteiro, a partir do plano de ação aprovado.")
    p.add_argument("--prospect", required=True, type=Path)
    p.add_argument("--link", help="Endereço (https://…) do documento detalhado do plano de ação")
    p.add_argument("--por-slide", type=int, help="Fixa o número de ações por slide (sem isso, divide pelo tamanho do texto)")
    a = p.parse_args(argv)
    try:
        linhas = ler_tabela_docx(a.prospect / CAMINHO_DOCX)
    except ErroPlano as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    print(json.dumps(slides_do_roteiro(linhas, a.link, a.por_slide), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
