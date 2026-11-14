from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from PIL import Image
from pptx import Presentation

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402
import gerar_apresentacao as ga  # noqa: E402


@pytest.fixture()
def prospect(tmp_path):
    pasta = tmp_path / "clientes" / "teste"
    (pasta / "entrega/ativos-aprovados/graficos").mkdir(parents=True)
    (pasta / "dados/benchmark-meta/x/midia/1").mkdir(parents=True)
    Image.new("RGB", (1200, 600), (20, 60, 200)).save(pasta / "entrega/ativos-aprovados/graficos/roas.png")
    Image.new("RGB", (400, 700), (200, 60, 20)).save(pasta / "dados/benchmark-meta/x/midia/1/imagem-1.jpg")
    return pasta


def roteiro_basico():
    return {
        "versao": 1,
        "prospect": "Marca Teste",
        "slides": [
            {"tipo": "capa", "prospect": "Marca Teste"},
            {"tipo": "jornada"},
            {"tipo": "divisoria", "numero": "01.", "titulo": "CENÁRIO **ATUAL**"},
            {
                "tipo": "grafico",
                "titulo": "Cenário Atual",
                "subtitulo": "**ROAS Global** vs ROAS por plataforma",
                "imagem": "entrega/ativos-aprovados/graficos/roas.png",
                "conclusoes": ["Média de 12,0x", "Correlação negativa com investimento"],
                "fonte": "secoes/03-macro-financeiro.md",
            },
            {
                "tipo": "benchmark",
                "titulo": "Benchmarking",
                "subtitulo": "Qual a jornada de compra anunciada pela concorrência?",
                "concorrente": "Concorrente X",
                "imagens": ["dados/benchmark-meta/x/midia/1/imagem-1.jpg"],
                "conclusoes": ["Usa muito UGC"],
                "link": "https://www.facebook.com/ads/library/?view_all_page_id=1",
            },
            {"tipo": "obrigado"},
        ],
    }


def tipos_molde():
    return {ap.tipo_do_slide(s) for s in Presentation(ga.CAMINHO_MOLDE).slides}


def test_roteiro_valido_nao_tem_erros(prospect):
    erros, _ = ga.validar_roteiro(roteiro_basico(), prospect, tipos_molde())
    assert erros == []


@pytest.mark.parametrize(
    "alteracao,trecho",
    [
        (lambda r: r["slides"].append({"tipo": "inexistente"}), "tipo"),
        (lambda r: r["slides"][3].pop("titulo"), "titulo"),
        (lambda r: r["slides"][3].update(conclusoes=["a", "b", "c", "d", "e"]), "conclusoes"),
        (lambda r: r["slides"][3].update(imagem="../../fora.png"), "fora da pasta"),
        (lambda r: r["slides"][3].update(imagem="/etc/passwd"), "fora da pasta"),
        (lambda r: r["slides"][3].update(imagem="entrega/nao-existe.png"), "não encontrada"),
        (lambda r: r["slides"][3].update(imagem="secoes/x.md"), "png"),
        (lambda r: r["slides"][4].update(link="ftp://x"), "link"),
    ],
)
def test_erros_de_validacao_apontam_slide_e_campo(prospect, alteracao, trecho):
    roteiro = roteiro_basico()
    alteracao(roteiro)
    erros, _ = ga.validar_roteiro(roteiro, prospect, tipos_molde())
    assert erros and any(trecho in e for e in erros), erros
    assert all(e.startswith("Slide ") for e in erros)


def test_gerar_monta_deck_na_ordem_sem_modelos(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    r = ga.gerar(roteiro_basico(), prospect, saida)
    prs = Presentation(saida)
    assert r["slides"] == len(prs.slides) == 6
    assert all(ap.tipo_do_slide(s) is None for s in prs.slides)
    textos = [" ".join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame) for s in prs.slides]
    assert "Marca Teste" in textos[0] and "{{prospect}}" not in textos[0]
    assert "CENÁRIO ATUAL" in textos[2]
    assert "Média de 12,0x" in textos[3] and "Correlação negativa" in textos[3]
    assert "Concorrente X" in textos[4]
    c = ap.campos(prs.slides[4])
    assert c["link"].text_frame.paragraphs[0].runs[0].hyperlink.address.endswith("view_all_page_id=1")


