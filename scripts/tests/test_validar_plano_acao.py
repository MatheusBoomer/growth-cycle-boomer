from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import validar_plano_acao as v  # noqa: E402
from plano_v2_exemplo import plano_com_ondas, plano_valido, registro_valido  # noqa: E402


def acao(plano: dict, numero: int) -> dict:
    for _, a in c.acoes(plano):
        if a["numero"] == numero:
            return a
    raise KeyError(numero)


def erros_de(plano, rascunho=False):
    erros, _ = v.validar(plano, registro_valido(), rascunho=rascunho)
    return erros


def tem(erros, trecho):
    return any(trecho in e for e in erros)


def sem_aviso_de_ondas(avisos):
    """Tira o aviso "Plano sem ondas", que todo plano sem a chave `ondas` recebe."""
    return [a for a in avisos if "sem ondas" not in a]


def test_plano_valido_passa():
    erros, avisos = v.validar(plano_valido(), registro_valido())
    assert erros == [] and sem_aviso_de_ondas(avisos) == []


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
    assert erros and isinstance(avisos, list)


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
        (["horizontes", 0, "acoes", 0, "depende_de"], [[1]]),
        (["horizontes", 0, "acoes", 0, "depende_de"], [{"a": 1}]),
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
        (["empresa_agencia"], None),
    ],
)
def test_estrutura_quebrada_vira_erro_sem_excecao(caminho, valor):
    plano = copy.deepcopy(plano_valido())
    _malformar(plano, caminho, valor)
    erros, avisos = v.validar(plano, registro_valido())
    assert isinstance(erros, list) and all(isinstance(e, str) for e in erros)
    assert isinstance(avisos, list)
    assert erros, f"{caminho} = {valor!r} deveria gerar erro"


def test_prospect_ausente_nao_levanta():
    plano = copy.deepcopy(plano_valido())
    plano["prospect"] = None
    erros, avisos = v.validar(plano, registro_valido())
    assert isinstance(erros, list) and isinstance(avisos, list)


def test_estrutura_quebrada_numero_nao_inteiro_gera_erro():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["numero"] = "um"
    assert erros_de(plano)


@pytest.mark.parametrize("valor", ["true", "sim", 1, 0, None])
def test_alavanca_da_meta_precisa_ser_booleano(valor):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 6)["alavanca_da_meta"] = valor
    assert tem(erros_de(plano), "alavanca_da_meta")


def test_alavanca_da_meta_string_nao_burla_a_janela_de_prova():
    plano = copy.deepcopy(plano_valido())
    a = acao(plano, 6)
    a["alavanca_da_meta"] = "true"
    assert tem(erros_de(plano), "alavanca_da_meta")


# --- cobertura das soluções ---

def test_solucao_do_registro_sem_acao_bloqueia():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 4)["solucoes"] = []
    erros = erros_de(plano)
    assert "Solução P1.S2 do registro não virou nenhuma ação do plano." in erros


def test_acao_citando_solucao_inexistente_bloqueia():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 3)["solucoes"] = ["P9.S1"]
    erros = erros_de(plano)
    assert any("cita a solução P9.S1, que não existe no registro." in e and "Ação 3" in e for e in erros), erros


@pytest.mark.parametrize("valor", ["P1.S1", [["P1.S1"]], [1]])
def test_solucoes_precisa_ser_lista_de_textos(valor):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 3)["solucoes"] = valor
    assert tem(erros_de(plano), "solucoes")


def test_solucoes_ausente_equivale_a_lista_vazia():
    plano = copy.deepcopy(plano_valido())
    del acao(plano, 3)["solucoes"]
    assert erros_de(plano) == []


def test_registro_inutilizavel_vira_erro():
    for ruim in (None, [], {}, {"problemas": "x"}):
        erros, _ = v.validar(plano_valido(), ruim)
        assert tem(erros, "registro"), ruim


# --- avisos ---

def avisos_de(plano, rascunho=False):
    erros, avisos = v.validar(plano, registro_valido(), rascunho=rascunho)
    assert erros == [], erros
    return sem_aviso_de_ondas(avisos)


@pytest.mark.parametrize("verbo", ["Otimizar", "acompanhar", "Priorizar", "direcionar", "Melhorar"])
def test_aviso_verbo_vago(verbo):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 6)["acao"] = f"{verbo} a rotina de revisão"
    avisos = avisos_de(plano)
    assert len(avisos) == 1 and "Ação 6" in avisos[0] and "vago" in avisos[0]


def test_aviso_diagnostico_sem_acao_que_dependa_dele():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 6)["acao"] = "Auditar a rotina de revisão"
    avisos = avisos_de(plano)
    assert len(avisos) == 1 and "Ação 6" in avisos[0] and "depend" in avisos[0]


def test_diagnostico_com_acao_dependente_nao_avisa():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["acao"] = "Mapear os eventos do GA4"  # a ação 3 depende da 1
    assert avisos_de(plano) == []


