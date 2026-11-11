from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import plano_v2_exemplo as ex  # noqa: E402


def test_ler_data_valida():
    assert c.ler_data("26/10/2026", "x") == date(2026, 10, 26)


@pytest.mark.parametrize("ruim", ["2026-10-26", "26/10/26", "31/02/2027", "26/10/2026 10:00", "Imediato", ""])
def test_ler_data_invalida(ruim):
    with pytest.raises(c.ErroPlano, match="dd/mm/aaaa"):
        c.ler_data(ruim, "Ação 1, início")


def test_pisos():
    assert c.pisos_roas(0.20, None) == {"aprovada": pytest.approx(5.0), "captada": None}
    assert c.pisos_roas(0.20, 0.20)["captada"] == pytest.approx(6.25)


@pytest.mark.parametrize("m", [None, 0, -0.1, 1.5])
def test_pisos_sem_margem_valida(m):
    assert c.pisos_roas(m, 0.2) == {"aprovada": None, "captada": None}


def test_tabela_resumo_cronologica():
    linhas = c.tabela_resumo(ex.plano_valido())
    inicios = [c.ler_data(l["periodo"].split(" a ")[0], "") for l in linhas]
    assert inicios == sorted(inicios)
    assert set(linhas[0]) == {"numero", "acao", "frente", "horizonte", "periodo", "dono"}


def test_texto_depende():
    assert c.texto_depende({"depende_de": []}) == "Nenhuma"
    assert c.texto_depende({"depende_de": [2]}) == "Ação 2"
    assert c.texto_depende({"depende_de": [2, 5]}) == "Ações 2, 5"


def test_constantes_e_acoes():
    assert c.HORIZONTES == ("Imediato", "Curto prazo", "Médio prazo")
    assert len(c.FRENTES) == 5 and len(c.CAMPOS_ACAO) == 10
    plano = ex.plano_valido()
    pares = c.acoes(plano)
    assert [h for h, _ in pares][0] == "Imediato"
    assert {a["frente"] for _, a in pares} == set(c.FRENTES)
    assert [a["numero"] for a in c.acoes_cronologicas(plano)] == [1, 2, 3, 4, 5, 6]


def test_plano_valido_cumpre_as_regras_do_exemplo():
    plano = ex.plano_valido()
    pares = c.acoes(plano)
    por_num = {a["numero"]: a for _, a in pares}
    ini, fim = (c.ler_data(plano["janela_prova"][k], "j") for k in ("inicio", "fim"))
    ref, ciclo = c.ler_data(plano["data_referencia"], "r"), c.ler_data(plano["fim_ciclo"], "f")
    for h, a in pares:
        i, e = c.ler_data(a["inicio"], "i"), c.ler_data(a["entrega"], "e")
        assert ref <= i <= e <= ciclo
        assert a["dono"].rsplit(" · ", 1)[1] in {"Boomer", "Cliente"}
        assert a["gatilho"].startswith("Se ") and " então " in a["gatilho"]
        for d in a["depende_de"]:
            assert c.ler_data(por_num[d]["entrega"], "d") <= i
        if a["alavanca_da_meta"]:
            assert ini <= i and e <= fim
        if h == "Imediato":
            assert (e - i).days <= 7
        assert not a["acao"].lower().startswith(("otimizar", "acompanhar", "priorizar", "direcionar", "melhorar", "auditar", "mapear", "investigar"))
    assert any(a["depende_de"] == [1] for _, a in pares)
    assert any(h == "Médio prazo" and not a["alavanca_da_meta"] and c.ler_data(a["entrega"], "e") > fim for h, a in pares)
    cobertas = {s for _, a in pares for s in a["solucoes"]}
    assert cobertas == {s["id"] for p in ex.registro_valido()["problemas"] for s in p["solucoes"]}
    assert "[VALIDAR]" not in str(plano) and "[PREENCHER]" not in str(plano)
