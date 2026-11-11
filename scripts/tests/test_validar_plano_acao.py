from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import validar_plano_acao as v  # noqa: E402
from plano_v2_exemplo import plano_valido, registro_valido  # noqa: E402


def acao(plano: dict, numero: int) -> dict:
    for _, a in c.acoes(plano):
        if a["numero"] == numero:
            return a
    raise KeyError(numero)


def erros_de(plano, rascunho=False):
    erros, avisos = v.validar(plano, registro_valido(), rascunho=rascunho)
    assert avisos == []
    return erros


def tem(erros, trecho):
    return any(trecho in e for e in erros)


def test_plano_valido_passa():
    assert v.validar(plano_valido(), registro_valido()) == ([], [])


# --- uma mutação por regra: (nome, função que altera o plano, trecho esperado) ---

def _set(numero, campo, valor):
    def f(p):
        acao(p, numero)[campo] = valor
    return f


def _del(numero, campo):
    def f(p):
        del acao(p, numero)[campo]
    return f


def _ciclo(p):
    acao(p, 1)["depende_de"] = [2]
    acao(p, 2)["depende_de"] = [1]


def _horizontes_trocados(p):
    p["horizontes"][0], p["horizontes"][1] = p["horizontes"][1], p["horizontes"][0]


def _horizonte_extra(p):
    p["horizontes"].append({"nome": "Longo prazo", "titulo": "x", "intro": None, "acoes": []})


def _meta_data(p):
    p["abertura"]["metas"][0]["ate"] = "2027-01-25"


def _chave(caminho, valor):
    def f(p):
        alvo = p
        for k in caminho[:-1]:
            alvo = alvo[k]
        alvo[caminho[-1]] = valor
    return f


def _marcacao_aninhada(p):
    p["abertura"]["premissas"].append("Confirmar a verba [VALIDAR]")


CASOS = [
    ("versao", _chave(["versao"], 1), "versao 2"),
    ("horizontes_ordem", _horizontes_trocados, "Imediato, Curto prazo, Médio prazo"),
    ("horizontes_extra", _horizonte_extra, "Imediato, Curto prazo, Médio prazo"),
    ("numero_repetido", _set(2, "numero", 1), "número 1 repetido"),
    ("frente", _set(1, "frente", "Outra frente"), "frente"),
    ("frente_ausente", _del(1, "frente"), "frente"),
    ("data_entrega_31_02", _set(1, "entrega", "31/02/2027"), "dd/mm/aaaa"),
    ("data_inicio_iso", _set(1, "inicio", "2026-10-26"), "dd/mm/aaaa"),
    ("data_com_hora", _set(1, "inicio", "26/10/2026 10:00"), "dd/mm/aaaa"),
    ("data_referencia", _chave(["data_referencia"], "22-10-2026"), "dd/mm/aaaa"),
    ("data_referencia_ausente", _chave(["data_referencia"], None), "dd/mm/aaaa"),
    ("janela_inicio", _chave(["janela_prova", "inicio"], "32/10/2026"), "dd/mm/aaaa"),
    ("janela_fim", _chave(["janela_prova", "fim"], "hoje"), "dd/mm/aaaa"),
    ("fim_ciclo", _chave(["fim_ciclo"], "30/9/2027"), "dd/mm/aaaa"),
    ("meta_ate", _meta_data, "dd/mm/aaaa"),
    ("inicio_antes_da_referencia", _set(1, "inicio", "20/10/2026"), "antes da data de referência"),
    ("entrega_antes_do_inicio", _set(1, "entrega", "25/10/2026"), "entrega antes do início"),
    ("entrega_depois_do_fim", _set(6, "entrega", "01/10/2027"), "depois do fim do ciclo"),
    ("dono_sem_separador", _set(1, "dono", "Analista de dados"), "disciplina · empresa"),
    ("dono_separador_simples", _set(1, "dono", "Analista de dados - Boomer"), "disciplina · empresa"),
    ("dono_disciplina_vazia", _set(1, "dono", " · Boomer"), "disciplina · empresa"),
    ("dono_empresa_desconhecida", _set(1, "dono", "Analista · Terceiros SA"), "empresa"),
    ("dono_empresa_vazia", _set(1, "dono", "Analista · "), "empresa"),
    ("depende_inexistente", _set(3, "depende_de", [99]), "depende da ação 99"),
    ("depende_de_si", _set(1, "depende_de", [1]), "depende da ação 1"),
    ("depende_de_acao_que_termina_depois", _set(3, "depende_de", [4]), "depende da ação 4"),
    ("ciclo", _ciclo, "ciclo de dependência"),
    ("ciclo_lista_numeros", _ciclo, "1 → 2 → 1"),
    ("gatilho_sem_se_nem_entao", _set(1, "gatilho", "Escalar ao suporte"), "Se … então"),
    ("gatilho_sem_entao", _set(1, "gatilho", "Se os eventos não aparecerem escalar"), "Se … então"),
    ("gatilho_sem_se", _set(1, "gatilho", "Quando falhar então escalar"), "Se … então"),
    ("alavanca_fora_da_janela", _set(6, "alavanca_da_meta", True), "janela de prova"),
    ("marcacao_validar", _set(1, "como", "Entrar no GA4 [VALIDAR]"), "marcação"),
    ("marcacao_preencher", _set(1, "como", "[PREENCHER: margem]"), "marcação"),
    ("marcacao_aninhada", _marcacao_aninhada, "marcação"),
    ("margem_nula", _chave(["abertura", "margem_contribuicao"], None), "margem de contribuição"),
    ("margem_ausente", lambda p: p["abertura"].pop("margem_contribuicao"), "margem de contribuição"),
    ("margem_zero", _chave(["abertura", "margem_contribuicao"], 0), "margem de contribuição"),
]


