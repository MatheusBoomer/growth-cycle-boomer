"""Gerador da planilha .xlsx do plano de ação v2.

Duas abas: "Plano de Ação" (uma linha por ação, em ordem cronológica) e
"Metas do plano" (o prospect e a abertura do plano). Quando o plano tem `fases`, são três:
"Plano de Ação Estratégico" (uma faixa e um bloco de ações por fase), "Resumo por frente"
(contagens por fórmula) e "Metas do plano". Não valida o plano: quem valida é
gerar_plano_acao.py, que chama este módulo depois do validador.
"""
from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from plano_acao_comum import (
    FRENTES,
    HORIZONTES,
    ErroPlano,
    acoes,
    acoes_cronologicas_com_horizonte,
    ler_data,
    limpar_texto,
    fases,
    quando_curto,
    texto_depende,
    texto_piso_roas,
)

ABA_PLANO = "Plano de Ação"
ABA_METAS = "Metas do plano"
ABA_PLANO_FASES = "Plano de Ação Estratégico"
ABA_RESUMO = "Resumo por frente"

COLUNAS_PLANO = [
    "Nº", "Frente", "Horizonte", "Ação", "Achado de origem", "Alavanca da meta", "Como", "Dono",
    "Início", "Entrega", "Depende de", "Evidência", "KPI e meta", "Gatilho", "Status",
]
STATUS = ["A fazer", "Em andamento", "Feito", "Atrasado"]

COLUNAS_FASES = [
    "Nº", "Ação", "Racional (achado de origem)", "Alavanca da meta", "Frente", "Horizonte", "Responsável",
    "Início", "Entrega", "Depende de", "Como", "Evidência", "Impacto esperado / KPI e meta", "Gatilho", "Status",
]
STATUS_FASES = ["A iniciar", "Em andamento", "Concluída", "Atrasada", "Adiada"]
LARGURAS_FASES = [6, 32, 36, 22, 22, 14, 22, 11, 11, 24, 54, 32, 33, 37, 13]
COLUNAS_DATA_FASES = (8, 9)
COLUNA_STATUS_FASES = len(COLUNAS_FASES)
# (cor da faixa, tom claro das linhas) de cada fase, em rodízio; mesma paleta da planilha de referência.
CORES_DAS_FASES = [
    ("C0392B", "FDEDEC"), ("D68910", "FEF5E7"), ("1E8449", "EAFAF1"), ("2471A3", "EBF5FB"),
    ("7D3C98", "F5EEF8"), ("148F77", "E8F8F5"), ("566573", "F2F3F4"),
]
COR_TOTAL = "C9D3E8"
MESES = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")

LARGURAS = [6, 24, 14, 30, 30, 24, 60, 22, 14, 14, 14, 30, 28, 45, 16]
COLUNAS_DATA = (9, 10)
COLUNA_STATUS = len(COLUNAS_PLANO)
FORMATO_DATA = "DD/MM/YYYY"

COR_CABECALHO = "1C2F5F"
COR_ZEBRA = ("FFFFFF", "EEF2F8")

_ALINHA_TEXTO = Alignment(wrap_text=True, vertical="top")
_ALINHA_CENTRO = Alignment(horizontal="center", vertical="top")
_ALINHA_CENTRO_QUEBRA = Alignment(horizontal="center", vertical="top", wrap_text=True)
_ALINHA_ESQUERDA = Alignment(horizontal="left", vertical="center")
_LADO = Side(style="thin", color="BFBFBF")
_BORDA = Border(left=_LADO, right=_LADO, top=_LADO, bottom=_LADO)


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


# ---------------------------------------------------------------------------
# Plano com fases
# ---------------------------------------------------------------------------

def _mes_ano(texto: str, onde: str) -> str:
    d = ler_data(texto, onde)
    return f"{MESES[d.month - 1]}/{d.year}"


def _subtitulo_fases(plano: dict) -> str:
    lista = fases(plano)
    inicio = _mes_ano(lista[0]["inicio"], "Fase 1, início")
    fim = _mes_ano(plano.get("fim_ciclo") or lista[-1]["fim"], "fim do ciclo")
    partes = [f"Horizonte de 12 meses ({inicio} a {fim})", "Plano de ação do planejamento estratégico"]
    if plano.get("data_referencia"):
        partes.append(f"Data-base {plano['data_referencia']}")
    if plano.get("empresa_agencia"):
        partes.append(f"Elaborado por {plano['empresa_agencia']}")
    return " · ".join(partes)


