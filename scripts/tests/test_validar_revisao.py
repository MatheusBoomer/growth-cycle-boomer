from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import validar_revisao as v  # noqa: E402
from plano_v2_exemplo import plano_valido  # noqa: E402
from revisao_exemplo import plano_final_valido, revisao_valida, transcricao_exemplo  # noqa: E402


def validar(revisao, final=True, transcricao=None, plano_08=None, rascunho=False):
    return v.validar(
        revisao,
        transcricao_exemplo() if transcricao is None else transcricao,
        plano_valido() if plano_08 is None else plano_08,
        plano_final_valido() if final else None,
        rascunho=rascunho,
    )


def com(mutacao):
    revisao = revisao_valida()
    mutacao(revisao)
    return revisao


def tem(mensagens, trecho):
    return any(trecho in m for m in mensagens)


def test_revisao_valida_nao_gera_erro_nem_aviso():
    assert validar(revisao_valida()) == ([], [])


def test_aceita_rascunho_sem_plano_final_quando_as_acoes_existem_na_08():
    revisao = revisao_valida()
    revisao["abertos"][0]["destino"] = {"tipo": "descartado", "motivo": "sem interesse"}
    assert validar(revisao, final=False, rascunho=True) == ([], [])


def _trocar(caminho, valor):
    def mutacao(r):
        alvo = r
        for passo in caminho[:-1]:
            alvo = alvo[passo]
        alvo[caminho[-1]] = valor
    return mutacao


def _remover(chave):
    return lambda r: r.pop(chave)


def _repetir(grupo):
    def mutacao(r):
        r[grupo][-1]["numero"] = r[grupo][0]["numero"]
    return mutacao


def _opcoes_sem_b(r):
    del r["conflitos"][0]["opcoes"]["B"]


def _remocao_sem_substituta(r):
    r["conflitos"][0].update(remove_acao=True, alavanca_descoberta="Margem por classe", substituta=None)


def _remocao_sem_alavanca_descoberta(r):
    r["conflitos"][0].update(remove_acao=True, alavanca_descoberta="", substituta="Ação 2")


CASOS = [
    ("versao", _trocar(["versao"], 2), "versao 1"),
    ("participantes ausente", _remover("participantes"), "participantes"),
    ("participantes tipo", _trocar(["participantes"], "Marina"), "participantes"),
    ("complementos ausente", _remover("complementos"), "complementos"),
    ("conflitos string", _trocar(["conflitos"], "nenhum"), "conflitos"),
    ("abertos tipo", _trocar(["abertos"], {}), "abertos"),
    ("compromissos ausente", _remover("compromissos"), "compromissos"),
    ("numero repetido complementos", lambda r: r["complementos"].append({**copy.deepcopy(r["complementos"][0])}), "número 1 repetido"),
    ("numero repetido conflitos", _repetir("conflitos"), "número 1 repetido"),
    ("numero repetido abertos", _repetir("abertos"), "número 1 repetido"),
    ("numero repetido compromissos", _repetir("compromissos"), "número 1 repetido"),
    ("trecho vazio", _trocar(["complementos", 0, "trecho", "texto"], "  "), "trecho não encontrado na transcrição"),
    ("trecho inventado", _trocar(["conflitos", 0, "trecho", "texto"], "o cliente jurou pelo Pix"), "trecho não encontrado na transcrição"),
    ("quem desconhecido", _trocar(["complementos", 0, "trecho", "quem"], "Fulano (cliente)"), "quem"),
    ("acao inexistente", _trocar(["conflitos", 0, "acao"], 99), "ação 99 não existe"),
    ("acoes inexistente", _trocar(["complementos", 0, "acoes"], [2, 98]), "ação 98 não existe"),
    ("acoes_afetadas inexistente", _trocar(["conflitos", 1, "acoes_afetadas"], [97]), "ação 97 não existe"),
    ("destino acoes inexistente", _trocar(["abertos", 0, "destino"], {"tipo": "acao", "acoes": [96]}), "ação 96 não existe"),
    ("compromisso acoes inexistente", _trocar(["compromissos", 0, "acoes"], [95]), "ação 95 não existe"),
    ("opcoes sem B", _opcoes_sem_b, "opção"),
    ("recomendacao fora das opcoes", _trocar(["conflitos", 0, "recomendacao_boomer"], "D"), "opção"),
    ("decisao fora das opcoes", _trocar(["conflitos", 1, "decisao"], "C"), "opção"),
    ("remove alavanca sem substituta", _remocao_sem_substituta, "alavanca descoberta"),
    ("remove alavanca sem descoberta", _remocao_sem_alavanca_descoberta, "alavanca descoberta"),
    ("data_hoje", _trocar(["data_hoje"], "2026-11-11"), "dd/mm/aaaa"),
    ("data_reuniao", _trocar(["data_reuniao"], "9/11/2026"), "dd/mm/aaaa"),
    ("destino.ate", _trocar(["abertos", 1, "destino", "ate"], "20-11-2026"), "dd/mm/aaaa"),
    ("reuniao depois de hoje", _trocar(["data_reuniao"], "12/11/2026"), "data da reunião"),
]


