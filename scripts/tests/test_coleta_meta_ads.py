from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import coleta_meta_ads  # noqa: E402
from meta_ads_apify import ErroColeta  # noqa: E402
from meta_ads_selecao import Midia  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "apify_anuncios.json").read_text(encoding="utf-8"))
HOJE = date(2026, 9, 29)


class ClienteFalso:
    def __init__(self, busca=None, pagina=None, total=57):
        self.busca = busca if busca is not None else {"Marca Teste": FIXTURE}
        self.pagina = FIXTURE if pagina is None else pagina
        self.total = total
        self.entradas = []
        self.limites = []

    def executar(self, entrada, limite_segundos=None):
        self.entradas.append(entrada)
        self.limites.append(limite_segundos)
        url = entrada["startUrls"][0]["url"]
        if entrada["onlyTotal"]:
            return [{"totalCount": self.total}] if self.total is not None else [{}]
        if "view_all_page_id" in url:
            return self.pagina
        for termo, itens in self.busca.items():
            if "q=" + termo.replace(" ", "+") + "&" in url + "&":
                return itens
        return []


@pytest.fixture(autouse=True)
def sem_rede(monkeypatch):
    def baixar(anuncio, pasta_marca, sessao):
        pasta = pasta_marca / "midia" / anuncio.ad_id
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / "imagem-1.jpg").write_bytes(b"x")
        return Midia(arquivos=[f"midia/{anuncio.ad_id}/imagem-1.jpg"], hash={"103": 0, "108": 1}.get(anuncio.ad_id),
                     quadros_falharam=anuncio.ad_id == "101")

    monkeypatch.setattr(coleta_meta_ads, "baixar_midia", baixar)
    monkeypatch.setattr(coleta_meta_ads, "ffmpeg_disponivel", lambda: True)


def test_coletar_grava_resumo_json_e_notas(tmp_path):
    r = coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)
    pasta = tmp_path / "marca-teste"
    assert r["selecionados"] == 4 and r["total"] == 57
    resumo = (pasta / "resumo.md").read_text(encoding="utf-8")
    assert "- Anúncios ativos (total): 57" in resumo
    assert "- Coletado em: 29/09/2026" in resumo
    assert "### 1. 101 · Vídeo" in resumo
    assert "- Link: https://www.facebook.com/ads/library/?id=101" in resumo
    assert "- Início: 20/09/2026 · Versões: 3 · Impressões: —" in resumo
    assert "  - midia/101/imagem-1.jpg" in resumo
    assert "descreva a partir da capa" in resumo
    assert "anúncios repetiam um criativo" in resumo
    assert "limite de 1 por anunciante" in resumo
    assert "mídia indisponível" in resumo
    assert "?id=201" not in resumo  # anúncio de outra página fica de fora
    anuncios = json.loads((pasta / "anuncios.json").read_text(encoding="utf-8"))
    assert [a["ad_id"] for a in anuncios] == ["101", "103", "104", "107"]
    assert anuncios[0]["link"] == "https://www.facebook.com/ads/library/?id=101"
    assert anuncios[0]["midia"] == ["midia/101/imagem-1.jpg"]
    assert json.loads((pasta / "bruto.json").read_text(encoding="utf-8")) == FIXTURE
    assert not (pasta / "midia" / "108").exists()  # duplicado descartado não deixa arquivo


def test_coletar_sem_total_avisa_no_resumo(tmp_path):
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(total=None), None, HOJE)
    resumo = (tmp_path / "marca-teste" / "resumo.md").read_text(encoding="utf-8")
    assert "não informado pela Apify" in resumo
    assert "use o número de anúncios da amostra como mínimo" in resumo


def test_coletar_pagina_sem_anuncios(tmp_path):
    r = coleta_meta_ads.coletar("999", "Vazia", tmp_path, 10, ClienteFalso(pagina=[], total=0), None, HOJE)
    assert r["selecionados"] == 0
    resumo = (tmp_path / "vazia" / "resumo.md").read_text(encoding="utf-8")
    assert "Nenhum anúncio ativo encontrado no momento da coleta." in resumo


def test_coletar_limpa_midia_de_coleta_anterior(tmp_path):
    velho = tmp_path / "marca-teste" / "midia" / "antigo"
    velho.mkdir(parents=True)
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)
    assert not velho.exists()


def test_coletar_sem_ffmpeg(tmp_path, monkeypatch):
    monkeypatch.setattr(coleta_meta_ads, "ffmpeg_disponivel", lambda: False)
    with pytest.raises(ErroColeta, match="brew install ffmpeg"):
        coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)


