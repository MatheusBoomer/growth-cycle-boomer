from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from docx import Document

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import linhas_plano_acao as plano  # noqa: E402

DOCX_FIXTURE = RAIZ / "clientes/_fixtures/verdeluz/base" / plano.CAMINHO_DOCX


def _linha(n, acao="Auditar o pixel", quando="Semana 1"):
    return {"num": str(n), "acao": acao, "horizonte": "Imediato", "quando": quando, "quem": "Agência", "frente": "Mídia Paga"}


def test_le_a_tabela_resumo_do_docx_aprovado_na_ordem():
    linhas = plano.ler_tabela_docx(DOCX_FIXTURE)
    assert len(linhas) >= 10
    assert [l["num"] for l in linhas][:3] == ["1", "2", "3"]
    assert set(linhas[0]) == {"num", "acao", "horizonte", "quando", "quem", "frente"}
    assert all(l["acao"] and l["horizonte"] and l["quem"] for l in linhas)


def test_docx_sem_tabela_de_acoes_vira_erro_em_portugues(tmp_path):
    caminho = tmp_path / "plano.docx"
    Document().save(caminho)
    with pytest.raises(plano.ErroPlano, match="tabela-resumo"):
        plano.ler_tabela_docx(caminho)
    with pytest.raises(plano.ErroPlano, match="não encontrado"):
        plano.ler_tabela_docx(tmp_path / "nao-existe.docx")


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