def _valores_da_acao_fases(horizonte: str, a: dict, plano: dict) -> list:
    onde = f"Ação {a.get('numero')}"
    return [
        a.get("numero"), a.get("acao"), a.get("achado_origem"), a.get("alavanca"), a.get("frente"), horizonte,
        a.get("dono"), ler_data(a["inicio"], f"{onde}, início"), ler_data(a["entrega"], f"{onde}, entrega"),
        texto_depende(a, plano), a.get("como"), a.get("evidencia"), a.get("kpi_meta"), a.get("gatilho"), STATUS_FASES[0],
    ]


def _faixa(ws, linha: int, texto: str, cor: str, altura: float, tamanho: int) -> None:
    ws.merge_cells(start_row=linha, start_column=1, end_row=linha, end_column=COLUNA_STATUS_FASES)
    cel = ws.cell(linha, 1, limpar_texto(texto))
    cel.fill = _preencher(cor)
    cel.font = Font(bold=True, color="FFFFFF", size=tamanho)
    cel.alignment = _ALINHA_ESQUERDA
    ws.row_dimensions[linha].height = altura


def _escrever_fases(ws, plano: dict) -> int:
    """Título, subtítulo e, por fase: faixa, cabeçalho repetido e ações em ordem de número. Devolve o total de ações."""
    lista = fases(plano)
    por_numero = {a.get("numero"): (h, a) for h, a in acoes(plano)}
    ano_base = ler_data(lista[0]["inicio"], "Fase 1, início").year
    for col, largura in enumerate(LARGURAS_FASES, start=1):
        ws.column_dimensions[get_column_letter(col)].width = largura
    ws.sheet_view.showGridLines = False

    _faixa(ws, 1, f"PLANO DE AÇÃO ESTRATÉGICO — {str(plano.get('prospect', '')).upper()}", COR_CABECALHO, 30, 16)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=COLUNA_STATUS_FASES)
    sub = ws.cell(2, 1, limpar_texto(_subtitulo_fases(plano)))
    sub.font = Font(color=COR_CABECALHO)
    sub.alignment = _ALINHA_ESQUERDA
    ws.row_dimensions[2].height = 18

    linha, total = 4, 0
    blocos_de_acao: list[tuple[int, int]] = []  # (primeira, última) linha de ação de cada fase
    for i, fase in enumerate(lista):
        cor_faixa, tom = CORES_DAS_FASES[i % len(CORES_DAS_FASES)]
        janela = quando_curto({"numero": f"da fase {fase.get('numero')}", "inicio": fase["inicio"], "entrega": fase["fim"]},
                              ano_base)
        _faixa(ws, linha, f"FASE {fase.get('numero')} · {str(fase.get('nome', '')).upper()} · {janela.upper()}",
               cor_faixa, 21.75, 11)
        linha += 1
        for col, nome in enumerate(COLUNAS_FASES, start=1):
            cel = ws.cell(linha, col, nome)
            cel.fill = _preencher(COR_CABECALHO)
            cel.font = Font(bold=True, color="FFFFFF", size=10)
            cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cel.border = _BORDA
        ws.row_dimensions[linha].height = 30
        linha += 1
        primeira_acao = linha
        for n, numero in enumerate(sorted(fase.get("acoes") or [])):
            if numero not in por_numero:
                raise ErroPlano(f"a fase {fase.get('numero')} lista a ação {numero}, que não existe no plano.")
            horizonte, a = por_numero[numero]
            cor_linha = COR_ZEBRA[0] if n % 2 == 0 else tom
            for col, valor in enumerate(_valores_da_acao_fases(horizonte, a, plano), start=1):
                cel = ws.cell(linha, col, limpar_texto(valor))
                cel.fill = _preencher(cor_linha)
                cel.border = _BORDA
                cel.font = Font(bold=(col == 2), size=10)
                cel.alignment = _ALINHA_CENTRO_QUEBRA if col in (1, 5, 6, 7, 8, 9, 15) else _ALINHA_TEXTO
                if col in COLUNAS_DATA_FASES:
                    cel.number_format = FORMATO_DATA
            linha += 1
            total += 1
        if linha > primeira_acao:
            blocos_de_acao.append((primeira_acao, linha - 1))

    ws.freeze_panes = "C6"
    if blocos_de_acao:
        ultima = get_column_letter(COLUNA_STATUS_FASES)
        validacao = DataValidation(
            type="list",
            formula1='"' + ",".join(STATUS_FASES) + '"',
            allow_blank=True,
            showErrorMessage=True,
            errorTitle="Status inválido",
            error="Use: " + ", ".join(STATUS_FASES[:-1]) + " ou " + STATUS_FASES[-1] + ".",
        )
        for primeira, final in blocos_de_acao:
            validacao.add(f"{ultima}{primeira}:{ultima}{final}")
        ws.add_data_validation(validacao)
    return total


