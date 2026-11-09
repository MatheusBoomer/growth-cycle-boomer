from __future__ import annotations

import sys
from pathlib import Path

from pptx import Presentation

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402

MOLDE = RAIZ / ".claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx"
ESPERADO = {
    "capa": set(),
    "jornada": set(),
    "divisoria": {"numero", "titulo"},
    "grafico": {"titulo", "subtitulo", "conclusoes", "imagem"},
    "tabela_lateral": {"titulo", "subtitulo", "conclusoes", "imagem"},
    "imagem_larga": {"titulo", "texto", "imagem"},
    "analises_2_colunas": {"esquerda", "direita"},
    "bullets": {"titulo", "subtitulo", "itens"},
    "cartoes": {"titulo", "subtitulo", "cartao_1", "cartao_2", "cartao_3"},
    "benchmark": {"titulo", "subtitulo", "concorrente", "conclusoes", "imagem_1", "imagem_2", "imagem_3", "link"},
    "obrigado": set(),
    "desafio": {"titulo", "esquerda", "direita"},
}


def test_molde_tem_um_slide_por_tipo_com_os_campos():
    prs = Presentation(MOLDE)
    tipos = {ap.tipo_do_slide(s): s for s in prs.slides}
    assert set(tipos) == set(ESPERADO)
    assert len(prs.slides) == len(ESPERADO)
    for tipo, slide in tipos.items():
        assert set(ap.campos(slide)) == ESPERADO[tipo], tipo


def test_desafio_nao_repete_id_de_forma():
    prs = Presentation(MOLDE)
    desafio = next(s for s in prs.slides if ap.tipo_do_slide(s) == "desafio")
    ids = [sh.shape_id for sh in desafio.shapes]
    assert len(ids) == len(set(ids)), ids


def test_capa_tem_token_do_prospect():
    prs = Presentation(MOLDE)
    capa = next(s for s in prs.slides if ap.tipo_do_slide(s) == "capa")
    assert any("{{prospect}}" in sh.text_frame.text for sh in capa.shapes if sh.has_text_frame)


def test_molde_nao_tem_conteudo_do_prospect_de_referencia():
    prs = Presentation(MOLDE)
    texto = " ".join(s._element.xml for s in prs.slides).lower()  # texto, títulos internos e descrições
    for proibido in ("sottile", "baunni", "scrub", "4.858", "smooth"):
        assert proibido not in texto, proibido


def test_molde_nao_tem_imagem_nem_link_orfaos_ou_do_prospect():
    prs = Presentation(MOLDE)
    for slide in prs.slides:
        xml = slide._element.xml
        for rid, rel in slide.part.rels.items():
            if rel.reltype.endswith("/image") or rel.reltype.endswith("/hyperlink"):
                assert f'"{rid}"' in xml, f"relação {rid} sem uso no slide {ap.tipo_do_slide(slide)}"
            if rel.reltype.endswith("/hyperlink"):
                assert rel.target_ref == "https://www.facebook.com/ads/library/", rel.target_ref


def test_nenhum_arquivo_do_pacote_cita_o_prospect_de_referencia():
    import zipfile

    with zipfile.ZipFile(MOLDE) as z:
        for nome in z.namelist():
            if nome.endswith((".xml", ".rels")):
                texto = z.read(nome).decode("utf-8", "ignore").lower()
                for proibido in ("sottile", "baunni", "jalecos", "drive.google"):
                    assert proibido not in texto, (nome, proibido)


def test_molde_nao_leva_metadados_internos_ao_prospect():
    import zipfile

    with zipfile.ZipFile(MOLDE) as z:
        nomes = z.namelist()
    assert not any("commentAuthors" in n or n.startswith("ppt/comments/") for n in nomes), [n for n in nomes if "comment" in n]


SECOES_JORNADA = ["Cenário atual", "Desafios", "Metas", "Cenários e Impactos Esperados", "Plano de ação"]


def _jornada_xml() -> str:
    import zipfile

    with zipfile.ZipFile(MOLDE) as z:
        return z.read("ppt/slides/slide2.xml").decode("utf-8")


def test_jornada_tem_as_cinco_secoes_sem_benchmarking():
    import re

    xml = _jornada_xml()
    assert "Benchmarking" not in xml
    assert "JORNADA" in xml
    paragrafos = ["".join(re.findall(r"<a:t>([^<]*)</a:t>", p)) for p in re.findall(r"<a:p>(.*?)</a:p>", xml)]
    itens = [p for p in paragrafos if p and p != "JORNADA"]
    assert itens == SECOES_JORNADA


def test_jornada_tem_uma_seta_por_secao_no_mesmo_espaco_do_original():
    import re

    xml = _jornada_xml()
    setas = re.findall(r'<a:off x="0" y="(\d+)"/><a:ext cx="695400" cy="210900"/></a:xfrm><a:prstGeom prst="homePlate"', xml)
    ys = [int(y) for y in setas]
    assert len(ys) == len(SECOES_JORNADA)
    passos = {b - a for a, b in zip(ys, ys[1:])}
    assert max(passos) - min(passos) <= 1, passos  # espaçamento uniforme
    # mesma faixa vertical que as 6 setas do deck de referência ocupavam (1387100 a 3525063)
    assert ys[0] == 1387100
    assert abs(ys[-1] - 3525063) < 10000
