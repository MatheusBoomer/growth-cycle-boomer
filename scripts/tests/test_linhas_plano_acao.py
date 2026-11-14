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


def test_le_o_plano_aprovado_em_json_por_onda_e_numero():
    linhas = plano.ler_plano(PLANO_FIXTURE)
    dados = json.loads(PLANO_FIXTURE.read_text(encoding="utf-8"))
    por_numero = {a["numero"]: a for h in dados["horizontes"] for a in h["acoes"]}
    esperado = [n for o in dados["ondas"] for n in sorted(o["acoes"])]
    assert len(linhas) == len(por_numero) == len(esperado) >= 10
    assert set(linhas[0]) == {"num", "acao", "horizonte", "quando", "quem", "frente"}
    assert [l["num"] for l in linhas] == [str(n) for n in esperado]
    assert [l["acao"] for l in linhas] == [por_numero[n]["acao"] for n in esperado]
    primeira = por_numero[esperado[0]]
    assert linhas[0]["quem"] == primeira["dono"].split(" · ")[0] and "·" not in linhas[0]["quem"]
    assert linhas[0]["frente"] == primeira["frente"]
    assert linhas[0]["horizonte"] in {h["nome"] for h in dados["horizontes"]}
    assert all(re.fullmatch(r"\d{2}/\d{2}(/\d{2})? a \d{2}/\d{2}(/\d{2})?", l["quando"]) for l in linhas)


def _plano_json(ondas=None):
    acao = lambda n, ini, fim: {"numero": n, "acao": f"Ação {n}", "frente": "F", "dono": "Gestor · Boomer", "inicio": ini, "entrega": fim}  # noqa: E731
    dados = {
        "data_referencia": "22/10/2026",
        "horizontes": [
            {"nome": "Imediato", "acoes": [acao(1, "26/10/2026", "28/10/2026"), acao(2, "27/12/2026", "28/12/2026")]},
            {"nome": "Curto prazo", "acoes": [acao(3, "02/11/2026", "05/11/2026"), acao(4, "26/10/2026", "29/10/2026")]},
        ],
    }
    if ondas:
        dados["ondas"] = ondas
    return dados


def test_plano_com_ondas_vem_por_onda_e_depois_por_numero(tmp_path):
    ondas = [{"numero": 1, "acoes": [4, 1]}, {"numero": 2, "acoes": [3, 2]}]
    caminho = tmp_path / "plano.json"
    caminho.write_text(json.dumps(_plano_json(ondas)), encoding="utf-8")
    linhas = plano.ler_plano(caminho)
    assert [l["num"] for l in linhas] == ["1", "4", "2", "3"]  # onda 1 (1, 4), onda 2 (2, 3), por número dentro da onda
    assert [l["horizonte"] for l in linhas] == ["Imediato", "Curto prazo", "Imediato", "Curto prazo"]


def test_plano_sem_ondas_segue_a_ordem_cronologica(tmp_path):
    caminho = tmp_path / "plano.json"
    caminho.write_text(json.dumps(_plano_json()), encoding="utf-8")
    assert [l["num"] for l in plano.ler_plano(caminho)] == ["1", "4", "3", "2"]


def test_acao_fora_de_toda_onda_vai_ao_fim_por_numero(tmp_path):
    caminho = tmp_path / "plano.json"
    caminho.write_text(json.dumps(_plano_json([{"numero": 1, "acoes": [3, 1]}])), encoding="utf-8")
    assert [l["num"] for l in plano.ler_plano(caminho)] == ["1", "3", "2", "4"]


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


@pytest.mark.parametrize("conteudo", ["{nao e json", "[]", '{"data_referencia": "22/10/2026", "horizontes": [{"nome": "X", "acoes": [{"numero": 1}]}]}'])
def test_plano_ilegivel_vira_erro_em_portugues_sem_traceback(tmp_path, conteudo, capsys):
    caminho = tmp_path / "plano.json"
    caminho.write_text(conteudo, encoding="utf-8")
    with pytest.raises(plano.ErroPlano, match="Plano de ação aprovado (ilegível|inválido)"):
        plano.ler_plano(caminho)
    base = tmp_path / "prospect" / plano.CAMINHO_PLANO
    base.parent.mkdir(parents=True)
    base.write_text(conteudo, encoding="utf-8")
    assert plano.main(["--prospect", str(tmp_path / "prospect")]) == 1
    assert capsys.readouterr().err.startswith("ERRO:")


def test_plano_que_nao_abre_vira_erro_em_portugues(tmp_path, monkeypatch):
    caminho = tmp_path / "plano.json"
    caminho.write_text("{}", encoding="utf-8")
    original = Path.read_text

    def falha(self, *a, **k):
        if self == caminho:
            raise PermissionError("sem permissão")
        return original(self, *a, **k)

    monkeypatch.setattr(Path, "read_text", falha)
    with pytest.raises(plano.ErroPlano, match="ilegível"):
        plano.ler_plano(caminho)


def _docx_legado(caminho: Path, linhas):
    from docx import Document

    doc = Document()
    doc.add_paragraph("Plano de ação")
    tabela = doc.add_table(rows=1, cols=6)
    for celula, titulo in zip(tabela.rows[0].cells, ["#", "Ação", "Frente", "Horizonte", "Quando", "Por Quem"]):
        celula.text = titulo
    for l in linhas:
        for celula, valor in zip(tabela.add_row().cells, l):
            celula.text = valor
    caminho.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(caminho))


LINHAS_LEGADO = [
    ["1", "Auditar o pixel", "Mídia Paga", "Imediato", "Semana 1", "Agência"],
    ["2", "Revisar o antifraude", "Eficiência Operacional", "Curto prazo", "Mês 2", "Cliente"],
]


