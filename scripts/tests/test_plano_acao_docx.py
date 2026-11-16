from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path
from xml.dom.minidom import parseString

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import plano_v2_exemplo as ex  # noqa: E402
from plano_acao_docx import MODELO_DOCX_PADRAO, gerar_docx  # noqa: E402

ROTULOS = (
    "ACHADO DE ORIGEM", "ALAVANCA DA META", "COMO", "DONO", "INÍCIO E ENTREGA",
    "DEPENDE DE", "EVIDÊNCIA", "KPI E META", "GATILHO",
)


def _gerar(plano, tmp_path):
    saida = tmp_path / "plano.docx"
    resumo = gerar_docx(plano, MODELO_DOCX_PADRAO, saida)
    return saida, resumo


def _xml(saida) -> str:
    with zipfile.ZipFile(saida) as z:
        return z.read("word/document.xml").decode("utf-8")


def _paragrafos(saida) -> list[str]:
    """Texto de cada <w:p>, juntando os <w:t> (com o xml já desescapado pelo parser)."""
    dom = parseString(_xml(saida))
    out = []
    for p in dom.getElementsByTagName("w:p"):
        out.append("".join(t.firstChild.data if t.firstChild else ""
                           for t in p.getElementsByTagName("w:t")))
    return out


def _texto(saida) -> str:
    return "\n".join(_paragrafos(saida))


def test_resumo(tmp_path):
    saida, resumo = _gerar(ex.plano_valido(), tmp_path)
    assert resumo == {"output": str(saida), "total_acoes": 6}


def test_docx_tem_os_10_rotulos_por_acao(tmp_path):
    plano = ex.plano_valido()
    saida, _ = _gerar(plano, tmp_path)
    texto = _texto(saida)
    for _, a in c.acoes(plano):
        assert f"AÇÃO {a['numero']}: {a['acao']}" in texto
        assert f"FRENTE: {a['frente']}" in texto
        assert f"INÍCIO E ENTREGA: {a['inicio']} a {a['entrega']}" in texto
        assert f"DEPENDE DE: {c.texto_depende(a)}" in texto
    for rotulo in ROTULOS:
        assert texto.count(f"{rotulo}:") >= 6  # uma por ação (COMO também pode aparecer em outros textos)


