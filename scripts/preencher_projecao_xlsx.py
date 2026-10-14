#!/usr/bin/env python3
"""
scripts/preencher_projecao_xlsx.py — preenche o modelo de Projeção de Cenários.

Pega o arquivo-modelo `.claude/skills/_shared/[MODELO] Projeção de Cenários.xlsx`
e escreve nele os KPIs Influenciadores já aprovados na Skill 06, deixando as
colunas de resultado (Sessões totais / Vendas / Receita) como estão — elas são
FÓRMULAS no modelo e recalculam sozinhas quando o cliente abre o arquivo no
Excel/Google Sheets. O script só escreve os campos de INPUT; nunca sobrescreve
uma fórmula.

## Meses são POSICIONAIS (M-1 … M-12), não meses de calendário

O modelo NÃO fixa Jan→Dez nem Jun→Mai. A coluna "Mês" corre de `Mês m-12`
(linha 2 = mês mais ANTIGO da janela) até `Mês m-1` (linha 13 = mês mais
RECENTE). Qual mês real cada posição representa depende inteiramente da coluna
de mês da planilha `dados/historico-mensal.xlsx` usada na Skill 03 — que varia
de planejamento para planejamento (pode ser m-1…m-12 relativo, ou meses
absolutos de um período de planejamento). Por isso este script trabalha por
POSIÇÃO, casando cada entrada das listas às linhas na ordem mais antigo→recente.

Quem estabelece a ordem correta é o subagente `analista-dados`, lendo a coluna
de mês da Skill 03. Este script não adivinha calendário.

## Fluxo (chamado pelo `analista-dados`, ao final da Skill 06)

    python scripts/preencher_projecao_xlsx.py \
        --modelo ".claude/skills/_shared/[MODELO] Projeção de Cenários.xlsx" \
        --input cenarios.json \
        --output "clientes/<prospect>/entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx"

## Estrutura do JSON de entrada

Cada cenário é uma LISTA ORDENADA de 12 meses, do mais ANTIGO (m-12, linha 2)
ao mais RECENTE (m-1, linha 13). `taxa_conversao` e `pct_sessoes_pagas` são
FRAÇÕES (ex.: 0.024 e 0.65).

    {
      "prospect": "Nome do Prospect",
      "meses": ["Mês m-12", ..., "Mês m-1"],   # OPCIONAL — rótulos p/ a coluna A.
                                                #   Se omitido, mantém os do modelo.
      "periodo_anterior": [ {kpis}, ... x12 ],  # histórico da Skill 03, mesma ordem
      "realista":         [ {kpis}, ... x12 ],  # aba "Meta"
      "pessimista":       [ {kpis}, ... x12 ],
      "otimista":         [ {kpis}, ... x12 ]
    }

    kpis = {investimento, ticket_medio, taxa_conversao,
            custo_por_sessao_paga, pct_sessoes_pagas}

A aba de comparação alinha, na MESMA linha, o "Novo período" (Realista) contra
o "Período anterior" (histórico) — comparação posição a posição (sazonalmente
equivalente).
"""

from __future__ import annotations

import argparse
import json
import sys

import openpyxl
from openpyxl.utils import column_index_from_string

KPI_KEYS = [
    "investimento",
    "ticket_medio",
    "taxa_conversao",
    "custo_por_sessao_paga",
    "pct_sessoes_pagas",
]

# Colunas de INPUT por tipo de aba. As abas de cenário (Meta/Pessimista/
# Otimista) compartilham o mesmo layout B–F.
COLUNAS_CENARIO = {
    "investimento": "B",
    "ticket_medio": "C",
    "taxa_conversao": "D",
    "custo_por_sessao_paga": "E",
    "pct_sessoes_pagas": "F",
}
# Aba de comparação: pares "Novo período" (Realista) e "Período anterior".
COLUNAS_COMPARACAO_NOVO = {
    "investimento": "B",
    "ticket_medio": "E",
    "taxa_conversao": "H",
    "custo_por_sessao_paga": "K",
    "pct_sessoes_pagas": "N",
}
COLUNAS_COMPARACAO_ANTERIOR = {
    "investimento": "C",
    "ticket_medio": "F",
    "taxa_conversao": "I",
    "custo_por_sessao_paga": "L",
    "pct_sessoes_pagas": "O",
}