def test_aviso_frente_sem_acao():
    plano = copy.deepcopy(plano_valido())
    for h in plano["horizontes"]:
        h["acoes"] = [a for a in h["acoes"] if a["numero"] != 5]
    avisos = avisos_de(plano)
    assert len(avisos) == 1 and "Redução de Dependências" in avisos[0]


def test_aviso_imediato_com_mais_de_sete_dias():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 2)["entrega"] = "03/11/2026"  # 8 dias
    avisos = avisos_de(plano)
    assert len(avisos) == 1 and "Ação 2" in avisos[0] and "7 dias" in avisos[0]


def test_imediato_com_exatamente_sete_dias_nao_avisa():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 2)["entrega"] = "02/11/2026"  # 7 dias
    assert avisos_de(plano) == []


def test_aviso_margem_ausente_so_em_rascunho():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = None
    avisos = avisos_de(plano, rascunho=True)
    assert len(avisos) == 1 and "margem" in avisos[0]
    erros, avisos_final = v.validar(plano, registro_valido())
    assert tem(erros, "margem") and sem_aviso_de_ondas(avisos_final) == []


# --- CLI ---

def _gravar(tmp_path, plano=None, registro=None):
    p, r = tmp_path / "plano.json", tmp_path / "registro.json"
    p.write_text(json.dumps(plano_valido() if plano is None else plano, ensure_ascii=False), encoding="utf-8")
    r.write_text(json.dumps(registro_valido() if registro is None else registro, ensure_ascii=False), encoding="utf-8")
    return ["--plano", str(p), "--registro", str(r)]


def test_cli_plano_valido(tmp_path, capsys):
    assert v.main(_gravar(tmp_path)) == 0
    linhas = capsys.readouterr().out.splitlines()
    assert linhas[-1] == "OK: 6 ações, 3 soluções cobertas."
    assert len(linhas) == 2 and linhas[0].startswith("AVISO: Plano sem ondas")


def test_cli_avisos_vao_para_stdout_antes_do_ok(tmp_path, capsys):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 6)["acao"] = "Melhorar a rotina de revisão"
    assert v.main(_gravar(tmp_path, plano)) == 0
    linhas = capsys.readouterr().out.splitlines()
    assert linhas[0].startswith("AVISO: ") and linhas[-1].startswith("OK: 6 ações")


def test_cli_plano_invalido(tmp_path, capsys):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 4)["solucoes"] = []
    assert v.main(_gravar(tmp_path, plano)) == 1
    cap = capsys.readouterr()
    assert cap.err.startswith("ERRO: ") and "P1.S2" in cap.err and "OK:" not in cap.out


def test_cli_rascunho_aceita_marcacao_e_margem_ausente(tmp_path, capsys):
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = None
    acao(plano, 6)["kpi_meta"] = "[VALIDAR: meta com o cliente]"
    argv = _gravar(tmp_path, plano)
    assert v.main(argv) == 1
    capsys.readouterr()
    assert v.main(argv + ["--rascunho"]) == 0
    out = capsys.readouterr().out
    assert "AVISO: " in out and "OK:" in out


@pytest.mark.parametrize("conteudo", [None, "{ruim", "[1, 2"])
def test_cli_json_ausente_ou_quebrado_vira_erro(tmp_path, capsys, conteudo):
    argv = _gravar(tmp_path)
    plano_arq = tmp_path / "plano.json"
    if conteudo is None:
        plano_arq.unlink()
    else:
        plano_arq.write_text(conteudo, encoding="utf-8")
    assert v.main(argv) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO:") and "Traceback" not in err


def test_cli_registro_quebrado_vira_erro(tmp_path, capsys):
    argv = _gravar(tmp_path)
    (tmp_path / "registro.json").write_text("{ruim", encoding="utf-8")
    assert v.main(argv) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO:") and "registro" in err and "Traceback" not in err


def test_cli_arquivo_nao_utf8(tmp_path, capsys):
    argv = _gravar(tmp_path)
    (tmp_path / "plano.json").write_bytes(b"\xff\xfe")
    assert v.main(argv) == 1
    assert capsys.readouterr().err.startswith("ERRO:")


@pytest.mark.parametrize("deps", [[[1]], [{"a": 1}]])
def test_cli_depende_de_malformado_nao_levanta(tmp_path, capsys, deps):
    plano = copy.deepcopy(plano_valido())
    acao(plano, 1)["acao"] = "Auditar o GA4"  # ativa o aviso que consulta as dependências
    acao(plano, 1)["depende_de"] = deps
    assert v.main(_gravar(tmp_path, plano)) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO:") and "depende" in err and "Traceback" not in err


# --- onda final de correções ---

