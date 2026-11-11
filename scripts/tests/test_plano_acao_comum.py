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
from validar_plano_acao import validar  # noqa: E402


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
    # Sem erros e sem avisos: o exemplo atende a todas as regras do validador.
    assert validar(ex.plano_valido(), ex.registro_valido()) == ([], [])


def test_ler_data_rejeita_digitos_unicode():
    with pytest.raises(c.ErroPlano, match="dd/mm/aaaa"):
        c.ler_data("٢٦/١٠/٢٠٢٦", "x")


def _plano_fora_de_ordem():
    def a(numero, inicio):
        return {"numero": numero, "acao": f"A{numero}", "frente": c.FRENTES[0],
                "inicio": inicio, "entrega": "30/12/2026", "dono": "X · Boomer"}
    return {"horizontes": [
        {"nome": "Imediato", "acoes": [a(5, "10/11/2026"), a(2, "03/11/2026")]},
        {"nome": "Curto prazo", "acoes": [a(4, "03/11/2026"), a(1, "26/10/2026")]},
        {"nome": "Médio prazo", "acoes": [a(3, "02/11/2026")]},
    ]}


def test_acoes_cronologicas_ordena_por_inicio_e_desempata_por_numero():
    # 1 (26/10), 3 (02/11), 2 e 4 empatadas em 03/11 (numero menor primeiro), 5 (10/11)
    assert [a["numero"] for a in c.acoes_cronologicas(_plano_fora_de_ordem())] == [1, 3, 2, 4, 5]


def test_tabela_resumo_ordena_e_mantem_o_horizonte_de_cada_acao():
    linhas = c.tabela_resumo(_plano_fora_de_ordem())
    assert [l["numero"] for l in linhas] == [1, 3, 2, 4, 5]
    assert {l["numero"]: l["horizonte"] for l in linhas} == {
        1: "Curto prazo", 3: "Médio prazo", 2: "Imediato", 4: "Curto prazo", 5: "Imediato"}
    assert linhas[0]["periodo"] == "26/10/2026 a 30/12/2026"


def test_formatar_decimal_usa_virgula():
    assert c.formatar_decimal(5.0) == "5,00"
    assert c.formatar_decimal(6.25) == "6,25"
    assert c.formatar_decimal(1 / 0.3) == "3,33"
    assert c.formatar_decimal(2.5, 1) == "2,5"
    assert c.formatar_decimal(1234.5) == "1234,50"


def test_formatar_percentual_inteiro_quando_redondo():
    assert c.formatar_percentual(0.20) == "20%"
    assert c.formatar_percentual(0.055) == "5,5%"
    assert c.formatar_percentual(0.361) == "36,1%"
    assert c.formatar_percentual(0.2) == "20%"


def test_texto_piso_roas_com_margem_e_quebra():
    plano = ex.plano_valido()
    assert c.texto_piso_roas(plano) == [
        "Piso de ROAS sobre a receita aprovada: 5,00 (1 ÷ margem de 20%).",
        "Sobre a receita captada: 6,25 (com quebra de 20%).",
    ]


def test_texto_piso_roas_sem_quebra():
    plano = ex.plano_valido()
    plano["abertura"]["taxa_quebra"] = None
    assert c.texto_piso_roas(plano) == ["Piso de ROAS sobre a receita aprovada: 5,00 (1 ÷ margem de 20%)."]


def test_texto_piso_roas_sem_margem():
    plano = ex.plano_valido()
    plano["abertura"]["margem_contribuicao"] = None
    assert c.texto_piso_roas(plano) == ["Piso de ROAS: [PREENCHER: margem de contribuição]"]


def test_acoes_cronologicas_com_horizonte_pareia_horizonte_e_acao_na_ordem_cronologica():
    pares = c.acoes_cronologicas_com_horizonte(_plano_fora_de_ordem())
    assert [(h, a["numero"]) for h, a in pares] == [
        ("Curto prazo", 1), ("Médio prazo", 3), ("Imediato", 2), ("Curto prazo", 4), ("Imediato", 5)]
    assert [a for _, a in pares] == c.acoes_cronologicas(_plano_fora_de_ordem())


def test_diferencas():
    import copy
    a = ex.plano_valido()
    b = copy.deepcopy(a)
    medio = b["horizontes"][2]["acoes"]
    medio[:] = [x for x in medio if x["numero"] != 6]
    b["horizontes"][0]["acoes"][1]["como"] = "Reconfigurar o fluxo de lembrete de PIX e boleto."
    nova = copy.deepcopy(a["horizontes"][2]["acoes"][0])
    nova["numero"] = 7
    nova["acao"] = "Ação nova"
    medio.append(nova)
    b["abertura"]["metas"][0]["para"] = "22%"
    kpi = a["abertura"]["metas"][0]["kpi"]
    assert c.diferencas(a, b) == {
        "incluidas": [7],
        "removidas": [6],
        "alteradas": {2: ["como"]},
        "metas_alteradas": [kpi],
    }
    assert c.diferencas(a, a) == {"incluidas": [], "removidas": [], "alteradas": {}, "metas_alteradas": []}


def test_diferencas_horizonte_dependencias_solucoes_e_metas_incluidas_removidas():
    import copy
    a = ex.plano_valido()
    b = copy.deepcopy(a)
    acao3 = b["horizontes"][1]["acoes"].pop(0)
    acao3["depende_de"] = []
    acao3["solucoes"] = ["P1.S1"]
    acao3["alavanca_da_meta"] = False
    acao3["frente"] = "Eficiência Operacional"
    b["horizontes"][0]["acoes"].append(acao3)
    b["abertura"]["metas"].append({"kpi": "ROAS", "de": "2", "para": "3", "ate": "25/01/2027", "fonte": "x"})
    d = c.diferencas(a, b)
    assert d["incluidas"] == [] and d["removidas"] == []
    assert d["alteradas"] == {3: ["frente", "horizonte", "depende_de", "alavanca_da_meta", "solucoes"]}
    assert d["metas_alteradas"] == ["ROAS"]
    # meta removida também conta
    assert c.diferencas(b, a)["metas_alteradas"] == ["ROAS"]