@pytest.mark.parametrize("mutar,trecho", [(m, t) for _, m, t in CASOS], ids=[n for n, _, _ in CASOS])
def test_regra_de_erro(mutar, trecho):
    plano = copy.deepcopy(plano_valido())
    mutar(plano)
    erros = erros_de(plano)
    assert tem(erros, trecho), erros


@pytest.mark.parametrize("campo", c.CAMPOS_ACAO)
@pytest.mark.parametrize("vazio", ["", "   ", None])
def test_campo_vazio(campo, vazio):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)[campo] = vazio
    assert tem(erros_de(plano), f"campo {campo} vazio")


@pytest.mark.parametrize("campo", c.CAMPOS_ACAO)
def test_campo_ausente(campo):
    plano = copy.deepcopy(plano_valido())
    del acao(plano, 1)[campo]
    assert tem(erros_de(plano), f"campo {campo} vazio")


def test_mensagem_de_acao_traz_numero_e_nome():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["entrega"] = "25/10/2026"
    erros = erros_de(plano)
    assert any(e.startswith('Ação 1 ("Desativar o limiar de dados no GA4"): ') for e in erros), erros


def test_data_31_02_vira_erro_nao_excecao():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 2)["entrega"] = "31/02/2027"
    erros = erros_de(plano)
    assert tem(erros, "31/02/2027") and tem(erros, "dd/mm/aaaa")


def test_alavanca_da_meta_medio_prazo_diz_acao_data_e_fim_da_janela():
    plano = copy.deepcopy(plano_valido())
    a = acao(plano, 6)
    a["alavanca_da_meta"] = True
    a["entrega"] = "15/03/2027"
    erros = erros_de(plano)
    msg = next(e for e in erros if "janela de prova" in e)
    assert msg.startswith('Ação 6 ("Implantar a rotina mensal de revisão do plano"): ')
    assert "15/03/2027" in msg and "25/01/2027" in msg


def test_alavanca_da_meta_inicio_fora_da_janela():
    plano = copy.deepcopy(plano_valido())
    a = acao(plano, 2)
    a["inicio"] = "23/10/2026"  # depois da referência, antes da janela
    erros = erros_de(plano)
    assert tem(erros, "janela de prova") and tem(erros, "25/01/2027")


def test_acao_fora_da_janela_sem_alavanca_da_meta_passa():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 6)["entrega"] = "15/03/2027"
    assert erros_de(plano) == []


def test_ciclo_nao_gera_recursao_e_lista_numeros():
    plano = copy.deepcopy(plano_valido())
    # ciclo 3 -> 4 -> 5 -> 3 em datas coerentes
    acao(plano, 3)["depende_de"] = [5]
    acao(plano, 4)["depende_de"] = [3]
    acao(plano, 5)["depende_de"] = [4]
    erros = erros_de(plano)
    msg = next(e for e in erros if "ciclo de dependência" in e)
    for n in ("3", "4", "5"):
        assert n in msg


def test_dependencia_valida_em_cadeia_passa():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 4)["depende_de"] = [3]
    acao(plano, 4)["inicio"] = "30/11/2026"  # entrega da 3 == início da 4 é permitido
    assert erros_de(plano) == []