@pytest.mark.parametrize("rascunho", [False, True])
def test_alavanca_da_meta_ausente_e_erro(rascunho):
    plano = copy.deepcopy(plano_valido())
    del acao(plano, 6)["alavanca_da_meta"]
    assert tem(erros_de(plano, rascunho=rascunho), "alavanca_da_meta")


@pytest.mark.parametrize("rascunho", [False, True])
def test_alavanca_da_meta_ausente_nao_burla_janela(rascunho):
    plano = copy.deepcopy(plano_valido())
    a = acao(plano, 6)
    del a["alavanca_da_meta"]
    a["entrega"] = "15/03/2027"
    assert tem(erros_de(plano, rascunho=rascunho), "alavanca_da_meta")


@pytest.mark.parametrize("valor", [5.5, 1, 1.0, -0.1, "0.055", True, False])
def test_taxa_quebra_invalida(valor):
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["taxa_quebra"] = valor
    erros = erros_de(plano)
    assert tem(erros, "taxa_quebra inválida: use fração entre 0 e 1 (ex.: 0.055)"), erros


@pytest.mark.parametrize("valor", [None, 0, 0.055, 0.2])
def test_taxa_quebra_valida(valor):
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["taxa_quebra"] = valor
    assert erros_de(plano) == []


def test_rascunho_margem_com_marcador_vale_como_ausente():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = "[PREENCHER: margem do cliente]"
    erros, avisos = v.validar(plano, registro_valido(), rascunho=True)
    assert erros == [], erros
    assert any("margem" in a for a in avisos)


def test_final_margem_com_marcador_continua_erro():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = "[PREENCHER: margem do cliente]"
    erros = erros_de(plano)
    assert tem(erros, "margem de contribuição") and tem(erros, "marcação")


def test_rascunho_margem_texto_comum_continua_invalida():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["margem_contribuicao"] = "vinte por cento"
    assert tem(erros_de(plano, rascunho=True), "margem de contribuição")


def test_abertura_cenario_vazio_e_erro_no_final():
    for vazio in ("", "  ", None):
        plano = copy.deepcopy(plano_valido())
        plano["abertura"]["cenario"] = vazio
        assert tem(erros_de(plano), "abertura.cenario"), vazio
    plano["abertura"]["cenario"] = ""
    assert not tem(erros_de(plano, rascunho=True), "abertura.cenario")


def test_abertura_metas_vazias_e_erro_no_final():
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["metas"] = []
    assert tem(erros_de(plano), "abertura.metas")
    assert not tem(erros_de(plano, rascunho=True), "abertura.metas")
    del plano["abertura"]["metas"]
    assert tem(erros_de(plano), "abertura.metas")


@pytest.mark.parametrize("campo", ["kpi", "de", "para", "ate", "fonte"])
@pytest.mark.parametrize("vazio", ["", "  ", None])
def test_meta_sem_campo_e_erro_no_final(campo, vazio):
    plano = copy.deepcopy(plano_valido())
    plano["abertura"]["metas"][0][campo] = vazio
    assert tem(erros_de(plano), f"abertura.metas[1].{campo}")


@pytest.mark.parametrize("campo", ["kpi", "de", "para", "fonte"])
def test_meta_sem_chave_e_erro_no_final(campo):
    plano = copy.deepcopy(plano_valido())
    del plano["abertura"]["metas"][0][campo]
    assert tem(erros_de(plano), f"abertura.metas[1].{campo}")


def test_janela_inicio_depois_do_fim():
    plano = copy.deepcopy(plano_valido())
    plano["janela_prova"]["inicio"] = "26/01/2027"
    assert tem(erros_de(plano), "janela de prova: o início")


def test_janela_fim_depois_do_fim_do_ciclo():
    plano = copy.deepcopy(plano_valido())
    plano["janela_prova"]["fim"] = "01/10/2027"
    assert tem(erros_de(plano), "depois do fim do ciclo")


def test_janela_inicio_antes_da_referencia():
    plano = copy.deepcopy(plano_valido())
    plano["janela_prova"]["inicio"] = "21/10/2026"
    assert tem(erros_de(plano), "antes da data de referência")


@pytest.mark.parametrize("fim", ["18/01/2027", "30/01/2027"])  # 84 e 96 dias desde 26/10/2026
def test_janela_fora_de_85_a_95_dias_avisa(fim):
    plano = copy.deepcopy(plano_valido())
    plano["janela_prova"]["fim"] = fim
    erros, avisos = v.validar(plano, registro_valido())
    assert erros == [], erros
    texto = " ".join(avisos)
    assert "janela de prova" in texto and "85" in texto and "95" in texto


@pytest.mark.parametrize("fim", ["19/01/2027", "29/01/2027"])  # 85 e 95 dias
def test_janela_nos_limites_85_95_nao_avisa(fim):
    plano = copy.deepcopy(plano_valido())
    plano["janela_prova"]["fim"] = fim
    erros, avisos = v.validar(plano, registro_valido())
    assert erros == [] and sem_aviso_de_ondas(avisos) == []