def _escrever_resumo(ws, plano: dict, total: int, ultima_linha: int) -> None:
    """Contagem por frente x horizonte (COUNTIFS) e por status (COUNTIF) sobre a aba do plano."""
    aba = f"'{ABA_PLANO_FASES}'"

    def faixa(coluna: str) -> str:
        return f"{aba}!${coluna}$4:${coluna}${ultima_linha}"

    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 34
    for col in "BCDE":
        ws.column_dimensions[col].width = 14
    titulo = ws.cell(1, 1, f"Ações por frente e horizonte (contagem automática a partir da aba {ABA_PLANO_FASES})")
    titulo.font = Font(bold=True, size=13, color=COR_CABECALHO)

    for col, nome in enumerate(("Frente", *HORIZONTES, "Total"), start=1):
        cel = ws.cell(3, col, nome)
        cel.fill = _preencher(COR_CABECALHO)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    primeira = 4
    for i, frente in enumerate(FRENTES):
        linha = primeira + i
        ws.cell(linha, 1, frente).font = Font(bold=True, size=10)
        for col in range(2, 5):
            letra = get_column_letter(col)
            cel = ws.cell(linha, col, f"=COUNTIFS({faixa('E')},$A{linha},{faixa('F')},{letra}$3)")
            cel.alignment = Alignment(horizontal="center")
        total_linha = ws.cell(linha, 5, f"=SUM(B{linha}:D{linha})")
        total_linha.font = Font(bold=True, size=10)
        total_linha.alignment = Alignment(horizontal="center")
    ultima_frente = primeira + len(FRENTES) - 1
    linha_total = ultima_frente + 1
    ws.cell(linha_total, 1, "Total")
    for col in range(2, 6):
        letra = get_column_letter(col)
        ws.cell(linha_total, col, f"=SUM({letra}{primeira}:{letra}{ultima_frente})").alignment = Alignment(horizontal="center")
    for col in range(1, 6):
        cel = ws.cell(linha_total, col)
        cel.fill = _preencher(COR_TOTAL)
        cel.font = Font(bold=True, size=10)

    linha = linha_total + 2
    ws.cell(linha, 1, "Status do plano").font = Font(bold=True, size=10, color=COR_CABECALHO)
    primeira_status = linha + 1
    for i, status in enumerate(STATUS_FASES):
        l = primeira_status + i
        ws.cell(l, 1, status)
        ws.cell(l, 2, f"=COUNTIF({faixa('O')},A{l})").alignment = Alignment(horizontal="center")
    l_conf = primeira_status + len(STATUS_FASES)
    ws.cell(l_conf, 1, f"Conferência (total de ações = {total})").font = Font(bold=True, size=10)
    conf = ws.cell(l_conf, 2, f"=SUM(B{primeira_status}:B{l_conf - 1})")
    conf.font = Font(bold=True, size=10)
    conf.alignment = Alignment(horizontal="center")


def _gerar_com_fases(plano: dict, modelo: Path | None) -> tuple[Workbook, int]:
    abas = (ABA_PLANO_FASES, ABA_RESUMO, ABA_METAS)
    if modelo is not None:
        wb = load_workbook(modelo)
        if any(nome not in wb.sheetnames for nome in abas):
            raise ErroPlano(f'o modelo .xlsx precisa das abas "{ABA_PLANO_FASES}", "{ABA_RESUMO}" e "{ABA_METAS}".')
        ws_plano, ws_resumo, ws_metas, com_estilo = wb[ABA_PLANO_FASES], wb[ABA_RESUMO], wb[ABA_METAS], False
    else:
        wb = Workbook()
        ws_plano = wb.active
        ws_plano.title = ABA_PLANO_FASES
        ws_resumo = wb.create_sheet(ABA_RESUMO)
        ws_metas = wb.create_sheet(ABA_METAS)
        com_estilo = True
    total = _escrever_fases(ws_plano, plano)
    _escrever_resumo(ws_resumo, plano, total, ws_plano.max_row)
    _escrever_metas(ws_metas, plano, com_estilo=com_estilo)
    return wb, total


def gerar_xlsx(plano: dict, saida: Path, modelo: Path | None = None) -> dict:
    """Grava a planilha em `saida` e devolve {"output", "total_acoes"}. Nunca altera o modelo."""
    saida = Path(saida)
    if fases(plano):
        wb, total = _gerar_com_fases(plano, modelo)
        saida.parent.mkdir(parents=True, exist_ok=True)
        wb.save(saida)
        return {"output": str(saida), "total_acoes": total}
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
