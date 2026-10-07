from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import gerar_apresentacao as ga  # noqa: E402
import previa_apresentacao as pv  # noqa: E402

TEM_FERRAMENTAS = (shutil.which("soffice") or Path("/Applications/LibreOffice.app/Contents/MacOS/soffice").exists()) and shutil.which("pdftoppm")


@pytest.fixture()
def deck(tmp_path):
    pasta = tmp_path / "clientes" / "teste"
    (pasta / "entrega/ativos-aprovados/graficos").mkdir(parents=True)
    Image.new("RGB", (1200, 600), (20, 60, 200)).save(pasta / "entrega/ativos-aprovados/graficos/roas.png")
    roteiro = {"versao": 1, "prospect": "Marca", "slides": [
        {"tipo": "capa", "prospect": "Marca"},
        {"tipo": "grafico", "titulo": "Cenário Atual", "subtitulo": "**ROAS** global",
         "imagem": "entrega/ativos-aprovados/graficos/roas.png", "conclusoes": ["Uma conclusão"]},
        {"tipo": "obrigado"},
    ]}
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro, pasta, saida)
    return saida


def test_mapa_do_pptx_tem_titulo_e_campos(deck):
    mapa = pv.mapa_do_pptx(deck)
    assert [s["numero"] for s in mapa["slides"]] == [1, 2, 3]
    s2 = mapa["slides"][1]
    assert s2["titulo"] == "Cenário Atual · ROAS global"
    assert {"titulo", "conclusoes", "imagem"} <= set(s2["campos"])
    assert all(0 <= v <= 100 for c in s2["campos"].values() for v in c.values())


def test_recortar_inclui_margem_e_destaque(tmp_path):
    slide = tmp_path / "slide-01.png"
    Image.new("RGB", (1000, 560), (255, 255, 255)).save(slide)
    saida = tmp_path / "c1.png"
    pv.recortar(slide, {"x": 60, "y": 30, "w": 30, "h": 40}, saida)
    with Image.open(saida) as img:
        largura, altura = img.size
        assert 300 < largura <= 1000 and 224 < altura <= 560
        cores = {img.getpixel((x, y)) for x in range(largura) for y in range(0, altura, 7)}
    assert (200, 111, 0) in cores  # contorno laranja da agência (#C86F00)


def test_recortar_regiao_invalida(tmp_path):
    slide = tmp_path / "s.png"
    Image.new("RGB", (100, 100)).save(slide)
    with pytest.raises(pv.ErroPrevia):
        pv.recortar(slide, {"x": 90, "y": 90, "w": 0, "h": 0}, tmp_path / "c.png")


@pytest.mark.skipif(not TEM_FERRAMENTAS, reason="LibreOffice ou poppler não instalados")
def test_converter_gera_um_png_por_slide(deck, tmp_path):
    pasta = tmp_path / "previa"
    n = pv.converter(deck, pasta)
    assert n == 3
    assert sorted(p.name for p in pasta.glob("slide-*.png")) == ["slide-01.png", "slide-02.png", "slide-03.png"]
    with Image.open(pasta / "slide-01.png") as img:
        assert abs(img.width / img.height - 16 / 9) < 0.02


@pytest.mark.skipif(not TEM_FERRAMENTAS, reason="LibreOffice ou poppler não instalados")
def test_cli_gerar_grava_mapa(deck, tmp_path, capsys):
    pasta = tmp_path / "previa"
    assert pv.main(["gerar", "--pptx", str(deck), "--saida", str(pasta)]) == 0
    assert json.loads(capsys.readouterr().out) == {"slides": 3}
    assert json.loads((pasta / "mapa.json").read_text(encoding="utf-8"))["slides"][1]["numero"] == 2


def test_cli_pptx_inexistente(tmp_path, capsys):
    assert pv.main(["gerar", "--pptx", str(tmp_path / "nao.pptx"), "--saida", str(tmp_path / "p")]) == 1
    assert "ERRO" in capsys.readouterr().err
