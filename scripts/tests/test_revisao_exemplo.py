from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import revisao_exemplo as ex  # noqa: E402
from plano_acao_comum import diferencas  # noqa: E402
from plano_v2_exemplo import plano_valido, registro_valido  # noqa: E402
from relatorio_revisao import montar_relatorio  # noqa: E402
from texto_transcricao import contem_trecho, normalizar  # noqa: E402
from validar_plano_acao import validar  # noqa: E402


def _trechos(revisao):
    for grupo in ("complementos", "conflitos", "abertos", "compromissos"):
        for item in revisao[grupo]:
            yield item["trecho"]


def test_exemplo_coerente():
    erros, avisos = validar(ex.plano_final_valido(), registro_valido())
    assert erros == [] and len(avisos) == 1 and "sem ondas" in avisos[0]
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
    relatorio = montar_relatorio(plano_valido(), ex.plano_final_valido(), ex.revisao_valida())
    esperado = {2: "Complemento 1", 3: "Conflito 1", 6: "Conflito 2", 7: "Ponto em aberto 1"}
    for numero, motivo in esperado.items():
        linha = next(l for l in relatorio.splitlines() if l.startswith(f"- Ação {numero} · "))
        assert f": {motivo}" in linha, linha


def test_sem_pii_nem_garantia():
    texto = (ex.transcricao_exemplo() + str(ex.revisao_valida())).lower()
    assert "@" not in texto and "garanti" not in texto