@pytest.mark.parametrize("mutacao,esperado", [(c[1], c[2]) for c in CASOS], ids=[c[0] for c in CASOS])
def test_regra_de_erro(mutacao, esperado):
    erros, _ = validar(com(mutacao))
    assert tem(erros, esperado), erros


def test_mensagem_de_item_comeca_pelo_rotulo_e_numero():
    r = com(_trocar(["conflitos", 1, "trecho", "texto"], "inventado"))
    erros, _ = validar(r)
    assert erros == ["Conflito 2: trecho não encontrado na transcrição."]
    r = com(_trocar(["abertos", 1, "trecho", "quem"], "Zé (cliente)"))
    assert validar(r)[0][0].startswith("Ponto em aberto 2: ")
    r = com(_trocar(["compromissos", 0, "acoes"], [95]))
    assert validar(r)[0][0].startswith("Compromisso 1: ")
    r = com(_trocar(["complementos", 0, "acoes"], [95]))
    assert validar(r)[0][0].startswith("Complemento 1: ")


def test_remocao_de_acao_alavanca_com_substituta_e_alavanca_descoberta_passa():
    def mutacao(r):
        r["conflitos"][0].update(remove_acao=True, alavanca_descoberta="Margem por classe", substituta="Ação 2")
    assert validar(com(mutacao)) == ([], [])


def test_remocao_de_acao_que_nao_e_alavanca_nao_exige_substituta():
    # a ação 6 é de governança: o exemplo já remove sem alavanca descoberta
    assert validar(revisao_valida()) == ([], [])


def test_acao_que_so_existe_no_plano_final_exige_o_plano_final():
    erros, _ = validar(revisao_valida(), final=False)
    assert tem(erros, "ação 7 não existe")


def test_trecho_com_aspas_tipograficas_e_quebra_de_linha_e_aceito():
    transcricao = transcricao_exemplo().replace(
        "já testamos isso no ano passado", "já “testamos isso”\nno ano passado"
    )
    revisao = com(_trocar(["conflitos", 0, "trecho", "texto"], 'já "testamos isso" no ano passado e a verba ficou presa em campanhas que não escalavam'))
    assert validar(revisao, transcricao=transcricao) == ([], [])


def test_trecho_com_travessao_diferente_e_aceito():
    transcricao = "[00:01:00] Marina Alves: Fica combinado — sem reunião mensal.\n"
    revisao = revisao_valida()
    revisao["complementos"][0]["trecho"]["texto"] = "Fica combinado - sem reunião mensal"
    erros, _ = validar(revisao, transcricao=transcricao)
    assert not tem(erros, "Complemento 1: trecho não encontrado")


@pytest.mark.parametrize("entrada", [[], "texto", None, 3])
def test_revisao_que_nao_e_objeto_gera_erro_sem_excecao(entrada):
    erros, avisos = validar(entrada)
    assert len(erros) == 1 and avisos == []


def test_entrada_malformada_nao_levanta_e_gera_erro():
    revisao = {
        "versao": "1",
        "participantes": [],
        "complementos": [1, None, {"numero": "x", "acoes": "2", "trecho": "oi"}],
        "conflitos": "texto",
        "abertos": [{"numero": 1, "trecho": None, "destino": "x"}, {"numero": 1, "destino": {"tipo": "acao", "acoes": 3}}],
        "compromissos": [{"numero": 1, "acao": "a", "acoes": [None, "2", True]}],
        "data_hoje": 5,
    }
    erros, _ = validar(revisao)
    assert erros
    assert tem(erros, "participantes") and tem(erros, "conflitos") and tem(erros, "dd/mm/aaaa")
    assert tem(erros, "versao 1")