# --- ondas, checkpoints, decisões do cliente e blocos novos (todos opcionais) ---

KPIS = [{"kpi": "Taxa de quebra", "meta_limite": "Meta 25%; acima de 30% volta ao Contenção"}]


def com_ondas():
    """plano_com_ondas() com kpis_acompanhamento: o ponto de partida sem ERRO e sem AVISO."""
    plano = copy.deepcopy(plano_com_ondas())
    plano["kpis_acompanhamento"] = copy.deepcopy(KPIS)
    plano["como_funciona"] = [{"titulo": "Lógica do plano", "texto": "Três ondas com checkpoint."}]
    plano["protocolo_mudanca"] = {"intro": "Uma mudança por vez.", "regras": ["Fazer backup antes."]}
    plano["metas_mensais"] = {
        "cenario": "Realista",
        "colunas": ["Mês", "Receita (R$)"],
        "linhas": [["Nov/26", "100,00"], ["Dez/26", "200,00"]],
        "observacao": None,
    }
    return plano


def validar_plano(plano, rascunho=False):
    return v.validar(plano, registro_valido(), rascunho=rascunho)


def onda(plano, numero):
    return next(o for o in plano["ondas"] if o["numero"] == numero)


def test_plano_com_ondas_valido_passa():
    assert validar_plano(com_ondas()) == ([], [])


def test_plano_antigo_sem_ondas_so_avisa():
    erros, avisos = validar_plano(plano_valido())
    assert erros == []
    assert len(avisos) == 1 and "sem ondas" in avisos[0]


def test_plano_com_ondas_sem_kpis_avisa():
    plano = com_ondas()
    del plano["kpis_acompanhamento"]
    erros, avisos = validar_plano(plano)
    assert erros == []
    assert len(avisos) == 1 and "kpis_acompanhamento" in avisos[0]


@pytest.mark.parametrize("chave", ["como_funciona", "protocolo_mudanca", "metas_mensais"])
@pytest.mark.parametrize("vazio", ["ausente", None])
def test_plano_com_ondas_sem_bloco_obrigatorio_da_skill_avisa(chave, vazio):
    plano = com_ondas()
    if vazio == "ausente":
        del plano[chave]
    else:
        plano[chave] = vazio
    erros, avisos = validar_plano(plano)
    assert erros == []
    assert len(avisos) == 1 and chave in avisos[0], avisos


def test_plano_com_ondas_com_como_funciona_vazio_avisa():
    plano = com_ondas()
    plano["como_funciona"] = []
    erros, avisos = validar_plano(plano)
    assert erros == [] and len(avisos) == 1 and "como_funciona" in avisos[0]


def test_plano_com_ondas_sem_os_tres_blocos_da_um_aviso_por_bloco():
    plano = com_ondas()
    for chave in ("como_funciona", "protocolo_mudanca", "metas_mensais"):
        del plano[chave]
    erros, avisos = validar_plano(plano)
    assert erros == [] and len(avisos) == 3


def test_plano_sem_ondas_nao_cobra_os_blocos_das_ondas():
    erros, avisos = validar_plano(plano_valido())
    assert erros == [] and len(avisos) == 1 and "sem ondas" in avisos[0]


def test_kpis_acompanhamento_vazio_equivale_a_ausente():
    plano = com_ondas()
    plano["kpis_acompanhamento"] = []
    erros, avisos = validar_plano(plano)
    assert erros == []
    assert len(avisos) == 1 and "kpis_acompanhamento" in avisos[0]


def test_ondas_lista_vazia_equivale_a_sem_ondas():
    plano = com_ondas()
    plano["ondas"] = []
    erros, avisos = validar_plano(plano)
    assert erros == [] and any("sem ondas" in a for a in avisos)


def _ondas_fora_de_ordem(p):
    p["ondas"][0], p["ondas"][1] = p["ondas"][1], p["ondas"][0]


def _ondas_sobrepostas(p):
    onda(p, 2)["inicio"] = "01/11/2026"  # a onda 1 termina em 01/11


def _numeracao_pulada(p):
    onda(p, 3)["numero"] = 5


def _numeracao_texto(p):
    onda(p, 2)["numero"] = "2"


def _primeira_antes_da_referencia(p):
    onda(p, 1)["inicio"] = "21/10/2026"  # referência: 22/10/2026


def _ultima_depois_do_fim_do_ciclo(p):
    onda(p, 3)["fim"] = "01/10/2027"  # fim do ciclo: 30/09/2027


def _onda_inicio_depois_do_fim(p):
    onda(p, 2)["fim"] = "01/11/2026"


def _onda_data_invalida(p):
    onda(p, 2)["inicio"] = "2026-11-02"