PRIMEIRA_LINHA_DADOS = 2


class PreenchimentoError(Exception):
    """Erro de validação do preenchimento — aborta sem gravar arquivo."""


def _linhas_de_dados(ws) -> list[int]:
    """Linhas de mês da aba: da linha 2 até antes da linha 'TOTAL' (ou fim)."""
    linhas: list[int] = []
    linha = PRIMEIRA_LINHA_DADOS
    while linha <= ws.max_row:
        rotulo = ws.cell(row=linha, column=1).value
        if rotulo is not None and str(rotulo).strip().lower() == "total":
            break
        # Só conta como linha de dados se houver rótulo de mês.
        if rotulo is None or str(rotulo).strip() == "":
            break
        linhas.append(linha)
        linha += 1
    return linhas


def _validar_bloco(escopo: str, lista, n_esperado: int) -> None:
    if not isinstance(lista, list):
        raise PreenchimentoError(f"[{escopo}] precisa ser uma LISTA ordenada de meses.")
    if len(lista) != n_esperado:
        raise PreenchimentoError(
            f"[{escopo}] tem {len(lista)} meses; o modelo tem {n_esperado} "
            f"linhas de dados. Devem bater exatamente."
        )
    for i, kpis in enumerate(lista):
        pos = i + 1  # posição 1 = mais antigo (linha 2)
        faltando = [k for k in KPI_KEYS if k not in kpis]
        if faltando:
            raise PreenchimentoError(f"[{escopo}] posição {pos}: faltam KPIs: {', '.join(faltando)}")
        conv, pct = kpis["taxa_conversao"], kpis["pct_sessoes_pagas"]
        if not (0 < conv < 1):
            raise PreenchimentoError(
                f"[{escopo}] posição {pos}: taxa_conversao deve ser fração "
                f"(ex.: 0.024), recebido {conv!r}."
            )
        if not (0 < pct <= 1):
            raise PreenchimentoError(
                f"[{escopo}] posição {pos}: pct_sessoes_pagas deve ser fração "
                f"(ex.: 0.65), recebido {pct!r}."
            )
        if kpis["custo_por_sessao_paga"] <= 0:
            raise PreenchimentoError(
                f"[{escopo}] posição {pos}: custo_por_sessao_paga deve ser positivo."
            )


def _escrever_bloco(ws, lista, colunas: dict[str, str], linhas: list[int]) -> int:
    """Escreve os KPIs de cada mês por POSIÇÃO (lista[i] → linhas[i]).

    Preserva o formato numérico do modelo copiando o formato da linha 2 da
    mesma coluna. Devolve quantas células foram escritas.
    """
    formatos = {
        kpi: ws.cell(row=PRIMEIRA_LINHA_DADOS, column=column_index_from_string(col)).number_format
        for kpi, col in colunas.items()
    }
    escritas = 0
    for i, kpis in enumerate(lista):
        linha = linhas[i]
        for kpi, col in colunas.items():
            cel = ws.cell(row=linha, column=column_index_from_string(col))
            cel.value = kpis[kpi]
            cel.number_format = formatos[kpi]
            escritas += 1
    return escritas


def _escrever_rotulos(ws, meses: list[str], linhas: list[int]) -> None:
    """Escreve os rótulos de mês na coluna A, preservando o resto da linha."""
    for i, rotulo in enumerate(meses):
        ws.cell(row=linhas[i], column=1).value = rotulo


def _aba_por_titulo(wb, *prefixos: str):
    alvos = [p.strip().lower() for p in prefixos]
    for ws in wb.worksheets:
        t = ws.title.strip().lower()
        if any(t == a or t.startswith(a) for a in alvos):
            return ws
    raise PreenchimentoError(
        f"Não encontrei aba começando por {prefixos}. "
        f"Abas: {[ws.title for ws in wb.worksheets]}"
    )