def test_main_erro_sai_com_codigo_1_e_mensagem(tmp_path, monkeypatch, capsys):
    def sem_token():
        raise ErroColeta("APIFY_TOKEN não configurado.")

    monkeypatch.setattr(coleta_meta_ads, "ler_token", sem_token)
    codigo = coleta_meta_ads.main(["coletar", "--page-id", "1", "--marca", "X", "--saida", str(tmp_path)])
    assert codigo == 1
    assert "APIFY_TOKEN não configurado." in capsys.readouterr().err


def test_cli_nao_imprime_aviso_do_urllib3():
    import subprocess

    r = subprocess.run([sys.executable, str(RAIZ / "scripts" / "coleta_meta_ads.py"), "coletar", "--help"],
                       capture_output=True, text=True)
    assert r.returncode == 0
    assert "NotOpenSSLWarning" not in r.stderr


def test_coletar_quando_nenhuma_midia_baixa_e_erro_e_nao_sem_anuncios(tmp_path, monkeypatch):
    monkeypatch.setattr(coleta_meta_ads, "baixar_midia", lambda anuncio, pasta_marca, sessao: None)
    with pytest.raises(ErroColeta, match="nenhuma mídia"):
        coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)
    assert not (tmp_path / "marca-teste" / "resumo.md").exists()


def test_resumo_mostra_quantos_anuncios_vieram_na_amostra(tmp_path):
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(total=None), None, HOJE)
    resumo = (tmp_path / "marca-teste" / "resumo.md").read_text(encoding="utf-8")
    assert "- Anúncios da página na amostra: 8 (limite 15)" in resumo
    assert "use o número de anúncios da amostra como mínimo" in resumo


def test_coletar_usa_limites_de_tempo_que_cabem_no_bash(tmp_path):
    cliente = ClienteFalso()
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, cliente, None, HOJE)
    assert cliente.limites == [coleta_meta_ads.LIMITE_CONTAGEM_S, coleta_meta_ads.LIMITE_COLETA_S]
    assert coleta_meta_ads.LIMITE_CONTAGEM_S + coleta_meta_ads.LIMITE_COLETA_S <= 480


def test_coleta_que_falha_nao_apaga_a_midia_anterior(tmp_path):
    velho = tmp_path / "marca-teste" / "midia" / "antigo"
    velho.mkdir(parents=True)

    class ClienteQueFalha(ClienteFalso):
        def executar(self, entrada, limite_segundos=None):
            if not entrada["onlyTotal"]:
                raise ErroColeta("A coleta passou de 5 minutos.")
            return super().executar(entrada, limite_segundos)

    with pytest.raises(ErroColeta):
        coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteQueFalha(), None, HOJE)
    assert velho.exists()


def test_valores_padrao_economizam_api():
    assert coleta_meta_ads.AMOSTRA_COLETA == 15
    args = coleta_meta_ads.criar_parser().parse_args(["coletar", "--link", "https://www.facebook.com/ads/library/?view_all_page_id=1", "--marca", "X", "--saida", "y"])
    assert args.limite == 5


def test_aviso_de_poucos_anuncios_acompanha_o_limite(tmp_path):
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 5, ClienteFalso(total=4), None, HOJE)
    resumo = (tmp_path / "marca-teste" / "resumo.md").read_text(encoding="utf-8")
    assert "Só 4 anúncios ativos" in resumo
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 5, ClienteFalso(total=7), None, HOJE)
    resumo = (tmp_path / "marca-teste" / "resumo.md").read_text(encoding="utf-8")
    assert "anúncios ativos no momento" not in resumo


def test_cli_coleta_pelo_link(tmp_path, monkeypatch, capsys):
    chamadas = []
    monkeypatch.setattr(coleta_meta_ads, "ler_token", lambda: "t")
    monkeypatch.setattr(coleta_meta_ads, "coletar",
                        lambda page_id, marca, saida, limite, cliente, sessao, hoje: chamadas.append((page_id, limite)) or
                        {"pasta": str(saida), "total": 1, "selecionados": 1, "notas": []})
    link = "https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=987&search_type=page"
    assert coleta_meta_ads.main(["coletar", "--link", link, "--marca", "X", "--saida", str(tmp_path)]) == 0
    assert chamadas == [("987", 5)]


def test_cli_com_link_errado_sai_com_erro_em_portugues(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(coleta_meta_ads, "ler_token", lambda: "t")
    codigo = coleta_meta_ads.main(["coletar", "--link", "https://www.facebook.com/insiderstore", "--marca", "X", "--saida", str(tmp_path)])
    assert codigo == 1
    assert "view_all_page_id" in capsys.readouterr().err
