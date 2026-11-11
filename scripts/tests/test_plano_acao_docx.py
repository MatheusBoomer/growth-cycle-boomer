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
    assert "Taxa de quebra: de 36,1% para 25% até 25/01/2027" in texto
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