@pytest.mark.parametrize("valor", [["A"], {}, {"A": 1}, 1, True])
def test_recomendacao_e_decisao_de_tipo_errado_nao_levantam(valor):
    revisao = revisao_valida()
    revisao["conflitos"][0]["recomendacao_boomer"] = valor
    revisao["conflitos"][1]["decisao"] = valor
    erros, _ = validar(revisao)
    assert tem(erros, "Conflito 1: recomendacao_boomer") and tem(erros, "Conflito 2: decisao")


def test_conflito_sem_trecho_nem_opcoes_nao_levanta():
    revisao = com(lambda r: r["conflitos"].append({"numero": 3, "opcoes": "A", "acoes_afetadas": "6", "remove_acao": True}))
    erros, _ = validar(revisao)
    assert tem(erros, "Conflito 3: trecho ausente")
    assert tem(erros, "Conflito 3: opcoes")


@pytest.mark.parametrize("plano_08,plano_final", [(None, None), ({"horizontes": "x"}, {"horizontes": [1, {"acoes": [None]}]}), ([], [])])
def test_planos_malformados_nao_levantam(plano_08, plano_final):
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), plano_08, plano_final)
    assert erros


def test_transcricao_que_nao_e_texto_gera_erro_sem_excecao():
    erros, _ = v.validar(revisao_valida(), None, plano_valido(), plano_final_valido())
    assert tem(erros, "transcrição")


def test_aviso_trecho_longo():
    texto = transcricao_exemplo() + "\n" + ("palavra " * 50).strip() + ".\n"
    revisao = com(_trocar(["complementos", 0, "trecho", "texto"], ("palavra " * 50).strip()))
    erros, avisos = validar(revisao, transcricao=texto)
    assert erros == [] and tem(avisos, "Complemento 1: trecho com 399 caracteres")


def test_aviso_posicao_vazia():
    erros, avisos = validar(com(_trocar(["abertos", 0, "trecho", "posicao"], " ")))
    assert erros == [] and avisos == ["Ponto em aberto 1: posicao do trecho vazia."]


def test_aviso_resumo_com_mais_de_cinco_linhas():
    erros, avisos = validar(com(_trocar(["resumo"], "\n\n".join(f"linha {i}" for i in range(6)))))
    assert erros == [] and tem(avisos, "resumo com 6 linhas")


def test_resumo_de_cinco_linhas_nao_gera_aviso():
    assert validar(com(_trocar(["resumo"], "\n".join(f"linha {i}" for i in range(5)))))[1] == []


# --- Modo final: regras que só valem sem rascunho --------------------------------------------

def _decisao_nula(r):
    r["conflitos"][0]["decisao"] = None


def _destino_nulo(r):
    r["abertos"][1]["destino"] = None


def _destino_no_passado(r):
    r["abertos"][1]["destino"] = {"tipo": "confirmar", "ate": "10/11/2026"}


def _destino_acao_inexistente(r):
    r["abertos"][0]["destino"] = {"tipo": "acao", "acoes": [8]}


def _destino_acao_vazio(r):
    r["abertos"][0]["destino"] = {"tipo": "acao", "acoes": []}


def _descartado_sem_motivo(r):
    r["abertos"][1]["destino"] = {"tipo": "descartado", "motivo": "  "}


def _tipo_desconhecido(r):
    r["abertos"][1]["destino"] = {"tipo": "adiar"}


def _compromisso_fora_sem_tratamento(r):
    r["compromissos"][1].update(tratamento=None, acoes=[])


def _compromisso_fora_do_plano_sem_tratamento(r):
    r["compromissos"][0].update(no_plano=False, acoes=[], tratamento="")


CASOS_FINAIS = [
    ("conflito sem decisao", _decisao_nula, "Conflito 1: sem decisão"),
    ("aberto sem destino", _destino_nulo, "Ponto em aberto 2: sem destino"),
    ("confirmar com data passada", _destino_no_passado, "data já passou"),
    ("destino acao inexistente no final", _destino_acao_inexistente, "ação 8 não existe no plano final"),
    ("destino acao sem acoes", _destino_acao_vazio, "Ponto em aberto 1: destino acao"),
    ("descartado sem motivo", _descartado_sem_motivo, "motivo"),
    ("tipo de destino desconhecido", _tipo_desconhecido, "destino com tipo 'adiar' desconhecido"),
    ("fora do escopo sem acoes nem tratamento", _compromisso_fora_sem_tratamento, "Compromisso 2: compromisso fora do plano ou do escopo precisa de acoes ou de tratamento"),
    ("no_plano false sem acoes nem tratamento", _compromisso_fora_do_plano_sem_tratamento, "tratamento"),
]


