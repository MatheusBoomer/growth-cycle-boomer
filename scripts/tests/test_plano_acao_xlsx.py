from __future__ import annotations

import shutil
import subprocess
import sys
import warnings
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl
import pytest
from openpyxl.utils import get_column_letter

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import plano_v2_exemplo as ex  # noqa: E402
from plano_acao_xlsx import (  # noqa: E402
    ABA_METAS,
    ABA_PLANO_ONDAS,
    ABA_RESUMO,
    COLUNAS_ONDAS,
    COLUNAS_PLANO,
    STATUS,
    STATUS_ONDAS,
    gerar_xlsx,
)


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
    assert v.showErrorMessage is True
    assert v.errorTitle == "Status inválido"
    assert v.error == "Use: A fazer, Em andamento, Feito ou Atrasado."
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
                     "25/01/2027", "06 · Realista, JAN/27", "O que cabe nos 3 meses", "Recuperação de PIX e boleto",
                     "Premissas", "Verba de mídia mantida", "Piso de ROAS", "5,00", "6,25"):
        assert esperado in texto, esperado
    assert "O que não cabe" not in texto  # lista vazia


def test_aba_de_metas_abre_com_o_nome_do_prospect(tmp_path):
    plano = ex.plano_valido()
    plano["prospect"] = "Marca Teste (FICTÍCIO)"
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb["Metas do plano"]
    assert ws["A1"].value == "Prospect"
    assert ws["A2"].value == "Marca Teste (FICTÍCIO)"


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


def test_caracteres_de_controle_ilegais_nao_quebram_a_planilha(tmp_path):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = "passo\x0b um\x00\x1f fim\nlinha 2"
    plano["abertura"]["premissas"].append("premissa\x0c com controle")
    saida, _, wb = _gerar(plano, tmp_path)
    ws = wb[ex_aba_plano()]
    como = [r[6].value for r in ws.iter_rows(min_row=2)]
    assert "passo um fim\nlinha 2" in como
    assert "premissa com controle" in _texto_metas(wb["Metas do plano"])


def ex_aba_plano():
    from plano_acao_xlsx import ABA_PLANO
    return ABA_PLANO


# ---------------------------------------------------------------------------
# Plano com ondas: aba por onda, resumo por frente e aba de metas
# ---------------------------------------------------------------------------

def _acoes_por_numero(plano):
    return {a["numero"]: (h, a) for h, a in c.acoes(plano)}


def _linhas_de_acao(ws):
    """Números de linha das ações: as que têm um inteiro em A (banners e cabeçalhos não têm)."""
    return [l for l in range(1, ws.max_row + 1) if isinstance(ws.cell(l, 1).value, int)]


def test_ondas_tres_abas_na_ordem(tmp_path):
    saida, resumo, wb = _gerar(ex.plano_com_ondas(), tmp_path)
    assert ABA_PLANO_ONDAS == "Plano de Ação Estratégico"
    assert ABA_RESUMO == "Resumo por frente"
    assert wb.sheetnames == [ABA_PLANO_ONDAS, ABA_RESUMO, ABA_METAS]
    assert resumo == {"output": str(saida), "total_acoes": 6}
    assert STATUS_ONDAS == ["A iniciar", "Em andamento", "Concluída", "Atrasada", "Adiada"]
    assert COLUNAS_ONDAS == [
        "Nº", "Ação", "Racional (achado de origem)", "Alavanca da meta", "Frente", "Horizonte",
        "Responsável", "Início", "Entrega", "Depende de", "Como", "Evidência",
        "Impacto esperado / KPI e meta", "Gatilho", "Status",
    ]


def test_ondas_titulo_subtitulo_e_congelamento(tmp_path):
    plano = ex.plano_com_ondas()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    assert ws["A1"].value == "PLANO DE AÇÃO ESTRATÉGICO — MARCA TESTE"
    assert "A1:O1" in {str(r) for r in ws.merged_cells.ranges}
    assert "A2:O2" in {str(r) for r in ws.merged_cells.ranges}
    sub = ws["A2"].value
    assert "Horizonte de 12 meses" in sub and "out/2026 a set/2027" in sub
    assert "Data-base 22/10/2026" in sub and sub.endswith("Elaborado por Boomer")
    assert ws.freeze_panes == "C6"
    assert ws["A1"].fill.fgColor.rgb.endswith("1C2F5F")