@pytest.mark.parametrize(
    "mutar, trecho",
    [
        (_ondas_fora_de_ordem, "fora de ordem"),
        (_ondas_sobrepostas, "Onda 2: começa em 01/11/2026, mas a Onda 1 só termina em 01/11/2026"),
        (_numeracao_pulada, "numeradas de 1 a 3"),
        (_numeracao_texto, "numeradas de 1 a 3"),
        (_primeira_antes_da_referencia, "Onda 1: início 21/10/2026 antes da data de referência 22/10/2026"),
        (_ultima_depois_do_fim_do_ciclo, "Onda 3: fim 01/10/2027 depois do fim do ciclo (30/09/2027)"),
        (_onda_inicio_depois_do_fim, "Onda 2: o início 02/11/2026 é depois do fim 01/11/2026"),
        (_onda_data_invalida, "Onda 2: "),
    ],
)
def test_regra_de_erro_das_ondas(mutar, trecho):
    plano = com_ondas()
    mutar(plano)
    assert tem(validar_plano(plano)[0], trecho), validar_plano(plano)[0]


@pytest.mark.parametrize("campo", ["nome", "calendario_midia", "objetivo"])
@pytest.mark.parametrize("vazio", ["", "   ", None])
def test_onda_com_campo_de_texto_vazio(campo, vazio):
    plano = com_ondas()
    onda(plano, 2)[campo] = vazio
    assert tem(validar_plano(plano)[0], f"Onda 2: campo {campo} vazio")


def test_onda_sem_a_chave_de_texto():
    plano = com_ondas()
    del onda(plano, 1)["objetivo"]
    assert tem(validar_plano(plano)[0], "Onda 1: campo objetivo vazio")


@pytest.mark.parametrize("campo", ["duracao", "pauta", "para_liberar", "quem_decide"])
@pytest.mark.parametrize("vazio", ["", "  ", None])
def test_checkpoint_com_campo_de_texto_vazio(campo, vazio):
    plano = com_ondas()
    onda(plano, 1)["checkpoint"][campo] = vazio
    assert tem(validar_plano(plano)[0], f"Onda 1: checkpoint.{campo} vazio")


def test_acao_em_duas_ondas():
    plano = com_ondas()
    onda(plano, 2)["acoes"].append(1)
    assert tem(validar_plano(plano)[0], 'Ação 1 ("Liberar os acessos"): está em mais de uma onda (Onda 1 e Onda 2)')


def test_acao_em_nenhuma_onda():
    plano = com_ondas()
    onda(plano, 3)["acoes"].remove(6)
    assert tem(
        validar_plano(plano)[0],
        'Ação 6 ("Implantar a rotina mensal de revisão do plano"): não está em nenhuma onda',
    )


def test_onda_cita_acao_que_nao_existe():
    plano = com_ondas()
    onda(plano, 2)["acoes"].append(99)
    assert tem(validar_plano(plano)[0], "Onda 2: cita a ação 99, que não existe no plano")


def test_inicio_da_acao_depois_da_janela_da_onda():
    plano = com_ondas()
    acao(plano, 4)["inicio"] = "01/12/2026"  # a onda 2 vai até 30/11/2026
    assert tem(
        validar_plano(plano)[0],
        'Ação 4 ("Checar ruptura de estoque continuamente"): início 01/12/2026 fora da janela '
        "da Onda 2 (02/11/2026 a 30/11/2026)",
    )


def test_inicio_da_acao_antes_da_janela_da_onda():
    plano = com_ondas()
    acao(plano, 3)["inicio"] = "01/11/2026"  # a onda 2 começa em 02/11/2026
    assert tem(validar_plano(plano)[0], "início 01/11/2026 fora da janela da Onda 2")


def test_entrega_da_acao_pode_passar_da_janela_da_onda():
    plano = com_ondas()
    assert acao(plano, 4)["entrega"] == "15/12/2026"  # a onda 2 termina em 30/11/2026
    assert validar_plano(plano)[0] == []


def test_inicio_da_acao_nos_limites_da_janela_passa():
    plano = com_ondas()
    assert acao(plano, 3)["inicio"] == onda(plano, 2)["inicio"]
    assert validar_plano(plano)[0] == []


def test_checkpoint_antes_do_inicio_da_onda():
    plano = com_ondas()
    onda(plano, 2)["checkpoint"]["data"] = "01/11/2026"  # a onda 2 começa em 02/11/2026
    assert tem(validar_plano(plano)[0], "Onda 2: checkpoint.data 01/11/2026 antes do início da onda (02/11/2026)")


def test_checkpoint_depois_do_inicio_da_onda_seguinte():
    plano = com_ondas()
    onda(plano, 1)["checkpoint"]["data"] = "03/11/2026"  # a onda 2 começa em 02/11/2026
    assert tem(
        validar_plano(plano)[0],
        "Onda 1: checkpoint.data 03/11/2026 depois do início da Onda 2 (02/11/2026)",
    )


def test_checkpoint_no_dia_do_inicio_da_onda_seguinte_passa():
    plano = com_ondas()
    onda(plano, 1)["checkpoint"]["data"] = "02/11/2026"
    assert validar_plano(plano)[0] == []