def test_docx_ordem_dos_campos_dentro_da_acao(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    ps = _paragrafos(saida)
    i = next(k for k, p in enumerate(ps) if p.startswith("AÇÃO 1:"))
    ordem = [p.split(":")[0] for p in ps[i:i + 11]]
    assert ordem[:1] == ["AÇÃO 1"]
    assert [o for o in ordem if o in ROTULOS or o.startswith("FRENTE")] == [
        "FRENTE", "ACHADO DE ORIGEM", "ALAVANCA DA META", "COMO", "DONO", "INÍCIO E ENTREGA",
        "DEPENDE DE", "EVIDÊNCIA", "KPI E META", "GATILHO"]


def test_docx_abertura(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    texto = _texto(saida)
    assert "Metas do plano" in texto
    assert "Taxa de quebra: de 36,1% para 25% até 25/01/2027 (fonte: 06 · Realista, JAN/27)" in texto
    assert "Cenário de referência: Realista" in texto
    assert "O que cabe nos 3 meses" in texto
    assert "Recuperação de PIX e boleto" in texto
    assert "O que não cabe" not in texto  # lista vazia
    assert "Premissas" in texto
    assert "Verba de mídia mantida no patamar atual" in texto
    assert texto.index("Metas do plano") < texto.index("Primeiros dias") < texto.index("AÇÃO 1:")


def test_docx_nao_cabe_aparece_quando_ha(tmp_path):
    plano = ex.plano_valido()
    plano["abertura"]["nao_cabe"] = ["Expansão para marketplace"]
    saida, _ = _gerar(plano, tmp_path)
    texto = _texto(saida)
    assert "O que não cabe" in texto
    assert "Expansão para marketplace" in texto


def test_docx_horizontes_na_ordem_e_com_intro(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    texto = _texto(saida)
    assert (texto.index("Primeiros dias") < texto.index("Primeiros três meses")
            < texto.index("Até o fim do ciclo"))
    assert "Ações que sustentam a meta dentro da janela de prova." in texto


def test_docx_agrupa_por_frente_na_ordem_de_frentes(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    ps = _paragrafos(saida)
    # Imediato: ação 2 (Eficiência Operacional) vem antes da ação 1 (Monitoramento e Governança)
    assert ps.index("AÇÃO 2: Ativar recuperação automática de PIX e boleto") < ps.index(
        "AÇÃO 1: Desativar o limiar de dados no GA4")
    # Curto prazo: Mídia (3), Produto (4), Redução de Dependências (5)
    idx = [ps.index(p) for p in ps if p.startswith(("AÇÃO 3:", "AÇÃO 4:", "AÇÃO 5:"))]
    assert idx == sorted(idx)
    assert [p for p in ps if p.startswith("AÇÃO ")][2:5] == [p for p in ps if p.startswith(("AÇÃO 3:", "AÇÃO 4:", "AÇÃO 5:"))]


def test_docx_tabela_resumo(tmp_path):
    plano = ex.plano_valido()
    saida, _ = _gerar(plano, tmp_path)
    texto = _texto(saida)
    assert "Tabela-Resumo Cronológica" in texto
    for cab in ["Nº", "Ação", "Frente", "Horizonte", "Início e entrega", "Dono"]:
        assert cab in _paragrafos(saida)
    assert "26/10/2026 a 28/10/2026" in _paragrafos(saida)
    xml = _xml(saida)
    widths = [int(w) for w in re.findall(r'<w:gridCol w:w="(\d+)"/>', xml)]
    assert len(widths) == 6 and sum(widths) == 9029


def test_docx_piso_roas(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    texto = _texto(saida)
    assert "Piso de ROAS sobre a receita aprovada: 5,00 (1 ÷ margem de 20%)." in texto
    assert "Sobre a receita captada: 6,25 (com quebra de 20%)." in texto


def test_docx_sem_margem(tmp_path):
    plano = ex.plano_valido()
    plano["abertura"]["margem_contribuicao"] = None
    saida, _ = _gerar(plano, tmp_path)
    texto = _texto(saida)
    assert "[PREENCHER: margem de contribuição]" in texto
    assert not re.search(r"\b(inf|nan)\b", texto.lower())


def test_docx_escapa_xml(tmp_path):
    plano = ex.plano_valido()
    como = 'Verba R$ 20 & público <25 anos> "quentes"'
    plano["horizontes"][0]["acoes"][0]["como"] = como
    saida, _ = _gerar(plano, tmp_path)
    with zipfile.ZipFile(saida) as z:
        assert z.testzip() is None
    assert f"COMO: {como}" in _paragrafos(saida)


def test_docx_preserva_modelo(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    with zipfile.ZipFile(MODELO_DOCX_PADRAO) as m, zipfile.ZipFile(saida) as s:
        assert s.namelist() == m.namelist()
        for nome in ("word/header1.xml", "word/styles.xml"):
            assert s.read(nome) == m.read(nome)


def test_docx_numeros_com_virgula_e_sem_garantia(tmp_path):
    saida, _ = _gerar(ex.plano_valido(), tmp_path)
    assert "garant" not in _texto(saida).lower()


def test_docx_quebra_de_linha_vira_w_br(tmp_path):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = "passo 1\npasso 2"
    saida, _ = _gerar(plano, tmp_path)
    xml = _xml(saida)
    assert "<w:br/>" in xml
    assert "passo 1\npasso 2" not in xml
    parseString(xml)  # continua XML válido
    assert "COMO: passo 1passo 2" in _paragrafos(saida)


def test_docx_remove_caracteres_de_controle_ilegais(tmp_path):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = "passo\x0b um\x00\x1f\ttab"
    saida, _ = _gerar(plano, tmp_path)
    xml = _xml(saida)
    parseString(xml)
    assert "\x0b" not in xml and "\x00" not in xml and "\x1f" not in xml
    assert "passo um\ttab" in xml


# ---------------------------------------------------------------------------
# Layout com fases (modelo Happy Duck)
# ---------------------------------------------------------------------------

TITULOS_FASES = [
    "Como este plano funciona",
    "Visão geral",
    "Metas dos 2 primeiros meses",
    "Sessões não pagas",
    "Metas do plano",
    "Como mudamos minimizando riscos",
    "Fase 1",
    "Fase 2",
    "Fase 3",
    "KPIs de acompanhamento e limites",
    "Decisões que dependem de Marca Teste",
]


def _plano_completo() -> dict:
    plano = ex.plano_com_fases()
    plano["como_funciona"] = [
        {"titulo": "Horizontes", "texto": "O plano tem 3 fases."},
        {"titulo": "Dono.", "texto": "Todas as ações têm um responsável."},
    ]
    plano["metas_mensais"] = {
        "cenario": "Realista",
        "colunas": ["Mês", "Receita", "Investimento"],
        "linhas": [["Nov/26", "1.900", "500"], ["Dez/26", "3.500", "900"], ["2 meses", "5.400", "1.400"]],
        "observacao": "Valores de receita aprovada.",
    }
    plano["sessoes_nao_pagas"] = {
        "colunas": ["Mês", "Sessões"],
        "linhas": [["Nov/26", "6.982"]],
        "premissas": "Base própria de 100 contatos.",
        "risco": "Cerca de 95% das sessões são pagas.",
    }
    plano["protocolo_mudanca"] = {
        "intro": "Mexer em rastreamento e mídia ao mesmo tempo atrapalha.",
        "regras": ["Uma mudança por vez.", "Nada na sexta à tarde."],
    }
    plano["kpis_acompanhamento"] = [
        {"kpi": "ROAS global", "meta_limite": "2,05x em dezembro"},
        {"kpi": "Taxa de quebra", "meta_limite": "25% até janeiro"},
    ]
    return plano


def _indice_titulos(saida, titulos) -> list[int]:
    ps = _paragrafos(saida)
    idx = []
    for t in titulos:
        achados = [k for k, p in enumerate(ps) if p == t or p.startswith(f"{t} ·") or p.startswith(f"{t}:")]
        assert achados, f"título ausente: {t}"
        idx.append(achados[0])
    return idx


def test_docx_fases_ordem_dos_titulos(tmp_path):
    saida, _ = _gerar(_plano_completo(), tmp_path)
    idx = _indice_titulos(saida, TITULOS_FASES)
    assert idx == sorted(idx) and len(set(idx)) == len(idx)
    assert _paragrafos(saida)[0].startswith("Plano de Ação Estratégico — Marca Teste")


def test_docx_fases_nao_tem_tabela_resumo_e_sem_fases_tem(tmp_path):
    com, _ = _gerar(_plano_completo(), tmp_path)
    assert "Tabela-Resumo Cronológica" not in _texto(com)
    sem, _ = _gerar(ex.plano_valido(), tmp_path)
    assert "Tabela-Resumo Cronológica" in _texto(sem)


def test_docx_fases_acao_fica_dentro_da_fase(tmp_path):
    saida, _ = _gerar(ex.plano_com_fases(), tmp_path)
    ps = _paragrafos(saida)
    fase1 = next(k for k, p in enumerate(ps) if p.startswith("Fase 1 ·"))
    fase2 = next(k for k, p in enumerate(ps) if p.startswith("Fase 2 ·"))
    acao1 = next(k for k, p in enumerate(ps) if p.startswith("AÇÃO 1 ·"))
    acao3 = next(k for k, p in enumerate(ps) if p.startswith("AÇÃO 3 ·"))
    assert fase1 < acao1 < fase2 < acao3
    assert "AÇÃO 1 · Liberar os acessos" in ps[acao1]
    assert ps[fase1 + 1].startswith("Objetivo:") and "Destravar acessos" in ps[fase1 + 1]
    assert ps[fase1 + 2] == "Calendário de mídia: Contenção"


def test_docx_fases_cabecalho_da_acao_com_depende_de_nomeado(tmp_path):
    plano = ex.plano_com_fases()
    saida, _ = _gerar(plano, tmp_path)
    ps = _paragrafos(saida)
    cab = next(p for p in ps if p.startswith("Início e entrega: 02/11/2026 a 30/11/2026"))
    assert "Dono: Gestor de tráfego · Boomer" in cab
    assert "Frente: Mídia Paga / Canal Principal" in cab
    assert "Horizonte: Curto prazo" in cab
    assert f"Depende de: {c.texto_depende(plano['horizontes'][1]['acoes'][0], plano)}" in cab
    assert "Depende de: Ação 1 (Liberar os acessos)" in cab


def test_docx_fases_tabela_da_acao_com_6_rotulos_e_textos(tmp_path):
    plano = ex.plano_com_fases()
    saida, _ = _gerar(plano, tmp_path)
    ps = _paragrafos(saida)
    acao = plano["horizontes"][0]["acoes"][0]
    i = next(k for k, p in enumerate(ps) if p.startswith("AÇÃO 1 ·"))
    esperado = [
        ("ACHADO", acao["achado_origem"]), ("ALAVANCA", acao["alavanca"]), ("COMO", acao["como"]),
        ("EVIDÊNCIA", acao["evidencia"]), ("KPI E META", acao["kpi_meta"]), ("GATILHO", acao["gatilho"]),
    ]
    achados = ps[i + 2:i + 2 + 12]
    assert achados == [x for par in esperado for x in par]
    xml = _xml(saida)
    assert xml.count("<w:tbl>") >= 7  # visão geral + decisões + 1 tabela por ação (6)


def test_docx_fases_checkpoint(tmp_path):
    saida, _ = _gerar(ex.plano_com_fases(), tmp_path)
    ps = _paragrafos(saida)
    i = next(k for k, p in enumerate(ps) if p == "Checkpoint 1: 30/10/2026 (30 minutos)")
    assert ps[i + 1].startswith("• Pauta.") and "eventos de funil no GA4" in ps[i + 1]
    assert ps[i + 2].startswith("• Para liberar a Fase 2.") and "Acessos entregues" in ps[i + 2]
    assert ps[i + 3].startswith("• Quem decide.") and "Gestor de projetos" in ps[i + 3]
    assert sum(p.startswith("Checkpoint ") for p in ps) == 2  # a fase 3 não tem


def test_docx_fases_decisoes_do_cliente(tmp_path):
    saida, _ = _gerar(ex.plano_com_fases(), tmp_path)
    ps = _paragrafos(saida)
    i = ps.index("Decisões que dependem de Marca Teste")
    assert ps[i + 1:i + 4] == ["Ação", "Até", "Recomendação"]
    linhas = ps[i + 4:i + 10]
    assert linhas == [
        "Ação 3: Reestruturar as campanhas de aquisição por Curva ABC", "30/10/2026",
        "Aprovar a redistribuição da verba por classe da Curva ABC.",
        "Ação 5: Diversificar os canais de aquisição além da mídia paga", "27/11/2026",
        "Autorizar o e-mail e o CRM como canais de recompra.",
    ]


def test_docx_fases_sem_decisoes_omite_a_secao(tmp_path):
    plano = ex.plano_com_fases()
    for _, a in c.acoes(plano):
        a.pop("decisao_cliente", None)
    saida, _ = _gerar(plano, tmp_path)
    assert "Decisões que dependem" not in _texto(saida)


def test_docx_fases_blocos_opcionais_ausentes_sao_omitidos(tmp_path):
    saida, _ = _gerar(ex.plano_com_fases(), tmp_path)
    texto = _texto(saida)
    for titulo in ("Como este plano funciona", "primeiros meses", "Sessões não pagas",
                   "Como mudamos minimizando riscos", "KPIs de acompanhamento e limites"):
        assert titulo not in texto
    assert "Visão geral" in texto


def test_docx_fases_visao_geral(tmp_path):
    plano = ex.plano_com_fases()
    saida, _ = _gerar(plano, tmp_path)
    ps = _paragrafos(saida)
    i = ps.index("Visão geral")
    assert ps[i + 1:i + 6] == ["Fase", "Janela", "Calendário de mídia", "Foco", "Ações"]
    primeira = c.visao_geral(plano)[0]
    assert ps[i + 6:i + 11] == [
        "Fase 1Contenção", "26/10/2026 a 01/11/2026", "Contenção", primeira["foco"], "2",
    ]


def test_docx_fases_blocos_opcionais_renderizados(tmp_path):
    saida, _ = _gerar(_plano_completo(), tmp_path)
    ps = _paragrafos(saida)
    assert "Horizontes. O plano tem 3 fases." in ps
    assert "Dono. Todas as ações têm um responsável." in ps  # ponto final não duplica
    i = ps.index("Metas dos 2 primeiros meses")  # 2 linhas de mês, fora a de total
    assert ps[i + 1] == "Cenário: Realista"
    assert ps[i + 2:i + 5] == ["Mês", "Receita", "Investimento"]
    assert "2 meses" in ps and "Valores de receita aprovada." in ps
    assert "Premissas de volume. Base própria de 100 contatos." in ps
    assert "Risco. Cerca de 95% das sessões são pagas." in ps
    assert "Mexer em rastreamento e mídia ao mesmo tempo atrapalha." in ps
    assert "1. Uma mudança por vez." in ps and "2. Nada na sexta à tarde." in ps
    j = ps.index("KPIs de acompanhamento e limites")
    assert ps[j + 1:j + 7] == ["KPI", "Meta e limite", "ROAS global", "2,05x em dezembro",
                               "Taxa de quebra", "25% até janeiro"]


def test_docx_fases_premissas_e_risco_como_lista(tmp_path):
    plano = _plano_completo()
    plano["sessoes_nao_pagas"]["premissas"] = ["Base de 100 contatos.", "Crescimento de 1,5% ao mês."]
    plano["sessoes_nao_pagas"]["risco"] = ["Dependência de uma campanha.", "Sem teste de Google."]
    saida, _ = _gerar(plano, tmp_path)
    ps = _paragrafos(saida)
    i = ps.index("Premissas de volume.")
    assert ps[i + 1:i + 3] == ["• Base de 100 contatos.", "• Crescimento de 1,5% ao mês."]
    j = ps.index("Risco.")
    assert ps[j + 1:j + 3] == ["• Dependência de uma campanha.", "• Sem teste de Google."]


def test_docx_fases_escapa_xml_e_remove_controles(tmp_path):
    plano = ex.plano_com_fases()
    como = 'Verba R$ 20 & público <25 anos> "quentes"\x0b'
    plano["horizontes"][0]["acoes"][0]["como"] = como
    plano["horizontes"][0]["acoes"][0]["acao"] = 'Liberar & "ler" <acessos>'
    plano["fases"][0]["checkpoint"]["pauta"] = "Pauta <1> & \"2\""
    saida, _ = _gerar(plano, tmp_path)
    with zipfile.ZipFile(saida) as z:
        assert z.testzip() is None
    xml = _xml(saida)
    parseString(xml)
    assert "\x0b" not in xml
    ps = _paragrafos(saida)
    assert 'Verba R$ 20 & público <25 anos> "quentes"' in ps
    assert 'AÇÃO 1 · Liberar & "ler" <acessos>' in ps
    assert 'Pauta <1> & "2"' in "".join(ps)


def test_docx_fases_total_de_acoes_e_modelo_preservado(tmp_path):
    saida, resumo = _gerar(ex.plano_com_fases(), tmp_path)
    assert resumo["total_acoes"] == 6
    with zipfile.ZipFile(MODELO_DOCX_PADRAO) as m, zipfile.ZipFile(saida) as s:
        assert s.namelist() == m.namelist()
        assert s.read("word/header1.xml") == m.read("word/header1.xml")


def _paragrafo_xml_com(xml: str, trecho: str) -> str:
    """O <w:p> (sem tabela) que contém o trecho de texto."""
    for p in re.findall(r"<w:p [^>]*>.*?</w:p>", xml, flags=re.S):
        if trecho in p:
            return p
    raise AssertionError(f"parágrafo com {trecho!r} não encontrado")


def test_docx_fases_keep_with_next_nos_titulos_e_metadados(tmp_path):
    plano = _plano_completo()
    saida, _ = _gerar(plano, tmp_path)
    xml = _xml(saida)
    parseString(xml)
    alvos = [
        "AÇÃO 1", "Início e entrega:", "Fase 1 · Contenção", "Objetivo:", "Calendário de mídia:", "Checkpoint 1:",
    ]
    for alvo in alvos:
        p = _paragrafo_xml_com(xml, alvo)
        assert p.split("<w:pPr>", 1)[1].startswith("<w:keepNext/><w:spacing"), alvo  # primeiro filho do pPr
    # parágrafos comuns não ganham keepNext
    assert "<w:keepNext/>" not in _paragrafo_xml_com(xml, "Pauta.")


def test_docx_fases_metas_mensais_com_10_colunas_tem_larguras_fixas(tmp_path):
    plano = _plano_completo()
    cabecalhos = ["Mês", "Check em", "Receita (R$)", "Invest. (R$)", "Ticket (R$)", "Conv.", "CPS (R$)", "% pagas", "Sessões", "Vendas"]
    plano["metas_mensais"] = {
        "cenario": "Realista", "colunas": cabecalhos,
        "linhas": [["Nov/26", "11/12/2026"] + ["1"] * 8, ["3 meses", ""] + ["1"] * 8], "observacao": None,
    }
    saida, _ = _gerar(plano, tmp_path)
    xml = _xml(saida)
    parseString(xml)
    esperado = [1000, 1100, 950, 900, 850, 750, 700, 850, 1000, 929]
    assert sum(esperado) == 9029
    grade = f'<w:tblGrid>{"".join(f"<w:gridCol w:w={chr(34)}{w}{chr(34)}/>" for w in esperado)}</w:tblGrid>'
    assert grade in xml
    assert "Metas do primeiro mês" in _paragrafos(saida)
    assert "Metas dos 1 primeiros meses" not in _paragrafos(saida)
