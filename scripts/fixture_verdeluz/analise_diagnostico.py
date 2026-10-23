#!/usr/bin/env python3
"""
Cálculos e gráficos das etapas 03 (diagnóstico de performance) e 04 (unidade econômica) do cliente de produção da Verdeluz.
Lê só as planilhas em dados/ (como o analista faria), grava os PNG em entrega/ativos-aprovados/graficos/ e imprime um
resumo em JSON com todos os números que as seções de texto citam.

    python3 scripts/fixture_verdeluz/analise_diagnostico.py --cliente clientes/verdeluz-producao --etapa 03
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import openpyxl

try:
    from . import graficos as g
except ImportError:  # execução direta do script
    import graficos as g  # type: ignore[no-redef]

BENCH_QUEBRA = 5.0
BENCH_CONV = {"global": (1.0, 2.0), "google": (2.0, 4.0), "meta": (1.0, 2.0)}
BENCH_DEP = (45.0, 60.0)  # DTC consolidada
BENCH_LTV_CAC = (3.0, 5.0)


def historico(path: Path) -> dict[str, list]:
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    cab = [str(c.value).strip() if c.value else None for c in ws[2]]
    linhas = list(ws.iter_rows(min_row=3, max_row=14, values_only=True))
    return {nome: [l[i] for l in linhas] for i, nome in enumerate(cab) if nome}


def media(v) -> float:
    return sum(v) / len(v)


def semestres(v) -> tuple[float, float]:
    return sum(v[:6]), sum(v[6:])


def etapa03(cliente: Path) -> dict:
    h = historico(cliente / "dados/historico-mensal.xlsx")
    graf = cliente / "entrega/ativos-aprovados/graficos"
    inv, inv_gg, inv_meta = h["INVESTIMENTO TOTAL"], h["INVESTIMENTO GG"], h["INVESTIMENTO META"]
    capt, apr = h["RECEITA BRUTA (Ecommerce)"], h["RECEITA APROVADA"]
    quebra = [(1 - a / c) * 100 for a, c in zip(apr, capt)]
    roas = [c / i for c, i in zip(capt, inv)]
    sess, s_gg, s_meta = h["SESSÕES TOTAIS"], h["SESSÕES GG"], h["SESSÕES META"]
    dep = [(a + b) / t * 100 for a, b, t in zip(s_gg, s_meta, sess)]
    conv = {"global": [x * 100 for x in h["TAXA CONVERSÃO TOTAL"]], "google": [x * 100 for x in h["TAXA CONVERSÃO GG"]], "meta": [x * 100 for x in h["TAXA CONVERSÃO META"]]}
    media_roas = sum(capt) / sum(inv)

    # Fase 1
    g.linha(graf / "investimento-midia-mensal.png", "Investimento em mídia paga (Google + Meta)", "Investimento (R$)", "R$",
            [("Investimento total", inv, g.AZUL)], [("media", f"Média do período ({g.brl(media(inv), 0)})", media(inv), g.AZUL)])
    g.linha(graf / "receita-captada-vs-aprovada.png", "Receita captada vs. aprovada", "Receita (R$)", "R$",
            [("Receita captada", capt, g.AZUL), ("Receita aprovada", apr, g.LARANJA)])
    g.linha(graf / "taxa-quebra-mensal.png", "Taxa de quebra mensal (captada para aprovada)", "Taxa de quebra (%)", "%",
            [("Taxa de quebra", quebra, g.AZUL)],
            [("media", f"Média do período ({g.pct(media_q := (1 - sum(apr) / sum(capt)) * 100)})", media_q, g.AZUL),
             ("benchmark", f"Benchmark máximo ({g.pct(BENCH_QUEBRA, 0)})", BENCH_QUEBRA, g.CLARO["Benchmark"])])

    # Quebra por meio de pagamento
    ws = openpyxl.load_workbook(cliente / "dados/quebra-pagamento.xlsx", data_only=True).worksheets[0]
    por_meio: dict[str, list[tuple[float, float]]] = {}
    for _d, meio, cap, apv in ws.iter_rows(min_row=2, values_only=True):
        por_meio.setdefault(meio, []).append((cap, apv))
    taxa_meio = {m: [(1 - a / c) * 100 for c, a in v] for m, v in por_meio.items()}
    anual_meio = {m: (1 - sum(a for _, a in v) / sum(c for c, _ in v)) * 100 for m, v in por_meio.items()}
    peso_meio = {m: sum(c for c, _ in v) / sum(capt) * 100 for m, v in por_meio.items()}
    g.linha(graf / "quebra-por-meio-pagamento.png", "Taxa de quebra por meio de pagamento", "Taxa de quebra (%)", "%",
            [("Cartão de crédito", taxa_meio["Cartão de crédito"], g.AZUL), ("PIX", taxa_meio["PIX"], g.LARANJA), ("Boleto", taxa_meio["Boleto"], g.VERDE)],
            [("benchmark", f"Benchmark máximo ({g.pct(BENCH_QUEBRA, 0)})", BENCH_QUEBRA, g.CLARO["Benchmark"])])

    g.linha(graf / "roas-global.png", "ROAS global (receita captada do site / investimento total)", "ROAS (x)", "x",
            [("ROAS global", roas, g.AZUL)], [("media", f"Média do período ({g.num(media_roas, 2)}x)", media_roas, g.AZUL)])
    roas_gg = [x for x in h["ROAS GG"]]
    roas_meta = [x for x in h["ROAS META"]]
    g.linha(graf / "roas-plataformas.png", "ROAS por plataforma (receita atribuída no GA4)", "ROAS (x)", "x",
            [("Google (GA4)", roas_gg, g.AZUL), ("Meta (GA4)", roas_meta, g.LARANJA)])

    # Fase 2
    g.linha(graf / "sessoes-por-plataforma.png", "Sessões totais e por plataforma", "Sessões", "n",
            [("Sessões totais", sess, g.AZUL), ("Google", s_gg, g.LARANJA), ("Meta", s_meta, g.VERDE)])
    g.linha(graf / "dependencia-midia-paga.png", "Dependência de mídia paga (% de sessões pagas)", "Sessões pagas (% do total)", "%",
            [("% de sessões pagas", dep, g.AZUL)],
            [("media", f"Média do período ({g.pct(media_d := sum(a + b for a, b in zip(s_gg, s_meta)) / sum(sess) * 100)})", media_d, g.AZUL),
             ("benchmark", f"Benchmark mínimo ({g.pct(BENCH_DEP[0], 0)})", BENCH_DEP[0], g.CLARO["Benchmark"]),
             ("benchmark", f"Benchmark máximo ({g.pct(BENCH_DEP[1], 0)})", BENCH_DEP[1], g.CLARO["Benchmark"])])
    media_conv = {"global": sum(h["VENDAS TOTAIS (ECOM)"]) / sum(sess) * 100, "google": sum(h["VENDAS GG"]) / sum(s_gg) * 100, "meta": sum(h["VENDAS META"]) / sum(s_meta) * 100}
    titulos = {"global": "Taxa de conversão global", "google": "Taxa de conversão Google", "meta": "Taxa de conversão Meta"}
    for chave, cor in (("global", g.AZUL), ("google", g.AZUL), ("meta", g.AZUL)):
        lo, hi = BENCH_CONV[chave]
        g.linha(graf / f"conversao-{chave}.png", titulos[chave], "Conversão (%)", "%", [(titulos[chave], conv[chave], cor)],
                [("media", f"Média do período ({g.pct(media_conv[chave], 2)})", media_conv[chave], cor),
                 ("benchmark", f"Benchmark mínimo ({g.pct(lo, 0)})", lo, g.CLARO["Benchmark"]),
                 ("benchmark", f"Benchmark máximo ({g.pct(hi, 0)})", hi, g.CLARO["Benchmark"])])

    # Curva ABC
    ws = openpyxl.load_workbook(cliente / "dados/produtos-curva-abc.xlsx", data_only=True).worksheets[0]
    prod = [dict(zip(["n", "ref", "produto", "valor", "estoque", "vendas", "total", "hot", "ind", "acum", "classe"], r)) for r in ws.iter_rows(min_row=2, values_only=True)]
    total_prod = sum(p["total"] for p in prod)
    por_classe = {c: [p for p in prod if p["classe"] == c] for c in "ABC"}
    share_classe = {c: sum(p["total"] for p in v) / total_prod * 100 for c, v in por_classe.items()}
    g.barras(graf / "curva-abc-faturamento.png", "Faturamento por Curva ABC", "Faturamento (R$)", "R$", [f"Curva {c}" for c in "ABC"],
             [sum(p["total"] for p in por_classe[c]) for c in "ABC"], [g.AZUL, g.LARANJA, g.VERDE],
             [f"{g.pct(share_classe[c])} · {len(por_classe[c])} SKUs" for c in "ABC"])
    top10 = prod[:10]
    g.barras(graf / "top10-produtos.png", "Top 10 produtos por faturamento", "Faturamento (R$)", "R$",
             [g.nome_produto(p["produto"]) for p in top10], [p["total"] for p in top10], g.AZUL,
             [f"{g.pct(p['total'] / total_prod * 100)}" for p in top10], horizontal=True, altura=4.2)
    for c, minuscula in (("A", "a"), ("B", "b"), ("C", "c")):
        linhas = [[str(p["n"]), g.nome_produto(p["produto"]), g.brl(p["total"]), g.pct(p["total"] / total_prod * 100), g.pct(float(p["acum"].replace(" %", "").replace(",", ".")))] for p in por_classe[c]]
        g.tabela(graf / f"tabela-curva-abc-{minuscula}.png", f"Curva {c}: {len(por_classe[c])} SKUs, {g.pct(share_classe[c])} do faturamento",
                 ["#", "Produto", "Faturamento", "% individual", "% acumulado"], linhas, [0.06, 0.52, 0.16, 0.13, 0.13])

    kits = sum(p["total"] for p in prod if p["produto"].startswith("KIT "))
    top3 = sum(p["total"] for p in prod[:3])
    return {
        "periodo": "OUT/25 a SET/26",
        "investimento": {"total": sum(inv), "media_mensal": media(inv), "google": sum(inv_gg), "meta": sum(inv_meta),
                         "share_meta": sum(inv_meta) / sum(inv) * 100, "pico": max(zip(inv, g.MESES_CURTOS))[::-1], "menor": min(zip(inv, g.MESES_CURTOS))[::-1],
                         "primeiro_trimestre": sum(inv[:3]), "ultimo_trimestre": sum(inv[9:]), "serie": inv},
        "receita": {"captada": sum(capt), "aprovada": sum(apr), "media_captada": media(capt), "media_aprovada": media(apr),
                    "nao_aprovada": sum(capt) - sum(apr), "captada_serie": capt, "aprovada_serie": apr,
                    "semestre_captada": semestres(capt), "semestre_aprovada": semestres(apr)},
        "quebra": {"media": media_q, "serie": quebra, "meses_acima_5": [m for m, q in zip(g.MESES_CURTOS, quebra) if q > BENCH_QUEBRA],
                   "maior": max(zip(quebra, g.MESES_CURTOS)), "menor": min(zip(quebra, g.MESES_CURTOS)),
                   "no_limite_de_5": sum(capt) * (1 - BENCH_QUEBRA / 100) - sum(apr)},
        "quebra_meio": {"anual": anual_meio, "peso": peso_meio, "serie": taxa_meio},
        "roas": {"global_medio": media_roas, "serie": roas, "primeiro": roas[0], "ultimo": roas[-1], "pior": min(zip(roas, g.MESES_CURTOS)), "melhor": max(zip(roas, g.MESES_CURTOS)),
                 "google_serie": roas_gg, "meta_serie": roas_meta, "google_medio": sum(h["RECEITA GG"]) / sum(inv_gg), "meta_medio": sum(h["RECEITA META (GA4)"]) / sum(inv_meta)},
        "sessoes": {"total": sum(sess), "media": media(sess), "google": sum(s_gg), "meta": sum(s_meta), "semestre": semestres(sess), "serie": sess,
                    "google_serie": s_gg, "meta_serie": s_meta, "pico": max(zip(sess, g.MESES_CURTOS))[::-1]},
        "dependencia": {"media": media_d, "serie": dep, "primeiro": dep[0], "ultimo": dep[-1], "max": max(zip(dep, g.MESES_CURTOS)), "min": min(zip(dep, g.MESES_CURTOS))},
        "conversao": {"media": media_conv, "serie": conv, "pior": {k: min(zip(v, g.MESES_CURTOS)) for k, v in conv.items()},
                      "meses_fora_faixa": {k: [m for m, x in zip(g.MESES_CURTOS, conv[k]) if not BENCH_CONV[k][0] <= x <= BENCH_CONV[k][1]] for k in conv}},
        "pedidos": sum(h["VENDAS TOTAIS (ECOM)"]), "ticket_medio": sum(capt) / sum(h["VENDAS TOTAIS (ECOM)"]),
        "ga4_vs_plataforma": sum(h["VENDAS TOTAIS (GA4)"]) / sum(h["VENDAS TOTAIS (ECOM)"]) - 1,
        "curva_abc": {"skus": len(prod), "total": total_prod, "share": share_classe, "skus_por_classe": {c: len(v) for c, v in por_classe.items()},
                      "top3_share": top3 / total_prod * 100, "kits_share": kits / total_prod * 100, "top10_share": sum(p["total"] for p in top10) / total_prod * 100,
                      "top10": [(p["produto"], p["total"], p["total"] / total_prod * 100) for p in top10], "total_vs_captada": total_prod / sum(capt) * 100,
                      "estoque_baixo": [(p["produto"], p["estoque"]) for p in prod if p["estoque"] < 60]},
    }


def etapa04(cliente: Path) -> dict:
    h = historico(cliente / "dados/historico-mensal.xlsx")
    graf = cliente / "entrega/ativos-aprovados/graficos"
    inv = h["INVESTIMENTO TOTAL"]
    pedidos, recorrentes = h["VENDAS TOTAIS (ECOM)"], h["CLIENTES RECORRENTES"]
    novos = [p - r for p, r in zip(pedidos, recorrentes)]
    cac = [i / n for i, n in zip(inv, novos)]
    cac_medio = sum(inv) / sum(novos)
    pct_novos = [n / p * 100 for n, p in zip(novos, pedidos)]
    pct_rec = [r / p * 100 for r, p in zip(recorrentes, pedidos)]
    g.linha(graf / "cac-mensal.png", "CAC mensal (investimento total / clientes novos)", "CAC (R$)", "R$ unidade",
            [("CAC", cac, g.AZUL)], [("media", f"Média ponderada do período ({g.brl(cac_medio)})", cac_medio, g.AZUL)])
    g.linha(graf / "novos-vs-recorrentes.png", "Pedidos de clientes novos vs. recorrentes", "Participação nos pedidos (%)", "%",
            [("% clientes novos", pct_novos, g.AZUL), ("% clientes recorrentes", pct_rec, g.LARANJA)])

    ws = openpyxl.load_workbook(cliente / "dados/clientes-historico.xlsx", data_only=True).worksheets[0]
    cli = [dict(zip(["id", "nome", "pedidos", "valor"], r)) for r in ws.iter_rows(min_row=2, values_only=True)]
    n, ped, valor = len(cli), sum(c["pedidos"] for c in cli), sum(c["valor"] for c in cli)
    ticket_hist, ped_por_cliente = valor / ped, ped / n
    ltv = valor / n
    grupos = {"1 pedido": [c for c in cli if c["pedidos"] == 1], "2 pedidos": [c for c in cli if c["pedidos"] == 2], "3 ou mais": [c for c in cli if c["pedidos"] >= 3]}
    ltv_recorrente = sum(c["valor"] for c in cli if c["pedidos"] >= 2) / sum(1 for c in cli if c["pedidos"] >= 2)
    ltv_unico = sum(c["valor"] for c in grupos["1 pedido"]) / len(grupos["1 pedido"])
    ordenado = sorted(cli, key=lambda c: -c["valor"])
    top10pct = sum(c["valor"] for c in ordenado[: n // 10]) / valor * 100
    return {
        "cac": {"serie": cac, "medio": cac_medio, "ultimo": cac[-1], "primeiro": cac[0], "min": min(zip(cac, g.MESES_CURTOS)), "max": max(zip(cac, g.MESES_CURTOS)),
                "semestre": (sum(inv[:6]) / sum(novos[:6]), sum(inv[6:]) / sum(novos[6:])), "novos_total": sum(novos), "novos_serie": novos},
        "novos_recorrentes": {"pct_novos": pct_novos, "pct_recorrentes": pct_rec, "novos": sum(novos), "recorrentes": sum(recorrentes), "pedidos": sum(pedidos),
                              "recorrentes_semestre": (sum(recorrentes[:6]), sum(recorrentes[6:])), "pct_recorrentes_ultimo": pct_rec[-1], "pct_recorrentes_min": min(zip(pct_rec, g.MESES_CURTOS)),
                              "pct_novos_media": sum(novos) / sum(pedidos) * 100},
        "ltv": {"clientes": n, "pedidos": ped, "valor_total": valor, "ticket_historico": ticket_hist, "pedidos_por_cliente": ped_por_cliente, "ltv": ltv,
                "ltv_via_ticket": ticket_hist * ped_por_cliente, "compra_unica": len(grupos["1 pedido"]), "dois": len(grupos["2 pedidos"]), "tres_ou_mais": len(grupos["3 ou mais"]),
                "pct_recorrentes_base": (n - len(grupos["1 pedido"])) / n * 100, "ltv_recorrente": ltv_recorrente, "ltv_compra_unica": ltv_unico, "top10pct_share": top10pct,
                "top5": [(c["id"], c["nome"], c["valor"], c["pedidos"]) for c in ordenado[:5]]},
        "ltv_cac": {"ultimo_mes": ltv / cac[-1], "medio": ltv / cac_medio, "compra_unica": ltv_unico / cac[-1], "recorrente": ltv_recorrente / cac[-1],
                    "meses_abaixo_3": [m for m, c in zip(g.MESES_CURTOS, cac) if ltv / c < BENCH_LTV_CAC[0]]},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    parser.add_argument("--etapa", required=True, choices=["03", "04"])
    args = parser.parse_args()
    resumo = etapa03(args.cliente) if args.etapa == "03" else etapa04(args.cliente)
    print(json.dumps(resumo, ensure_ascii=False, indent=1, default=lambda o: list(o) if isinstance(o, tuple) else str(o)))
