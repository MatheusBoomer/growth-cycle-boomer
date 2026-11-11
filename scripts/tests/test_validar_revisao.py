from __future__ import annotations

import copy
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