def test_benchmark_com_menos_imagens_remove_as_areas_sobrando(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro_basico(), prospect, saida)
    c = ap.campos(Presentation(saida).slides[4])
    assert "imagem_1" in c and "imagem_2" not in c and "imagem_3" not in c


def test_slide_com_pendencia_e_pulado_com_aviso(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(4, {"tipo": "grafico", "pendencia": "Gráfico de CAC não foi aprovado na etapa 04"})
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert r["slides"] == 6
    assert any("pulado" in a and "CAC" in a for a in r["avisos"])


def test_aviso_de_texto_que_estoura(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"][3]["conclusoes"] = ["x" * 400, "y" * 400, "z" * 400]
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("Slide 4" in a and "conclusoes" in a for a in r["avisos"])


def test_mapa_de_slides(prospect, tmp_path):
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    mapa = json.loads(Path(r["mapa"]).read_text(encoding="utf-8"))
    s4 = mapa["slides"][3]
    assert s4["numero"] == 4 and s4["tipo"] == "grafico" and s4["roteiro"] == 3
    assert set(s4["campos"]) >= {"titulo", "conclusoes", "imagem"}
    assert all(set(v) == {"x", "y", "w", "h"} for v in s4["campos"].values())


def test_roteiro_invalido_nao_gera_arquivo(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].append({"tipo": "inexistente"})
    with pytest.raises(ga.ErroRoteiro):
        ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert not (tmp_path / "deck.pptx").exists()


def test_cli_erro_em_portugues(prospect, tmp_path, capsys):
    caminho = tmp_path / "roteiro.json"
    caminho.write_text("{ não é json", encoding="utf-8")
    codigo = ga.main(["--roteiro", str(caminho), "--prospect", str(prospect), "--output", str(tmp_path / "d.pptx")])
    assert codigo == 1
    assert "ERRO" in capsys.readouterr().err


def test_divisoria_com_titulo_em_duas_linhas_nao_gera_aviso(prospect, tmp_path):
    # No deck de referência (p.42) "CENÁRIOS E IMPACTOS ESPERADOS" ocupa duas linhas na mesma caixa.
    roteiro = roteiro_basico()
    roteiro["slides"][2]["titulo"] = "**CENÁRIOS** E IMPACTOS **ESPERADOS**"
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert not any("Slide 3" in a for a in r["avisos"]), r["avisos"]


def test_benchmark_com_criativo_repetido(prospect, tmp_path):
    roteiro = roteiro_basico()
    img = "dados/benchmark-meta/x/midia/1/imagem-1.jpg"
    roteiro["slides"][4]["imagens"] = [img, "entrega/ativos-aprovados/graficos/roas.png", img]
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    c = ap.campos(Presentation(tmp_path / "deck.pptx").slides[4])
    assert r["slides"] == 6 and c["imagem_1"].image.blob == c["imagem_3"].image.blob


def test_aviso_de_graficos_aprovados_fora_do_roteiro(prospect, tmp_path):
    graficos = prospect / "entrega/ativos-aprovados/graficos"
    Image.new("RGB", (800, 400)).save(graficos / "cac-mensal.png")
    Image.new("RGB", (800, 400)).save(graficos / "tabela-calendario.png")
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    aviso = next(a for a in r["avisos"] if "não entraram" in a)
    assert "2 gráficos aprovados" in aviso and "cac-mensal.png" in aviso and "tabela-calendario.png" in aviso
    assert "roas.png" not in aviso


def test_sem_aviso_quando_todos_os_graficos_estao_no_roteiro(prospect, tmp_path):
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    assert not any("não entraram" in a for a in r["avisos"])


def slide_desafio(**extra):
    s = {
        "tipo": "desafio",
        "problema_id": "P1",
        "titulo": "Quebra: **hipótese antes da ação**",
        "problema": "36,1% da receita captada não vira caixa",
        "hipoteses": ["Boleto como meio de pagamento", "Ruptura de estoque"],
        "solucoes": ["Recuperar PIX e boleto", "Checar ruptura de estoque"],
        "impacto": "+R$ 16,4M/ano",
    }
    s.update(extra)
    return s


def test_desafio_preenche_problema_hipoteses_solucoes_e_impacto(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio())
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro, prospect, saida)
    prs = Presentation(saida)
    texto = " ".join(sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame)
    for trecho in ("36,1% da receita", "Hipótese: Ruptura de estoque", "Solução: Recuperar PIX e boleto", "+R$ 16,4M/ano"):
        assert trecho in texto, trecho
    assert "1. Recuperar" not in texto


@pytest.mark.parametrize(
    "extra, trecho",
    [
        ({"solucoes": ["a", "b", "c", "d"]}, "campo solucoes: precisa ter de 1 a 3"),
        ({"hipoteses": []}, "campo hipoteses: precisa ter de 1 a 5"),
        ({"impacto": ""}, "campo impacto: precisa ser um texto"),
    ],
)
def test_desafio_invalido(prospect, extra, trecho):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(**extra))
    modelos = {ap.tipo_do_slide(s) for s in Presentation(ga.CAMINHO_MOLDE).slides}
    erros, _ = ga.validar_roteiro(roteiro, prospect, modelos)
    assert any(trecho in e for e in erros), erros


