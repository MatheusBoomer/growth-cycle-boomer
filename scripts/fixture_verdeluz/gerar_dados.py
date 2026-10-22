#!/usr/bin/env python3
"""
Gera as quatro planilhas de insumo da Verdeluz Cosméticos Veganos (marca FICTÍCIA) com semente fixa:
historico-mensal.xlsx, produtos-curva-abc.xlsx, quebra-pagamento.xlsx e clientes-historico.xlsx.

    python3 scripts/fixture_verdeluz/gerar_dados.py --saida <pasta>

Os totais fecham entre os arquivos (pedidos do ano, receita captada e aprovada por mês, clientes da base) e carregam a
história descrita em ancoras.py. Sem dado pessoal: clientes só com ID sequencial e nome inventado.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import numpy as np
import openpyxl
from openpyxl.styles import Font

try:
    from . import ancoras as a
except ImportError:  # execução direta do script
    import ancoras as a  # type: ignore[no-redef]


def _linear(par: tuple[float, float], n: int = 12) -> np.ndarray:
    return np.linspace(par[0], par[1], n)


def _bonus(tabela: dict[str, float]) -> np.ndarray:
    return np.array([tabela.get(m, 0.0) for m in a.MESES])


def _serie_mensal(rng: np.random.Generator) -> dict[str, Any]:
    n = len(a.MESES)
    fator = np.array([a.FATOR_RUPTURA.get(m, 1.0) for m in a.MESES])
    s_real = np.array(a.SAZONALIDADE) * fator * (1 + rng.normal(0, 0.015, n))
    receita_alvo = a.CAPTADA * s_real / s_real.sum()
    ticket = np.array(a.TICKET) * (1 + rng.normal(0, 0.004, n))
    pedidos = np.rint(receita_alvo / ticket).astype(int)
    captada = np.round(pedidos * ticket, 2)

    roas = np.linspace(a.ROAS_INICIO, a.ROAS_FIM, n) + _bonus(a.BONUS_ROAS)
    inv = captada / roas
    inv = inv * a.INVESTIMENTO / inv.sum()
    inv_gg = np.round(inv * (a.SHARE_GOOGLE + rng.uniform(-0.02, 0.02, n)), 2)
    inv_meta = np.round(inv - inv_gg, 2)
    inv_total = np.round(inv_gg + inv_meta, 2)

    black_friday = _bonus({"NOVEMBRO": 1.0})
    cps_meta = _linear(a.CPS_META) * (1 + 0.10 * black_friday)
    cps_gg = _linear(a.CPS_GOOGLE) * (1 + 0.06 * black_friday)
    sess_meta = np.rint(inv_meta / cps_meta).astype(int)
    sess_gg = np.rint(inv_gg / cps_gg).astype(int)
    sessoes = np.rint(pedidos / (np.array(a.CONVERSAO) / 100)).astype(int)
    vendas_gg = np.rint(sess_gg * _linear(a.CONV_GOOGLE) / 100).astype(int)
    vendas_meta = np.rint(sess_meta * _linear(a.CONV_META) / 100).astype(int)

    recorrentes = np.rint(pedidos * _linear(a.RECORRENTES_SHARE)).astype(int)
    novos = pedidos - recorrentes

    q = np.linspace(a.QUEBRA_INICIO, a.QUEBRA_FIM, n) + _bonus(a.BONUS_QUEBRA)
    q = q * a.QUEBRA_MEDIA * captada.sum() / (q * captada).sum()
    aprovada = np.round(captada * (1 - q), 2)

    return {
        "fator": fator,
        "receita_sem_ruptura": receita_alvo / fator,
        "pedidos": pedidos, "ticket": ticket, "captada": captada, "aprovada": aprovada,
        "inv_total": inv_total, "inv_gg": inv_gg, "inv_meta": inv_meta,
        "sessoes": sessoes, "sess_gg": sess_gg, "sess_meta": sess_meta,
        "vendas_gg": vendas_gg, "vendas_meta": vendas_meta,
        "ga4_total": np.rint(pedidos * 1.04).astype(int),
        "rec_gg": np.round(vendas_gg * ticket * 0.98, 2),
        "rec_meta": np.round(vendas_meta * ticket * 0.93, 2),
        "recorrentes": recorrentes, "novos": novos,
    }


def _dividir(num: np.ndarray, den: np.ndarray) -> np.ndarray:
    return np.where(den == 0, 0.0, num / np.where(den == 0, 1, den))


def _colunas_historico(m: dict[str, Any]) -> list[tuple[str, str, list[Any], str | None]]:
    """(cabeçalho, marcador, valores por mês, cabeçalho da coluna de variação ou None)."""
    zeros = np.zeros(12)
    pagas = m["sess_gg"] + m["sess_meta"]
    f, pm = "Fórmula", "Preench. Manual"
    return [
        ("INVESTIMENTO TOTAL", f, m["inv_total"], "% VAR."),
        ("INVESTIMENTO GG", pm, m["inv_gg"], "% VAR."),
        ("INVESTIMENTO GG VS TOTAL", f, _dividir(m["inv_gg"], m["inv_total"]), None),
        ("INVESTIMENTO META", pm, m["inv_meta"], "% VAR."),
        ("INVESTIMENTO META VS TOTAL", f, _dividir(m["inv_meta"], m["inv_total"]), "% VAR."),
        ("RECEITA BRUTA (Ecommerce + wpp)", pm, m["captada"], "% VAR."),
        ("RECEITA BRUTA (Ecommerce)", pm, m["captada"], "% VAR."),
        ("RECEITA BRUTA (Whatsapp)", pm, zeros, "% VAR."),
        ("RECEITA APROVADA", pm, m["aprovada"], "% VAR."),
        ("TX QUEBRA", f, 1 - _dividir(m["aprovada"], m["captada"]), "% VAR."),
        ("ROAS BRUTO", f, _dividir(m["captada"], m["inv_total"]), "% VAR."),
        ("ROAS Aprovado", f, _dividir(m["aprovada"], m["inv_total"]), "% VAR."),
        ("RECEITA GG", pm, m["rec_gg"], "% VAR."),
        ("ROAS GG", f, _dividir(m["rec_gg"], m["inv_gg"]), "% VAR."),
        ("RECEITA META (GA4)", pm, m["rec_meta"], "% VAR."),
        ("ROAS META", f, _dividir(m["rec_meta"], m["inv_meta"]), "% VAR."),
        ("VENDAS TOTAIS (GA4)", pm, m["ga4_total"], "% VAR."),
        ("VENDAS TOTAIS (ECOM + WPP)", pm, m["pedidos"], "% VAR."),
        ("VENDAS TOTAIS (ECOM)", pm, m["pedidos"], "% VAR."),
        ("VENDAS TOTAIS (Whatsapp)", pm, zeros, "% VAR."),
        ("VENDAS GG", pm, m["vendas_gg"], "% VAR."),
        ("VENDAS META", pm, m["vendas_meta"], "% VAR."),
        ("CLIENTES RECORRENTES", pm, m["recorrentes"], "% VAR."),
        ("% NOVOS CLIENTES", pm, np.round(_dividir(m["novos"], m["pedidos"]), 4), "% VAR."),
        ("CPA", f, _dividir(m["inv_total"], m["pedidos"]), "% VAR."),
        ("LTV", f, [None] * 12, "% VAR."),  # o LTV é calculado na etapa 04, a partir do clientes-historico
        ("CAC", f, _dividir(m["inv_total"], m["novos"]), "% VAR."),
        ("SESSÕES TOTAIS", pm, m["sessoes"], "% VAR."),
        ("SESSÕES PAGAS", f, pagas, "% VAR."),
        ("SESSÕES GG", pm, m["sess_gg"], "% VAR."),
        ("SESSÕES META", pm, m["sess_meta"], "% VAR."),
        ("% SESSÕES PAGAS", f, _dividir(pagas, m["sessoes"]), "% VAR."),
        ("CPS PAGA", f, _dividir(m["inv_total"], pagas), "% VAR. CPS"),
        ("CPS GOOGLE", f, _dividir(m["inv_gg"], m["sess_gg"]), "% VAR. CPS"),
        ("CPS META", f, _dividir(m["inv_meta"], m["sess_meta"]), "% VAR. CPS"),
        ("TAXA CONVERSÃO TOTAL", f, _dividir(m["pedidos"], m["sessoes"]), "% VAR. CONV"),
        ("TAXA CONVERSÃO GG", f, _dividir(m["vendas_gg"], m["sess_gg"]), "% VAR. CONV"),
        ("TAXA CONVERSÃO META", f, _dividir(m["vendas_meta"], m["sess_meta"]), "% VAR. CONV"),
        ("TICKET MÉDIO", f, _dividir(m["captada"], m["pedidos"]), "% VAR. T.M"),
    ]


def _numero(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    return round(float(v), 6)


def _gravar_historico(destino: Path, m: dict[str, Any]) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Histórico - sem formatação"
    ws.cell(2, 2, "DATA")
    for i, mes in enumerate(a.MESES):
        ws.cell(3 + i, 2, mes)
    coluna = 3
    for cabecalho, marcador, valores, variacao in _colunas_historico(m):
        ws.cell(1, coluna, marcador)
        ws.cell(2, coluna, cabecalho)
        for i, v in enumerate(valores):
            ws.cell(3 + i, coluna, _numero(v))
        coluna += 1
        if variacao:
            ws.cell(2, coluna, variacao)
            for i in range(1, 12):
                anterior, atual = valores[i - 1], valores[i]
                if anterior not in (None, 0) and atual is not None:
                    ws.cell(3 + i, coluna, round(float(atual) / float(anterior) - 1, 4))
            coluna += 1
    for c in ws[2]:
        c.font = Font(bold=True)
    wb.save(destino)


def _gravar_quebra(destino: Path, m: dict[str, Any], rng: np.random.Generator) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Worksheet"
    ws.append(["DATA", "MEIO DE PAGAMENTO", "RECEITA CAPTADA", "RECEITA APROVADA"])
    peso = np.array(a.PESO_QUEBRA_MEIO)
    for i, mes in enumerate(a.MESES):
        total, aprovado = float(m["captada"][i]), float(m["aprovada"][i])
        mix = np.array(a.MIX_PAGAMENTO) + np.array([rng.uniform(-0.01, 0.01), 0.0, rng.uniform(-0.004, 0.004)])
        mix[1] = 1 - mix[0] - mix[2]
        cap = [round(total * mix[0], 2), round(total * mix[1], 2)]
        cap.append(round(total - sum(cap), 2))
        lam = (total - aprovado) / float(np.dot(cap, peso))
        apr = [round(c * (1 - lam * p), 2) for c, p in zip(cap[:2], peso[:2])]
        apr.append(round(aprovado - sum(apr), 2))
        for meio, c, p in zip(a.MEIOS, cap, apr):
            ws.append([mes, meio, c, p])
    wb.save(destino)


def _gerar_produtos(destino: Path, captada: float) -> None:
    fixos = a.PRODUTOS_FIXOS
    resto = 100.0 - sum(p[3] for p in fixos)
    n_cauda, a0 = len(a.PRODUTOS_CAUDA), 1.75
    baixo, alto = 0.0, 0.999
    for _ in range(80):  # bisseção na razão da progressão geométrica
        r = (baixo + alto) / 2
        soma = a0 * (1 - r**n_cauda) / (1 - r)
        baixo, alto = (r, alto) if soma < resto else (baixo, r)
    itens = [(ref, nome, preco, pct) for ref, nome, preco, pct in fixos]
    itens += [(ref, nome, preco, a0 * r**i) for i, (ref, nome, preco) in enumerate(a.PRODUTOS_CAUDA)]
    itens.sort(key=lambda x: -x[3])
    soma_pct = sum(x[3] for x in itens)
    total = round(captada * a.PRODUTOS_SOBRE_CAPTADA, 2)
    valores = [round(x[3] / soma_pct * total, 2) for x in itens]
    valores[0] = round(valores[0] + total - sum(valores), 2)

    rng = np.random.default_rng(7)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Worksheet"
    ws.append(["#", "REFERÊNCIA", "PRODUTO", "VALOR", "ESTOQUE", "VENDAS", "VALOR TOTAL VENDAS", "HOTSITES",
               "PORCENTAGEM INDIVIDUAL", "PORCENTAGEM ACUMULADA", "CLASSE"])
    acumulado = 0.0
    for i, ((ref, nome, preco, _), valor) in enumerate(zip(itens, valores), start=1):
        individual = valor / total * 100
        acumulado += individual
        classe = "A" if acumulado <= 80 else "B" if acumulado <= 95 else "C"
        estoque = a.ESTOQUE_BAIXO.get(ref, int(rng.integers(25, 520)))
        ws.append([i, ref, nome, preco, estoque, max(1, round(valor / preco)), valor, None,
                   f"{individual:.3f} %".replace(".", ","), f"{acumulado:.3f} %".replace(".", ","), classe])
    wb.save(destino)


def _gerar_clientes(destino: Path, rng: np.random.Generator) -> dict[str, Any]:
    n = a.CLIENTES_BASE
    n1, n2 = round(n * a.SHARE_1_PEDIDO), round(n * a.SHARE_2_PEDIDOS)
    n3 = n - n1 - n2
    extra_alvo = a.PEDIDOS_BASE - n1 - 2 * n2 - 3 * n3
    extras = rng.geometric(1 / (1 + extra_alvo / n3), n3) - 1
    while (diff := extra_alvo - int(extras.sum())) != 0:
        passo = 1 if diff > 0 else -1
        alvos = rng.integers(0, n3, abs(diff))
        for i in alvos:
            if passo > 0 or extras[i] > 0:
                extras[i] += passo
    pedidos = np.concatenate([np.ones(n1, int), np.full(n2, 2), 3 + extras])
    rng.shuffle(pedidos)

    sigma = 0.30 / np.sqrt(pedidos)
    bruto = pedidos * a.PEDIDO_MEDIO_HISTORICO * np.exp(rng.normal(0, 1, n) * sigma - sigma**2 / 2)
    alvo_total = a.PEDIDOS_BASE * a.PEDIDO_MEDIO_HISTORICO
    valores = np.round(bruto * alvo_total / bruto.sum(), 2)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Worksheet"
    ws.append(["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"])
    for i in range(n):
        nome = f"{rng.choice(a.NOMES)} {rng.choice(a.SOBRENOMES)} {rng.choice(a.SOBRENOMES)}"
        ws.append([20001 + i, nome, int(pedidos[i]), float(valores[i])])
    wb.save(destino)
    return {"clientes": n, "pedidos_base": int(pedidos.sum()), "ltv": round(float(valores.sum()) / n, 2)}


def gerar(saida: Path, semente: int = 2026) -> dict[str, Any]:
    """Grava as quatro planilhas em `saida` e devolve os totais calculados."""
    saida = Path(saida)
    saida.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(semente)
    m = _serie_mensal(rng)
    _gravar_historico(saida / "historico-mensal.xlsx", m)
    _gerar_produtos(saida / "produtos-curva-abc.xlsx", float(m["captada"].sum()))
    _gravar_quebra(saida / "quebra-pagamento.xlsx", m, rng)
    base = _gerar_clientes(saida / "clientes-historico.xlsx", rng)
    return {
        "sessoes": int(m["sessoes"].sum()),
        "pedidos": int(m["pedidos"].sum()),
        "novos": int(m["novos"].sum()),
        "recorrentes": int(m["recorrentes"].sum()),
        "captada": round(float(m["captada"].sum()), 2),
        "aprovada": round(float(m["aprovada"].sum()), 2),
        "investimento": round(float(m["inv_total"].sum()), 2),
        "cac_por_mes": [round(float(x), 2) for x in _dividir(m["inv_total"], m["novos"])],
        "receita_por_mes": {mes: float(m["captada"][i]) for i, mes in enumerate(a.MESES)},
        "receita_sem_ruptura": {mes: float(m["receita_sem_ruptura"][i]) for i, mes in enumerate(a.MESES) if mes in a.FATOR_RUPTURA},
        **base,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--saida", required=True, type=Path)
    parser.add_argument("--semente", type=int, default=2026)
    args = parser.parse_args()
    totais = gerar(args.saida, args.semente)
    print({k: v for k, v in totais.items() if not isinstance(v, (list, dict))})
