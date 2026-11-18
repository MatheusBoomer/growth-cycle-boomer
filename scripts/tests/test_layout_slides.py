from __future__ import annotations

import sys
from pathlib import Path

import pytest
from PIL import Image
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402
import gerar_apresentacao as ga  # noqa: E402
import layout_slides as lay  # noqa: E402


@pytest.fixture()
def prospect(tmp_path):
    pasta = tmp_path / "clientes" / "teste"
    (pasta / "entrega/ativos-aprovados/graficos").mkdir(parents=True)
    return pasta


def gerar_deck(tmp_path, pasta, slides, molde=ga.CAMINHO_MOLDE):
    roteiro = {"versao": 1, "prospect": "Marca Teste", "slides": slides}
    saida = tmp_path / "deck.pptx"
    resultado = ga.gerar(roteiro, pasta, saida, molde)
    return Presentation(saida), resultado


def molde_slide(tipo):
    return next(s for s in Presentation(ga.CAMINHO_MOLDE).slides if ap.tipo_do_slide(s) == tipo)


def setas(slide):
    achadas = [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE and s.left == 0 and not s.text_frame.text.strip()]
    return sorted(achadas, key=lambda s: s.top)


def caixas_de_item(slide):
    return sorted((s for s in slide.shapes if s.name.startswith("Jornada item")), key=lambda s: s.top)


def lista_original(slide):
    """Caixa do molde com os 5 itens (a única de texto com 5 parágrafos)."""
    return next(s for s in slide.shapes if s.has_text_frame and len(s.text_frame.paragraphs) == 5)


class TestJornada:
    def test_cada_item_e_centralizado_na_sua_seta(self, tmp_path, prospect):
        prs, _ = gerar_deck(tmp_path, prospect, [{"tipo": "jornada"}])
        slide = prs.slides[0]
        caixas, flechas = caixas_de_item(slide), setas(slide)
        assert len(caixas) == 5 and len(flechas) == 5
        for caixa, seta in zip(caixas, flechas):
            assert abs((caixa.top + caixa.height / 2) - (seta.top + seta.height / 2)) <= 1

    def test_geometria_ancoragem_e_espacamento_das_caixas(self, tmp_path, prospect):
        original = lista_original(molde_slide("jornada"))
        prs, _ = gerar_deck(tmp_path, prospect, [{"tipo": "jornada"}])
        caixas = caixas_de_item(prs.slides[0])
        assert len(caixas) == 5
        for caixa in caixas:
            assert caixa.height == lay.ALTURA_ITEM_JORNADA == 420_000
            assert (caixa.left, caixa.width) == (original.left, original.width)
            corpo = caixa._element.find(".//" + qn("a:bodyPr"))
            assert corpo.get("anchor") == "ctr"
            assert corpo.find(qn("a:spAutoFit")) is None
            assert caixa._element.find(".//" + qn("a:lnSpc") + "/" + qn("a:spcPct")).get("val") == "100000"

    def test_numeracao_continua_de_1_a_5_e_textos_seguem_o_molde(self, tmp_path, prospect):
        textos = [p.text for p in lista_original(molde_slide("jornada")).text_frame.paragraphs]
        prs, _ = gerar_deck(tmp_path, prospect, [{"tipo": "jornada"}])
        caixas = caixas_de_item(prs.slides[0])
        assert [c.text_frame.text for c in caixas] == textos
        for i, caixa in enumerate(caixas):
            assert len(caixa.text_frame.paragraphs) == 1
            assert caixa._element.find(".//" + qn("a:buAutoNum")).get("startAt") == str(i + 1)

    def test_a_caixa_original_some_e_os_ids_sao_unicos(self, tmp_path, prospect):
        prs, _ = gerar_deck(tmp_path, prospect, [{"tipo": "jornada"}])
        slide = prs.slides[0]
        assert not any(s.has_text_frame and len(s.text_frame.paragraphs) == 5 for s in slide.shapes)
        ids = [s.shape_id for s in slide.shapes]
        assert len(ids) == len(set(ids))

    def test_slide_sem_a_estrutura_da_jornada_fica_intacto(self):
        slide = molde_slide("grafico")
        antes = [(s.name, s.left, s.top, s.width, s.height) for s in slide.shapes]
        assert lay.alinhar_jornada(slide) is False
        assert [(s.name, s.left, s.top, s.width, s.height) for s in slide.shapes] == antes

    def test_molde_inesperado_avisa_e_nao_quebra_a_geracao(self, tmp_path, prospect):
        molde = tmp_path / "molde-sem-setas.pptx"
        prs = Presentation(ga.CAMINHO_MOLDE)
        for slide in prs.slides:
            if ap.tipo_do_slide(slide) == "jornada":
                for seta in setas(slide):
                    seta._element.getparent().remove(seta._element)
        prs.save(molde)
        _, resultado = gerar_deck(tmp_path, prospect, [{"tipo": "jornada"}], molde=molde)
        assert any("Slide 1 (jornada)" in a and "alinhamento" in a for a in resultado["avisos"])
