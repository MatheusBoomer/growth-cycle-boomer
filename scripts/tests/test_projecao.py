from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import projecao as p  # noqa: E402

# Receita A-1 com sazonalidade de e-commerce: novembro e dezembro fortes, início do ano fraco.
HISTORICO = {
    "janeiro": 80_000, "fevereiro": 70_000, "março": 85_000, "abril": 80_000,
    "maio": 100_000, "junho": 90_000, "julho": 85_000, "agosto": 90_000,
    "setembro": 85_000, "outubro": 95_000, "novembro": 160_000, "dezembro": 140_000,
}
TOTAL_A1 = sum(HISTORICO.values())


def _kpis_para_receita(receitas: dict[str, float]) -> dict[str, dict]:
    """KPIs Influenciadores que, pela cadeia, dão exatamente a receita pedida em cada mês."""
    # sessões pagas = inv / 1 ; totais = /0,5 ; vendas = *0,02 ; receita = *200 → receita = inv * 8
    return {
        m: {"investimento": r / 8, "ticket_medio": 200, "taxa_conversao": 0.02,
            "custo_por_sessao_paga": 1, "pct_sessoes_pagas": 0.5}
        for m, r in receitas.items()
    }


# ---------------------------------------------------------------------------
# Distribuição da meta: crescimento varia por mês
# ---------------------------------------------------------------------------

def test_soma_da_distribuicao_bate_com_a_meta():
    meta = TOTAL_A1 * 1.3
    dist = p.distribuir_sazonalmente(meta, HISTORICO)
    assert sum(dist.values()) == pytest.approx(meta, abs=0.01)


def test_crescimento_nao_e_igual_em_todo_mes():
    # Antes: dividir pelo peso do A-1 dava +30% em todos os meses.
    dist = p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO)
    crescimento = p.crescimento_por_mes(dist, HISTORICO)
    assert max(crescimento.values()) - min(crescimento.values()) > 0.10


def test_datas_do_varejo_e_meses_fortes_crescem_mais():
    cresc = p.crescimento_por_mes(p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO), HISTORICO)
    assert cresc["novembro"] == max(cresc.values())  # Black Friday + mês mais forte do A-1
    assert cresc["dezembro"] > cresc["setembro"]      # Natal
    assert cresc["maio"] > cresc["abril"]             # Dia das Mães
    assert cresc["fevereiro"] == min(cresc.values())  # mês mais fraco, sem data


def test_todo_mes_cresce_quando_a_meta_esta_acima_do_a1():
    dist = p.distribuir_sazonalmente(TOTAL_A1 * 1.1, HISTORICO)
    assert all(dist[m] > HISTORICO[m] for m in p.MESES)


def test_eventos_personalizados_substituem_o_calendario_padrao():
    # Sem datas, abril e janeiro (mesma receita no A-1) crescem igual; com uma data em abril, abril cresce mais.
    sem = p.crescimento_por_mes(p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO, {}), HISTORICO)
    assert sem["abril"] == pytest.approx(sem["janeiro"], abs=1e-4)
    com = p.crescimento_por_mes(
        p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO, {"abril": {"nome": "Páscoa", "peso": 0.4}}), HISTORICO
    )
    assert com["abril"] > com["janeiro"]


def test_meta_abaixo_do_a1_pesa_menos_nos_meses_fortes():
    cresc = p.crescimento_por_mes(p.distribuir_sazonalmente(TOTAL_A1 * 0.9, HISTORICO), HISTORICO)
    assert all(v < 0 for v in cresc.values())
    assert cresc["novembro"] > cresc["fevereiro"]  # novembro cai menos


def test_meta_igual_ao_a1_e_recusada_como_flat():
    with pytest.raises(p.CrescimentoFlatError):
        p.distribuir_sazonalmente(TOTAL_A1, HISTORICO)


def test_historico_uniforme_continua_recusado():
    with pytest.raises(p.DistribuicaoFlatError):
        p.distribuir_sazonalmente(1_200_000, {m: 100_000 for m in p.MESES})


def test_evento_com_mes_invalido_e_recusado():
    with pytest.raises(ValueError, match="Mês desconhecido"):
        p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO, {"novembr": {"peso": 0.5}})


# ---------------------------------------------------------------------------
# Crescimento flat em qualquer cenário
# ---------------------------------------------------------------------------