def test_gatilho_case_insensitive_passa():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["gatilho"] = "  SE o evento falhar ENTÃO escalar  "
    assert erros_de(plano) == []


def test_dono_aceita_prospect_e_parceira():
    plano = copy.deepcopy(plano_valido())
    plano["agencia_parceira"] = "Parceira X"
    acao(plano, 1)["dono"] = "Analista · Marca Teste"
    acao(plano, 2)["dono"] = "Analista · Parceira X"
    acao(plano, 3)["dono"] = "Analista · Cliente"
    assert erros_de(plano) == []


def test_dono_parceira_nula_nao_vira_empresa_valida():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["dono"] = "Analista · None"
    assert tem(erros_de(plano), "empresa")


def test_dono_empresa_comparada_exatamente():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["dono"] = "Analista · boomer"
    assert tem(erros_de(plano), "empresa")


def test_rascunho_aceita_marcacao_e_margem_nula():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["como"] = "[PREENCHER: margem]"
    plano["abertura"]["margem_contribuicao"] = None
    assert erros_de(plano, rascunho=True) == []
    erros = erros_de(plano, rascunho=False)
    assert tem(erros, "marcação") and tem(erros, "margem de contribuição")


def test_rascunho_aceita_margem_nula_sozinha():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = None
    assert erros_de(plano, rascunho=True) == []


def test_rascunho_ainda_recusa_margem_invalida():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = 5
    assert tem(erros_de(plano, rascunho=True), "margem de contribuição")


def test_rascunho_nao_perdoa_outros_erros():
    plano = copy.deepcopy(plano_valido())
    plano["versao"] = 1
    assert tem(erros_de(plano, rascunho=True), "versao 2")


# --- entrada malformada nunca levanta ---

@pytest.mark.parametrize("ruim", [None, [], "texto", 42, {}, {"versao": 2}])
def test_plano_malformado_na_raiz(ruim):
    erros, avisos = v.validar(ruim, registro_valido())
    assert erros and avisos == []


def _malformar(p, caminho, valor):
    alvo = p
    for k in caminho[:-1]:
        alvo = alvo[k]
    alvo[caminho[-1]] = valor


@pytest.mark.parametrize(
    "caminho,valor",
    [
        (["horizontes"], "Imediato"),
        (["horizontes"], None),
        (["horizontes", 0], "texto"),
        (["horizontes", 0, "acoes"], None),
        (["horizontes", 0, "acoes"], "x"),
        (["horizontes", 0, "acoes", 0], "x"),
        (["horizontes", 0, "acoes", 0, "numero"], "um"),
        (["horizontes", 0, "acoes", 0, "numero"], None),
        (["horizontes", 0, "acoes", 0, "numero"], [1]),
        (["horizontes", 0, "acoes", 0, "depende_de"], "2"),
        (["horizontes", 0, "acoes", 0, "depende_de"], ["a", None, 2.5]),
        (["horizontes", 0, "acoes", 0, "depende_de"], 7),
        (["horizontes", 0, "acoes", 0, "dono"], 12),
        (["horizontes", 0, "acoes", 0, "gatilho"], 12),
        (["horizontes", 0, "acoes", 0, "inicio"], 20261026),
        (["horizontes", 0, "acoes", 0, "alavanca_da_meta"], "sim"),
        (["janela_prova"], None),
        (["janela_prova"], "26/10/2026"),
        (["janela_prova"], {}),
        (["abertura"], None),
        (["abertura"], "x"),
        (["abertura", "metas"], "x"),
        (["abertura", "metas"], [None, 1]),
        (["abertura", "margem_contribuicao"], "0,20"),
        (["abertura", "margem_contribuicao"], True),
        (["data_referencia"], 20261022),
        (["fim_ciclo"], None),
        (["prospect"], None),
        (["empresa_agencia"], None),
    ],
)
def test_estrutura_quebrada_vira_erro_sem_excecao(caminho, valor):
    plano = copy.deepcopy(plano_valido())
    _malformar(plano, caminho, valor)
    erros, avisos = v.validar(plano, registro_valido())
    assert isinstance(erros, list) and all(isinstance(e, str) for e in erros)
    assert avisos == []


def test_estrutura_quebrada_numero_nao_inteiro_gera_erro():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["numero"] = "um"
    assert erros_de(plano)


def test_registro_pode_ser_qualquer_coisa_nesta_etapa():
    assert v.validar(plano_valido(), None) == ([], [])