def test_sem_json_usa_a_tabela_do_docx_antigo_com_nota(tmp_path, capsys):
    _docx_legado(tmp_path / plano.CAMINHO_DOCX, LINHAS_LEGADO)
    linhas, nota = plano.ler_linhas(tmp_path)
    assert nota == plano.NOTA_DOCX_LEGADO and "formato antigo" in nota
    assert linhas == [
        {"num": "1", "acao": "Auditar o pixel", "horizonte": "Imediato", "quando": "Semana 1", "quem": "Agência", "frente": "Mídia Paga"},
        {"num": "2", "acao": "Revisar o antifraude", "horizonte": "Curto prazo", "quando": "Mês 2", "quem": "Cliente", "frente": "Eficiência Operacional"},
    ]
    assert plano.main(["--prospect", str(tmp_path)]) == 0
    captura = capsys.readouterr()
    assert "formato antigo" in captura.err
    assert [l["acao"] for l in json.loads(captura.out)[0]["linhas"]] == ["Auditar o pixel", "Revisar o antifraude"]


def test_com_json_e_docx_o_json_vence(tmp_path):
    _docx_legado(tmp_path / plano.CAMINHO_DOCX, LINHAS_LEGADO)
    destino = tmp_path / plano.CAMINHO_PLANO
    destino.write_text(PLANO_FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
    linhas, nota = plano.ler_linhas(tmp_path)
    assert nota is None and len(linhas) == 25 and linhas[0]["acao"] != "Auditar o pixel"


def test_sem_json_nem_docx_falha_em_portugues(tmp_path, capsys):
    with pytest.raises(plano.ErroPlano, match="Plano de ação aprovado não encontrado"):
        plano.ler_linhas(tmp_path)
    assert plano.main(["--prospect", str(tmp_path)]) == 1
    assert "Plano de ação aprovado não encontrado" in capsys.readouterr().err


def test_docx_antigo_sem_a_tabela_resumo_falha_em_portugues(tmp_path):
    from docx import Document

    caminho = tmp_path / plano.CAMINHO_DOCX
    caminho.parent.mkdir(parents=True)
    doc = Document()
    doc.add_paragraph("sem tabela")
    doc.save(str(caminho))
    with pytest.raises(plano.ErroPlano, match="tabela-resumo"):
        plano.ler_linhas(tmp_path)


def test_linha_de_comando_com_plano_ausente_falha_em_portugues(tmp_path, capsys):
    assert plano.main(["--prospect", str(tmp_path)]) == 1
    assert "Plano de ação aprovado não encontrado" in capsys.readouterr().err


def test_divide_em_slides_sem_perder_nem_reordenar_acao():
    linhas = [_linha(n) for n in range(1, 41)]
    slides = plano.slides_do_roteiro(linhas, "https://x.com/doc")
    assert all(s["tipo"] == "tabela_plano" and s["link"] == "https://x.com/doc" for s in slides)
    assert [l for s in slides for l in s["linhas"]] == linhas
    assert all(len(s["linhas"]) <= plano.MAX_LINHAS_POR_SLIDE for s in slides)
    assert sorted(len(s["linhas"]) for s in slides) == [13, 13, 14]  # o menor número de slides (3), repartido por igual


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


def test_quebra_por_palavra_conta_mais_linhas_que_a_divisao_simples():
    # linhas de 10 caracteres: "aaaaaaa bbbbbbb cc" cabe em 2 linhas por palavra (a divisão simples diria 2) e
    # "aaaaaa bbbbbb cccccc" gasta 3 por palavra (a divisão simples diria 2)
    assert plano._linhas_da_celula("aaaaaaa bbbbbbb cc", 10) == 2
    assert plano._linhas_da_celula("aaaaaa bbbbbb cccccc", 10) == 3
    assert plano._linhas_da_celula("", 10) == 1
    assert plano._linhas_da_celula("x" * 25, 10) == 3  # palavra maior que a linha é partida
    assert plano._linhas_da_celula("ab " + "x" * 12, 10) == 3  # "ab" sozinha na primeira, a palavra longa em duas


def test_ultima_pagina_nao_fica_com_uma_linha_so():
    # 25 linhas de 2 linhas de texto cada: o enchimento guloso daria 11 + 11 + 3; o repartido, páginas parelhas
    linhas = [_linha(n, "Fixar o teto de CAC de R$ 80 e a regra de escala da verba") for n in range(1, 26)]
    assert [len(p) for p in plano._paginas_gulosas(linhas)] == [11, 11, 3]
    slides = plano.slides_do_roteiro(linhas)
    tamanhos = [len(s["linhas"]) for s in slides]
    assert sum(tamanhos) == 25 and max(tamanhos) - min(tamanhos) <= 1
    assert [l for s in slides for l in s["linhas"]] == linhas
    assert all(plano.altura_estimada(s["linhas"]) <= plano.ALTURA_UTIL for s in slides)


def test_fixture_verdeluz_divide_em_paginas_parelhas_que_cabem():
    slides = plano.slides_do_roteiro(plano.ler_plano(PLANO_FIXTURE))
    tamanhos = [len(s["linhas"]) for s in slides]
    assert len(slides) == 3 and sum(tamanhos) == 25 and max(tamanhos) - min(tamanhos) <= 1
    assert all(plano.altura_estimada(s["linhas"]) <= plano.ALTURA_UTIL for s in slides)


def test_linha_sozinha_maior_que_a_pagina_ainda_vira_um_slide():
    enorme = _linha(1, "palavra " * 200)
    slides = plano.slides_do_roteiro([enorme, _linha(2)])
    assert [len(s["linhas"]) for s in slides] == [1, 1]
