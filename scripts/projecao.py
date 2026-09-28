#!/usr/bin/env python3
"""
scripts/projecao.py — motor de projeção do planejamento estratégico.

Implementa em código as duas regras mais frágeis do processo manual original:

1. Distribuição mensal NUNCA flat — a meta anual é quebrada mês a mês usando
   o peso histórico real de cada mês, não uma divisão igual por 12.
2. Cadeia de KPIs Influenciadores -> KPIs Resultado — confirmada contra dados
   reais de cliente (ver spec de design, seção 8):

       sessões_pagas  = investimento / custo_por_sessão_paga
       sessões_totais = sessões_pagas / %_sessões_pagas
       vendas         = sessões_totais * taxa_de_conversão
       receita        = vendas * ticket_médio

Uso típico (chamado pelo subagente `analista-dados`, não pelo analista
humano diretamente):

    python scripts/projecao.py distribuir --input historico.json
    python scripts/projecao.py projetar --input cenario.json

Os dois comandos leem um JSON de entrada e devolvem um JSON no stdout — o
subagente que chama este script decide o que fazer com o resultado (salvar
em arquivo, gerar gráfico, etc.).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from statistics import pstdev, mean

MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

# Se o desvio padrão dos pesos mensais, normalizado pela média, cair abaixo
# deste limiar, o histórico é considerado "artificialmente uniforme" e o
# script recusa a distribuição em vez de mascarar o problema.
LIMIAR_UNIFORMIDADE = 0.03

# Tolerância percentual aceita entre a soma da projeção e a meta anual.
TOLERANCIA_VALIDACAO = 0.01


class DistribuicaoFlatError(Exception):
    """Levantado quando o histórico de entrada é uniforme demais para
    sustentar uma distribuição sazonal com confiança."""


class ProjecaoInconsistenteError(Exception):
    """Levantado quando a soma mensal de um cenário não bate com a meta
    anual dentro da tolerância aceita."""


# ---------------------------------------------------------------------------
# 1. Distribuição sazonal (Prompt 5)
# ---------------------------------------------------------------------------

def distribuir_sazonalmente(meta_anual: float, historico_mensal: dict[str, float]) -> dict[str, float]:
    """Quebra `meta_anual` em 12 valores mensais, proporcionais ao peso
    histórico de cada mês em `historico_mensal` (mesmas chaves de MESES).

    Nunca retorna uma distribuição uniforme: se o histórico de entrada for
    uniforme demais, levanta DistribuicaoFlatError em vez de prosseguir.
    """
    _validar_meses(historico_mensal)

    total_historico = sum(historico_mensal.values())
    if total_historico <= 0:
        raise ValueError("Total do histórico precisa ser positivo para calcular pesos.")

    pesos = {mes: historico_mensal[mes] / total_historico for mes in MESES}

    media_peso = mean(pesos.values())
    desvio = pstdev(pesos.values())
    if media_peso > 0 and (desvio / media_peso) < LIMIAR_UNIFORMIDADE:
        raise DistribuicaoFlatError(
            "O histórico informado é uniforme demais (variação de peso "
            f"mensal de apenas {desvio / media_peso:.1%}). Confirme se os "
            "dados de entrada estão corretos antes de projetar — uma "
            "distribuição sazonal real quase nunca é assim tão uniforme."
        )

    distribuicao = {mes: round(meta_anual * pesos[mes], 2) for mes in MESES}

    # Ajusta o último mês para fechar exatamente o total anual, absorvendo
    # o erro de arredondamento acumulado dos 11 meses anteriores.
    soma_onze_meses = sum(distribuicao[m] for m in MESES[:-1])
    distribuicao[MESES[-1]] = round(meta_anual - soma_onze_meses, 2)

    return distribuicao


# ---------------------------------------------------------------------------
# 2. Cadeia de KPIs Influenciadores -> Resultado (Prompt 6)
# ---------------------------------------------------------------------------

@dataclass
class KPIsInfluenciadores:
    investimento: float
    ticket_medio: float
    taxa_conversao: float          # fração, ex.: 0.024 para 2,4%
    custo_por_sessao_paga: float
    pct_sessoes_pagas: float       # fração, ex.: 0.65 para 65%


@dataclass
class KPIsResultado:
    sessoes_pagas: float
    sessoes_totais: float
    vendas: float
    receita: float


def projetar_kpis_resultado(kpis: KPIsInfluenciadores) -> KPIsResultado:
    """Aplica a cadeia de cálculo confirmada contra dados reais de cliente."""
    if kpis.custo_por_sessao_paga <= 0:
        raise ValueError("custo_por_sessao_paga precisa ser positivo.")
    if not (0 < kpis.pct_sessoes_pagas <= 1):
        raise ValueError("pct_sessoes_pagas precisa estar entre 0 (exclusivo) e 1.")

    sessoes_pagas = kpis.investimento / kpis.custo_por_sessao_paga
    sessoes_totais = sessoes_pagas / kpis.pct_sessoes_pagas
    vendas = sessoes_totais * kpis.taxa_conversao
    receita = vendas * kpis.ticket_medio

    return KPIsResultado(
        sessoes_pagas=round(sessoes_pagas, 2),
        sessoes_totais=round(sessoes_totais, 2),
        vendas=round(vendas, 2),
        receita=round(receita, 2),
    )


def projetar_cenario(kpis_por_mes: dict[str, dict]) -> dict[str, dict]:
    """Roda a cadeia de cálculo mês a mês para um cenário completo.

    `kpis_por_mes` é um dict {mes: {investimento, ticket_medio,
    taxa_conversao, custo_por_sessao_paga, pct_sessoes_pagas}}.
    Retorna {mes: {**influenciadores, **resultado}}.
    """
    _validar_meses(kpis_por_mes)

    resultado: dict[str, dict] = {}
    for mes in MESES:
        influenciadores = KPIsInfluenciadores(**kpis_por_mes[mes])
        kpis_resultado = projetar_kpis_resultado(influenciadores)
        resultado[mes] = {**asdict(influenciadores), **asdict(kpis_resultado)}
    return resultado


def validar_cenario_contra_meta(cenario_projetado: dict[str, dict], meta_anual: float) -> None:
    """Confere se a soma de receita mensal do cenário bate com a meta
    anual, dentro da tolerância aceita. Levanta ProjecaoInconsistenteError
    se não bater — nunca devolve silenciosamente um cenário incoerente."""
    receita_total = sum(m["receita"] for m in cenario_projetado.values())
    diferenca = receita_total - meta_anual
    diferenca_pct = abs(diferenca) / meta_anual if meta_anual else float("inf")

    if diferenca_pct > TOLERANCIA_VALIDACAO:
        raise ProjecaoInconsistenteError(
            f"Soma de receita projetada (R$ {receita_total:,.2f}) diverge da "
            f"meta anual (R$ {meta_anual:,.2f}) em {diferenca_pct:.2%} — "
            f"acima da tolerância de {TOLERANCIA_VALIDACAO:.0%}. Ajuste os "
            "KPIs Influenciadores de algum mês antes de aprovar este cenário."
        )


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _validar_meses(dados: dict) -> None:
    faltando = [m for m in MESES if m not in dados]
    if faltando:
        raise ValueError(f"Faltam os meses: {', '.join(faltando)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cmd_distribuir(args: argparse.Namespace) -> None:
    with open(args.input, encoding="utf-8") as f:
        dados = json.load(f)
    resultado = distribuir_sazonalmente(dados["meta_anual"], dados["historico_mensal"])
    json.dump({"distribuicao_mensal": resultado, "total": sum(resultado.values())},
              sys.stdout, ensure_ascii=False, indent=2)


def _cmd_projetar(args: argparse.Namespace) -> None:
    with open(args.input, encoding="utf-8") as f:
        dados = json.load(f)
    resultado = projetar_cenario(dados["kpis_por_mes"])
    if "meta_anual" in dados:
        validar_cenario_contra_meta(resultado, dados["meta_anual"])
    json.dump({"projecao_mensal": resultado}, sys.stdout, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Motor de projeção do planejamento estratégico.")
    subparsers = parser.add_subparsers(dest="comando", required=True)

    p_dist = subparsers.add_parser("distribuir", help="Quebra uma meta anual em 12 meses, respeitando sazonalidade.")
    p_dist.add_argument("--input", required=True, help="JSON com {meta_anual, historico_mensal: {mes: valor, ...}}")
    p_dist.set_defaults(func=_cmd_distribuir)

    p_proj = subparsers.add_parser("projetar", help="Roda a cadeia de KPIs Influenciadores -> Resultado para um cenário.")
    p_proj.add_argument("--input", required=True, help="JSON com {kpis_por_mes: {mes: {...}}, meta_anual?}")
    p_proj.set_defaults(func=_cmd_projetar)

    args = parser.parse_args()
    try:
        args.func(args)
    except (DistribuicaoFlatError, ProjecaoInconsistenteError, ValueError) as exc:
        print(json.dumps({"erro": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
