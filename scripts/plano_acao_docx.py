"""
scripts/plano_acao_docx.py — monta o .docx do Plano de Ação v2 (Skill 08).

Le o modelo em `.claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx`
(banner da agência, fontes Montserrat embutidas, estilos de tabela já prontos) e
gera o documento final a partir do JSON do plano v2 (ver `plano_acao_comum.py` e
`validar_plano_acao.py`). Este módulo NÃO valida o plano: quem valida é o
`gerar_plano_acao.py`, que chama `gerar_docx` depois.

Conteúdo, nesta ordem: título; abertura (metas, cenário, o que cabe nos 3 meses,
o que não cabe, premissas, piso de ROAS); cada horizonte com as ações agrupadas
por frente (10 campos por ação); tabela-resumo cronológica.

O script não reescreve `word/header1.xml`, fontes, `styles.xml` nem `theme1.xml`
— copia-os do modelo sem alteração. Só `word/document.xml` é gerado do zero, a
partir dos fragmentos abaixo (mesma formatação do modelo: título Montserrat
34/bold, cabeçalhos de horizonte 30/bold, introdução 21/cinza #444444, rótulos
em negrito — a linha de AÇÃO com destaque amarelo —, tabela com cabeçalho
#1c2f5f/branco e linhas zebradas branco/#eef2f8).
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from plano_acao_comum import (
    FRENTES,
    acoes,
    limpar_texto,
    tabela_resumo,
    texto_depende,
    texto_piso_roas,
)

RAIZ = Path(__file__).resolve().parents[1]
MODELO_DOCX_PADRAO = RAIZ / ".claude" / "skills" / "_shared" / "[MODELO] Plano de Ação Estratégico.docx"

W_NS_DECL = (
    '<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
    'xmlns:o="urn:schemas-microsoft-com:office:office" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
    'xmlns:v="urn:schemas-microsoft-com:vml" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:w10="urn:schemas-microsoft-com:office:word" '
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" '
    'xmlns:sl="http://schemas.openxmlformats.org/schemaLibrary/2006/main" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
    'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
    'xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas" '
    'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" '
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" '
    'xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" '
    'xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" '
    'xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" '
    'xmlns="http://schemas.microsoft.com/office/tasks/2019/documenttasks" '
    'xmlns:cr="http://schemas.microsoft.com/office/comments/2020/reactions">'
)

_pid_counter = 0


def _next_pid() -> str:
    global _pid_counter
    _pid_counter += 1
    return f"{_pid_counter:08X}"


def _p_open(after=240, before=None) -> str:
    pid = _next_pid()
    spacing = f'w:after="{after}"' + (f' w:before="{before}"' if before is not None else "")
    return (
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" '
        f'w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="{pid}">'
        f'<w:pPr><w:spacing {spacing} w:lineRule="auto"/><w:rPr/></w:pPr>'
    )


_EMPTY_TRAIL = (
    '<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">'
    '<w:rPr><w:rtl w:val="0"/></w:rPr></w:r>'
)


def _run(text: str, bold=False, sz=None, color=None, highlight=None) -> str:
    rpr = ['<w:rFonts w:ascii="Montserrat" w:cs="Montserrat" w:eastAsia="Montserrat" w:hAnsi="Montserrat"/>']
    if bold:
        rpr.append('<w:b w:val="1"/><w:bCs w:val="1"/>')
    if color:
        rpr.append(f'<w:color w:val="{color}"/>')
    if sz:
        rpr.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    if highlight:
        rpr.append(f'<w:highlight w:val="{highlight}"/>')
    rpr.append('<w:rtl w:val="0"/>')
    linhas = limpar_texto(text).replace("\r\n", "\n").replace("\r", "\n").split("\n")
    corpo = "<w:br/>".join(f'<w:t xml:space="preserve">{escape(linha)}</w:t>' for linha in linhas)
    return (
        '<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">'
        f'<w:rPr>{"".join(rpr)}</w:rPr>{corpo}</w:r>'
    )


def titulo_paragrafo(prospect: str) -> str:
    return (
        _p_open(after=80)
        + _run(f"Plano de Ação Estratégico — {prospect}", bold=True, sz="34")
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def spacer_paragrafo(after=240) -> str:
    return _p_open(after=after) + _EMPTY_TRAIL + "</w:p>"


def horizonte_titulo(texto: str) -> str:
    return (
        _p_open(after=80)
        + _run(texto, bold=True, sz="30")
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def horizonte_intro(texto: str) -> str:
    return (
        _p_open(after=240)
        + _run(texto, sz="21", color="444444")
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def _p_rotulo(rotulo: str, valor: str, highlight=None, before=240) -> str:
    return (
        _p_open(after=240, before=before)
        + _run(f"{rotulo}:", bold=True, highlight=highlight)
        + _run(f" {valor}", highlight=highlight)
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def subtitulo_paragrafo(texto: str) -> str:
    return _p_open(after=80, before=240) + _run(texto, bold=True, sz="24") + _EMPTY_TRAIL + "</w:p>"


def texto_paragrafo(texto: str, after=80) -> str:
    return _p_open(after=after) + _run(texto) + _EMPTY_TRAIL + "</w:p>"


def frente_titulo(texto: str) -> str:
    return _p_open(after=80, before=240) + _run(texto, bold=True, sz="24") + _EMPTY_TRAIL + "</w:p>"


def acao_bloco(titulo: str, campos: list[tuple[str, str]]) -> str:
    """Linha de destaque (`titulo`, ex.: 'AÇÃO 2: ...') seguida de um parágrafo por (rótulo, valor)."""
    rotulo, _, resto = titulo.partition(":")
    out = [
        _p_open(after=240, before=240)
        + _run(f"{rotulo}:", bold=True, highlight="yellow")
        + _run(resto, highlight="yellow")
        + _EMPTY_TRAIL
        + "</w:p>"
    ]
    out.extend(_p_rotulo(r, v) for r, v in campos)
    out.append(spacer_paragrafo())
    return "".join(out)


def campos_da_acao(acao: dict, horizonte: str) -> list[tuple[str, str]]:
    return [
        ("FRENTE", f"{acao['frente']} · HORIZONTE: {horizonte}"),
        ("ACHADO DE ORIGEM", acao["achado_origem"]),
        ("ALAVANCA DA META", acao["alavanca"]),
        ("COMO", acao["como"]),
        ("DONO", acao["dono"]),
        ("INÍCIO E ENTREGA", f"{acao['inicio']} a {acao['entrega']}"),
        ("DEPENDE DE", texto_depende(acao)),
        ("EVIDÊNCIA", acao["evidencia"]),
        ("KPI E META", acao["kpi_meta"]),
        ("GATILHO", acao["gatilho"]),
    ]


TABLE_HEADERS = ["Nº", "Ação", "Frente", "Horizonte", "Início e entrega", "Dono"]
TABLE_COL_WIDTHS = ["450", "2500", "1650", "1100", "1900", "1429"]  # soma 9029


def _tc(text: str, header=False, shade=None, align="left") -> str:
    pid = _next_pid()
    fill = shade if shade else ("1c2f5f" if header else "ffffff")
    sz = "18" if header else "17"
    run_props = 'bold' if header else ''
    color = "ffffff" if header else None
    return (
        "<w:tc><w:tcPr>"
        '<w:tcBorders>'
        '<w:top w:color="cccccc" w:space="0" w:sz="4" w:val="single"/>'
        '<w:left w:color="cccccc" w:space="0" w:sz="4" w:val="single"/>'
        '<w:bottom w:color="cccccc" w:space="0" w:sz="4" w:val="single"/>'
        '<w:right w:color="cccccc" w:space="0" w:sz="4" w:val="single"/>'
        "</w:tcBorders>"
        f'<w:shd w:fill="{fill}" w:val="clear"/>'
        f'<w:tcMar><w:top w:w="{"80.0" if header else "70.0"}" w:type="dxa"/>'
        '<w:left w:w="100.0" w:type="dxa"/>'
        f'<w:bottom w:w="{"80.0" if header else "70.0"}" w:type="dxa"/>'
        '<w:right w:w="100.0" w:type="dxa"/></w:tcMar>'
        '<w:vAlign w:val="center"/></w:tcPr>'
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" '
        f'w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="{pid}">'
        f'<w:pPr><w:jc w:val="{align}"/><w:rPr/></w:pPr>'
        + _run(text, bold=header, sz=sz, color=color)
        + _EMPTY_TRAIL
        + "</w:p></w:tc>"
    )


def tabela_linha_cabecalho() -> str:
    aligns = ["center", "left", "left", "left", "left", "left"]
    cells = "".join(_tc(h, header=True, align=a) for h, a in zip(TABLE_HEADERS, aligns))
    return f'<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="1"/></w:trPr>{cells}</w:tr>'


def tabela_linha_dado(row: dict, index: int) -> str:
    shade = "ffffff" if index % 2 == 0 else "eef2f8"
    aligns = ["center", "left", "left", "left", "left", "left"]
    values = [str(row["numero"]), row["acao"], row["frente"], row["horizonte"], row["periodo"], row["dono"]]
    cells = "".join(_tc(v, header=False, shade=shade, align=a) for v, a in zip(values, aligns))
    return f'<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>{cells}</w:tr>'


def tabela_titulo() -> str:
    return (
        _p_open(after=80, before=240)
        + _run("Tabela-Resumo Cronológica", bold=True, sz="30")
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def montar_tabela(linhas: list[dict]) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in TABLE_COL_WIDTHS)
    preamble = (
        "<w:tbl><w:tblPr>"
        '<w:tblStyle w:val="Table1"/><w:tblW w:w="9029.0" w:type="dxa"/><w:jc w:val="left"/>'
        "<w:tblBorders>"
        '<w:top w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        '<w:left w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        '<w:bottom w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        '<w:right w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        '<w:insideH w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        '<w:insideV w:color="000000" w:space="0" w:sz="4" w:val="single"/>'
        "</w:tblBorders>"
        '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0000"/>'
        f"</w:tblPr><w:tblGrid>{grid}</w:tblGrid>"
    )
    rows = [tabela_linha_cabecalho()]
    for i, row in enumerate(linhas):
        rows.append(tabela_linha_dado(row, i))
    return preamble + "".join(rows) + "</w:tbl>"


SECT_PR = (
    "<w:sectPr><w:headerReference r:id=\"rId6\" w:type=\"default\"/>"
    '<w:pgSz w:h="16834" w:w="11909" w:orient="portrait"/>'
    '<w:pgMar w:bottom="1440" w:top="1440" w:left="1440" w:right="1440" w:header="720" w:footer="720"/>'
    '<w:pgNumType w:start="1"/></w:sectPr>'
)


def _abertura(plano: dict) -> list[str]:
    ab = plano.get("abertura") or {}
    partes = [subtitulo_paragrafo("Metas do plano")]
    for m in ab.get("metas", []):
        partes.append(texto_paragrafo(f"{m['kpi']}: de {m['de']} para {m['para']} até {m['ate']} (fonte: {m['fonte']})"))
    partes.append(texto_paragrafo(f"Cenário de referência: {ab.get('cenario', '')}", after=240))
    blocos = [("O que cabe nos 3 meses", ab.get("cabe_nos_3_meses")),
              ("O que não cabe", ab.get("nao_cabe")),
              ("Premissas", ab.get("premissas"))]
    for titulo, itens in blocos:
        if not itens:
            continue
        partes.append(subtitulo_paragrafo(titulo))
        partes.extend(texto_paragrafo(f"• {item}") for item in itens)
    partes.append(subtitulo_paragrafo("Piso de ROAS"))
    partes.extend(texto_paragrafo(linha) for linha in texto_piso_roas(plano))
    partes.append(spacer_paragrafo())
    return partes


def montar_document_xml(plano: dict) -> str:
    body_parts = [titulo_paragrafo(plano["prospect"]), spacer_paragrafo()]
    body_parts.extend(_abertura(plano))

    for horizonte in plano["horizontes"]:
        body_parts.append(horizonte_titulo(horizonte["titulo"]))
        if horizonte.get("intro"):
            body_parts.append(horizonte_intro(horizonte["intro"]))
        else:
            body_parts.append(spacer_paragrafo(after=120))
        for frente in FRENTES:
            da_frente = [a for a in horizonte.get("acoes", []) if a.get("frente") == frente]
            if not da_frente:
                continue
            body_parts.append(frente_titulo(frente))
            for acao in da_frente:
                body_parts.append(
                    acao_bloco(f"AÇÃO {acao['numero']}: {acao['acao']}",
                               campos_da_acao(acao, horizonte["nome"]))
                )

    body_parts.append(tabela_titulo())
    body_parts.append(montar_tabela(tabela_resumo(plano)))
    body_parts.append(_p_open(after=0) + _EMPTY_TRAIL + "</w:p>")
    body_parts.append(SECT_PR)

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + W_NS_DECL
        + "<w:body>"
        + "".join(body_parts)
        + "</w:body></w:document>"
    )


def gerar_docx(plano: dict, modelo: Path, saida: Path) -> dict:
    """Escreve o .docx do plano em `saida`, copiando do `modelo` tudo menos word/document.xml.

    Não valida o plano; devolve {"output", "total_acoes"}.
    """
    saida = Path(saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    document_xml = montar_document_xml(plano)

    with zipfile.ZipFile(modelo) as zin:
        with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as zout:
            for name in zin.namelist():
                data = zin.read(name)
                if name == "word/document.xml":
                    data = document_xml.encode("utf-8")
                zout.writestr(name, data)

    return {"output": str(saida), "total_acoes": len(acoes(plano))}