def _checkpoint(data):
    return {
        "data": data,
        "duracao": "30 minutos",
        "pauta": "Fechamento do ciclo.",
        "para_liberar": "Metas do ciclo atingidas.",
        "quem_decide": "Diretoria do cliente",
    }


def test_checkpoint_da_ultima_onda_depois_do_fim_do_ciclo():
    plano = com_ondas()
    onda(plano, 3)["checkpoint"] = _checkpoint("01/10/2027")
    assert tem(
        validar_plano(plano)[0],
        "Onda 3: checkpoint.data 01/10/2027 depois do fim do ciclo (30/09/2027)",
    )


def test_checkpoint_da_ultima_onda_dentro_do_ciclo_passa():
    plano = com_ondas()
    onda(plano, 3)["checkpoint"] = _checkpoint("30/06/2027")
    assert validar_plano(plano) == ([], [])


@pytest.mark.parametrize("data", ["2026-10-30", "30/10/26", "31/02/2026", None, ""])
def test_checkpoint_com_data_invalida(data):
    plano = com_ondas()
    onda(plano, 1)["checkpoint"]["data"] = data
    assert tem(validar_plano(plano)[0], "Onda 1: checkpoint.data")


@pytest.mark.parametrize("checkpoint", ["30/10/2026", ["30/10/2026"], 7, {}])
def test_checkpoint_que_nao_e_objeto_completo(checkpoint):
    plano = com_ondas()
    onda(plano, 1)["checkpoint"] = checkpoint
    assert tem(validar_plano(plano)[0], "Onda 1: checkpoint")


@pytest.mark.parametrize("ate", ["2026-11-27", "27/11/26", "31/02/2027", None, ""])
def test_decisao_do_cliente_com_data_invalida(ate):
    plano = com_ondas()
    acao(plano, 5)["decisao_cliente"]["ate"] = ate
    assert tem(
        validar_plano(plano)[0],
        'Ação 5 ("Diversificar os canais de aquisição além da mídia paga"): decisao_cliente.ate',
    )


@pytest.mark.parametrize("ate", ["21/10/2026", "01/10/2027"])
def test_decisao_do_cliente_fora_da_referencia_ao_fim_do_ciclo(ate):
    plano = com_ondas()
    acao(plano, 5)["decisao_cliente"]["ate"] = ate
    assert tem(validar_plano(plano)[0], f"decisao_cliente.ate {ate} fora do ciclo (22/10/2026 a 30/09/2027)")


@pytest.mark.parametrize("ate", ["22/10/2026", "30/09/2027"])
def test_decisao_do_cliente_nos_limites_do_ciclo_passa(ate):
    plano = com_ondas()
    acao(plano, 5)["decisao_cliente"]["ate"] = ate
    assert validar_plano(plano)[0] == []


@pytest.mark.parametrize("vazio", ["", "   ", None])
def test_decisao_do_cliente_com_recomendacao_vazia(vazio):
    plano = com_ondas()
    acao(plano, 3)["decisao_cliente"]["recomendacao"] = vazio
    assert tem(
        validar_plano(plano)[0],
        'Ação 3 ("Reestruturar as campanhas de aquisição por Curva ABC"): decisao_cliente.recomendacao vazia',
    )


def test_decisao_do_cliente_nula_ou_ausente_passa():
    plano = com_ondas()
    acao(plano, 3)["decisao_cliente"] = None
    del acao(plano, 5)["decisao_cliente"]
    assert validar_plano(plano) == ([], [])


@pytest.mark.parametrize("valor", ["aprovar", ["a"], 3, True])
def test_decisao_do_cliente_que_nao_e_objeto(valor):
    plano = com_ondas()
    acao(plano, 3)["decisao_cliente"] = valor
    assert tem(validar_plano(plano)[0], "decisao_cliente precisa ser um objeto")


def test_decisao_do_cliente_valida_tambem_sem_ondas():
    plano = copy.deepcopy(plano_valido())
    acao(plano, 3)["decisao_cliente"] = {"ate": "21/10/2026", "recomendacao": "Aprovar."}
    assert tem(validar_plano(plano)[0], "decisao_cliente.ate 21/10/2026 fora do ciclo")


def _meta_mensal_valida():
    return {
        "cenario": "Realista",
        "colunas": ["Mês", "Receita (R$)"],
        "linhas": [["Nov/26", "100,00"], ["Dez/26", "200,00"]],
        "observacao": None,
    }


def _sessoes_validas():
    return {
        "colunas": ["Mês", "Sessões"],
        "linhas": [["Nov/26", "1000"]],
        "premissas": "Tráfego pago mantido no patamar atual.",
        "risco": "Queda de orgânico em novembro.",
    }