@pytest.mark.parametrize("mutacao,esperado", [(c[1], c[2]) for c in CASOS_FINAIS], ids=[c[0] for c in CASOS_FINAIS])
def test_regra_do_modo_final(mutacao, esperado):
    revisao = com(mutacao)
    erros, _ = validar(revisao)
    assert tem(erros, esperado), erros
    # em rascunho nada disso bloqueia, exceto o que vale sempre
    erros_rascunho, _ = validar(revisao, rascunho=True)
    assert not tem(erros_rascunho, esperado), erros_rascunho


def test_rascunho_aceita_decisoes_e_destinos_nulos():
    def mutacao(r):
        for c in r["conflitos"]:
            c["decisao"] = None
        for a in r["abertos"]:
            a["destino"] = None
    assert validar(com(mutacao), rascunho=True) == ([], [])
    erros, _ = validar(com(mutacao))
    assert sum(tem([e], "sem decisão") or tem([e], "sem destino") for e in erros) == 4


def test_confirmar_na_propria_data_de_hoje_passa():
    r = com(lambda r: r["abertos"][1].update(destino={"tipo": "confirmar", "ate": "11/11/2026"}))
    assert validar(r) == ([], [])


def test_destino_descartado_com_motivo_passa():
    r = com(lambda r: r["abertos"][1].update(destino={"tipo": "descartado", "motivo": "Cliente desistiu do orçamento extra."}))
    assert validar(r) == ([], [])


def test_compromisso_fora_do_escopo_com_acoes_sem_tratamento_passa():
    r = com(lambda r: r["compromissos"][1].update(tratamento=None, acoes=[1]))
    assert validar(r) == ([], [])


def test_compromisso_no_plano_nao_exige_tratamento():
    r = com(lambda r: r["compromissos"][0].update(acoes=[], tratamento=None))
    assert validar(r) == ([], [])


def test_destino_acao_sem_plano_final_da_erro_em_modo_final():
    erros, _ = validar(revisao_valida(), final=False)
    assert tem(erros, "Ponto em aberto 1: ação 7 não existe no plano final")


def test_destino_acao_com_acao_do_plano_final_passa():
    r = com(lambda r: r["abertos"][0].update(destino={"tipo": "acao", "acoes": [7]}))
    assert validar(r) == ([], [])


@pytest.mark.parametrize("destino", [{"tipo": None}, {"tipo": ["acao"]}, {"tipo": {}}, {}])
def test_tipo_de_destino_de_tipo_errado_nao_levanta(destino):
    erros, _ = validar(com(lambda r: r["abertos"][1].update(destino=destino)))
    assert tem(erros, "Ponto em aberto 2: destino com tipo")


# --- Modo final: toda mudança do plano final tem motivo --------------------------------------

def _final_com(mutacao):
    plano = plano_final_valido()
    mutacao(plano)
    return plano


def test_acao_alterada_so_no_como_sem_item_citando_recusa_com_o_numero():
    plano_final = _final_com(lambda p: p["horizontes"][0]["acoes"][1].update(como="Outro jeito de fazer."))
    revisao = com(lambda r: r["complementos"].clear())  # nada mais cita a ação 2
    erros, _ = v.validar(revisao, transcricao_exemplo(), plano_valido(), plano_final)
    assert tem(erros, "Ação 2 mudou no plano final sem motivo na revisão"), erros


def test_acao_incluida_sem_motivo_recusa():
    revisao = com(lambda r: r["abertos"][0].update(destino={"tipo": "confirmar", "ate": "20/11/2026"}))
    erros, _ = validar(revisao)
    assert erros == ["Ação 7 mudou no plano final sem motivo na revisão (nenhum item cita a ação 7)."]


def test_acao_removida_sem_motivo_recusa():
    def mutacao(r):
        r["conflitos"][1].update(acoes_afetadas=[], acao=None)
    erros, _ = validar(com(mutacao))
    assert tem(erros, "Ação 6 mudou no plano final sem motivo na revisão")


