from __future__ import annotations

import shutil
import sys
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import previa_planilha as pp  # noqa: E402

TEM_SOFFICE = shutil.which("soffice") or Path("/Applications/LibreOffice.app/Contents/MacOS/soffice").exists()

# Forma da saída do LibreOffice ("HTML (StarCalc)"): índice, uma âncora por aba e uma tabela por aba.
EXPORTADO = """<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style type="text/css">body,td { font-family:"Calibri"; font-size:x-small }</style></head><body>
<hr><p><center><h1>Overview</h1><A HREF="#table0">Meta</A><br><A HREF="#table1">Comparação</A><br></center></p><hr>
<A NAME="table0"><h1>Sheet 1: <em>Meta</em></h1></A>
<table cellspacing="0" border="0"><tr><td>R$ 12.000,00</td><td>13.333</td></tr></table>
<br clear=left>
<hr>
<A NAME="table1"><h1>Sheet 2: <em>Comparação &amp; saldo</em></h1></A>
<table cellspacing="0" border="0"><tr><td>2,00%</td></tr></table>
<br clear=left>
</body></html>"""


def test_abas_extrai_nome_e_tabela_de_cada_aba():
    abas = pp.abas(EXPORTADO)
    assert [nome for nome, _ in abas] == ["Meta", "Comparação & saldo"]
    assert "R$ 12.000,00" in abas[0][1] and abas[0][1].startswith("<table")
    assert "2,00%" in abas[1][1] and "12.000" not in abas[1][1]


def test_pagina_tem_uma_aba_por_botao_e_so_a_primeira_visivel():
    html = pp.pagina(pp.abas(EXPORTADO), "Projeção")
    assert html.count('<button role="tab"') == 2
    assert html.count('<div role="tabpanel"') == 2
    assert html.count(" hidden>") == 1
    assert "Comparação &amp; saldo" in html
    assert "<title>Projeção</title>" in html


def test_pagina_escapa_o_titulo():
    assert "<title>&lt;b&gt;x</title>" in pp.pagina(pp.abas(EXPORTADO), "<b>x")


def test_abas_sem_nenhuma_tabela_e_erro_claro():
    with pytest.raises(pp.ErroPrevia, match="vazia"):
        pp.abas("<html><body></body></html>")


def test_converter_arquivo_inexistente(tmp_path):
    with pytest.raises(pp.ErroPrevia, match="não encontrado"):
        pp.converter(tmp_path / "nada.xlsx", tmp_path / "saida")


@pytest.mark.skipif(not TEM_SOFFICE, reason="LibreOffice não instalado")
def test_converter_de_verdade_calcula_formulas_que_o_openpyxl_deixou_sem_valor(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cenário"
    ws["A1"], ws["B1"], ws["C1"] = 12000, 250, "=A1/B1"
    ws["A1"].number_format = '"R$" #,##0.00'
    outra = wb.create_sheet("Total")
    outra["A1"] = "=SUM(Cenário!A1:B1)"
    xlsx = tmp_path / "p.xlsx"
    wb.save(xlsx)
    saida = tmp_path / "previa"
    pp.converter(xlsx, saida)
    html = (saida / "planilha.html").read_text(encoding="utf-8")
    assert html.count('<button role="tab"') == 2
    assert ">48<" in html  # 12000 / 250 calculado pelo LibreOffice
    assert ">12250<" in html or ">12.250<" in html  # soma da segunda aba