def test_ondas_faixa_cabecalho_e_acoes_de_cada_onda(tmp_path):
    plano = ex.plano_com_ondas()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    por_numero = _acoes_por_numero(plano)
    faixas = [l for l in range(1, ws.max_row + 1) if str(ws.cell(l, 1).value).startswith("ONDA ")]
    assert faixas == [4, 8, 12]  # título, subtítulo, linha em branco; depois faixa, cabeçalho e 2 ações por onda
    assert ws.cell(faixas[0], 1).value == "ONDA 1 · CONTENÇÃO · 26/10 A 01/11"
    assert ws.cell(faixas[1], 1).value == "ONDA 2 · ESCALA · 02/11 A 30/11"
    assert ws.cell(faixas[2], 1).value == "ONDA 3 · MANUTENÇÃO · 01/12 A 30/06/27"
    mescladas = {str(r) for r in ws.merged_cells.ranges}
    limites = faixas + [ws.max_row + 1]
    for onda, ini, fim in zip(plano["ondas"], limites, limites[1:]):
        assert f"A{ini}:O{ini}" in mescladas
        assert [cel.value for cel in ws[ini + 1]] == COLUNAS_ONDAS  # cabeçalho repetido
        numeros = [ws.cell(l, 1).value for l in range(ini + 2, fim)]
        assert numeros == sorted(onda["acoes"])
        for linha in range(ini + 2, fim):
            horizonte, a = por_numero[ws.cell(linha, 1).value]
            assert ws.cell(linha, 2).value == a["acao"]
            assert ws.cell(linha, 3).value == a["achado_origem"]
            assert ws.cell(linha, 4).value == a["alavanca"]
            assert ws.cell(linha, 5).value == a["frente"]
            assert ws.cell(linha, 6).value == horizonte
            assert ws.cell(linha, 7).value == a["dono"]
            assert ws.cell(linha, 11).value == a["como"]
            assert ws.cell(linha, 12).value == a["evidencia"]
            assert ws.cell(linha, 13).value == a["kpi_meta"]
            assert ws.cell(linha, 14).value == a["gatilho"]
            assert ws.cell(linha, 15).value is None
    assert ws.cell(faixas[0] + 1, 1).fill.fgColor.rgb.endswith("1C2F5F")


def test_ondas_datas_e_depende_de_com_nome(tmp_path):
    plano = ex.plano_com_ondas()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    linhas = {ws.cell(l, 1).value: l for l in _linhas_de_acao(ws)}
    for numero, (_, a) in _acoes_por_numero(plano).items():
        linha = linhas[numero]
        assert ws.cell(linha, 10).value == c.texto_depende(a, plano)
        for col in (8, 9):
            assert isinstance(ws.cell(linha, col).value, date)
            assert ws.cell(linha, col).number_format == "DD/MM/YYYY"
    assert ws.cell(linhas[3], 10).value == "Ação 1 (Liberar os acessos)"
    assert ws.cell(linhas[5], 10).value.startswith("Ação 2 (")
    assert ws.cell(linhas[1], 10).value == "Nenhuma"
    assert ws.cell(linhas[1], 8).value == datetime(2026, 10, 26)


def test_ondas_validacao_de_status_so_nas_linhas_de_acao(tmp_path):
    plano = ex.plano_com_ondas()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    validacoes = ws.data_validations.dataValidation
    assert len(validacoes) == 1
    v = validacoes[0]
    assert v.type == "list"
    assert v.formula1 == '"A iniciar,Em andamento,Concluída,Atrasada,Adiada"'
    assert v.showErrorMessage is True
    celulas = {
        f"{get_column_letter(col)}{lin}" for faixa in v.sqref.ranges
        for lin in range(faixa.min_row, faixa.max_row + 1) for col in range(faixa.min_col, faixa.max_col + 1)
    }
    esperado = {f"O{l}" for l in _linhas_de_acao(ws)}
    assert len(esperado) == 6
    assert celulas == esperado