def test_blocos_novos_validos_passam():
    plano = com_ondas()
    plano["como_funciona"] = [{"titulo": "Lógica do plano", "texto": "Três ondas com checkpoint."}]
    plano["metas_mensais"] = _meta_mensal_valida()
    plano["sessoes_nao_pagas"] = _sessoes_validas()
    plano["protocolo_mudanca"] = {"intro": "Uma mudança por vez.", "regras": ["Fazer backup antes."]}
    assert validar_plano(plano) == ([], [])


def test_metas_mensais_com_observacao_texto_passa():
    plano = com_ondas()
    plano["metas_mensais"] = {**_meta_mensal_valida(), "observacao": "Meses com mais de 4 semanas."}
    assert validar_plano(plano) == ([], [])


def test_metas_mensais_linha_com_numero_de_celulas_errado():
    plano = com_ondas()
    plano["metas_mensais"] = _meta_mensal_valida()
    plano["metas_mensais"]["linhas"][1] = ["Dez/26"]
    assert tem(validar_plano(plano)[0], "metas_mensais.linhas[2]: 1 células, mas colunas tem 2")


def test_sessoes_nao_pagas_linha_com_numero_de_celulas_errado():
    plano = com_ondas()
    plano["sessoes_nao_pagas"] = _sessoes_validas()
    plano["sessoes_nao_pagas"]["linhas"][0] = ["Nov/26", "1000", "extra"]
    assert tem(validar_plano(plano)[0], "sessoes_nao_pagas.linhas[1]: 3 células, mas colunas tem 2")


@pytest.mark.parametrize(
    "bloco, chave, valor, trecho",
    [
        ("metas_mensais", "cenario", "", "metas_mensais.cenario vazio"),
        ("metas_mensais", "colunas", [], "metas_mensais.colunas"),
        ("metas_mensais", "colunas", "Mês", "metas_mensais.colunas"),
        ("metas_mensais", "linhas", "x", "metas_mensais.linhas"),
        ("metas_mensais", "linhas", [["Nov/26", 100]], "metas_mensais.linhas[1]"),
        ("metas_mensais", "linhas", ["Nov/26"], "metas_mensais.linhas[1]"),
        ("metas_mensais", "observacao", 5, "metas_mensais.observacao"),
        ("sessoes_nao_pagas", "colunas", [], "sessoes_nao_pagas.colunas"),
        ("sessoes_nao_pagas", "linhas", None, "sessoes_nao_pagas.linhas"),
        ("sessoes_nao_pagas", "premissas", "", "sessoes_nao_pagas.premissas vazio"),
        ("sessoes_nao_pagas", "risco", None, "sessoes_nao_pagas.risco vazio"),
    ],
)
def test_tabelas_malformadas(bloco, chave, valor, trecho):
    plano = com_ondas()
    plano[bloco] = _meta_mensal_valida() if bloco == "metas_mensais" else _sessoes_validas()
    plano[bloco][chave] = valor
    assert tem(validar_plano(plano)[0], trecho), validar_plano(plano)[0]


@pytest.mark.parametrize("bloco", ["metas_mensais", "sessoes_nao_pagas", "protocolo_mudanca"])
@pytest.mark.parametrize("valor", ["texto", ["a"], 3, True])
def test_bloco_que_deveria_ser_objeto(bloco, valor):
    plano = com_ondas()
    plano[bloco] = valor
    assert tem(validar_plano(plano)[0], f"{bloco} precisa ser um objeto")


@pytest.mark.parametrize("chave", ["colunas", "linhas", "cenario"])
def test_metas_mensais_sem_chave(chave):
    plano = com_ondas()
    plano["metas_mensais"] = _meta_mensal_valida()
    del plano["metas_mensais"][chave]
    assert tem(validar_plano(plano)[0], f"metas_mensais.{chave}")


@pytest.mark.parametrize(
    "valor",
    [
        "texto",
        {"kpi": "x", "meta_limite": "y"},
        ["texto"],
        [{"kpi": "Quebra"}],
        [{"meta_limite": "25%"}],
        [{"kpi": "", "meta_limite": "25%"}],
        [{"kpi": "Quebra", "meta_limite": "  "}],
        [{"kpi": 3, "meta_limite": "25%"}],
    ],
)
def test_kpis_acompanhamento_malformado(valor):
    plano = com_ondas()
    plano["kpis_acompanhamento"] = valor
    assert tem(validar_plano(plano)[0], "kpis_acompanhamento"), validar_plano(plano)[0]


@pytest.mark.parametrize(
    "valor",
    [
        "texto",
        {"titulo": "x", "texto": "y"},
        ["texto"],
        [{"titulo": "Lógica"}],
        [{"texto": "Três ondas."}],
        [{"titulo": "", "texto": "Três ondas."}],
        [{"titulo": "Lógica", "texto": "  "}],
        [{"titulo": "Lógica", "texto": 5}],
    ],
)
def test_como_funciona_malformado(valor):
    plano = com_ondas()
    plano["como_funciona"] = valor
    assert tem(validar_plano(plano)[0], "como_funciona"), validar_plano(plano)[0]


