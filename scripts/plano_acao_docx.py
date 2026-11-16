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

Plano com `fases`: layout do modelo Happy Duck — como o plano funciona, visão geral, metas
mensais, sessões não pagas, abertura, protocolo de mudança, cada fase (objetivo, calendário de
mídia, ações em tabela de 2 colunas, checkpoint), KPIs de acompanhamento e decisões do cliente.
Os blocos opcionais ausentes são omitidos; sem `fases` vale o layout acima, sem alteração.

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
    decisoes_do_cliente,
    limpar_texto,
    fases,
    tabela_resumo,
    texto_depende,
    texto_piso_roas,
    visao_geral,
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


def _p_open(after=240, before=None, keep_next=False) -> str:
    """Abre um parágrafo; `keep_next` o mantém na mesma página que o parágrafo ou a tabela seguinte."""
    pid = _next_pid()
    spacing = f'w:after="{after}"' + (f' w:before="{before}"' if before is not None else "")
    return (
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" '
        f'w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="{pid}">'
        f'<w:pPr>{"<w:keepNext/>" if keep_next else ""}<w:spacing {spacing} w:lineRule="auto"/><w:rPr/></w:pPr>'
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


def subtitulo_paragrafo(texto: str, keep_next=False) -> str:
    return _p_open(after=80, before=240, keep_next=keep_next) + _run(texto, bold=True, sz="24") + _EMPTY_TRAIL + "</w:p>"


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


def _tc(text: str, header=False, shade=None, align="left", bold=None, valign="center") -> str:
    pid = _next_pid()
    fill = shade if shade else ("1c2f5f" if header else "ffffff")
    sz = "18" if header else "17"
    color = "ffffff" if header else None
    negrito = header if bold is None else bold
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
        f'<w:vAlign w:val="{valign}"/></w:tcPr>'
        f'<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" '
        f'w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="{pid}">'
        f'<w:pPr><w:jc w:val="{align}"/><w:rPr/></w:pPr>'
        + _run(text, bold=negrito, sz=sz, color=color)
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


def _tbl_abre(larguras: list) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in larguras)
    return (
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


def montar_tabela(linhas: list[dict]) -> str:
    rows = [tabela_linha_cabecalho()]
    for i, row in enumerate(linhas):
        rows.append(tabela_linha_dado(row, i))
    return _tbl_abre(TABLE_COL_WIDTHS) + "".join(rows) + "</w:tbl>"


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


# ---------------------------------------------------------------------------
# Layout com fases (modelo Happy Duck): tabelas genéricas, bloco da ação em tabela, checkpoint
# ---------------------------------------------------------------------------

LARGURA_TOTAL = 9029
LARGURAS_VISAO_GERAL = [1800, 1500, 1400, 3529, 800]  # soma 9029
LARGURAS_DECISOES = [2700, 1300, 5029]  # soma 9029
LARGURAS_KPIS = [3300, 5729]  # soma 9029
LARGURAS_ACAO = [1300, 7729]  # soma 9029
LARGURAS_METAS_MENSAIS = [1000, 1100, 950, 900, 850, 750, 700, 850, 1000, 929]  # 10 colunas, soma 9029
CINZA_ZEBRA = "eef2f8"
AMARELO_GATILHO = "fff2cc"


def _larguras_iguais(n: int) -> list[int]:
    """`n` colunas somando 9029; com 2 ou mais, a primeira (rótulo) fica mais larga que as demais."""
    if n <= 1:
        return [LARGURA_TOTAL]
    primeira = 1500 if n <= 4 else 900
    resto = (LARGURA_TOTAL - primeira) // (n - 1)
    return [LARGURA_TOTAL - resto * (n - 1)] + [resto] * (n - 1)


def tabela_generica(cabecalhos: list[str], linhas: list[list[str]], larguras: list[int]) -> str:
    """Tabela com cabeçalho #1c2f5f/branco e linhas zebradas, no mesmo estilo da tabela-resumo."""
    cab = "".join(_tc(h, header=True) for h in cabecalhos)
    rows = [f'<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="1"/></w:trPr>{cab}</w:tr>']
    for i, linha in enumerate(linhas):
        shade = "ffffff" if i % 2 == 0 else CINZA_ZEBRA
        cells = "".join(_tc(v, shade=shade) for v in linha)
        rows.append(f'<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>{cells}</w:tr>')
    return _tbl_abre(larguras) + "".join(rows) + "</w:tbl>"


def _p_lead(lead: str, texto: str = "", after=120, before=None, keep_next=False) -> str:
    """Parágrafo com um começo em negrito (`lead`) seguido do `texto` normal."""
    return (
        _p_open(after=after, before=before, keep_next=keep_next)
        + _run(lead, bold=True)
        + (_run(f" {texto}") if texto else "")
        + _EMPTY_TRAIL
        + "</w:p>"
    )


def _com_ponto(titulo: str) -> str:
    titulo = limpar_texto(titulo).strip()
    return titulo if titulo.endswith((".", ":", ";", "!", "?")) else f"{titulo}."


def acao_bloco_tabela(titulo: str, cabecalho: str, campos: list[tuple[str, str]]) -> str:
    """Linha de destaque (`titulo`, ex.: 'AÇÃO 2 · texto'), linha de cabeçalho em fonte menor e
    tabela de 2 colunas (rótulo em negrito | texto). O GATILHO leva fundo amarelo claro."""
    rotulo, sep, resto = titulo.partition(" · ")
    destaque = (
        _p_open(after=40, before=240, keep_next=True)
        + _run(rotulo, bold=True, highlight="yellow")
        + (_run(f"{sep}{resto}", highlight="yellow") if sep else "")
        + _EMPTY_TRAIL
        + "</w:p>"
    )
    info = _p_open(after=80, keep_next=True) + _run(cabecalho, sz="18", color="444444") + _EMPTY_TRAIL + "</w:p>"
    rows = []
    for rot, valor in campos:
        shade = AMARELO_GATILHO if rot == "GATILHO" else "ffffff"
        cells = _tc(rot, shade=shade, bold=True, valign="top") + _tc(valor, shade=shade, valign="top")
        rows.append(f'<w:tr><w:trPr><w:cantSplit w:val="1"/><w:tblHeader w:val="0"/></w:trPr>{cells}</w:tr>')
    return destaque + info + _tbl_abre(LARGURAS_ACAO) + "".join(rows) + "</w:tbl>" + spacer_paragrafo(after=120)


def cabecalho_da_acao(acao: dict, horizonte: str, plano: dict) -> str:
    return (
        f"Início e entrega: {acao['inicio']} a {acao['entrega']}   Dono: {acao['dono']}   "
        f"Frente: {acao['frente']}   Horizonte: {horizonte}   Depende de: {texto_depende(acao, plano)}"
    )


def campos_da_acao_em_tabela(acao: dict) -> list[tuple[str, str]]:
    return [
        ("ACHADO", acao["achado_origem"]),
        ("ALAVANCA", acao["alavanca"]),
        ("COMO", acao["como"]),
        ("EVIDÊNCIA", acao["evidencia"]),
        ("KPI E META", acao["kpi_meta"]),
        ("GATILHO", acao["gatilho"]),
    ]


def fase_titulo(fase: dict) -> str:
    """Título da fase (com a janela) seguido de 'Objetivo' e 'Calendário de mídia'."""
    partes = [
        _p_open(after=80, before=360, keep_next=True)
        + _run(f"Fase {fase['numero']} · {fase['nome']} ({fase['inicio']} a {fase['fim']})", bold=True, sz="30")
        + _EMPTY_TRAIL
        + "</w:p>",
        _p_lead("Objetivo:", fase.get("objetivo", ""), after=80, keep_next=True),
    ]
    if fase.get("calendario_midia"):
        partes.append(_p_lead("Calendário de mídia:", fase["calendario_midia"], after=120, keep_next=True))
    return "".join(partes)


def checkpoint_bloco(fase: dict, ha_proxima: bool = True) -> str:
    """Bloco do checkpoint ao fim da fase; vazio quando ela não tem checkpoint."""
    cp = fase.get("checkpoint")
    if not cp:
        return ""
    quando = f"{cp['data']} ({cp['duracao']})" if cp.get("duracao") else cp["data"]
    liberar = f"Para liberar a Fase {fase['numero'] + 1}." if ha_proxima else "Para fechar o ciclo."
    return (
        subtitulo_paragrafo(f"Checkpoint {fase['numero']}: {quando}", keep_next=True)
        + _p_lead("• Pauta.", cp["pauta"], after=80)
        + _p_lead(f"• {liberar}", cp["para_liberar"], after=80)
        + _p_lead("• Quem decide.", cp["quem_decide"], after=240)
    )


def _como_funciona(plano: dict) -> list[str]:
    itens = plano.get("como_funciona") or []
    if not itens:
        return []
    return [horizonte_titulo("Como este plano funciona")] + [
        _p_lead(_com_ponto(i["titulo"]), i["texto"]) for i in itens
    ] + [spacer_paragrafo(after=120)]


def _visao_geral(plano: dict) -> list[str]:
    linhas = [
        [f"Fase {v['numero']}\n{v['nome']}", v["janela"], v["calendario_midia"] or "", v["foco"] or "",
         str(v["total_acoes"])]
        for v in visao_geral(plano)
    ]
    cabecalhos = ["Fase", "Janela", "Calendário de mídia", "Foco", "Ações"]
    return [horizonte_titulo("Visão geral"), tabela_generica(cabecalhos, linhas, LARGURAS_VISAO_GERAL),
            spacer_paragrafo()]


def _metas_mensais(plano: dict) -> list[str]:
    metas = plano.get("metas_mensais")
    if not metas:
        return []
    meses = max(len(metas.get("linhas") or []) - 1, 0)  # a última linha é o total
    titulo = "Metas do primeiro mês" if meses == 1 else f"Metas dos {meses} primeiros meses"
    partes = [horizonte_titulo(titulo)]
    if metas.get("cenario"):
        partes.append(texto_paragrafo(f"Cenário: {metas['cenario']}", after=120))
    larguras = LARGURAS_METAS_MENSAIS if len(metas["colunas"]) == len(LARGURAS_METAS_MENSAIS) else _larguras_iguais(len(metas["colunas"]))
    partes.append(tabela_generica(metas["colunas"], metas["linhas"], larguras))
    if metas.get("observacao"):
        partes.append(texto_paragrafo(metas["observacao"], after=120))
    partes.append(spacer_paragrafo())
    return partes


def _lead_e_lista(lead: str, valor) -> list[str]:
    """`valor` em texto vira um parágrafo com o `lead` em negrito; em lista, o `lead` e um marcador por item."""
    if isinstance(valor, list):
        return [_p_lead(lead, after=80)] + [texto_paragrafo(f"• {item}") for item in valor]
    return [_p_lead(lead, valor)]


def _sessoes_nao_pagas(plano: dict) -> list[str]:
    sessoes = plano.get("sessoes_nao_pagas")
    if not sessoes:
        return []
    partes = [
        horizonte_titulo("Sessões não pagas"),
        tabela_generica(sessoes["colunas"], sessoes["linhas"], _larguras_iguais(len(sessoes["colunas"]))),
        spacer_paragrafo(after=120),
    ]
    if sessoes.get("premissas"):
        partes.extend(_lead_e_lista("Premissas de volume.", sessoes["premissas"]))
    if sessoes.get("risco"):
        partes.extend(_lead_e_lista("Risco.", sessoes["risco"]))
    partes.append(spacer_paragrafo())
    return partes


def _protocolo_mudanca(plano: dict) -> list[str]:
    protocolo = plano.get("protocolo_mudanca")
    if not protocolo:
        return []
    partes = [horizonte_titulo("Como mudamos minimizando riscos"), texto_paragrafo(protocolo["intro"], after=120)]
    partes.extend(texto_paragrafo(f"{i}. {regra}") for i, regra in enumerate(protocolo["regras"], start=1))
    partes.append(spacer_paragrafo())
    return partes


def _fechamento(plano: dict) -> list[str]:
    partes: list[str] = []
    kpis = plano.get("kpis_acompanhamento") or []
    if kpis:
        partes.append(horizonte_titulo("KPIs de acompanhamento e limites"))
        partes.append(tabela_generica(["KPI", "Meta e limite"], [[k["kpi"], k["meta_limite"]] for k in kpis],
                                      LARGURAS_KPIS))
        partes.append(spacer_paragrafo())
    decisoes = decisoes_do_cliente(plano)
    if decisoes:
        partes.append(horizonte_titulo(f"Decisões que dependem de {plano['prospect']}"))
        partes.append(tabela_generica(
            ["Ação", "Até", "Recomendação"],
            [[f"Ação {d['numero']}: {d['acao']}", d["ate"], d["recomendacao"]] for d in decisoes],
            LARGURAS_DECISOES,
        ))
        partes.append(spacer_paragrafo())
    return partes


def _corpo_com_fases(plano: dict) -> list[str]:
    partes = [titulo_paragrafo(plano["prospect"]), spacer_paragrafo()]
    partes.extend(_como_funciona(plano))
    partes.extend(_visao_geral(plano))
    partes.extend(_metas_mensais(plano))
    partes.extend(_sessoes_nao_pagas(plano))
    partes.extend(_abertura(plano))
    partes.extend(_protocolo_mudanca(plano))

    por_numero = {a.get("numero"): (h, a) for h, a in acoes(plano)}
    lista = fases(plano)
    for i, fase in enumerate(lista):
        partes.append(fase_titulo(fase))
        for numero in sorted(fase.get("acoes") or []):
            if numero not in por_numero:
                continue
            horizonte, acao = por_numero[numero]
            partes.append(acao_bloco_tabela(
                f"AÇÃO {numero} · {acao['acao']}",
                cabecalho_da_acao(acao, horizonte, plano),
                campos_da_acao_em_tabela(acao),
            ))
        partes.append(checkpoint_bloco(fase, ha_proxima=i + 1 < len(lista)))
    partes.extend(_fechamento(plano))
    return partes


def montar_document_xml(plano: dict) -> str:
    if fases(plano):
        body_parts = _corpo_com_fases(plano)
        body_parts.append(_p_open(after=0) + _EMPTY_TRAIL + "</w:p>")
        body_parts.append(SECT_PR)
        return _envelopar(body_parts)
    return _montar_document_xml_horizontes(plano)


def _envelopar(body_parts: list[str]) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + W_NS_DECL
        + "<w:body>"
        + "".join(body_parts)
        + "</w:body></w:document>"
    )


def _montar_document_xml_horizontes(plano: dict) -> str:
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
    return _envelopar(body_parts)


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