def test_mesmo_crescimento_em_todo_mes_e_recusado():
    flat = {m: v * 1.3 for m, v in HISTORICO.items()}
    with pytest.raises(p.CrescimentoFlatError, match="flat"):
        p.validar_crescimento_nao_flat(flat, HISTORICO)


def test_crescimento_quase_igual_tambem_e_recusado():
    # 28% a 32%: amplitude de 4 p.p. com média de 30% (mínimo 7,5 p.p.)
    quase = {m: v * (1.28 + 0.04 * (i % 2)) for i, (m, v) in enumerate(HISTORICO.items())}
    with pytest.raises(p.CrescimentoFlatError):
        p.validar_crescimento_nao_flat(quase, HISTORICO)


# ---------------------------------------------------------------------------
# Pessimista nunca abaixo do A-1
# ---------------------------------------------------------------------------

def test_pessimista_abaixo_do_a1_em_um_mes_e_recusado():
    receitas = {m: v * (1.05 + 0.01 * i) for i, (m, v) in enumerate(HISTORICO.items())}
    receitas["fevereiro"] = HISTORICO["fevereiro"] * 0.95
    cenario = p.projetar_cenario(_kpis_para_receita(receitas))
    with pytest.raises(p.PessimistaAbaixoDoHistoricoError, match="fevereiro"):
        p.validar_pessimista_acima_do_historico(cenario, HISTORICO)


def test_pessimista_abaixo_do_a1_no_total_e_recusado():
    receitas = {m: v * 0.9 for m, v in HISTORICO.items()}
    cenario = p.projetar_cenario(_kpis_para_receita(receitas))
    with pytest.raises(p.PessimistaAbaixoDoHistoricoError, match="total do ano"):
        p.validar_pessimista_acima_do_historico(cenario, HISTORICO)


def test_pessimista_igual_ou_acima_do_a1_passa():
    receitas = {m: v * (1.0 + 0.01 * i) for i, (m, v) in enumerate(HISTORICO.items())}
    p.validar_pessimista_acima_do_historico(p.projetar_cenario(_kpis_para_receita(receitas)), HISTORICO)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _rodar(tmp_path: Path, comando: str, dados: dict) -> subprocess.CompletedProcess:
    entrada = tmp_path / "entrada.json"
    entrada.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    return subprocess.run(
        [sys.executable, str(RAIZ / "scripts" / "projecao.py"), comando, "--input", str(entrada)],
        capture_output=True, text=True,
    )


def test_cli_distribuir_devolve_crescimento_e_eventos(tmp_path):
    r = _rodar(tmp_path, "distribuir", {"meta_anual": TOTAL_A1 * 1.3, "historico_mensal": HISTORICO})
    assert r.returncode == 0, r.stderr
    saida = json.loads(r.stdout)
    assert saida["eventos_considerados"]["novembro"]["nome"] == "Black Friday"
    assert len(set(saida["crescimento_mensal"].values())) > 1


def test_cli_projetar_pessimista_abaixo_do_a1_sai_com_erro(tmp_path):
    receitas = {m: v * 0.95 for m, v in HISTORICO.items()}
    r = _rodar(tmp_path, "projetar", {
        "kpis_por_mes": _kpis_para_receita(receitas), "historico_mensal": HISTORICO, "cenario": "pessimista",
    })
    assert r.returncode == 1
    assert "Pessimista não pode ficar abaixo" in json.loads(r.stderr)["erro"]


def test_cli_projetar_pessimista_sem_historico_sai_com_erro(tmp_path):
    receitas = {m: v * 1.1 for m, v in HISTORICO.items()}
    r = _rodar(tmp_path, "projetar", {"kpis_por_mes": _kpis_para_receita(receitas), "cenario": "pessimista"})
    assert r.returncode == 1
    assert "historico_mensal" in json.loads(r.stderr)["erro"]


def test_cli_projetar_com_historico_devolve_crescimento(tmp_path):
    receitas = p.distribuir_sazonalmente(TOTAL_A1 * 1.3, HISTORICO)
    r = _rodar(tmp_path, "projetar", {
        "kpis_por_mes": _kpis_para_receita(receitas), "historico_mensal": HISTORICO,
        "cenario": "realista", "meta_anual": TOTAL_A1 * 1.3,
    })
    assert r.returncode == 0, r.stderr
    assert json.loads(r.stdout)["crescimento_mensal"]["novembro"] > 0.3
