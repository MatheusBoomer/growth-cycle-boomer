from __future__ import annotations

import sys
import warnings
from datetime import date, datetime
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import plano_v2_exemplo as ex  # noqa: E402
from plano_acao_xlsx import COLUNAS_PLANO, STATUS, gerar_xlsx  # noqa: E402


def _gerar(plano, tmp_path, modelo=None):
    saida = tmp_path / "sub" / "plano.xlsx"
    resumo = gerar_xlsx(plano, saida, modelo)
    return saida, resumo, openpyxl.load_workbook(saida)


def _texto_metas(ws) -> str:
    return "\n".join(str(cel.value) for linha in ws.iter_rows() for cel in linha if cel.value is not None)


def test_abas_e_resumo(tmp_path):
    saida, resumo, wb = _gerar(ex.plano_valido(), tmp_path)
    assert wb.sheetnames == ["Plano de Ação", "Metas do plano"]
    assert resumo == {"output": str(saida), "total_acoes": 6}


def test_cabecalho_e_estilo(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    ws = wb["Plano de Ação"]
    assert [cel.value for cel in ws[1]] == COLUNAS_PLANO
    assert len(COLUNAS_PLANO) == 15
    assert ws["A1"].fill.fgColor.rgb.endswith("1C2F5F")
    assert ws["A1"].font.bold and ws["A1"].font.color.rgb.endswith("FFFFFF")
    assert ws.freeze_panes == "A2"
    assert ws.auto_filter.ref == "A1:O7"


def test_linhas_em_ordem_cronologica_com_horizonte(tmp_path):
    plano = ex.plano_valido()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb["Plano de Ação"]
    esperado = c.acoes_cronologicas_com_horizonte(plano)
    assert ws.max_row == 1 + len(esperado)
    for linha, (horizonte, a) in enumerate(esperado, start=2):
        assert ws.cell(linha, 1).value == a["numero"]
        assert ws.cell(linha, 2).value == a["frente"]
        assert ws.cell(linha, 3).value == horizonte
        assert ws.cell(linha, 4).value == a["acao"]
        assert ws.cell(linha, 5).value == a["achado_origem"]
        assert ws.cell(linha, 6).value == a["alavanca"]
        assert ws.cell(linha, 7).value == a["como"]
        assert ws.cell(linha, 8).value == a["dono"]
        assert ws.cell(linha, 11).value == c.texto_depende(a)
        assert ws.cell(linha, 12).value == a["evidencia"]
        assert ws.cell(linha, 13).value == a["kpi_meta"]
        assert ws.cell(linha, 14).value == a["gatilho"]
        assert ws.cell(linha, 15).value is None
    assert ws["K4"].value == "Ação 1"  # ação 3 depende da 1
    assert ws["C2"].value == "Imediato"


def test_datas_sao_celulas_de_data(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    ws = wb["Plano de Ação"]
    for linha in range(2, 8):
        for col in (9, 10):
            cel = ws.cell(linha, col)
            assert isinstance(cel.value, date)
            assert cel.number_format == "DD/MM/YYYY"
    assert ws["I2"].value == datetime(2026, 10, 26)


def test_validacao_de_status(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    ws = wb["Plano de Ação"]
    validacoes = ws.data_validations.dataValidation
    assert len(validacoes) == 1
    v = validacoes[0]
    assert v.type == "list"
    assert v.formula1 == '"A fazer,Em andamento,Feito,Atrasado"'
    assert str(v.sqref) == "O2:O7"
    assert STATUS == ["A fazer", "Em andamento", "Feito", "Atrasado"]


def test_zebra_e_quebra_de_linha(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    ws = wb["Plano de Ação"]
    assert ws["A2"].fill.fgColor.rgb.endswith("FFFFFF")
    assert ws["A3"].fill.fgColor.rgb.endswith("EEF2F8")
    assert ws["G2"].alignment.wrap_text
    assert ws.column_dimensions["G"].width == 60
    assert ws.column_dimensions["N"].width == 45


def test_aba_de_metas(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    texto = _texto_metas(wb["Metas do plano"])
    for esperado in ("Cenário de referência", "Realista", "Metas", "KPI", "Taxa de quebra", "36,1%",
                     "25/01/2027", "06 · mês 3", "O que cabe nos 3 meses", "Recuperação de PIX e boleto",
                     "Premissas", "Verba de mídia mantida", "Piso de ROAS", "5,00", "6,25"):
        assert esperado in texto, esperado
    assert "O que não cabe" not in texto  # lista vazia


def test_aba_de_metas_com_nao_cabe_e_piso_identico_ao_docx(tmp_path):
    plano = ex.plano_valido()
    plano["abertura"]["nao_cabe"] = ["Reposicionamento de marca"]
    _, _, wb = _gerar(plano, tmp_path)
    texto = _texto_metas(wb["Metas do plano"])
    assert "O que não cabe" in texto and "Reposicionamento de marca" in texto
    for linha in c.texto_piso_roas(plano):
        assert linha in texto


def test_sem_margem_grava_preencher_sem_inf(tmp_path):
    plano = ex.plano_valido()
    plano["abertura"]["margem_contribuicao"] = None
    _, _, wb = _gerar(plano, tmp_path)
    texto = _texto_metas(wb["Metas do plano"])
    assert "[PREENCHER: margem de contribuição]" in texto
    assert "inf" not in texto.lower().replace("informa", "")


def test_sem_avisos_do_openpyxl(tmp_path):
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        _gerar(ex.plano_valido(), tmp_path)


def _modelo(tmp_path, abas=("Plano de Ação", "Metas do plano")):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for nome in abas:
        wb.create_sheet(nome)
    if "Plano de Ação" in abas:
        wb["Plano de Ação"]["A1"] = "CABEÇALHO DO MODELO"
    if "Metas do plano" in abas:
        wb["Metas do plano"]["A1"] = "Título do modelo"
    caminho = tmp_path / "modelo.xlsx"
    wb.save(caminho)
    return caminho


def test_modelo_sem_as_abas_gera_erro(tmp_path):
    modelo = _modelo(tmp_path, abas=("Plano de Ação",))
    with pytest.raises(c.ErroPlano, match='precisa das abas "Plano de Ação" e "Metas do plano"'):
        gerar_xlsx(ex.plano_valido(), tmp_path / "out.xlsx", modelo)
    assert not (tmp_path / "out.xlsx").exists()


def test_modelo_minimo_e_preenchido_sem_alterar_o_original(tmp_path):
    modelo = _modelo(tmp_path)
    original = modelo.read_bytes()
    saida, resumo, wb = _gerar(ex.plano_valido(), tmp_path, modelo)
    assert resumo["total_acoes"] == 6
    ws = wb["Plano de Ação"]
    assert ws["A1"].value == "CABEÇALHO DO MODELO"  # linha 1 do modelo preservada
    esperado = c.acoes_cronologicas_com_horizonte(ex.plano_valido())
    assert [ws.cell(l, 1).value for l in range(2, 8)] == [a["numero"] for _, a in esperado]
    assert isinstance(ws["I2"].value, date)
    metas = wb["Metas do plano"]
    assert metas["A1"].value == "Título do modelo"
    assert "6,25" in _texto_metas(metas)
    assert modelo.read_bytes() == original
