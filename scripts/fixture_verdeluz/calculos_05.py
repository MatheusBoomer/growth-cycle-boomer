#!/usr/bin/env python3
"""
Impactos em R$ das soluções da etapa 05 (Verdeluz), calculados só a partir dos dados aprovados nas etapas 03 e 04.
Cada premissa está na própria linha. Os impactos de problemas diferentes se sobrepõem e NÃO se somam.

    python3 scripts/fixture_verdeluz/calculos_05.py --cliente clientes/verdeluz-producao
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from .analise_diagnostico import etapa03, etapa04
except ImportError:  # execução direta do script
    from analise_diagnostico import etapa03, etapa04  # type: ignore[no-redef]


def calcular(cliente: Path) -> dict:
    d3, d4 = etapa03(cliente), etapa04(cliente)
    capt, apr = d3["receita"]["captada"], d3["receita"]["aprovada"]
    ticket, sessoes = d3["ticket_medio"], d3["sessoes"]["total"]
    novos_sem2 = sum(d4["cac"]["novos_serie"][6:])
    cac_sem2 = d4["cac"]["semestre"][1]
    serie = d3["receita"]["captada_serie"]
    ruptura_captada = serie[5] + serie[6]  # MAR e ABR
    return {
        # P1: CAC-alvo de R$ 70 (perto da média do período, R$ 68,53) ou R$ 80, mesmo ritmo de novos do 2º semestre, anualizado
        "p1_novos_ano": 2 * novos_sem2,
        "p1_economia_cac70": 2 * novos_sem2 * (cac_sem2 - 70.0),
        "p1_economia_cac80": 2 * novos_sem2 * (cac_sem2 - 80.0),
        "cac_sem2": cac_sem2,
        # P2: ruptura: queda declarada de 22% sobre MAR e ABR
        "p2_captada_mar_abr": ruptura_captada,
        "p2_perda_ruptura": ruptura_captada / 0.78 - ruptura_captada,
        # P3: 5% a 10% dos 7.176 clientes de compra única fazem uma segunda compra, ao ticket histórico
        "p3_compra_unica": d4["ltv"]["compra_unica"],
        "p3_5pct": d4["ltv"]["compra_unica"] * 0.05 * d4["ltv"]["ticket_historico"],
        "p3_10pct": d4["ltv"]["compra_unica"] * 0.10 * d4["ltv"]["ticket_historico"],
        # P4: quebra de 6,5% para 6,0% ou 5,0%
        "quebra_media": d3["quebra"]["media"],
        "p4_6pct": capt * (d3["quebra"]["media"] - 6.0) / 100,
        "p4_5pct": capt * (d3["quebra"]["media"] - 5.0) / 100,
        # P5: +0,1 ou +0,2 ponto percentual de conversão global, sessões do ano e ticket do período
        "p5_01pp": sessoes * 0.001 * ticket,
        "p5_02pp": sessoes * 0.002 * ticket,
        "p5_01pp_aprovada": sessoes * 0.001 * ticket * (apr / capt),
        # P8: ticket médio +5% ou +10% sobre a receita captada
        "p8_5pct": capt * 0.05,
        "p8_10pct": capt * 0.10,
        "captada": capt, "aprovada": apr, "ticket": ticket, "sessoes": sessoes,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps({k: round(v, 2) for k, v in calcular(args.cliente).items()}, ensure_ascii=False, indent=1))
