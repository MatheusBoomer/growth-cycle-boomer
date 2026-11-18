#!/usr/bin/env python3
"""
scripts/projecao.py — motor de projeção do Growth Cycle.

Implementa em código as regras mais frágeis do processo manual original:

1. Distribuição mensal NUNCA flat — nem em valor, nem em crescimento. A meta
   anual é quebrada mês a mês partindo do resultado de cada mês no ano anterior
   (A-1), e o CRESCIMENTO sobre o A-1 varia por mês: cresce mais o mês que foi
   forte no A-1 e o mês com data relevante do varejo (Black Friday, Natal, Dia
   das Mães...). Dividir pelo peso histórico apenas dava o mesmo +X% em todo
   mês, que é meta flat disfarçada — o script recusa isso.
2. Cenário Pessimista nunca abaixo do A-1 — nem no total do ano, nem em
   nenhum mês.
3. Cadeia de KPIs Influenciadores -> KPIs Resultado — confirmada contra dados
   reais de cliente (ver spec de design, seção 8):

       sessões_pagas  = investimento / custo_por_sessão_paga
       sessões_totais = sessões_pagas / %_sessões_pagas
       vendas         = sessões_totais * taxa_de_conversão
       receita        = vendas * ticket_médio

Uso típico (chamado pelo subagente `analista-dados`, não pelo analista
humano diretamente):

    python scripts/projecao.py distribuir --input historico.json
    python scripts/projecao.py projetar --input cenario.json

Formato dos JSON de entrada:

    distribuir: {
      "meta_anual": 1200000,
      "historico_mensal": {"janeiro": 80000, ..., "dezembro": 150000},   # receita A-1
      "eventos": {"novembro": {"nome": "Black Friday", "peso": 0.5}, ...} # opcional
    }
    `eventos` substitui o calendário padrão (EVENTOS_VAREJO_PADRAO) inteiro:
    ajuste ao nicho do prospect (ex.: tirar Dia das Crianças de quem vende
    suplemento). `{}` desliga as datas e deixa só a sazonalidade do A-1.

    projetar: {
      "kpis_por_mes": {"janeiro": {investimento, ticket_medio, taxa_conversao,
                       custo_por_sessao_paga, pct_sessoes_pagas}, ...},
      "meta_anual": 1200000,                # opcional: confere a soma
      "historico_mensal": {...},            # opcional: receita A-1 por mês
      "cenario": "pessimista"               # opcional: pessimista|realista|otimista
    }
    Com `historico_mensal`, o script recusa crescimento flat sobre o A-1 e,
    com `cenario: "pessimista"`, recusa qualquer mês (ou o ano) abaixo do A-1.

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

# Crescimento sobre o A-1 é considerado flat quando a diferença entre o mês que
# mais cresce e o que menos cresce fica abaixo de 25% do crescimento médio (ou
# de 1 ponto percentual, para metas próximas do A-1). Ex.: com crescimento médio
# de 30%, os meses precisam variar pelo menos 7,5 p.p. entre si.
LIMIAR_CRESCIMENTO_FLAT_RELATIVO = 0.25
LIMIAR_CRESCIMENTO_FLAT_ABSOLUTO = 0.01

# Datas fortes do varejo brasileiro. O peso é o crescimento extra do mês em
# relação ao que a sazonalidade do A-1 já daria (0.5 = cresce 50% a mais),
# porque o plano concentra ação e verba nessas datas. Padrão para e-commerce
# generalista: a skill ajusta ao nicho do prospect passando `eventos`.
EVENTOS_VAREJO_PADRAO: dict[str, dict] = {
    "março": {"nome": "Dia do Consumidor", "peso": 0.10},
    "maio": {"nome": "Dia das Mães", "peso": 0.20},
    "junho": {"nome": "Dia dos Namorados", "peso": 0.10},
    "agosto": {"nome": "Dia dos Pais", "peso": 0.10},
    "outubro": {"nome": "Dia das Crianças", "peso": 0.10},
    "novembro": {"nome": "Black Friday", "peso": 0.50},
    "dezembro": {"nome": "Natal", "peso": 0.30},
}


class DistribuicaoFlatError(Exception):
    """Levantado quando o histórico de entrada é uniforme demais para
    sustentar uma distribuição sazonal com confiança."""


class ProjecaoInconsistenteError(Exception):
    """Levantado quando a soma mensal de um cenário não bate com a meta
    anual dentro da tolerância aceita."""


class CrescimentoFlatError(Exception):
    """Levantado quando todos os meses crescem praticamente o mesmo % sobre o
    A-1 — meta flat, mesmo que os valores em R$ sigam a sazonalidade."""


class PessimistaAbaixoDoHistoricoError(Exception):
    """Levantado quando o cenário Pessimista fica abaixo do resultado do ano
    anterior (A-1) no total ou em algum mês."""


# ---------------------------------------------------------------------------
# 1. Distribuição sazonal (Prompt 5)
# ---------------------------------------------------------------------------

def distribuir_sazonalmente(
    meta_anual: float,
    historico_mensal: dict[str, float],
    eventos: dict[str, dict] | None = None,
) -> dict[str, float]:
    """Quebra `meta_anual` em 12 valores mensais a partir do resultado de cada
    mês no A-1 (`historico_mensal`, mesmas chaves de MESES).

    O crescimento de cada mês sobre o A-1 é proporcional ao potencial do mês:
    a força dele no A-1 (raiz do índice sazonal, para o mês forte crescer mais
    sem disparar) vezes o peso da data do varejo que cai nele (`eventos`; sem
    o argumento vale EVENTOS_VAREJO_PADRAO). Assim os meses fortes e as datas
    do varejo carregam mais do crescimento, e nenhum mês cresce igual a todos.
    Com meta abaixo do A-1, a queda pesa menos nos meses de maior potencial.

    Recusa histórico uniforme demais (DistribuicaoFlatError) e resultado com o
    mesmo crescimento em todo mês (CrescimentoFlatError).
    """
    _validar_meses(historico_mensal)
    eventos = EVENTOS_VAREJO_PADRAO if eventos is None else eventos
    _validar_eventos(eventos)

    total_historico = sum(historico_mensal.values())
    if total_historico <= 0:
        raise ValueError("Total do histórico precisa ser positivo para calcular pesos.")
    if any(historico_mensal[m] <= 0 for m in MESES):
        raise ValueError("Todo mês do histórico precisa ter receita positiva para calcular o crescimento.")

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

    potencial = potencial_por_mes(historico_mensal, eventos)
    incremento = meta_anual - total_historico
    # Crescendo, o crescimento acompanha o potencial; caindo, a queda acompanha o inverso dele.
    fator = {m: (potencial[m] if incremento >= 0 else 1 / potencial[m]) for m in MESES}
    base = sum(historico_mensal[m] * fator[m] for m in MESES)
    k = incremento / base

    distribuicao = {mes: round(historico_mensal[mes] * (1 + k * fator[mes]), 2) for mes in MESES}

    # Ajusta o último mês para fechar exatamente o total anual, absorvendo
    # o erro de arredondamento acumulado dos 11 meses anteriores.
    soma_onze_meses = sum(distribuicao[m] for m in MESES[:-1])
    distribuicao[MESES[-1]] = round(meta_anual - soma_onze_meses, 2)

    validar_crescimento_nao_flat(distribuicao, historico_mensal)
    return distribuicao


def potencial_por_mes(historico_mensal: dict[str, float], eventos: dict[str, dict]) -> dict[str, float]:
    """Potencial de crescimento de cada mês: raiz do índice sazonal do A-1
    (receita do mês ÷ média mensal) × (1 + peso da data do varejo do mês)."""
    media = mean(historico_mensal[m] for m in MESES)
    return {
        m: (historico_mensal[m] / media) ** 0.5 * (1 + float(eventos.get(m, {}).get("peso", 0)))
        for m in MESES
    }


def crescimento_por_mes(projetado: dict[str, float], historico_mensal: dict[str, float]) -> dict[str, float]:
    """Crescimento (fração) de cada mês projetado sobre o mesmo mês do A-1."""
    return {m: round(projetado[m] / historico_mensal[m] - 1, 4) for m in MESES}


def validar_crescimento_nao_flat(projetado: dict[str, float], historico_mensal: dict[str, float]) -> None:
    """Recusa projeção em que todos os meses crescem praticamente o mesmo %
    sobre o A-1 (ver LIMIAR_CRESCIMENTO_FLAT_*)."""
    crescimento = crescimento_por_mes(projetado, historico_mensal)
    valores = list(crescimento.values())
    amplitude = max(valores) - min(valores)
    minimo = max(LIMIAR_CRESCIMENTO_FLAT_ABSOLUTO, LIMIAR_CRESCIMENTO_FLAT_RELATIVO * abs(mean(valores)))
    if amplitude < minimo:
        raise CrescimentoFlatError(
            f"Todos os meses crescem entre {min(valores):.1%} e {max(valores):.1%} sobre o A-1 — "
            "isso é meta flat, mesmo com os valores seguindo a sazonalidade. O crescimento "
            "precisa variar por mês: mais nos meses fortes do A-1 e nas datas do varejo "
            f"(diferença mínima entre o maior e o menor crescimento: {minimo:.1%})."
        )


def validar_pessimista_acima_do_historico(cenario_projetado: dict[str, dict], historico_mensal: dict[str, float]) -> None:
    """O Pessimista nunca fica abaixo do A-1: nem no total, nem em nenhum mês.
    Levanta PessimistaAbaixoDoHistoricoError listando o que ficou abaixo."""
    abaixo = [
        f"{m} (R$ {cenario_projetado[m]['receita']:,.2f} < A-1 R$ {historico_mensal[m]:,.2f})"
        for m in MESES
        if cenario_projetado[m]["receita"] < historico_mensal[m]
    ]
    total = sum(cenario_projetado[m]["receita"] for m in MESES)
    total_historico = sum(historico_mensal[m] for m in MESES)
    if total < total_historico:
        abaixo.insert(0, f"total do ano (R$ {total:,.2f} < A-1 R$ {total_historico:,.2f})")
    if abaixo:
        raise PessimistaAbaixoDoHistoricoError(
            "O cenário Pessimista não pode ficar abaixo do resultado do ano anterior (A-1). "
            "Abaixo do A-1: " + "; ".join(abaixo) + ". Suba os KPIs Influenciadores desses meses "
            "até a receita igualar ou passar o A-1."
        )


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


def _validar_eventos(eventos: dict[str, dict]) -> None:
    desconhecidos = [m for m in eventos if m not in MESES]
    if desconhecidos:
        raise ValueError(f"Mês desconhecido em eventos: {', '.join(desconhecidos)} (use {', '.join(MESES)}).")
    for mes, evento in eventos.items():
        peso = evento.get("peso") if isinstance(evento, dict) else None
        if not isinstance(peso, (int, float)) or peso < 0:
            raise ValueError(f"Evento de {mes} precisa de \"peso\" numérico maior ou igual a zero.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cmd_distribuir(args: argparse.Namespace) -> None:
    with open(args.input, encoding="utf-8") as f:
        dados = json.load(f)
    eventos = dados.get("eventos")
    resultado = distribuir_sazonalmente(dados["meta_anual"], dados["historico_mensal"], eventos)
    json.dump({
        "distribuicao_mensal": resultado,
        "total": round(sum(resultado.values()), 2),
        "crescimento_mensal": crescimento_por_mes(resultado, dados["historico_mensal"]),
        "eventos_considerados": EVENTOS_VAREJO_PADRAO if eventos is None else eventos,
    }, sys.stdout, ensure_ascii=False, indent=2)


def _cmd_projetar(args: argparse.Namespace) -> None:
    with open(args.input, encoding="utf-8") as f:
        dados = json.load(f)
    resultado = projetar_cenario(dados["kpis_por_mes"])
    if "meta_anual" in dados:
        validar_cenario_contra_meta(resultado, dados["meta_anual"])
    saida: dict = {"projecao_mensal": resultado}
    historico = dados.get("historico_mensal")
    cenario = str(dados.get("cenario", "")).lower()
    if cenario == "pessimista" and historico is None:
        raise ValueError("Cenário Pessimista precisa de historico_mensal (receita A-1) para conferir o piso.")
    if historico is not None:
        _validar_meses(historico)
        if cenario == "pessimista":
            validar_pessimista_acima_do_historico(resultado, historico)
        receitas = {m: resultado[m]["receita"] for m in MESES}
        validar_crescimento_nao_flat(receitas, historico)
        saida["crescimento_mensal"] = crescimento_por_mes(receitas, historico)
    json.dump(saida, sys.stdout, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Motor de projeção do Growth Cycle.")
    subparsers = parser.add_subparsers(dest="comando", required=True)

    p_dist = subparsers.add_parser("distribuir", help="Quebra uma meta anual em 12 meses, respeitando sazonalidade.")
    p_dist.add_argument("--input", required=True, help="JSON com {meta_anual, historico_mensal: {mes: valor, ...}, eventos?}")
    p_dist.set_defaults(func=_cmd_distribuir)

    p_proj = subparsers.add_parser("projetar", help="Roda a cadeia de KPIs Influenciadores -> Resultado para um cenário.")
    p_proj.add_argument("--input", required=True, help="JSON com {kpis_por_mes: {mes: {...}}, meta_anual?, historico_mensal?, cenario?}")
    p_proj.set_defaults(func=_cmd_projetar)

    args = parser.parse_args()
    try:
        args.func(args)
    except (
        DistribuicaoFlatError,
        CrescimentoFlatError,
        PessimistaAbaixoDoHistoricoError,
        ProjecaoInconsistenteError,
        ValueError,
    ) as exc:
        print(json.dumps({"erro": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