@pytest.mark.parametrize(
    "valor, trecho",
    [
        ({"regras": ["Fazer backup."]}, "protocolo_mudanca.intro vazio"),
        ({"intro": "  ", "regras": ["Fazer backup."]}, "protocolo_mudanca.intro vazio"),
        ({"intro": "Uma mudança por vez."}, "protocolo_mudanca.regras"),
        ({"intro": "Uma mudança por vez.", "regras": []}, "protocolo_mudanca.regras"),
        ({"intro": "Uma mudança por vez.", "regras": "Fazer backup."}, "protocolo_mudanca.regras"),
        ({"intro": "Uma mudança por vez.", "regras": ["Fazer backup.", ""]}, "protocolo_mudanca.regras[2]"),
        ({"intro": "Uma mudança por vez.", "regras": [3]}, "protocolo_mudanca.regras[1]"),
    ],
)
def test_protocolo_de_mudanca_malformado(valor, trecho):
    plano = com_ondas()
    plano["protocolo_mudanca"] = valor
    assert tem(validar_plano(plano)[0], trecho), validar_plano(plano)[0]


def test_onda_que_cita_a_mesma_acao_duas_vezes():
    plano = com_ondas()
    onda(plano, 1)["acoes"] = [1, 1, 2]
    assert tem(validar_plano(plano)[0], "Onda 1: cita a ação 1 mais de uma vez")


def test_aviso_onda_sem_acao():
    plano = com_ondas()
    onda(plano, 3)["acoes"] = []
    avisos = validar_plano(plano)[1]
    assert any("Onda 3: não tem nenhuma ação" in a for a in avisos)


def test_aviso_onda_sem_checkpoint_exceto_a_ultima():
    plano = com_ondas()
    onda(plano, 2)["checkpoint"] = None
    erros, avisos = validar_plano(plano)
    assert erros == []
    assert avisos == [
        "Onda 2: sem checkpoint; toda onda, exceto a última, termina num checkpoint "
        "com data, pauta e quem decide."
    ]


def test_ultima_onda_sem_checkpoint_nao_avisa():
    plano = com_ondas()
    assert onda(plano, 3)["checkpoint"] is None
    assert validar_plano(plano)[1] == []


def test_onda_sem_a_chave_checkpoint_avisa_como_nula():
    plano = com_ondas()
    del onda(plano, 1)["checkpoint"]
    erros, avisos = validar_plano(plano)
    assert erros == [] and any("Onda 1: sem checkpoint" in a for a in avisos)


@pytest.mark.parametrize(
    "ondas",
    ["texto", 42, {"numero": 1}, [1], ["onda"], [None], [{}], [[]], [{"numero": 1, "acoes": "1,2"}]],
)
def test_ondas_malformadas_viram_erro_sem_excecao(ondas):
    plano = com_ondas()
    plano["ondas"] = ondas
    erros, _ = validar_plano(plano)
    assert erros, "um ondas malformado precisa gerar erro"
    assert all(isinstance(e, str) for e in erros)


@pytest.mark.parametrize("campo", ["acoes", "inicio", "fim", "nome", "checkpoint"])
@pytest.mark.parametrize("valor", [None, 7, "texto", [], {}, True])
def test_campo_de_onda_malformado_nao_levanta(campo, valor):
    plano = com_ondas()
    onda(plano, 2)[campo] = valor
    erros, avisos = validar_plano(plano)
    assert all(isinstance(m, str) for m in erros + avisos)


def test_ondas_com_horizontes_quebrados_nao_levanta():
    plano = com_ondas()
    plano["horizontes"] = "quebrado"
    erros, _ = validar_plano(plano)
    assert tem(erros, "horizontes")


def test_ondas_com_datas_de_referencia_quebradas_nao_levanta():
    plano = com_ondas()
    plano["data_referencia"] = "ontem"
    plano["fim_ciclo"] = None
    erros, _ = validar_plano(plano)
    assert tem(erros, "data_referencia") and tem(erros, "fim_ciclo")


def test_marcacao_nas_chaves_novas_e_erro_no_final_e_passa_no_rascunho():
    plano = com_ondas()
    onda(plano, 1)["objetivo"] += " [VALIDAR]"
    plano["kpis_acompanhamento"][0]["meta_limite"] = "[PREENCHER: limite]"
    acao(plano, 3)["decisao_cliente"]["recomendacao"] += " [VALIDAR]"
    erros_final, _ = validar_plano(plano)
    assert tem(erros_final, "plano.ondas[0].objetivo")
    assert tem(erros_final, "plano.kpis_acompanhamento[0].meta_limite")
    assert tem(erros_final, "decisao_cliente.recomendacao")
    assert validar_plano(plano, rascunho=True)[0] == []