def preencher(modelo: str, dados: dict, saida: str) -> dict:
    obrigatorios = ["periodo_anterior", "realista", "pessimista", "otimista"]
    faltando = [k for k in obrigatorios if k not in dados]
    if faltando:
        raise PreenchimentoError(f"JSON sem as chaves: {', '.join(faltando)}")

    wb = openpyxl.load_workbook(modelo)  # data_only=False → preserva fórmulas

    ws_comp = _aba_por_titulo(wb, "comparação", "comparacao")
    ws_meta = _aba_por_titulo(wb, "meta")
    ws_pess = _aba_por_titulo(wb, "pessimista")
    ws_otim = _aba_por_titulo(wb, "otimista")

    # As quatro abas devem ter o mesmo número de linhas de dados.
    linhas = _linhas_de_dados(ws_comp)
    n = len(linhas)
    if n == 0:
        raise PreenchimentoError("O modelo não tem linhas de mês na aba de comparação.")
    for ws in (ws_meta, ws_pess, ws_otim):
        if len(_linhas_de_dados(ws)) != n:
            raise PreenchimentoError(
                f"A aba {ws.title!r} tem número de linhas de mês diferente da "
                f"aba de comparação ({n}). Modelo inconsistente."
            )

    for escopo in obrigatorios:
        _validar_bloco(escopo, dados[escopo], n)

    meses = dados.get("meses")
    if meses is not None:
        if not isinstance(meses, list) or len(meses) != n:
            raise PreenchimentoError(
                f"'meses' precisa ser uma lista de {n} rótulos (uma por linha)."
            )
        for ws in (ws_comp, ws_meta, ws_pess, ws_otim):
            _escrever_rotulos(ws, meses, _linhas_de_dados(ws))

    total = 0
    # Comparação: Novo período = Realista; Período anterior = histórico (Skill 03).
    total += _escrever_bloco(ws_comp, dados["realista"], COLUNAS_COMPARACAO_NOVO, linhas)
    total += _escrever_bloco(ws_comp, dados["periodo_anterior"], COLUNAS_COMPARACAO_ANTERIOR, linhas)
    # Abas de cenário (só INPUT B–F; resultado é fórmula).
    total += _escrever_bloco(ws_meta, dados["realista"], COLUNAS_CENARIO, _linhas_de_dados(ws_meta))
    total += _escrever_bloco(ws_pess, dados["pessimista"], COLUNAS_CENARIO, _linhas_de_dados(ws_pess))
    total += _escrever_bloco(ws_otim, dados["otimista"], COLUNAS_CENARIO, _linhas_de_dados(ws_otim))

    wb.save(saida)
    return {
        "output": saida,
        "prospect": dados.get("prospect"),
        "linhas_de_mes": n,
        "celulas_escritas": total,
        "rotulos_reescritos": meses is not None,
        "abas": [ws_comp.title, ws_meta.title, ws_pess.title, ws_otim.title],
        "observacao": (
            "Ordem das listas: mais antigo (m-12, linha 2) → mais recente "
            "(m-1). Resultado (Sessões/Vendas/Receita) é fórmula e recalcula "
            "ao abrir no Excel/Google Sheets."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Preenche o modelo de Projeção de Cenários.")
    parser.add_argument("--modelo", required=True, help="Caminho do xlsx-modelo em _shared/.")
    parser.add_argument("--input", required=True, help="JSON com periodo_anterior + 3 cenários.")
    parser.add_argument("--output", required=True, help="Caminho do xlsx preenchido a salvar.")
    args = parser.parse_args()

    try:
        with open(args.input, encoding="utf-8") as f:
            dados = json.load(f)
        resumo = preencher(args.modelo, dados, args.output)
    except (PreenchimentoError, ValueError, KeyError) as exc:
        print(json.dumps({"erro": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    json.dump(resumo, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
