from __future__ import annotations

import sys
from pathlib import Path

import pytest
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402


def png(caminho: Path, w: int, h: int, cor=(200, 30, 30)) -> Path:
    Image.new("RGB", (w, h), cor).save(caminho)
    return caminho


def caixa_texto(slide, campo, paragrafos, x=0.5, y=0.5, w=4.0, h=1.0, tamanho=16):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    for i, (texto, negrito) in enumerate(paragrafos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if texto:
            r = p.add_run()
            r.text = texto
            r.font.size = Pt(tamanho)
            r.font.bold = negrito
            r.font.name = "Montserrat"
    ap.definir_texto_alternativo(tb, f"campo:{campo}")
    return tb


@pytest.fixture()
def deck(tmp_path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(10), Inches(5.625)
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    ap.marcar_tipo(slide, "grafico")
    caixa_texto(slide, "titulo", [("Título", True)])
    caixa_texto(slide, "conclusoes", [("Item modelo", False), ("", False), ("Outro", False)], y=2)
    pic = slide.shapes.add_picture(str(png(tmp_path / "m.png", 400, 200)), Inches(0.5), Inches(3), Inches(4), Inches(2))
    ap.definir_texto_alternativo(pic, "campo:imagem")
    return prs, slide, tmp_path


def test_texto_alternativo_e_campos(deck):
    prs, slide, _ = deck
    assert set(ap.campos(slide)) == {"titulo", "conclusoes", "imagem"}
    assert ap.texto_alternativo(ap.campos(slide)["imagem"]) == "campo:imagem"


def test_tipo_nas_anotacoes(deck):
    _, slide, _ = deck
    assert ap.tipo_do_slide(slide) == "grafico"


def test_partes_negrito():
    assert ap.partes_negrito("**Investimento total** em mídia") == [("Investimento total", True), (" em mídia", False)]
    assert ap.partes_negrito("sem marca") == [("sem marca", False)]
    assert ap.partes_negrito("**aberto sem fechar") == [("aberto sem fechar", False)]
    assert ap.partes_negrito("CENÁRIOS E IMPACTOS **ESPERADOS**") == [("CENÁRIOS E IMPACTOS ", False), ("ESPERADOS", True)]


def test_preencher_texto_mantem_fonte_e_aplica_negrito(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["titulo"]
    ap.preencher_texto(shape, "**ROAS** por plataforma")
    runs = shape.text_frame.paragraphs[0].runs
    assert [(r.text, r.font.bold) for r in runs] == [("ROAS", True), (" por plataforma", False)]
    assert all(r.font.size == Pt(16) and r.font.name == "Montserrat" for r in runs)
    assert "*" not in shape.text_frame.text


def test_preencher_texto_com_quebra_vira_paragrafos(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["titulo"]
    ap.preencher_texto(shape, "Linha 1\nLinha **2**")
    assert [p.text for p in shape.text_frame.paragraphs] == ["Linha 1", "Linha 2"]


def test_preencher_lista_usa_espacador_do_modelo(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["conclusoes"]
    ap.preencher_lista(shape, ["A", "B", "C"])
    assert [p.text for p in shape.text_frame.paragraphs] == ["A", "", "B", "", "C"]


def test_preencher_bloco(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    caixa_texto(slide, "esquerda", [("Análises sobre o **x**", False), ("", False), ("item", False)])
    shape = ap.campos(slide)["esquerda"]
    ap.preencher_bloco(shape, "Análises sobre o **investimento**", ["um", "dois"])
    assert [p.text for p in shape.text_frame.paragraphs] == ["Análises sobre o investimento", "", "um", "", "dois"]


@pytest.mark.parametrize("w,h", [(1600, 200), (200, 1600)])
def test_trocar_imagem_encaixa_sem_distorcer(deck, w, h):
    prs, slide, tmp = deck
    shape = ap.campos(slide)["imagem"]
    caixa = (shape.left, shape.top, shape.width, shape.height)
    ap.trocar_imagem(slide, shape, png(tmp / f"n{w}.png", w, h, (10, 10, 200)))
    assert abs(shape.width / shape.height - w / h) < 0.02
    assert shape.width <= caixa[2] + 1 and shape.height <= caixa[3] + 1
    assert abs((shape.left + shape.width / 2) - (caixa[0] + caixa[2] / 2)) < 2
    assert abs((shape.top + shape.height / 2) - (caixa[1] + caixa[3] / 2)) < 2


def test_duplicar_e_remover_slide(deck):
    prs, modelo, tmp = deck
    novo = ap.duplicar_slide(prs, modelo)
    assert set(ap.campos(novo)) == {"titulo", "conclusoes", "imagem"}
    assert ap.tipo_do_slide(novo) is None
    ap.preencher_texto(ap.campos(novo)["titulo"], "Novo")
    assert ap.campos(modelo)["titulo"].text_frame.text == "Título"
    ap.remover_slide(prs, modelo)
    assert len(prs.slides) == 1
    saida = tmp / "s.pptx"
    prs.save(saida)
    reaberto = Presentation(saida)
    assert ap.campos(reaberto.slides[0])["titulo"].text_frame.text == "Novo"


def test_imagem_do_slide_duplicado_e_trocada_sem_afetar_o_modelo(deck):
    prs, modelo, tmp = deck
    novo = ap.duplicar_slide(prs, modelo)
    ap.trocar_imagem(novo, ap.campos(novo)["imagem"], png(tmp / "outra.png", 300, 300, (0, 200, 0)))
    blob_modelo = ap.campos(modelo)["imagem"].image.blob
    blob_novo = ap.campos(novo)["imagem"].image.blob
    assert blob_modelo != blob_novo


def test_link_e_token(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    caixa_texto(slide, "link", [("Biblioteca de Anúncios", False)])
    caixa_texto(slide, "capa", [("PLANEJAMENTO", True), ("{{prospect}}", False)], y=2)
    ap.definir_link(ap.campos(slide)["link"], "https://www.facebook.com/ads/library/?view_all_page_id=1")
    assert ap.campos(slide)["link"].text_frame.paragraphs[0].runs[0].hyperlink.address.endswith("view_all_page_id=1")
    assert ap.substituir_token(slide, "{{prospect}}", "Sottile Jalecos") == 1
    assert "Sottile Jalecos" in ap.campos(slide)["capa"].text_frame.text


def test_ocupacao_estima_estouro(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    curta = caixa_texto(slide, "a", [("curto", False)], w=4, h=1, tamanho=12)
    longa = caixa_texto(slide, "b", [("x" * 600, False)], w=2, h=0.5, tamanho=12)
    assert ap.ocupacao(curta) < 1.0
    assert ap.ocupacao(longa) > 1.0


def test_caixa_percentual(deck):
    prs, slide, _ = deck
    c = ap.caixa_percentual(prs, ap.campos(slide)["imagem"])
    assert c == {"x": 5.0, "y": pytest.approx(53.33, 0.01), "w": 40.0, "h": pytest.approx(35.56, 0.01)}


def test_trocar_imagem_desanexa_a_imagem_antiga(deck):
    prs, slide, tmp = deck
    shape = ap.campos(slide)["imagem"]
    antiga = shape.image.blob
    ap.trocar_imagem(slide, shape, png(tmp / "nova.png", 300, 300, (0, 0, 0)))
    blobs = [rel.target_part.blob for rel in slide.part.rels.values() if rel.reltype.endswith("/image")]
    assert antiga not in blobs
