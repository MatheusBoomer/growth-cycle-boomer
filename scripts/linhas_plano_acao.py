#!/usr/bin/env python3
"""
scripts/linhas_plano_acao.py: lê o plano de ação aprovado
(plano-de-acao-estrategico.json, Skill 08) e entrega os slides "tabela_plano" do
roteiro da apresentação, já divididos em páginas, para ninguém copiar ação na mão.

    python3 scripts/linhas_plano_acao.py --prospect clientes/<slug> [--link <url>] [--por-slide 15]

Imprime a lista JSON de slides (cole no roteiro, depois da divisória "Plano de
ação"). Plano em fases: a ordem é a do documento (fase e, dentro dela, número da
ação); plano só com horizontes: a cronológica (início da ação). Cada slide leva
`linhas` e, com --link, o `link` do documento detalhado.

Prospect antigo, só com o .docx aprovado (formato v1, sem o .json): a tabela-resumo
do .docx é lida no lugar do JSON, com uma nota no erro padrão.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from docx import Document

import plano_acao_comum as comum
from adicionar_modelo_tabela_plano import COLUNAS, TAMANHO_FONTE

CAMINHO_PLANO = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json"
CAMINHO_DOCX = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx"
NOTA_DOCX_LEGADO = "plano lido do .docx (formato antigo)"
MAX_LINHAS_POR_SLIDE = 16
# Medido na prévia (LibreOffice, Montserrat 9 pt): cada linha da tabela gasta 17 de altura mais 11 por linha de texto;
# a área útil do slide, entre o topo e o link, comporta 480 dessas unidades (cabeçalho incluso).
ALTURA_BASE_LINHA = 17
ALTURA_LINHA_DE_TEXTO = 11
ALTURA_UTIL = 480
LARGURA_MEDIA_CARACTERE = 0.58  # em múltiplos do tamanho da fonte
# cabeçalho da coluna no docx antigo (sem acento e minúsculo) -> chave da linha do roteiro
CABECALHOS = {"#": "num", "acao": "acao", "frente": "frente", "horizonte": "horizonte", "quando": "quando", "por quem": "quem", "quem": "quem"}


class ErroPlano(Exception):
    """Mensagem pronta para o analista, em português."""


def _pares_na_ordem_do_documento(dados: dict) -> List[tuple]:
    """(horizonte, ação) por fase e, dentro dela, por número; ação fora de toda fase vai ao fim, por número."""
    por_numero = {a["numero"]: (h, a) for h, a in comum.acoes(dados)}
    pares, usados = [], set()
    for fase in comum.fases(dados):
        for numero in sorted(fase.get("acoes") or []):
            if numero in por_numero and numero not in usados:
                pares.append(por_numero[numero])
                usados.add(numero)
    pares += [por_numero[n] for n in sorted(por_numero) if n not in usados]
    return pares


def ler_plano(caminho: Path) -> List[Dict[str, str]]:
    """Linhas do plano aprovado (JSON da Skill 08): por fase e número quando o plano tem fases,
    senão em ordem cronológica de início."""
    if not caminho.is_file():
        raise ErroPlano(f"Plano de ação aprovado não encontrado: {caminho}")
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        ano_base = comum.ler_data(dados.get("data_referencia"), "data_referencia").year
        pares = _pares_na_ordem_do_documento(dados) if comum.fases(dados) else comum.acoes_cronologicas_com_horizonte(dados)
        linhas = [
            {
                "num": str(a["numero"]),
                "acao": " ".join(str(a["acao"]).split()),
                "horizonte": horizonte,
                "quando": comum.quando_curto(a, ano_base),
                "quem": str(a.get("dono", "")).rsplit(" · ", 1)[0].strip(),
                "frente": a.get("frente", ""),
            }
            for horizonte, a in pares
        ]
    except comum.ErroPlano as e:
        raise ErroPlano(f"Plano de ação aprovado inválido: {e}") from e
    except KeyError as e:
        raise ErroPlano(f"Plano de ação aprovado ilegível ({caminho.name}): falta o campo {e}.") from e
    except (OSError, ValueError, AttributeError, TypeError) as e:
        raise ErroPlano(f"Plano de ação aprovado ilegível ({caminho.name}): {e}") from e
    if not linhas:
        raise ErroPlano("O plano de ação aprovado está sem ações.")
    return linhas


def _normalizar(texto: str) -> str:
    return texto.strip().lower().replace("ç", "c").replace("ã", "a")


def ler_tabela_docx_legado(caminho: Path) -> List[Dict[str, str]]:
    """Linhas da tabela-resumo do .docx antigo (colunas Ação e Horizonte), na ordem do documento."""
    try:
        tabelas = Document(str(caminho)).tables
    except Exception as e:  # docx corrompido: python-docx levanta tipos variados
        raise ErroPlano(f"O .docx do plano de ação não pôde ser aberto ({caminho.name}): {e}") from e
    for tabela in tabelas:
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


def ler_linhas(pasta_prospect: Path) -> Tuple[List[Dict[str, str]], Optional[str]]:
    """(linhas, nota) do plano aprovado do prospect: o JSON da Skill 08 ou, na falta dele, a tabela-resumo
    do .docx antigo (e então `nota` avisa). Sem nenhum dos dois, ErroPlano."""
    json_plano = pasta_prospect / CAMINHO_PLANO
    docx = pasta_prospect / CAMINHO_DOCX
    if json_plano.is_file():
        return ler_plano(json_plano), None
    if docx.is_file():
        return ler_tabela_docx_legado(docx), NOTA_DOCX_LEGADO
    raise ErroPlano(f"Plano de ação aprovado não encontrado: {json_plano}")


def _linhas_da_celula(texto: str, por_linha: int) -> int:
    """Linhas que o texto ocupa na célula, quebrando por palavra (palavra maior que a linha é partida)."""
    linhas, atual = 1, 0
    for palavra in texto.split():
        tam = len(palavra)
        if atual:
            if atual + 1 + tam <= por_linha:
                atual += 1 + tam
                continue
            linhas += 1
        while tam > por_linha:
            linhas += 1
            tam -= por_linha
        atual = tam
    return linhas


def _linhas_de_texto(linha: Dict[str, str]) -> int:
    """Quantas linhas de texto a linha da tabela ocupa, contando a quebra por palavra dentro de cada célula."""
    maior = 1
    for chave, _, largura in COLUNAS:
        por_linha = max(1, int((largura / 12700 - 8.5) / (LARGURA_MEDIA_CARACTERE * TAMANHO_FONTE)))
        maior = max(maior, _linhas_da_celula(str(linha.get(chave, "")), por_linha))
    return maior


def altura_estimada(linhas: List[Dict[str, str]]) -> int:
    """Altura estimada da tabela (cabeçalho + linhas), na unidade de ALTURA_UTIL."""
    cabecalho = ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO
    return cabecalho + sum(ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO * _linhas_de_texto(l) for l in linhas)


def _cabe(pagina: List[Dict[str, str]]) -> bool:
    return len(pagina) == 1 or (len(pagina) <= MAX_LINHAS_POR_SLIDE and altura_estimada(pagina) <= ALTURA_UTIL)


def _paginas_gulosas(linhas: List[Dict[str, str]]) -> List[List[Dict[str, str]]]:
    paginas: List[List[Dict[str, str]]] = []
    for linha in linhas:
        if paginas and _cabe(paginas[-1] + [linha]):
            paginas[-1].append(linha)
        else:
            paginas.append([linha])
    return paginas


def _paginas_equilibradas(linhas: List[Dict[str, str]]) -> List[List[Dict[str, str]]]:
    """O menor número de páginas que cabe (pelo enchimento guloso), com as linhas distribuídas do modo mais
    parelho: minimiza a soma dos quadrados das alturas, mantendo cada página dentro do limite.

    A altura de cada linha é calculada uma vez e as páginas candidatas saem de somas acumuladas; como uma
    página maior nunca é mais baixa, a busca de cada página para na primeira que não cabe."""
    n = len(_paginas_gulosas(linhas))
    total = len(linhas)
    cabecalho = ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO
    acumulado = [0]
    for linha in linhas:
        acumulado.append(acumulado[-1] + ALTURA_BASE_LINHA + ALTURA_LINHA_DE_TEXTO * _linhas_de_texto(linha))
    infinito = float("inf")
    custo = [[infinito] * (total + 1) for _ in range(n + 1)]
    inicio = [[0] * (total + 1) for _ in range(n + 1)]
    custo[0][0] = 0.0
    for k in range(1, n + 1):
        for j in range(k, total + 1):
            for i in range(j - 1, k - 2, -1):
                altura = cabecalho + acumulado[j] - acumulado[i]
                if j - i > 1 and (j - i > MAX_LINHAS_POR_SLIDE or altura > ALTURA_UTIL):
                    break
                if custo[k - 1][i] == infinito:
                    continue
                c = custo[k - 1][i] + altura ** 2
                if c <= custo[k][j]:  # `<=` na ordem decrescente fica com o menor `i` entre empates
                    custo[k][j], inicio[k][j] = c, i
    if custo[n][total] == infinito:  # não deve acontecer: o enchimento guloso já é uma solução
        return _paginas_gulosas(linhas)
    paginas, j = [], total
    for k in range(n, 0, -1):
        i = inicio[k][j]
        paginas.append(linhas[i:j])
        j = i
    return paginas[::-1]


def slides_do_roteiro(linhas: List[Dict[str, str]], link: Optional[str] = None, por_slide: Optional[int] = None) -> List[dict]:
    """Divide em slides na ordem do plano. Sem `por_slide`, usa o menor número de slides que cabe (texto longo
    gasta mais espaço) e reparte as linhas por igual entre eles; com `por_slide`, enche cada slide até esse número."""
    if por_slide:
        paginas = [linhas[i:i + por_slide] for i in range(0, len(linhas), por_slide)]
    else:
        paginas = _paginas_equilibradas(linhas)
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
        linhas, nota = ler_linhas(a.prospect)
    except ErroPlano as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    if nota:
        print(f"NOTA: {nota}.", file=sys.stderr)
    print(json.dumps(slides_do_roteiro(linhas, a.link, a.por_slide), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