@pytest.mark.parametrize("onde", ["acao", "acoes", "acoes_afetadas"])
def test_numero_citado_em_qualquer_campo_de_qualquer_item_conta(onde):
    def mutacao(r):
        r["complementos"].clear()
        # a ação 2 passa a ser citada por um compromisso, depois só por um ponto em aberto etc.
        r["compromissos"][0].update(acao=None, acoes=[1], acoes_afetadas=None)
        r["compromissos"][0]["acao" if onde == "acao" else onde] = 2 if onde == "acao" else [1, 2]
    assert validar(com(mutacao)) == ([], [])


def test_numero_citado_so_em_destino_acao_de_ponto_em_aberto_conta():
    def mutacao(r):
        r["conflitos"][0].update(acao=None, acoes_afetadas=[])  # a ação 3 deixa de ser citada
        r["abertos"][0]["destino"] = {"tipo": "acao", "acoes": [3, 7]}
    assert validar(com(mutacao)) == ([], [])


def test_numero_so_em_destino_confirmar_nao_conta_como_citado():
    def mutacao(r):
        r["abertos"][1]["destino"] = {"tipo": "confirmar", "ate": "20/11/2026", "acoes": [2]}
        r["complementos"].clear()
    erros, _ = validar(com(mutacao))
    assert tem(erros, "Ação 2 mudou")


def test_rastreabilidade_so_vale_em_modo_final():
    revisao = com(lambda r: r["complementos"].clear())
    erros, _ = validar(revisao, rascunho=True)
    assert not tem(erros, "mudou no plano final")


def test_sem_plano_final_nao_ha_rastreabilidade():
    erros, _ = validar(com(lambda r: r["complementos"].clear()), final=False)
    assert not tem(erros, "mudou no plano final")


def test_meta_alterada_sem_divergencia_recusa():
    plano_final = _final_com(lambda p: p["abertura"]["metas"][0].update(para="99%"))
    kpi = plano_final["abertura"]["metas"][0]["kpi"]
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), plano_valido(), plano_final)
    assert erros == [f'Meta "{kpi}" mudou sem registro em divergencias_cenario.']


def test_meta_alterada_com_divergencia_registrada_passa():
    plano_final = _final_com(lambda p: p["abertura"]["metas"][0].update(para="99%"))
    kpi = plano_final["abertura"]["metas"][0]["kpi"]
    revisao = com(lambda r: r["divergencias_cenario"].append(
        {"item": kpi, "antes": "x", "depois": "99%", "slides": ["Metas do projeto"]}))
    assert v.validar(revisao, transcricao_exemplo(), plano_valido(), plano_final) == ([], [])


def test_meta_removida_ou_incluida_conta_como_alterada():
    plano_final = _final_com(lambda p: p["abertura"]["metas"].pop())
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), plano_valido(), plano_final)
    assert tem(erros, "mudou sem registro em divergencias_cenario")


def test_divergencias_cenario_que_nao_e_lista_gera_erro_em_modo_final():
    erros, _ = validar(com(_trocar(["divergencias_cenario"], "nenhuma")))
    assert tem(erros, "divergencias_cenario")
    assert not tem(validar(com(_trocar(["divergencias_cenario"], "nenhuma")), rascunho=True)[0], "divergencias_cenario")


@pytest.mark.parametrize("plano_final", [
    {"horizontes": "x"},
    {"horizontes": [{"acoes": [{"numero": "1"}]}]},
    {"horizontes": [], "abertura": {"metas": [{"kpi": ["x"]}]}},
    {"horizontes": [], "abertura": []},
    [],
])
def test_plano_final_malformado_pula_a_rastreabilidade_sem_levantar(plano_final):
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), plano_valido(), plano_final)
    assert not tem(erros, "mudou no plano final")


def test_plano_08_malformado_nao_levanta_no_modo_final():
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), {"horizontes": [{"acoes": [None]}]}, plano_final_valido())
    assert erros


# --- Linha de comando ------------------------------------------------------------------------

def _escrever(pasta, nome, conteudo):
    caminho = pasta / nome
    caminho.write_text(conteudo if isinstance(conteudo, str) else json.dumps(conteudo, ensure_ascii=False), encoding="utf-8")
    return str(caminho)


@pytest.fixture
def arquivos(tmp_path):
    return {
        "--revisao": _escrever(tmp_path, "revisao.json", revisao_valida()),
        "--transcricao": _escrever(tmp_path, "transcricao.txt", transcricao_exemplo()),
        "--plano-08": _escrever(tmp_path, "plano08.json", plano_valido()),
        "--plano-final": _escrever(tmp_path, "final.json", plano_final_valido()),
    }


