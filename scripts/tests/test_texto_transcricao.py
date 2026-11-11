from __future__ import annotations

import sys
from pathlib import Path

import pytest
from docx import Document

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import texto_transcricao as t  # noqa: E402


def _docx(caminho, paragrafos=(), celulas=()):
    doc = Document()
    for p in paragrafos:
        doc.add_paragraph(p)
    if celulas:
        tabela = doc.add_table(rows=1, cols=len(celulas))
        for i, texto in enumerate(celulas):
            tabela.rows[0].cells[i].text = texto
    doc.save(str(caminho))
    return caminho


def test_extrai_docx_paragrafos_e_tabela(tmp_path):
    arq = _docx(tmp_path / "t.docx", ["Primeira fala do cliente."], ["Célula A", "Célula B"])
    texto = t.extrair_texto(arq)
    linhas = texto.splitlines()
    assert "Primeira fala do cliente." in linhas
    assert "Célula A" in linhas and "Célula B" in linhas
    assert linhas.index("Primeira fala do cliente.") < linhas.index("Célula A")


def test_trecho_so_em_celula_de_tabela_e_encontrado(tmp_path):
    arq = _docx(tmp_path / "t.docx", ["Abertura."], ["Cliente", "Só aprovamos o CRM depois de janeiro."])
    texto = t.normalizar(t.extrair_texto(arq))
    assert t.contem_trecho(texto, "“só aprovamos o CRM depois de janeiro”")


def test_extrai_txt_utf8(tmp_path):
    arq = tmp_path / "t.txt"
    arq.write_text("Não vamos pausar a campanha.", encoding="utf-8")
    assert t.extrair_texto(arq) == "Não vamos pausar a campanha."


def test_extrai_txt_latin1_com_fallback(tmp_path):
    arq = tmp_path / "t.txt"
    arq.write_bytes("Não vamos pausar.".encode("latin-1"))
    assert t.extrair_texto(arq) == "Não vamos pausar."


def test_extrai_md(tmp_path):
    arq = tmp_path / "t.md"
    arq.write_text("# Reunião\n\nFala **importante**.", encoding="utf-8")
    assert "Fala **importante**." in t.extrair_texto(arq)


def test_extensao_nao_suportada_cita_extensao(tmp_path):
    arq = tmp_path / "t.pdf"
    arq.write_bytes(b"%PDF-1.4")
    with pytest.raises(t.ErroTranscricao, match=r"\.pdf"):
        t.extrair_texto(arq)


def test_arquivo_ausente_cita_caminho(tmp_path):
    arq = tmp_path / "nao-existe.txt"
    with pytest.raises(t.ErroTranscricao, match="nao-existe.txt"):
        t.extrair_texto(arq)


def test_docx_invalido_vira_erro_de_transcricao(tmp_path):
    arq = tmp_path / "quebrado.docx"
    arq.write_bytes(b"isto nao e um docx")
    with pytest.raises(t.ErroTranscricao, match="quebrado.docx"):
        t.extrair_texto(arq)


def test_normalizar_equivalencias():
    assert t.normalizar("“Olá”  —  mundo…") == 'olá" - mundo'
    assert t.normalizar("A–B—C") == "a-b-c"
    assert t.normalizar("‘x’ „y“ «z»") == "x' \"y\" \"z"
    assert t.normalizar("espera…  e\n\n volta") == "espera... e volta"
    assert t.normalizar('  ...Texto,  "ok".  ') == 'texto, "ok'


def test_contem_trecho_tolera_aspas_caixa_e_quebra_de_linha():
    transcricao = t.normalizar('Fala dele: "CRM só depois\nde Janeiro."')
    assert t.contem_trecho(transcricao, "“CRM só depois de janeiro”")


def test_contem_trecho_recusa_trecho_inventado():
    transcricao = t.normalizar("Vamos começar o CRM em março.")
    assert not t.contem_trecho(transcricao, "CRM só depois de janeiro")


def test_contem_trecho_vazio_ou_so_pontuacao_e_falso():
    transcricao = t.normalizar("Qualquer coisa.")
    assert not t.contem_trecho(transcricao, "")
    assert not t.contem_trecho(transcricao, "  ...  ")
