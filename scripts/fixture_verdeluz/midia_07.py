#!/usr/bin/env python3
"""
Etapa 08 da Verdeluz (mídia paga): alocação de verba por plataforma, estratégia por Curva ABC, calendário estratégico, ROAS esperado
por plataforma e meta de redução de dependência, tudo derivado do cenário Realista da etapa 06. Grava os PNG e imprime o resumo em JSON.

    python3 scripts/fixture_verdeluz/midia_08.py --cliente clientes/verdeluz-producao
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import openpyxl

try:
    from . import graficos as g
    from .analise_diagnostico import etapa03, historico
    from .cenarios_06 import construir
except ImportError:  # execução direta do script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import graficos as g  # type: ignore[no-redef]
    from analise_diagnostico import etapa03, historico  # type: ignore[no-redef]
    from cenarios_06 import construir  # type: ignore[no-redef]

MESES = ["OUT", "NOV", "DEZ", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET"]
GOOGLE_SHARE = [0.42, 0.38, 0.42, 0.48, 0.48, 0.46, 0.46, 0.40, 0.46, 0.47, 0.48, 0.46]
JUSTIFICATIVA = [
    "Google rende mais por real\n(GA4): fundo de funil em foco",
    "Black Friday: Meta amplia alcance\ne remarketing, Google protege a marca",
    "Natal: Shopping dos kits presente\ne remarketing",
    "Vale: verba em busca e Shopping,\nde maior intenção",
    "Vale: mantém a intenção alta e\ncorta a prospecção ampla",
    "Retomada com estoque: Shopping\nno sérum e nos kits",
    "Pré-aquecimento do Dia das Mães\ncom Shopping e remarketing",
    "Pico: Meta volta a escalar a\naquisição de público novo",
    "Pós-pico: realoca para busca\ne remarketing",
    "Eficiência: Google rende mais\npor real que o Meta",
    "Eficiência: teto de CAC em vigor,\nbusca e Shopping",
    "Dia do Cliente e pré-lista da\nBlack Friday: remarketing e marca",
]
CLASSES = ["🟡 Manutenção", "🔵 Pico", "🟢 Escala", "🔴 Contenção", "🔴 Contenção", "🟡 Manutenção", "🟢 Escala", "🔵 Pico", "🟡 Manutenção", "🟡 Manutenção", "🟡 Manutenção", "🟢 Escala"]
COR_CLASSE = {"🔴": "#f8d7da", "🟡": "#fff3cd", "🟢": "#d4edda", "🔵": "#d6e4ff"}
CALENDARIO = [
    ("Patamar atual e estoque cheio; teto de CAC em vigor desde o primeiro dia", "Sérum, hidratante e protetor", "Aquisição"),
    ("Maior verba do ano; desconto de até 20% com brinde; lista de espera aquecida desde SET", "Kits e líderes", "Conversão"),
    ("Natal: kits presente e entrega dentro do corte de prazo; remarketing da base da Black Friday", "Kit Presente Natal e Kit Rotina", "Conversão"),
    ("Vale histórico (cerca de 25% abaixo da média); verba conservadora e foco em base própria", "Reposição do sérum e do protetor", "Retenção"),
    ("Segundo mês de vale; régua de reposição e reativação no lugar de mídia fria", "Kits de rotina para quem comprou avulso", "Retenção"),
    ("Retomada com estoque de segurança vigiado; ruptura de MAR/26 não pode se repetir", "Sérum e kits que o contêm", "Aquisição"),
    ("Pré-aquecimento do Dia das Mães com a base e a busca de marca", "Kit Glow e Kit Rotina Essencial", "Aquisição"),
    ("Dia das Mães, segundo pico do ano; Meta escala público novo com teto de CAC", "Kits presente e líderes", "Conversão"),
    ("Pós-pico: mede o CAC do pico e realoca; evita queda brusca de verba", "Protetor e hidratante", "Retenção"),
    ("Regime normal com teto de CAC e foco em recompra do público do Dia das Mães", "Curva A", "Aquisição"),
    ("Teste de datas menores (aniversário da marca) sem desconto profundo", "Kits montados pelo cliente", "Conversão"),
    ("Dia do Cliente e abertura da lista de espera da Black Friday", "Kits e Curva A", "Aquisição"),
]


def _rs(v: float) -> str:
    return g.brl(v, 0)


def construir_08(cliente: Path) -> dict:
    d3 = etapa03(cliente)
    s6 = construir(cliente)
    real = s6["cenarios"]["realista"]
    inv = np.array(real["investimento"])
    receita = np.array(real["receita"])
    gs = np.array(GOOGLE_SHARE)
    google, meta = inv * gs, inv * (1 - gs)

    # ROAS por plataforma: mantém a relação com o ROAS global observada no último trimestre do ano atual (GA4, último clique)
    glob_h = np.array(d3["roas"]["serie"])
    rg = float(np.mean(np.array(d3["roas"]["google_serie"])[9:] / glob_h[9:]))
    rm = float(np.mean(np.array(d3["roas"]["meta_serie"])[9:] / glob_h[9:]))
    roas_global = receita / inv
    roas_google, roas_meta = roas_global * rg, roas_global * rm

    # Curva C: custo de uma venda paga contra o preço e o faturamento por SKU
    h = historico(cliente / "dados/historico-mensal.xlsx")
    vendas_pagas = sum(h["VENDAS GG"]) + sum(h["VENDAS META"])
    sess_pagas = sum(h["SESSÕES GG"]) + sum(h["SESSÕES META"])
    conv_paga = vendas_pagas / sess_pagas
    cps_medio = sum(h["INVESTIMENTO TOTAL"]) / sess_pagas
    ws = openpyxl.load_workbook(cliente / "dados/produtos-curva-abc.xlsx", data_only=True).worksheets[0]
    prod = [r for r in ws.iter_rows(min_row=2, values_only=True)]
    c_skus = [r for r in prod if r[10] == "C"]
    fat_medio_c = sum(r[6] for r in c_skus) / len(c_skus)
    preco_medio_c = sum(r[3] for r in c_skus) / len(c_skus)

    return {
        "meses": MESES, "investimento": inv.tolist(), "google": google.tolist(), "meta": meta.tolist(), "google_share": gs.tolist(),
        "total": float(inv.sum()), "total_google": float(google.sum()), "total_meta": float(meta.sum()),
        "google_share_ano": float(google.sum() / inv.sum()), "meta_share_ano": float(meta.sum() / inv.sum()),
        "roas_global": roas_global.tolist(), "roas_google": roas_google.tolist(), "roas_meta": roas_meta.tolist(),
        "ratio_google": rg, "ratio_meta": rm, "roas_global_medio": float(receita.sum() / inv.sum()),
        "roas_google_medio": float((roas_google * google).sum() / google.sum()), "roas_meta_medio": float((roas_meta * meta).sum() / meta.sum()),
        "receita": receita.tolist(), "dependencia": real["dependencia"],
        "atual": {"google": d3["investimento"]["google"], "meta": d3["investimento"]["meta"], "total": d3["investimento"]["total"]},
        "curva_c": {"cps_medio": cps_medio, "conv_paga": conv_paga, "custo_venda": cps_medio / conv_paga, "skus": len(c_skus),
                    "fat_medio_ano": fat_medio_c, "preco_medio": preco_medio_c, "fat_medio_mes": fat_medio_c / 12},
        "pico_nov_pct": float(inv[1] / inv.sum()),
    }


def gerar_08(cliente: Path, s: dict) -> None:
    graf = cliente / "entrega/ativos-aprovados/graficos"
    g.configurar()
    import matplotlib.pyplot as plt

    # 1) gráfico de barras empilhadas
    fig, ax = plt.subplots(figsize=(g.LARGURA, 3.9))
    x = np.arange(12)
    meta, google = np.array(s["meta"]), np.array(s["google"])
    ax.bar(x, meta, color=g.AZUL, label="Meta Ads")
    ax.bar(x, google, bottom=meta, color=g.LARANJA, label="Google Ads")
    for i in range(12):
        tot = meta[i] + google[i]
        ax.text(i, meta[i] / 2, f"{(1 - s['google_share'][i]) * 100:.0f}%", ha="center", va="center", color="white", fontsize=g.FONTE)
        ax.text(i, meta[i] + google[i] / 2, f"{s['google_share'][i] * 100:.0f}%", ha="center", va="center", color="white", fontsize=g.FONTE)
        ax.text(i, tot, f"{tot / 1000:.1f} mil".replace(".", ","), ha="center", va="bottom", fontsize=g.FONTE)
    ax.set_xticks(x, MESES, rotation=45, ha="right")
    ax.yaxis.set_major_formatter(g.formatador("R$"))
    ax.set_ylabel("Investimento (R$)")
    ax.grid(axis="y", alpha=0.3, linewidth=0.6)
    ax.set_title("Alocação de verba por plataforma (cenário Realista, OUT/26 a SET/27)", loc="left", fontweight="bold")
    top = (meta + google).max()
    ax.set_ylim(0, top * 1.28)
    ax.legend(loc="upper left", frameon=False)
    fig.tight_layout()
    fig.savefig(graf / "alocacao-verba-plataforma.png", dpi=300)
    plt.close(fig)

    # 2) tabela de alocação
    linhas = [[MESES[i], _rs(meta[i] + google[i]), f"{(1 - s['google_share'][i]) * 100:.0f}%", f"{s['google_share'][i] * 100:.0f}%", _rs(meta[i]), _rs(google[i]), JUSTIFICATIVA[i]] for i in range(12)]
    linhas.append(["TOTAL", _rs(s["total"]), f"{s['meta_share_ano'] * 100:.1f}%".replace(".", ","), f"{s['google_share_ano'] * 100:.1f}%".replace(".", ","), _rs(s["total_meta"]), _rs(s["total_google"]), "Google de 38% para 45% da verba"])
    g.tabela_cenarios(graf / "tabela-alocacao-verba-plataforma.png", "Alocação mensal de verba por plataforma (Realista)",
                      ["Mês", "Invest. total", "% Meta", "% Google", "Meta (R$)", "Google (R$)", "Justificativa"], linhas, [0.07, 0.12, 0.07, 0.08, 0.11, 0.11, 0.44])

    # 3) tabela Curva ABC
    c = s["curva_c"]
    nota = (f"Custo de adquirir 1 venda paga: custo por sessão paga médio de {g.brl(c['cps_medio'])} dividido pela conversão paga de {g.pct(c['conv_paga'] * 100, 2)} = {g.brl(c['custo_venda'])}. "
            f"Um SKU da Curva C fatura em média {g.brl(c['fat_medio_ano'], 0)} por ano (preço médio de {g.brl(c['preco_medio'])}): cada venda paga custa mais que o produto.")
    import textwrap

    def qb(texto: str, n: int) -> str:
        return "\n".join(textwrap.wrap(texto, n))

    g.tabela_cenarios(graf / "tabela-curva-abc-estrategia.png", "Estratégia de mídia por Curva ABC",
                      ["Classe", "Papel\nestratégico", "Tipo de campanha", "ROAS\nmínimo", "Prioridade\nde verba"],
                      [[qb("A (9 SKUs, 78,9%)", 14), qb("Motor de aquisição e escala", 22), qb("Shopping e Performance Max no Google; catálogo e conversão no Meta", 36), "4,5x", "70%"],
                       [qb("B (11 SKUs, 15,7%)", 14), qb("Expansão de cesta e remarketing", 22), qb("Remarketing e Search de categoria", 36), "4,0x", "25%"],
                       [qb("C (38 SKUs, 5,4%)", 14), qb("Complemento, sem verba direta", 22), qb("Sem campanha própria: brinde, order bump e kits com a Curva A", 36), "Não se aplica", qb("5% (só via kits e remarketing)", 16)]],
                      [0.15, 0.24, 0.31, 0.12, 0.18], nota=nota, altura_linha=0.62, destacar_ultima=False)

    # 4) calendário
    linhas, cores = [], {}
    for i in range(12):
        linhas.append([MESES[i], CLASSES[i].split(" ", 1)[1], CALENDARIO[i][0], CALENDARIO[i][1], CALENDARIO[i][2]])  # o emoji não existe na fonte do PNG: a cor da célula marca a classe
    quebra = lambda t, n: "\n".join(__import__("textwrap").wrap(t, n))
    linhas = [[l[0], l[1], quebra(l[2], 46), quebra(l[3], 22), l[4]] for l in linhas]
    for i in range(12):
        cores[(i + 1, 1)] = COR_CLASSE[CLASSES[i][0]]
    g.tabela_cenarios(graf / "tabela-calendario-estrategico.png", "Calendário estratégico de mídia (Realista)",
                      ["Mês", "Classificação", "Lógica de alocação", "Foco de produto", "Objetivo\nprincipal"], linhas, [0.07, 0.15, 0.40, 0.22, 0.16],
                      cores=cores, altura_linha=0.5, destacar_ultima=False)

    # 5) ROAS esperado
    g.linha(graf / "roas-esperado-plataforma.png", "ROAS esperado: global e por plataforma (Realista)", "ROAS (x)", "x",
            [("Global (receita captada)", s["roas_global"], g.AZUL), ("Google (GA4)", s["roas_google"], g.LARANJA), ("Meta (GA4)", s["roas_meta"], g.VERDE)], rotulos_x=MESES)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    args = parser.parse_args()
    resumo = construir_08(args.cliente)
    gerar_08(args.cliente, resumo)
    print(json.dumps(resumo, ensure_ascii=False, indent=1))