def _argv(arquivos, *extras, sem=()):
    argv = [x for chave, caminho in arquivos.items() if chave not in sem for x in (chave, caminho)]
    return [*argv, *extras]


def test_cli_ok(arquivos, capsys):
    assert v.main(_argv(arquivos)) == 0
    saida = capsys.readouterr()
    assert saida.out == "OK: 1 complementos, 2 conflitos, 2 pontos em aberto, 2 compromissos.\n"
    assert saida.err == ""


def test_cli_ok_sem_plano_final_em_rascunho_imprime_avisos(arquivos, tmp_path, capsys):
    revisao = revisao_valida()
    revisao["conflitos"][0]["decisao"] = None
    revisao["abertos"][0]["destino"] = None
    revisao["abertos"][0]["trecho"]["posicao"] = ""
    arquivos["--revisao"] = _escrever(tmp_path, "rascunho.json", revisao)
    assert v.main(_argv(arquivos, "--rascunho", sem=("--plano-final",))) == 0
    saida = capsys.readouterr().out.splitlines()
    assert saida[0] == "AVISO: Ponto em aberto 1: posicao do trecho vazia."
    assert saida[-1].startswith("OK: ")


def test_cli_revisao_invalida_sai_com_1_e_erro_em_stderr(arquivos, tmp_path, capsys):
    revisao = revisao_valida()
    revisao["complementos"].clear()
    arquivos["--revisao"] = _escrever(tmp_path, "ruim.json", revisao)
    assert v.main(_argv(arquivos)) == 1
    saida = capsys.readouterr()
    assert saida.err.startswith("ERRO: Ação 2 mudou no plano final sem motivo na revisão")
    assert "OK:" not in saida.out


def test_cli_json_quebrado_sai_com_1_sem_traceback(arquivos, tmp_path, capsys):
    arquivos["--revisao"] = _escrever(tmp_path, "quebrado.json", "{ nao e json")
    assert v.main(_argv(arquivos)) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO: ") and "JSON" in err and "Traceback" not in err


def test_cli_plano_final_inexistente_sai_com_1(arquivos, tmp_path, capsys):
    arquivos["--plano-final"] = str(tmp_path / "nao-existe.json")
    assert v.main(_argv(arquivos)) == 1
    assert capsys.readouterr().err.startswith("ERRO: plano final não encontrado")


def test_cli_transcricao_pdf_sai_com_1_sem_traceback(arquivos, tmp_path, capsys):
    arquivos["--transcricao"] = _escrever(tmp_path, "transcricao.pdf", "%PDF-1.4 falso")
    assert v.main(_argv(arquivos)) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO: ") and "não suportado" in err and "Traceback" not in err


def test_cli_como_script_devolve_o_codigo_de_saida(arquivos):
    ok = subprocess.run([sys.executable, str(RAIZ / "scripts" / "validar_revisao.py"), *_argv(arquivos)],
                        capture_output=True, text=True)
    assert ok.returncode == 0 and ok.stdout.startswith("OK: ")
    ruim = subprocess.run([sys.executable, str(RAIZ / "scripts" / "validar_revisao.py"), *_argv(arquivos, sem=("--plano-08",))],
                          capture_output=True, text=True)
    assert ruim.returncode == 2  # argparse: argumento obrigatório ausente


@pytest.mark.parametrize("plano_final", [None, [], "x"])
def test_modo_final_exige_plano_final_objeto(plano_final):
    erros, _ = v.validar(revisao_valida(), transcricao_exemplo(), plano_valido(), plano_final)
    assert tem(erros, "plano final ausente ou inválido")


def test_rascunho_nao_exige_plano_final():
    erros, _ = validar(revisao_valida(), final=False, rascunho=True)
    assert not tem(erros, "plano final")


def test_cli_modo_final_sem_plano_final_da_erro(arquivos, capsys):
    assert v.main(_argv(arquivos, sem=("--plano-final",))) == 1
    assert "plano final ausente ou inválido" in capsys.readouterr().err


def test_cli_modo_final_com_plano_final_null_da_erro(arquivos, tmp_path, capsys):
    arquivos["--plano-final"] = str(tmp_path / "null.json")
    (tmp_path / "null.json").write_text("null", encoding="utf-8")
    assert v.main(_argv(arquivos)) == 1
    assert "plano final ausente ou inválido" in capsys.readouterr().err
