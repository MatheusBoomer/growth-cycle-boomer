#!/usr/bin/env python3
"""
Etapa 06 da Verdeluz: quebra a meta mês a mês com `scripts/projecao.py` (distribuição sazonal, nunca flat), constrói os três
cenários pela cadeia de KPIs, gera os gráficos e a planilha de projeção e imprime o resumo em JSON.

    python3 scripts/fixture_verdeluz/cenarios_06.py --cliente clientes/verdeluz-producao

Premissas (ver `contexto/decisoes/06-metas-e-cenarios.md`): a base é a receita captada do site; o horizonte é de 12 meses na mesma
ordem do histórico (OUT a SET), posição a posição; as sessões seguem a sazonalidade do histórico com MAR e ABR normalizados (o
histórico está contaminado pela ruptura); o investimento é DERIVADO das sessões, do custo por sessão e da dependência; a conversão é
a variável que fecha a meta de cada mês (como a skill 06 prevê: um KPI compensa os outros).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import projecao  # noqa: E402

try:
    from . import graficos as g
    from .analise_diagnostico import etapa03
except ImportError:  # execução direta do script
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import graficos as g  # type: ignore[no-redef]
    from analise_diagnostico import etapa03  # type: ignore[no-redef]

MESES_ROTULO = ["OUT", "NOV", "DEZ", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET"]
FATOR_RUPTURA = 0.78  # queda declarada de MAR e ABR; usada só para normalizar o histórico
POS_NOV = 1

CENARIOS = {
    # meta sobre a receita captada do ano atual, rampa da meta mês a mês, sessões do ano e rampa, dependência, CPS, ticket, quebra média
    "pessimista": dict(cresc=-0.10, rampa_meta=(1.04, 0.96), sessoes=420_000, rampa_sess=(1.03, 0.97), dep=(0.55, 0.58), cps=(1.70, 1.90), ticket=(1.0, 0.98), quebra=0.075, normaliza=False),
    "realista": dict(cresc=0.30, rampa_meta=(0.86, 1.14), sessoes=455_000, rampa_sess=(0.97, 1.03), dep=(0.54, 0.45), cps=(1.60, 1.40), ticket=(1.0, 1.04), quebra=0.055, normaliza=True),
    "otimista": dict(cresc=0.40, rampa_meta=(0.86, 1.14), sessoes=490_000, rampa_sess=(0.96, 1.04), dep=(0.53, 0.42), cps=(1.55, 1.30), ticket=(1.0, 1.07), quebra=0.050, normaliza=True),
}
SOLUCOES = {
    "pessimista": [],
    "realista": ["P1.S1", "P1.S3", "P2.S1", "P2.S3", "P3.S1", "P3.S2", "P4.S1", "P4.S2", "P5.S1", "P5.S2", "P7.S1", "P7.S2"],
    "otimista": ["P1.S2", "P2.S2", "P3.S3", "P4.S3", "P5.S3", "P8.S1", "P8.S2", "P8.S3"],
}  # o Otimista soma estas às do Realista. P6 e P7 não têm impacto quantificado: P7.S1 e P7.S2 entram só como pré-requisito de medição


def _distribuir(meta: float, pesos_historico: np.ndarray) -> np.ndarray:
    d = projecao.distribuir_sazonalmente(meta, {m: float(v) for m, v in zip(projecao.MESES, pesos_historico)})
    return np.array([d[m] for m in projecao.MESES])


def construir(cliente: Path) -> dict:
    d3 = etapa03(cliente)
    capt = np.array(d3["receita"]["captada_serie"])
    inv_h = np.array(d3["investimento"]["serie"])
    sess_h = np.array(d3["sessoes"]["serie"], float)
    pagas_h = np.array(d3["sessoes"]["google_serie"], float) + np.array(d3["sessoes"]["meta_serie"], float)
    conv_h = np.array(d3["conversao"]["serie"]["global"]) / 100
    ticket_h = capt / (conv_h * sess_h)
    cps_h, dep_h = inv_h / pagas_h, pagas_h / sess_h

    norm = capt.copy()
    norm[5] /= FATOR_RUPTURA
    norm[6] /= FATOR_RUPTURA
    sess_idx = sess_h.copy()
    # MAR e ABR do histórico têm sessões infladas pela ruptura: interpola entre FEV e MAI (subida rumo ao Dia das Mães)
    sess_idx[5] = sess_h[4] + (sess_h[7] - sess_h[4]) / 3
    sess_idx[6] = sess_h[4] + 2 * (sess_h[7] - sess_h[4]) / 3
    sess_idx = sess_idx / sess_idx.mean()

    bf = np.array([1.06 if i == POS_NOV else 1.0 for i in range(12)])
    saida: dict = {"cenarios": {}, "periodo_anterior": []}
    for nome, c in CENARIOS.items():
        meta_total = float(capt.sum() * (1 + c["cresc"]))
        pesos = (norm if c["normaliza"] else capt) * np.linspace(*c["rampa_meta"], 12)
        meta = _distribuir(meta_total, pesos)
        sessoes = c["sessoes"] / 12 * sess_idx * np.linspace(*c["rampa_sess"], 12)
        dep, cps = np.linspace(*c["dep"], 12), np.linspace(*c["cps"], 12) * bf
        ticket = ticket_h * np.linspace(*c["ticket"], 12)
        conv = meta / (sessoes * ticket)
        invest = sessoes * dep * cps
        kpis = {mes: dict(investimento=float(invest[i]), ticket_medio=float(ticket[i]), taxa_conversao=float(conv[i]),
                          custo_por_sessao_paga=float(cps[i]), pct_sessoes_pagas=float(dep[i])) for i, mes in enumerate(projecao.MESES)}
        projetado = projecao.projetar_cenario(kpis)
        projecao.validar_cenario_contra_meta(projetado, meta_total)
        receita = np.array([projetado[m]["receita"] for m in projecao.MESES])
        vendas = np.array([projetado[m]["vendas"] for m in projecao.MESES])
        sess_tot = np.array([projetado[m]["sessoes_totais"] for m in projecao.MESES])
        saida["cenarios"][nome] = {
            "meta_total": meta_total, "meta_mensal": meta.tolist(), "receita": receita.tolist(), "vendas": vendas.tolist(), "sessoes": sess_tot.tolist(),
            "investimento": invest.tolist(), "conversao": conv.tolist(), "ticket": ticket.tolist(), "cps": cps.tolist(), "dependencia": dep.tolist(),
            "total_receita": float(receita.sum()), "total_investimento": float(invest.sum()), "roas": float(receita.sum() / invest.sum()),
            "conv_media": float(vendas.sum() / sess_tot.sum()), "ticket_medio": float(receita.sum() / vendas.sum()), "sessoes_ano": float(sess_tot.sum()),
            "vendas_ano": float(vendas.sum()), "quebra": c["quebra"], "aprovada": float(receita.sum() * (1 - c["quebra"])),
            "var_total": float(receita.sum() / capt.sum() - 1), "var_mensal": (receita / capt - 1).tolist(),
            "meses_acima_60k": int((receita >= 60000).sum()),
            "kpis": [kpis[m] for m in projecao.MESES],
            "solucoes": SOLUCOES[nome] if nome != "otimista" else SOLUCOES["realista"] + SOLUCOES["otimista"],
        }
    saida["periodo_anterior"] = [dict(investimento=float(inv_h[i]), ticket_medio=float(ticket_h[i]), taxa_conversao=float(conv_h[i]),
                                      custo_por_sessao_paga=float(cps_h[i]), pct_sessoes_pagas=float(dep_h[i])) for i in range(12)]
    saida["ano_atual"] = {"receita": capt.tolist(), "total": float(capt.sum()), "investimento": float(inv_h.sum()), "conversao": float(d3["conversao"]["media"]["global"]),
                          "aprovada": float(d3["receita"]["aprovada"]), "roas": float(capt.sum() / inv_h.sum()), "sessoes": float(sess_h.sum()), "ticket": float(d3["ticket_medio"])}
    return saida


def gerar_graficos(cliente: Path, s: dict) -> None:
    graf = cliente / "entrega/ativos-aprovados/graficos"
    atual = s["ano_atual"]["receita"]
    c = s["cenarios"]
    g.linha(graf / "meta-realista-vs-ano-atual.png", "Receita do ano atual vs. cenário Realista (receita captada mensal)", "Receita captada (R$)", "R$",
            [("Ano atual (OUT/25 a SET/26)", atual, g.AZUL), ("Realista (OUT/26 a SET/27)", c["realista"]["receita"], g.LARANJA, "--")], rotulos_x=MESES_ROTULO)
    g.linha(graf / "cenarios-pessimista-realista-otimista.png", "Cenários de receita captada: ano atual e projeção de 12 meses", "Receita captada (R$)", "R$",
            [("Ano atual", atual, g.AZUL), ("Pessimista", c["pessimista"]["receita"], "#7a8594", "--"), ("Realista", c["realista"]["receita"], g.LARANJA, "--"),
             ("Otimista", c["otimista"]["receita"], g.VERDE, "--")], rotulos_x=MESES_ROTULO, altura=4.0)
    linhas = []
    for i, mes in enumerate(MESES_ROTULO):
        linha = [mes, g.brl(atual[i], 0)]
        for nome in ("pessimista", "realista", "otimista"):
            v = c[nome]["receita"][i]
            linha.append(f"{g.brl(v, 0)}\n" + f"{c[nome]['var_mensal'][i] * 100:+.1f}%".replace(".", ","))
        linhas.append(linha)
    total = ["TOTAL ANO", g.brl(sum(atual), 0)]
    for nome in ("pessimista", "realista", "otimista"):
        total.append(f"{g.brl(c[nome]['total_receita'], 0)}\n" + f"{c[nome]['var_total'] * 100:+.1f}%".replace(".", ","))
    g.tabela_cenarios(graf / "tabela-cenarios-projecao.png", "Receita captada mensal: ano atual e cenários", ["Mês", "Ano atual", "Pessimista", "Realista", "Otimista"],
                      linhas + [total], [0.16, 0.21, 0.21, 0.21, 0.21])


def gerar_planilha(cliente: Path, s: dict, entrada: Path) -> Path:
    destino = cliente / "entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx"
    destino.parent.mkdir(parents=True, exist_ok=True)
    entrada.write_text(json.dumps({
        "prospect": "Verdeluz Cosméticos Veganos", "periodo_anterior": s["periodo_anterior"],
        "realista": s["cenarios"]["realista"]["kpis"], "pessimista": s["cenarios"]["pessimista"]["kpis"], "otimista": s["cenarios"]["otimista"]["kpis"],
    }, ensure_ascii=False), encoding="utf-8")
    subprocess.run([sys.executable, str(RAIZ / "scripts/preencher_projecao_xlsx.py"), "--modelo", str(RAIZ / ".claude/skills/_shared/[MODELO] Projeção de Cenários.xlsx"),
                    "--input", str(entrada), "--output", str(destino)], check=True, stdout=sys.stderr)
    return destino


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    parser.add_argument("--entrada-planilha", type=Path, default=Path("/tmp/verdeluz-cenarios-planilha.json"))
    args = parser.parse_args()
    resumo = construir(args.cliente)
    gerar_graficos(args.cliente, resumo)
    gerar_planilha(args.cliente, resumo, args.entrada_planilha)
    print(json.dumps(resumo, ensure_ascii=False, indent=1))
