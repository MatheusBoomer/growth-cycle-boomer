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


# ---- slides com imagem em coluna: texto à esquerda, imagem grande à direita ----

AREA_IMAGEM = (34.0, 7.0, 63.0, 85.0)  # x, y, largura, altura em % do slide
CAMPOS_DE_TEXTO = {
    "grafico": ["titulo", "subtitulo", "conclusoes"],
    "tabela_lateral": ["titulo", "subtitulo", "conclusoes"],
    "imagem_larga": ["titulo", "texto"],
}


def roteiro_de(tipo, imagem):
    if tipo == "imagem_larga":
        return {"tipo": tipo, "titulo": "Metas", "imagem": imagem, "texto": "O realista pede mais verba."}
    return {"tipo": tipo, "titulo": "Título", "subtitulo": "**Destaque** do subtítulo", "imagem": imagem, "conclusoes": ["Primeira", "Segunda"]}


def gerar_com_imagem(tmp_path, pasta, tipo, largura, altura):
    rel = "entrega/ativos-aprovados/graficos/imagem.png"
    Image.new("RGB", (largura, altura), (20, 60, 200)).save(pasta / rel)
    prs, resultado = gerar_deck(tmp_path, pasta, [roteiro_de(tipo, rel)])
    slide = prs.slides[0]
    return prs, slide, {n: ap.caixa_percentual(prs, f) for n, f in ap.campos(slide).items()}, resultado


def dentro(caixa, area, folga=0.5):
    x, y, w, h = area
    return caixa["x"] >= x - folga and caixa["y"] >= y - folga and caixa["x"] + caixa["w"] <= x + w + folga and caixa["y"] + caixa["h"] <= y + h + folga


def encosta(caixa, area, folga=1.0):
    return abs(caixa["w"] - area[2]) <= folga or abs(caixa["h"] - area[3]) <= folga


@pytest.mark.parametrize("tipo", ["grafico", "tabela_lateral", "imagem_larga"])
class TestColuna:
    @pytest.mark.parametrize("largura,altura", [(1200, 600), (400, 700), (900, 900), (2800, 1000)])
    def test_imagem_enche_a_area_da_direita_pelo_lado_limitante_e_fica_centrada(self, tmp_path, prospect, tipo, largura, altura):
        _, _, caixas, _ = gerar_com_imagem(tmp_path, prospect, tipo, largura, altura)
        img = caixas["imagem"]
        assert dentro(img, AREA_IMAGEM)
        assert encosta(img, AREA_IMAGEM)
        assert abs((img["x"] + img["w"] / 2) - (AREA_IMAGEM[0] + AREA_IMAGEM[2] / 2)) <= 1
        assert abs((img["y"] + img["h"] / 2) - (AREA_IMAGEM[1] + AREA_IMAGEM[3] / 2)) <= 1

    def test_imagem_muito_larga_mantem_a_faixa_do_molde(self, tmp_path, prospect, tipo):
        _, _, caixas, _ = gerar_com_imagem(tmp_path, prospect, tipo, 3000, 600)
        modelo = molde_slide(tipo)
        prs_molde = Presentation(ga.CAMINHO_MOLDE)
        original = {n: ap.caixa_percentual(prs_molde, f) for n, f in ap.campos(modelo).items()}
        area = (original["imagem"]["x"], original["imagem"]["y"], original["imagem"]["w"], original["imagem"]["h"])
        assert dentro(caixas["imagem"], area) and encosta(caixas["imagem"], area)
        for campo in CAMPOS_DE_TEXTO[tipo]:
            assert caixas[campo] == original[campo]

    def test_textos_ficam_na_coluna_da_esquerda_sem_encostar_na_imagem_nem_entre_si(self, tmp_path, prospect, tipo):
        _, _, caixas, _ = gerar_com_imagem(tmp_path, prospect, tipo, 1200, 600)
        anterior = None
        for campo in CAMPOS_DE_TEXTO[tipo]:
            c = caixas[campo]
            assert c["x"] >= 4.4 - 0.1 and c["x"] + c["w"] <= 31 + 0.1
            assert c["x"] + c["w"] < caixas["imagem"]["x"]
            if anterior:
                assert anterior["y"] + anterior["h"] <= c["y"] + 0.1
            anterior = c

    def test_titulo_comporta_tres_linhas_sem_invadir_o_campo_de_baixo(self, tmp_path, prospect, tipo):
        # Título de ~45 caracteres quebra em 3 linhas na coluna estreita (visto no deck do Verdeluz).
        prs, slide, caixas, _ = gerar_com_imagem(tmp_path, prospect, tipo, 1200, 600)
        titulo = ap.campos(slide)["titulo"]
        altura_pt = caixas["titulo"]["h"] / 100 * prs.slide_height / 12700
        margens_pt = 2 * 91425 / 12700
        assert altura_pt >= 3 * 1.2 * ap._tamanho_pt(titulo) + margens_pt
        abaixo = caixas[CAMPOS_DE_TEXTO[tipo][1]]
        assert caixas["titulo"]["y"] + caixas["titulo"]["h"] <= abaixo["y"] + 0.1

    def test_mapa_de_slides_traz_a_geometria_nova(self, tmp_path, prospect, tipo):
        import json

        _, _, caixas, resultado = gerar_com_imagem(tmp_path, prospect, tipo, 1200, 600)
        mapa = json.loads(Path(resultado["mapa"]).read_text(encoding="utf-8"))["slides"][0]["campos"]
        assert mapa["imagem"] == caixas["imagem"]
        assert mapa["titulo"] == caixas["titulo"]


class TestAplicarColuna:
    def test_devolve_true_para_imagem_normal_e_false_para_faixa_larga_ou_outro_tipo(self, tmp_path):
        prs = Presentation(ga.CAMINHO_MOLDE)
        normal, larga = tmp_path / "normal.png", tmp_path / "larga.png"
        Image.new("RGB", (1200, 600)).save(normal)
        Image.new("RGB", (3000, 600)).save(larga)
        assert lay.aplicar_coluna(prs, molde_slide("grafico"), "grafico", normal) is True
        assert lay.aplicar_coluna(prs, molde_slide("grafico"), "grafico", larga) is False
        assert lay.aplicar_coluna(prs, molde_slide("obrigado"), "obrigado", normal) is False

    def test_limite_exato_de_2_8_ainda_usa_a_coluna(self, tmp_path):
        prs = Presentation(ga.CAMINHO_MOLDE)
        limite, acima = tmp_path / "limite.png", tmp_path / "acima.png"
        Image.new("RGB", (2800, 1000)).save(limite)
        Image.new("RGB", (2801, 1000)).save(acima)
        assert lay.aplicar_coluna(prs, molde_slide("imagem_larga"), "imagem_larga", limite) is True
        assert lay.aplicar_coluna(prs, molde_slide("imagem_larga"), "imagem_larga", acima) is False
