"""Gerador da planilha .xlsx do plano de ação v2.

Duas abas: "Plano de Ação" (uma linha por ação, em ordem cronológica) e
"Metas do plano" (o prospect e a abertura do plano). Não valida o plano: quem valida é
gerar_plano_acao.py, que chama este módulo depois do validador.
"""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from plano_acao_comum import (
    ErroPlano,
    acoes_cronologicas_com_horizonte,
    ler_data,
    limpar_texto,
    texto_depende,
    texto_piso_roas,
)

ABA_PLANO = "Plano de Ação"
ABA_METAS = "Metas do plano"

COLUNAS_PLANO = [
    "Nº", "Frente", "Horizonte", "Ação", "Achado de origem", "Alavanca da meta", "Como", "Dono",
    "Início", "Entrega", "Depende de", "Evidência", "KPI e meta", "Gatilho", "Status",
]
STATUS = ["A fazer", "Em andamento", "Feito", "Atrasado"]

LARGURAS = [6, 24, 14, 30, 30, 24, 60, 22, 14, 14, 14, 30, 28, 45, 16]
COLUNAS_DATA = (9, 10)
COLUNA_STATUS = len(COLUNAS_PLANO)
FORMATO_DATA = "DD/MM/YYYY"

COR_CABECALHO = "1C2F5F"
COR_ZEBRA = ("FFFFFF", "EEF2F8")

_ALINHA_TEXTO = Alignment(wrap_text=True, vertical="top")
_ALINHA_CENTRO = Alignment(horizontal="center", vertical="top")


def _preencher(cor: str) -> PatternFill:
    return PatternFill(fill_type="solid", start_color=cor, end_color=cor)


def _valores_da_acao(horizonte: str, a: dict) -> list:
    onde = f"Ação {a.get('numero')}"
    return [
        a.get("numero"), a.get("frente"), horizonte, a.get("acao"), a.get("achado_origem"),
        a.get("alavanca"), a.get("como"), a.get("dono"),
        ler_data(a["inicio"], f"{onde}, início"), ler_data(a["entrega"], f"{onde}, entrega"),
        texto_depende(a), a.get("evidencia"), a.get("kpi_meta"), a.get("gatilho"), None,
    ]


def _escrever_acoes(ws, plano: dict, *, com_estilo: bool) -> int:
    """Escreve as ações a partir da linha 2; devolve o total. Com estilo, também o cabeçalho e as zebras."""
    pares = acoes_cronologicas_com_horizonte(plano)
    if com_estilo:
        for col, nome in enumerate(COLUNAS_PLANO, start=1):
            cel = ws.cell(1, col, nome)
            cel.fill = _preencher(COR_CABECALHO)
            cel.font = Font(bold=True, color="FFFFFF")
            cel.alignment = Alignment(wrap_text=True, vertical="center")
            ws.column_dimensions[get_column_letter(col)].width = LARGURAS[col - 1]
    for linha, (horizonte, a) in enumerate(pares, start=2):
        for col, valor in enumerate(_valores_da_acao(horizonte, a), start=1):
            cel = ws.cell(linha, col, limpar_texto(valor))
            if col in COLUNAS_DATA:
                cel.number_format = FORMATO_DATA
            if com_estilo:
                cel.fill = _preencher(COR_ZEBRA[linha % 2])
                cel.alignment = _ALINHA_CENTRO if col == 1 else _ALINHA_TEXTO
    total = len(pares)
    if total:
        ultima = get_column_letter(COLUNA_STATUS)
        validacao = DataValidation(
            type="list",
            formula1='"' + ",".join(STATUS) + '"',
            allow_blank=True,
            showErrorMessage=True,
            errorTitle="Status inválido",
            error="Use: A fazer, Em andamento, Feito ou Atrasado.",
        )
        validacao.add(f"{ultima}2:{ultima}{total + 1}")
        ws.add_data_validation(validacao)
    return total


def _blocos_de_metas(plano: dict) -> list[tuple[str, list]]:
    """Blocos da aba de metas como (título, linhas); cada linha é uma lista de células."""
    ab = plano.get("abertura") or {}
    blocos: list[tuple[str, list]] = [
        ("Prospect", [[plano.get("prospect", "")]]),
        ("Cenário de referência", [[ab.get("cenario", "")]]),
    ]
    metas = [[m.get("kpi"), m.get("de"), m.get("para"), m.get("ate"), m.get("fonte")] for m in ab.get("metas", [])]
    blocos.append(("Metas", [["KPI", "De", "Para", "Até", "Fonte"]] + metas))
    for titulo, chave in (("O que cabe nos 3 meses", "cabe_nos_3_meses"),
                          ("O que não cabe", "nao_cabe"),
                          ("Premissas", "premissas")):
        itens = ab.get(chave)
        if itens:
            blocos.append((titulo, [[item] for item in itens]))
    blocos.append(("Piso de ROAS", [[linha] for linha in texto_piso_roas(plano)]))
    return blocos


def _escrever_metas(ws, plano: dict, *, com_estilo: bool) -> None:
    linha = ws.max_row + 1 if ws.max_row > 1 or ws["A1"].value is not None else 1
    for titulo, linhas in _blocos_de_metas(plano):
        cel = ws.cell(linha, 1, limpar_texto(titulo))
        if com_estilo:
            cel.font = Font(bold=True, color="FFFFFF")
            for col in range(1, 6):
                ws.cell(linha, col).fill = _preencher(COR_CABECALHO)
        linha += 1
        for i, valores in enumerate(linhas):
            for col, valor in enumerate(valores, start=1):
                cel = ws.cell(linha, col, limpar_texto(valor))
                if com_estilo:
                    cel.alignment = _ALINHA_TEXTO
                    if titulo == "Metas" and i == 0:
                        cel.font = Font(bold=True)
            linha += 1
        linha += 1  # linha em branco entre blocos
    if com_estilo:
        for col, largura in enumerate((34, 22, 22, 16, 22), start=1):
            ws.column_dimensions[get_column_letter(col)].width = largura


def gerar_xlsx(plano: dict, saida: Path, modelo: Path | None = None) -> dict:
    """Grava a planilha em `saida` e devolve {"output", "total_acoes"}. Nunca altera o modelo."""
    saida = Path(saida)
    if modelo is not None:
        wb = load_workbook(modelo)
        if ABA_PLANO not in wb.sheetnames or ABA_METAS not in wb.sheetnames:
            raise ErroPlano('o modelo .xlsx precisa das abas "Plano de Ação" e "Metas do plano".')
        ws_plano, ws_metas, com_estilo = wb[ABA_PLANO], wb[ABA_METAS], False
    else:
        wb = Workbook()
        ws_plano = wb.active
        ws_plano.title = ABA_PLANO
        ws_metas = wb.create_sheet(ABA_METAS)
        com_estilo = True

    total = _escrever_acoes(ws_plano, plano, com_estilo=com_estilo)
    if com_estilo:
        ws_plano.freeze_panes = "A2"
        ws_plano.auto_filter.ref = f"A1:{get_column_letter(COLUNA_STATUS)}{total + 1}"
    _escrever_metas(ws_metas, plano, com_estilo=com_estilo)

    saida.parent.mkdir(parents=True, exist_ok=True)
    wb.save(saida)
    return {"output": str(saida), "total_acoes": total}
