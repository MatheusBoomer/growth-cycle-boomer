#!/usr/bin/env python3
"""
scripts/preencher_plano_acao_docx.py — monta o .docx do Plano de Ação (Skill 08).

Le um modelo em `.claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx`
(banner da agência, fontes Montserrat embutidas, estilos de tabela já prontos) e
gera o documento final a partir de um JSON com os horizontes/ações/tabela-resumo
já aprovados pelo analista. Nunca escreve o `.docx` na mão — sempre por este
script, para garantir formatação idêntica em qualquer prospect.

Uso:
    python scripts/preencher_plano_acao_docx.py \
        --modelo ".claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx" \
        --input plano.json \
        --output "clientes/<prospect>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx"

## Estrutura do JSON de entrada

    {
      "prospect": "Nome do Prospect",
      "horizontes": [
        {
          "titulo": "HORIZONTE 1 — IMEDIATO (Semana 1, ...)",
          "intro": null,                         // opcional — frase de contexto em cinza
          "acoes": [
            {"acao": "...", "o_que": "...", "quando": "...", "por_quem": "...", "como": "...",
             "solucoes": ["P1.S1"]},              // opcional: ids do contexto/solucoes.json que a ação executa
            ...
          ]
        },
        ... (exatamente 3 horizontes, nesta ordem)
      ],
      "tabela": [
        {"num": 1, "acao": "...", "frente": "...", "horizonte": "Imediato",
         "quando": "...", "por_quem": "..."},
        ...
      ]
    }

O script não reescreve `word/header1.xml`, fontes, `styles.xml` nem `theme1.xml`
— copia-os do modelo sem alteração. Só `word/document.xml` é gerado do zero, a
partir dos fragmentos abaixo (mesma formatação usada no modelo: título Montserrat
34/bold, cabeçalhos de horizonte 30/bold, introdução 21/cinza #444444, rótulos
AÇÃO/O QUÊ/QUANDO/POR QUEM/COMO em negrito — a linha de AÇÃO com destaque
amarelo —, tabela com cabeçalho #1c2f5f/branco e linhas zebradas
branco/#eef2f8).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

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
    return (
        '<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">'
        f'<w:rPr>{"".join(rpr)}</w:rPr>'
        f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
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


def acao_bloco(acao: str, o_que: str, quando: str, por_quem: str, como: str) -> str:
    out = []
    out.append(
        _p_open(after=240, before=240)
        + _run("AÇÃO:", bold=True, highlight="yellow")
        + _run(f" {acao}", highlight="yellow")
        + _EMPTY_TRAIL
        + "</w:p>"
    )
    for label, valor in (("O QUÊ:", o_que), ("QUANDO:", quando), ("POR QUEM:", por_quem), ("COMO:", como)):
        out.append(
            _p_open(after=240, before=240)
            + _run(label, bold=True)
            + _run(f" {valor}")
            + _EMPTY_TRAIL
            + "</w:p>"
        )
    out.append(spacer_paragrafo())
    return "".join(out)


TABLE_HEADERS = ["#", "Ação", "Frente", "Horizonte", "Quando", "Por Quem"]
TABLE_COL_WIDTHS = ["450", "2500", "1650", "1250", "1800", "1379"]


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
    values = [str(row["num"]), row["acao"], row["frente"], row["horizonte"], row["quando"], row["por_quem"]]
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


def montar_document_xml(dados: dict) -> str:
    body_parts = [titulo_paragrafo(dados["prospect"]), spacer_paragrafo()]

    for horizonte in dados["horizontes"]:
        body_parts.append(horizonte_titulo(horizonte["titulo"]))
        if horizonte.get("intro"):
            body_parts.append(horizonte_intro(horizonte["intro"]))
        else:
            body_parts.append(spacer_paragrafo(after=120))
        for acao in horizonte["acoes"]:
            body_parts.append(
                acao_bloco(acao["acao"], acao["o_que"], acao["quando"], acao["por_quem"], acao["como"])
            )

    body_parts.append(tabela_titulo())
    body_parts.append(montar_tabela(dados["tabela"]))
    body_parts.append(_p_open(after=0) + _EMPTY_TRAIL + "</w:p>")
    body_parts.append(SECT_PR)

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + W_NS_DECL
        + "<w:body>"
        + "".join(body_parts)
        + "</w:body></w:document>"
    )


def preencher(modelo: str, dados: dict, saida: str) -> dict:
    obrigatorios = ["prospect", "horizontes", "tabela"]
    faltando = [k for k in obrigatorios if k not in dados]
    if faltando:
        raise ValueError(f"JSON sem as chaves: {', '.join(faltando)}")
    if len(dados["horizontes"]) != 3:
        raise ValueError("É preciso exatamente 3 horizontes (Imediato, Curto Prazo, Médio Prazo).")

    saida_path = Path(saida)
    saida_path.parent.mkdir(parents=True, exist_ok=True)

    document_xml = montar_document_xml(dados)

    with zipfile.ZipFile(modelo) as zin:
        names = zin.namelist()
        with zipfile.ZipFile(saida_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for name in names:
                data = zin.read(name)
                if name == "word/document.xml":
                    data = document_xml.encode("utf-8")
                zout.writestr(name, data)

    total_acoes = sum(len(h["acoes"]) for h in dados["horizontes"])
    return {
        "output": str(saida_path),
        "prospect": dados["prospect"],
        "total_acoes": total_acoes,
        "total_linhas_tabela": len(dados["tabela"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Monta o .docx do Plano de Ação (Skill 08).")
    parser.add_argument("--modelo", required=True, help="Caminho do .docx-modelo em _shared/.")
    parser.add_argument("--input", required=True, help="JSON com prospect + horizontes + tabela.")
    parser.add_argument("--output", required=True, help="Caminho do .docx final a salvar.")
    args = parser.parse_args()

    try:
        with open(args.input, encoding="utf-8") as f:
            dados = json.load(f)
        resumo = preencher(args.modelo, dados, args.output)
    except (ValueError, KeyError) as exc:
        print(json.dumps({"erro": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    json.dump(resumo, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
