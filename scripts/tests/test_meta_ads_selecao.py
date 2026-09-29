from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from meta_ads_selecao import (  # noqa: E402
    FORMATO_CARROSSEL,
    FORMATO_DPA,
    FORMATO_IMAGEM,
    FORMATO_VIDEO,
    agrupar_paginas,
    classificar_descoberta,
    dominio_base,
    nome_compativel,
    normalizar_anuncio,
    slug_marca,
)

FIXTURE = Path(__file__).parent / "fixtures" / "apify_anuncios.json"


def anuncios():
    return {a.ad_id: a for a in (normalizar_anuncio(b) for b in json.loads(FIXTURE.read_text(encoding="utf-8"))) if a}


def test_normaliza_video_em_camel_case():
    a = anuncios()["101"]
    assert a.page_id == "111"
    assert a.pagina == "Marca Teste Oficial"
    assert a.formato == FORMATO_VIDEO
    assert a.texto == "Vídeo novo da coleção"
    assert a.titulo == "Coleção Primavera"
    assert a.cta == "Comprar agora"
    assert a.dominio == "marcateste.com.br"
    assert a.plataformas == ["Facebook", "Instagram"]
    assert a.inicio == "2026-09-20"
    assert a.versoes == 3
    assert a.collation_id == "c1"
    assert a.videos == [{"url": "https://cdn.test/v101.mp4", "capa": "https://cdn.test/v101.jpg"}]
    assert a.curtidas_pagina == 50000
    assert a.categorias_pagina == ["Loja de roupas"]
    assert a.link == "https://www.facebook.com/ads/library/?id=101"


def test_normaliza_carrossel_em_snake_case():
    a = anuncios()["107"]
    assert a.page_id == "111"
    assert a.formato == FORMATO_CARROSSEL
    assert a.texto == "Carrossel de looks"
    assert a.cta == "Ver mais"
    assert a.dominio == "marcateste.com.br"
    assert a.plataformas == ["Facebook", "Threads"]
    assert a.inicio == "2026-09-14"
    assert a.versoes == 2
    assert a.imagens == ["https://cdn.test/c107a.jpg", "https://cdn.test/c107b.jpg"]


def test_catalogo_imagem_e_limite_de_tres_cards():
    todos = anuncios()
    assert todos["104"].formato == FORMATO_DPA
    assert todos["104"].imagens == ["https://cdn.test/c104a.jpg", "https://cdn.test/c104b.jpg", "https://cdn.test/c104c.jpg"]
    assert todos["104"].dominio == "marcateste.com.br"
    assert todos["103"].formato == FORMATO_IMAGEM
    assert todos["103"].imagens == ["https://cdn.test/i103.jpg"]
    assert todos["106"].imagens == [] and todos["106"].videos == []


def test_anuncio_sem_id_e_descartado():
    assert normalizar_anuncio({"pageID": "1", "snapshot": {}}) is None


def test_dominio_base():
    assert dominio_base("https://loja.marca.com.br/x?y=1") == "marca.com.br"
    assert dominio_base("MARCA.COM.BR") == "marca.com.br"
    assert dominio_base("www.marca.com") == "marca.com"
    assert dominio_base("https://shop.brand.co.uk") == "brand.co.uk" or dominio_base("https://shop.brand.co.uk") == "co.uk"
    assert dominio_base("Loja Oficial") is None
    assert dominio_base(None) is None


def test_nome_compativel_tolera_acento_apostrofo_e_sufixo():
    assert nome_compativel("Água de Cheiro", "Agua de Cheiro Oficial")
    assert nome_compativel("L'Occitane", "L'OCCITANE en Provence")
    assert nome_compativel("Marca Teste", "MarcaTeste")
    assert not nome_compativel("Nike", "Adidas Brasil")
    assert not nome_compativel("!!!", "Qualquer")


def test_slug_marca():
    assert slug_marca("Água de Cheiro") == "agua-de-cheiro"
    assert slug_marca("L'Occitane en Provence") == "l-occitane-en-provence"
    assert slug_marca("!!!") == "marca"


def test_agrupar_paginas_ordena_por_volume():
    candidatas = agrupar_paginas(list(anuncios().values()))
    assert [c.page_id for c in candidatas] == ["111", "222"]
    assert candidatas[0].anuncios == 8
    assert candidatas[0].curtidas == 50000
    assert candidatas[0].dominios == ["marcateste.com.br"]
    assert candidatas[1].dominios == ["example.com"]


def test_descoberta_confirmada_com_nome_e_dominio():
    r = classificar_descoberta("Marca Teste", "https://www.marcateste.com.br", agrupar_paginas(list(anuncios().values())))
    assert r["status"] == "confirmada"
    assert r["page_id"] == "111"


def test_descoberta_ambigua_por_dominio_nome_ou_sem_site():
    candidatas = agrupar_paginas(list(anuncios().values()))
    outro = classificar_descoberta("Marca Teste", "outra.com.br", candidatas)
    assert outro["status"] == "ambigua" and "outra.com.br" in outro["motivo"] and outro["page_id"] is None
    assert classificar_descoberta("Outra Coisa", "marcateste.com.br", candidatas)["status"] == "ambigua"
    assert classificar_descoberta("Marca Teste", None, candidatas)["status"] == "ambigua"


def test_descoberta_nao_encontrada():
    assert classificar_descoberta("Marca Teste", "marcateste.com.br", [])["status"] == "nao_encontrada"