def _registro(pasta, ids):
    (pasta / "contexto").mkdir(parents=True, exist_ok=True)
    (pasta / "contexto/solucoes.json").write_text(
        json.dumps({"problemas": [{"id": i} for i in ids]}), encoding="utf-8"
    )


def test_aviso_de_problema_do_registro_fora_do_deck(prospect, tmp_path):
    _registro(prospect, ["P1", "P2", "P3"])
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio())
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("2 problemas do registro de soluções não entraram no deck: P2, P3." in a for a in r["avisos"]), r["avisos"]


def test_sem_registro_nao_avisa_nem_quebra(prospect, tmp_path):
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    assert not any("registro de soluções" in a for a in r["avisos"])


def test_registro_malformado_vira_aviso(prospect, tmp_path):
    (prospect / "contexto").mkdir(parents=True, exist_ok=True)
    (prospect / "contexto/solucoes.json").write_text("{ruim", encoding="utf-8")
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    assert any("contexto/solucoes.json não pôde ser lido" in a for a in r["avisos"]), r["avisos"]


def _erros(roteiro, prospect):
    modelos = {ap.tipo_do_slide(s) for s in Presentation(ga.CAMINHO_MOLDE).slides}
    return ga.validar_roteiro(roteiro, prospect, modelos)[0]


def test_desafio_com_texto_longo_e_recusado(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(problema="dado muito longo " * 80))
    erros = _erros(roteiro, prospect)
    assert any("Slide 6 (desafio), campo problema: item com 1360 caracteres; o limite é 140. Condense o texto." in e for e in erros), erros
    with pytest.raises(ga.ErroRoteiro):
        ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert not (tmp_path / "deck.pptx").exists()


def test_desafio_pior_caso_do_ensaio_e_recusado(prospect):
    roteiro = roteiro_basico()
    longa = "Recuperar a receita perdida em PIX e boleto com cobrança ativa, régua de lembrete e checkout simplificado " * 2
    roteiro["slides"].insert(-1, slide_desafio(solucoes=[longa] * 3))
    erros = [e for e in _erros(roteiro, prospect) if "campo solucoes" in e]
    assert len(erros) == 3 and all("o limite é 100" in e for e in erros), erros


def test_desafio_no_limite_exato_passa(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(
        titulo="t" * 60, problema="p" * 140, hipoteses=["h" * 90] * 5, solucoes=["s" * 100] * 3, impacto="i" * 100,
    ))
    assert _erros(roteiro, prospect) == []