def test_ondas_zebra_e_estilo_das_linhas(tmp_path):
    _, _, wb = _gerar(ex.plano_com_ondas(), tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    linhas = _linhas_de_acao(ws)
    assert ws.cell(linhas[0], 2).alignment.wrap_text
    cores = {ws.cell(l, 2).fill.fgColor.rgb[-6:] for l in linhas[:2]}
    assert len(cores) == 2  # zebra: linhas vizinhas da mesma onda têm cores diferentes
    assert ws.sheet_view.showGridLines is False


def _recalcular(caminho, tmp_path):
    soffice = shutil.which("soffice") or "/opt/homebrew/bin/soffice"
    if not Path(soffice).exists():
        pytest.skip("LibreOffice (soffice) não está instalado; não dá para recalcular as fórmulas.")
    destino = tmp_path / "recalculado"
    destino.mkdir()
    perfil = tmp_path / "perfil-lo"
    subprocess.run(
        [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--convert-to", "xlsx",
         "--outdir", str(destino), str(caminho)],
        check=True, capture_output=True, timeout=180,
    )
    return openpyxl.load_workbook(destino / Path(caminho).name, data_only=True)


def test_ondas_resumo_recalculado_bate_com_o_json(tmp_path):
    plano = ex.plano_com_ondas()
    saida, _, wb = _gerar(plano, tmp_path)
    # preenche os status das linhas de ação, em rodízio, para exercitar o bloco "Status do plano"
    ws = wb[ABA_PLANO_ONDAS]
    status_por_numero = {}
    for i, linha in enumerate(_linhas_de_acao(ws)):
        status_por_numero[ws.cell(linha, 1).value] = STATUS_ONDAS[i % 3]  # não usa Atrasada nem Adiada
        ws.cell(linha, 15).value = status_por_numero[ws.cell(linha, 1).value]
    preenchido = tmp_path / "preenchido.xlsx"
    wb.save(preenchido)

    calc = _recalcular(preenchido, tmp_path)
    resumo = calc[ABA_RESUMO]
    por_frente_horizonte = Counter((a["frente"], h) for h, a in c.acoes(plano))
    total = len(c.acoes(plano))

    linhas = {resumo.cell(l, 1).value: l for l in range(1, resumo.max_row + 1)}
    for frente in c.FRENTES:
        l = linhas[frente]
        esperado = [por_frente_horizonte[(frente, h)] for h in c.HORIZONTES]
        assert [resumo.cell(l, col).value for col in (2, 3, 4)] == esperado, frente
        assert resumo.cell(l, 5).value == sum(esperado)
    l_total = linhas["Total"]
    for col, h in zip((2, 3, 4), c.HORIZONTES):
        assert resumo.cell(l_total, col).value == sum(n for (f, hh), n in por_frente_horizonte.items() if hh == h)
    assert resumo.cell(l_total, 5).value == total

    contagem_status = Counter(status_por_numero.values())
    for status in STATUS_ONDAS:
        assert resumo.cell(linhas[status], 2).value == contagem_status.get(status, 0), status
    l_conf = linhas[f"Conferência (total de ações = {total})"]
    assert resumo.cell(l_conf, 2).value == total  # todas as ações têm status


def test_ondas_resumo_usa_formulas_sobre_a_aba_do_plano(tmp_path):
    _, _, wb = _gerar(ex.plano_com_ondas(), tmp_path)
    resumo = wb[ABA_RESUMO]
    formulas = [str(cel.value) for linha in resumo.iter_rows() for cel in linha if str(cel.value).startswith("=")]
    assert any(f.startswith("=COUNTIFS('Plano de Ação Estratégico'!") for f in formulas)
    assert any(f.startswith("=COUNTIF('Plano de Ação Estratégico'!") for f in formulas)
    assert resumo.sheet_view.showGridLines is False


def test_ondas_texto_com_e_comercial_e_menor_que_volta_igual(tmp_path):
    plano = ex.plano_com_ondas()
    achado = "Taxa < 5% & carrinho > 10% em \"A&B\" <tag>"
    plano["horizontes"][0]["acoes"][0]["achado_origem"] = achado
    plano["horizontes"][0]["acoes"][0]["acao"] = "Liberar <acessos> & medir"
    numero = plano["horizontes"][0]["acoes"][0]["numero"]
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_PLANO_ONDAS]
    linha = next(l for l in _linhas_de_acao(ws) if ws.cell(l, 1).value == numero)
    assert ws.cell(linha, 3).value == achado
    assert ws.cell(linha, 2).value == "Liberar <acessos> & medir"


def test_ondas_aba_de_metas_e_a_de_hoje(tmp_path):
    plano = ex.plano_com_ondas()
    _, _, wb = _gerar(plano, tmp_path)
    ws = wb[ABA_METAS]
    assert ws["A1"].value == "Prospect"
    assert "Piso de ROAS" in _texto_metas(ws)


def test_ondas_modelo_precisa_das_tres_abas(tmp_path):
    modelo = _modelo(tmp_path)  # só as duas abas de hoje
    with pytest.raises(c.ErroPlano, match="Resumo por frente"):
        gerar_xlsx(ex.plano_com_ondas(), tmp_path / "out.xlsx", modelo)
    assert not (tmp_path / "out.xlsx").exists()


def test_ondas_modelo_com_as_tres_abas_e_preenchido(tmp_path):
    modelo = _modelo(tmp_path, abas=(ABA_PLANO_ONDAS, ABA_RESUMO, ABA_METAS))
    original = modelo.read_bytes()
    _, resumo, wb = _gerar(ex.plano_com_ondas(), tmp_path, modelo)
    assert resumo["total_acoes"] == 6
    assert wb.sheetnames == [ABA_PLANO_ONDAS, ABA_RESUMO, ABA_METAS]
    assert wb[ABA_PLANO_ONDAS]["A1"].value.startswith("PLANO DE AÇÃO ESTRATÉGICO")
    assert len(_linhas_de_acao(wb[ABA_PLANO_ONDAS])) == 6
    assert wb[ABA_RESUMO]["A3"].value == "Frente"
    assert modelo.read_bytes() == original


def test_sem_ondas_continua_com_duas_abas_de_hoje(tmp_path):
    _, _, wb = _gerar(ex.plano_valido(), tmp_path)
    assert wb.sheetnames == ["Plano de Ação", "Metas do plano"]
