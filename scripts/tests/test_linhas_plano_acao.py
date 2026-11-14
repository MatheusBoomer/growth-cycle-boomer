from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import linhas_plano_acao as plano  # noqa: E402

PLANO_FIXTURE = RAIZ / "clientes/_fixtures/verdeluz/base" / plano.CAMINHO_PLANO


def _linha(n, acao="Auditar o pixel", quando="Semana 1"):
    return {"num": str(n), "acao": acao, "horizonte": "Imediato", "quando": quando, "quem": "Agência", "frente": "Mídia Paga"}


def test_le_o_plano_aprovado_em_json_na_ordem_cronologica():
    linhas = plano.ler_plano(PLANO_FIXTURE)
    dados = json.loads(PLANO_FIXTURE.read_text(encoding="utf-8"))
    acoes = sorted((a for h in dados["horizontes"] for a in h["acoes"]), key=lambda a: (a["inicio"][6:] + a["inicio"][3:5] + a["inicio"][:2], a["numero"]))
    assert len(linhas) == len(acoes) >= 10
    assert set(linhas[0]) == {"num", "acao", "horizonte", "quando", "quem", "frente"}
    assert [l["num"] for l in linhas] == [str(a["numero"]) for a in acoes]
    assert [l["acao"] for l in linhas] == [a["acao"] for a in acoes]
    primeira = acoes[0]
    assert linhas[0]["quem"] == primeira["dono"].split(" · ")[0] and "·" not in linhas[0]["quem"]
    assert linhas[0]["frente"] == primeira["frente"]
    assert linhas[0]["horizonte"] in {h["nome"] for h in dados["horizontes"]}
    assert all(re.fullmatch(r"\d{2}/\d{2}(/\d{2})? a \d{2}/\d{2}(/\d{2})?", l["quando"]) for l in linhas)


def test_quando_leva_o_ano_so_quando_difere_do_ano_da_data_de_referencia(tmp_path):
    plano_json = {
        "data_referencia": "22/10/2026",
        "horizontes": [{"nome": "Imediato", "acoes": [
            {"numero": 1, "acao": "A", "frente": "F", "dono": "Gestor de tráfego · Boomer", "inicio": "26/10/2026", "entrega": "28/10/2026"},
            {"numero": 2, "acao": "B", "frente": "F", "dono": "Cliente · Verdeluz", "inicio": "20/12/2026", "entrega": "29/01/2027"},
        ]}],
    }
    caminho = tmp_path / "plano.json"
    caminho.write_text(json.dumps(plano_json), encoding="utf-8")
    linhas = plano.ler_plano(caminho)
    assert [l["quando"] for l in linhas] == ["26/10 a 28/10", "20/12 a 29/01/27"]
    assert [l["quem"] for l in linhas] == ["Gestor de tráfego", "Cliente"]


def test_plano_ausente_ou_sem_acoes_vira_erro_em_portugues(tmp_path):
    with pytest.raises(plano.ErroPlano, match="Plano de ação aprovado não encontrado"):
        plano.ler_plano(tmp_path / "nao-existe.json")
    vazio = tmp_path / "vazio.json"
    vazio.write_text(json.dumps({"data_referencia": "22/10/2026", "horizontes": []}), encoding="utf-8")
    with pytest.raises(plano.ErroPlano, match="sem ações"):
        plano.ler_plano(vazio)


def test_linha_de_comando_com_plano_ausente_falha_em_portugues(tmp_path, capsys):
    assert plano.main(["--prospect", str(tmp_path)]) == 1
    assert "Plano de ação aprovado não encontrado" in capsys.readouterr().err


def test_divide_em_slides_sem_perder_nem_reordenar_acao():
    linhas = [_linha(n) for n in range(1, 41)]
    slides = plano.slides_do_roteiro(linhas, "https://x.com/doc")
    assert all(s["tipo"] == "tabela_plano" and s["link"] == "https://x.com/doc" for s in slides)
    assert [l for s in slides for l in s["linhas"]] == linhas
    assert all(len(s["linhas"]) <= plano.MAX_LINHAS_POR_SLIDE for s in slides)
    assert len(slides) == 3  # 16 + 16 + 8


def test_texto_longo_enche_o_slide_mais_cedo():
    longa = "Montar a régua de recompra aos 6 e 12 meses e conferir o resultado com o gateway"
    linhas = [_linha(n, longa, "Mês 1 a 2 (JUN a JUL), depois todo mês") for n in range(1, 21)]
    slides = plano.slides_do_roteiro(linhas)
    assert len(slides[0]["linhas"]) < plano.MAX_LINHAS_POR_SLIDE
    assert all(plano.altura_estimada(s["linhas"]) <= plano.ALTURA_UTIL for s in slides)


def test_por_slide_fixo_e_sem_link():
    slides = plano.slides_do_roteiro([_linha(n) for n in range(1, 8)], por_slide=3)
    assert [len(s["linhas"]) for s in slides] == [3, 3, 1]
    assert all("link" not in s for s in slides)


def test_linha_de_comando_imprime_json(capsys):
    prospect = RAIZ / "clientes/_fixtures/verdeluz/base"
    assert plano.main(["--prospect", str(prospect), "--link", "https://x.com/doc"]) == 0
    slides = json.loads(capsys.readouterr().out)
    assert slides[0]["tipo"] == "tabela_plano" and slides[0]["link"] == "https://x.com/doc"