@pytest.mark.parametrize(
    "extra, campo, limite",
    [
        ({"titulo": "t" * 61}, "titulo", 60),
        ({"hipoteses": ["ok", "h" * 91]}, "hipoteses", 90),
        ({"solucoes": ["s" * 101]}, "solucoes", 100),
        ({"impacto": "i" * 101}, "impacto", 100),
    ],
)
def test_desafio_um_caractere_acima_do_limite(prospect, extra, campo, limite):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(**extra))
    erros = _erros(roteiro, prospect)
    assert any(f"campo {campo}: item com {limite + 1} caracteres; o limite é {limite}." in e for e in erros), erros


def test_desafio_com_pendencia_nao_confere_limites(prospect):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, {"tipo": "desafio", "pendencia": "faltam dados", "problema": "x" * 500})
    assert _erros(roteiro, prospect) == []


def test_problema_id_que_nao_e_texto_vira_erro_e_nao_quebra(prospect, tmp_path):
    _registro(prospect, ["P1"])
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(problema_id=["P1"]))
    erros = _erros(roteiro, prospect)
    assert any("Slide 6 (desafio), campo problema_id: precisa ser um texto (ex.: P1)." in e for e in erros), erros
    with pytest.raises(ga.ErroRoteiro):
        ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")


def test_problema_id_nao_texto_nao_derruba_a_checagem_de_cobertura(prospect):
    _registro(prospect, ["P1"])
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(problema_id=["P1"]))
    avisos = []
    ga._problemas_fora_do_roteiro(roteiro, prospect, avisos)
    assert any("P1" in a for a in avisos), avisos


ROTEIRO_FIXTURE = RAIZ / "clientes/_fixtures/verdeluz/base/entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json"
DIVISORIAS_ESPERADAS = [
    ("01.", "CENÁRIO **ATUAL**"),
    ("02.", "DESAFIOS"),
    ("03.", "**METAS**"),
    ("04.", "**CENÁRIOS** E IMPACTOS **ESPERADOS**"),
    ("05.", "PLANO **DE AÇÃO**"),
]


def _roteiro_referencia():
    sys.path.insert(0, str(RAIZ / "scripts/fixture_verdeluz"))
    import roteiro_09  # noqa: E402

    return roteiro_09.montar()


def test_roteiro_de_referencia_tem_cinco_secoes_sem_benchmarking():
    roteiro = _roteiro_referencia()
    slides = roteiro["slides"]
    assert [s["tipo"] for s in slides[:2]] == ["capa", "jornada"]
    assert slides[2]["tipo"] == "divisoria" and slides[-1]["tipo"] == "obrigado"
    divisorias = [(s["numero"], s["titulo"]) for s in slides if s["tipo"] == "divisoria"]
    assert divisorias == DIVISORIAS_ESPERADAS
    texto = json.dumps(roteiro, ensure_ascii=False).lower()
    assert "benchmarking" not in texto and "07-benchmark" not in texto
    assert all(s["tipo"] != "benchmark" for s in slides)


def test_roteiro_do_fixture_e_o_de_referencia_e_valida():
    roteiro = json.loads(ROTEIRO_FIXTURE.read_text(encoding="utf-8"))
    assert roteiro == _roteiro_referencia()
    erros, _ = ga.validar_roteiro(roteiro, ROTEIRO_FIXTURE.parents[3], tipos_molde())
    assert erros == []


# ---- slide tabela_plano (plano de ação em tabela nativa) ----

def _linha(n, acao="Auditar o pixel", quando="Semana 1"):
    return {"num": str(n), "acao": acao, "horizonte": "Imediato", "quando": quando, "quem": "Agência", "frente": "Monitoramento e Governança"}


def _roteiro_tabela(link="https://docs.google.com/document/d/abc/edit", linhas=None):
    slide = {"tipo": "tabela_plano", "linhas": linhas or [_linha(1), _linha(2, "Revisar o antifraude")]}
    if link:
        slide["link"] = link
    return {"versao": 1, "prospect": "Marca Teste", "slides": [slide]}


