from __future__ import annotations

import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from meta_ads_apify import (  # noqa: E402
    ClienteApify,
    ErroColeta,
    entrada_ator,
    extrair_total,
    ler_token,
    url_busca,
    url_pagina,
)


class Resposta:
    def __init__(self, status_code, corpo):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        return self._corpo


class SessaoFalsa:
    def __init__(self, post, gets):
        self._post = post
        self._gets = list(gets)
        self.chamadas = []

    def post(self, url, json=None, headers=None, timeout=None):
        self.chamadas.append(("POST", url, headers, None))
        return self._post

    def get(self, url, params=None, headers=None, timeout=None):
        self.chamadas.append(("GET", url, headers, params))
        return self._gets.pop(0)


def criado(status="READY"):
    return Resposta(201, {"data": {"id": "run1", "defaultDatasetId": "ds1", "status": status}})


def rodando(status):
    return Resposta(200, {"data": {"id": "run1", "status": status}})


def cliente(sessao, relogio=None):
    tempo = {"t": 0.0}

    def relogio_padrao():
        return tempo["t"]

    return ClienteApify("segredo123", sessao=sessao, dormir=lambda s: None, relogio=relogio or relogio_padrao)


def test_ler_token_do_ambiente_e_do_env(tmp_path):
    assert ler_token({"APIFY_TOKEN": " abc "}, tmp_path / ".env") == "abc"
    env = tmp_path / ".env"
    env.write_text('OUTRA=1\nAPIFY_TOKEN="xyz"\n', encoding="utf-8")
    assert ler_token({}, env) == "xyz"


def test_ler_token_ausente(tmp_path):
    with pytest.raises(ErroColeta, match="APIFY_TOKEN"):
        ler_token({}, tmp_path / ".env")


def test_urls_e_entrada():
    busca = url_busca("Marca Teste")
    assert busca.startswith("https://www.facebook.com/ads/library/?")
    assert "q=Marca+Teste" in busca and "country=BR" in busca and "search_type=keyword_unordered" in busca
    assert "view_all_page_id=111" in url_pagina("111")
    e = entrada_ator(url_pagina("111"), 40)
    assert e["startUrls"] == [{"url": url_pagina("111")}]
    assert e["resultsLimit"] == 40 and e["onlyTotal"] is False
    assert entrada_ator("u", 1, apenas_total=True)["onlyTotal"] is True


def test_extrair_total():
    assert extrair_total([{"totalCount": 57}]) == 57
    assert extrair_total([{"total": "12"}]) == 12
    assert extrair_total([{}]) is None
    assert extrair_total([]) is None


def test_executar_espera_terminar_e_le_o_dataset():
    sessao = SessaoFalsa(criado(), [rodando("RUNNING"), rodando("SUCCEEDED"), Resposta(200, [{"adArchiveID": "1"}])])
    itens = cliente(sessao).executar({"startUrls": []})
    assert itens == [{"adArchiveID": "1"}]
    assert sessao.chamadas[0][1] == "https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs"
    assert sessao.chamadas[-1][1] == "https://api.apify.com/v2/datasets/ds1/items"
    for _, url, headers, params in sessao.chamadas:
        assert headers == {"Authorization": "Bearer segredo123"}
        assert "segredo123" not in url
        assert "segredo123" not in str(params)


@pytest.mark.parametrize("status,trecho", [(401, "token"), (402, "créditos"), (403, "plano"), (500, "500")])
def test_erros_http(status, trecho):
    sessao = SessaoFalsa(Resposta(status, {}), [])
    with pytest.raises(ErroColeta, match=trecho):
        cliente(sessao).executar({})


def test_execucao_que_falha():
    sessao = SessaoFalsa(criado(), [rodando("FAILED")])
    with pytest.raises(ErroColeta, match="FAILED"):
        cliente(sessao).executar({})


def test_tempo_esgotado():
    tempo = {"t": 0.0}

    def relogio():
        tempo["t"] += 400.0
        return tempo["t"]

    sessao = SessaoFalsa(criado(), [rodando("RUNNING")] * 5)
    with pytest.raises(ErroColeta, match="10 minutos"):
        cliente(sessao, relogio).executar({})
