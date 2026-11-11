from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import revisao_exemplo as ex  # noqa: E402
from plano_acao_comum import diferencas  # noqa: E402
from plano_v2_exemplo import plano_valido, registro_valido  # noqa: E402
from texto_transcricao import contem_trecho, normalizar  # noqa: E402
from validar_plano_acao import validar  # noqa: E402


def _trechos(revisao):
    for grupo in ("complementos", "conflitos", "abertos", "compromissos"):
        for item in revisao[grupo]:
            yield item["trecho"]


def test_exemplo_coerente():
    assert validar(ex.plano_final_valido(), registro_valido()) == ([], [])
    d = diferencas(plano_valido(), ex.plano_final_valido())
    assert d["incluidas"] == [7]
    assert d["removidas"] == [6]
    assert set(d["alteradas"]) == {2, 3}
    assert d["metas_alteradas"] == []
    texto = normalizar(ex.transcricao_exemplo())
    for trecho in _trechos(ex.revisao_valida()):
        assert contem_trecho(texto, trecho["texto"]), trecho["texto"]


def test_trechos_citam_participantes_e_tem_posicao():
    r = ex.revisao_valida()
    nomes = {p["nome"] for grupo in r["participantes"].values() for p in grupo}
    assert len(r["participantes"]["boomer"]) == 2 and len(r["participantes"]["cliente"]) == 2
    for trecho in _trechos(r):
        assert trecho["quem"].partition(" (")[0] in nomes
        assert trecho["posicao"]


def test_motivo_de_cada_acao_mudada_na_ordem_dos_grupos():
    r = ex.revisao_valida()
    motivos = {}
    grupos = (
        ("Complemento", r["complementos"], "acoes"),
        ("Conflito", r["conflitos"], "acoes_afetadas"),
        ("Ponto em aberto", r["abertos"], None),
        ("Compromisso", r["compromissos"], "acoes"),
    )
    for rotulo, itens, campo in grupos:
        for item in itens:
            if campo:
                acoes = item[campo]
            else:
                acoes = (item["destino"] or {}).get("acoes", []) if (item["destino"] or {}).get("tipo") == "acao" else []
            for n in acoes:
                motivos.setdefault(n, f'{rotulo} {item["numero"]}')
    assert motivos[2] == "Complemento 1"
    assert motivos[3] == "Conflito 1"
    assert motivos[6] == "Conflito 2"
    assert motivos[7] == "Ponto em aberto 1"


def test_sem_pii_nem_garantia():
    texto = (ex.transcricao_exemplo() + str(ex.revisao_valida())).lower()
    assert "@" not in texto and "garanti" not in texto