def test_tabela_plano_preenche_linhas_e_link(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    r = ga.gerar(_roteiro_tabela(), prospect, saida)
    assert r["slides"] == 1 and not any("link" in a for a in r["avisos"])
    slide = Presentation(saida).slides[0]
    c = ap.campos(slide)
    linhas = [[cel.text for cel in linha.cells] for linha in c["tabela"].table.rows]
    assert linhas[0][1:] == ["Ação", "Horizonte", "Quando", "Quem", "Frente"]
    assert linhas[1] == ["1", "Auditar o pixel", "Imediato", "Semana 1", "Agência", "Monitoramento e Governança"]
    assert linhas[2][1] == "Revisar o antifraude" and len(linhas) == 3
    runs = c["link"].text_frame.paragraphs[0].runs
    assert runs[0].text == "Clique aqui" and runs[0].hyperlink.address == "https://docs.google.com/document/d/abc/edit"
    assert runs[1].hyperlink.address is None


def test_tabela_plano_sem_link_sai_a_frase_e_avisa(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    r = ga.gerar(_roteiro_tabela(link=None), prospect, saida)
    assert any("sem o link" in a for a in r["avisos"])
    assert "link" not in ap.campos(Presentation(saida).slides[0])


@pytest.mark.parametrize(
    "alteracao,trecho",
    [
        (lambda s: s.update(link="ftp://x"), "link"),
        (lambda s: s.update(linhas=[]), "linhas"),
        (lambda s: s.update(linhas=[_linha(n) for n in range(1, 18)]), "linhas"),
        (lambda s: s["linhas"][0].pop("quem"), "quem"),
        (lambda s: s["linhas"][0].update(acao="  "), "acao"),
    ],
)
def test_tabela_plano_erros_de_validacao(prospect, alteracao, trecho):
    roteiro = _roteiro_tabela()
    alteracao(roteiro["slides"][0])
    erros, _ = ga.validar_roteiro(roteiro, prospect, tipos_molde())
    assert erros and any(trecho in e for e in erros), erros
    assert all(e.startswith("Slide 1") for e in erros)


def test_tabela_plano_aviso_quando_o_texto_estoura(prospect, tmp_path):
    longa = "Revisar " + "o rastreamento de todas as campanhas " * 3
    roteiro = _roteiro_tabela(linhas=[_linha(n, longa, "Mês 1 a 3 (JUN a AGO), até o portão de verba") for n in range(1, 13)])
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("Slide 1" in a and "tabela" in a and "não cabe" in a for a in r["avisos"])


def test_aviso_de_acao_do_plano_aprovado_fora_dos_slides(prospect, tmp_path):
    pasta = prospect / "entrega/ativos-aprovados/plano-de-acao"
    pasta.mkdir(parents=True)
    acoes = [
        {"numero": n, "acao": acao, "frente": "Mídia Paga", "dono": "Gestor de tráfego · Boomer", "inicio": f"0{n}/11/2026", "entrega": f"0{n + 1}/11/2026"}
        for n, acao in ((1, "Auditar o pixel"), (2, "Ação que ficou de fora"))
    ]
    plano_json = {"data_referencia": "22/10/2026", "horizontes": [{"nome": "Imediato", "acoes": acoes}]}
    (pasta / "plano-de-acao-estrategico.json").write_text(json.dumps(plano_json, ensure_ascii=False), encoding="utf-8")
    r = ga.gerar(_roteiro_tabela(linhas=[_linha(1)]), prospect, tmp_path / "deck.pptx")
    assert any("1 ações do plano de ação aprovado" in a and "Ação que ficou de fora" in a for a in r["avisos"])
    r = ga.gerar(_roteiro_tabela(linhas=[_linha(1), _linha(2, "Ação que ficou de fora")]), prospect, tmp_path / "deck2.pptx")
    assert not any("plano de ação aprovado" in a for a in r["avisos"])
