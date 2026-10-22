#!/usr/bin/env python3
"""
scripts/previa_planilha.py: prévia de uma planilha (.xlsx) no app, sem baixar.

    python3 scripts/previa_planilha.py gerar --xlsx <planilha.xlsx> --saida <pasta> [--titulo "Projeção"]

O LibreOffice abre o .xlsx (recalculando as fórmulas que o openpyxl deixou sem valor)
e exporta todas as abas como HTML, com formatação de número, cores, bordas e larguras
de coluna. Este script separa as abas e grava `<saida>/planilha.html`: uma página
única, só leitura, com uma aba clicável por planilha, pronta para o iframe do app.
Imprime {"abas": n}.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

SOFFICE_MAC = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")

# Âncora de cada aba no HTML do LibreOffice: "Sheet N: <em>Nome</em>" seguida da tabela.
ABA = re.compile(r'<a\s+name="table\d+">\s*<h1>.*?<em>(.*?)</em>.*?</h1>\s*</a>\s*(<table.*?</table>)', re.I | re.S)
# Atributos de número que o LibreOffice repete em cada célula e que o navegador ignora.
ATRIBUTOS_INUTEIS = re.compile(r'\s(?:sdval|sdnum|data-sheets-[a-z]+)="[^"]*"', re.I)

ESTILO = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
[role="tablist"] { position: sticky; top: 0; z-index: 2; display: flex; gap: 4px; overflow-x: auto; padding: 8px 12px 0; background: #f4f4f5; border-bottom: 1px solid #d4d4d8; }
[role="tab"] { border: 1px solid transparent; border-bottom: 0; border-radius: 8px 8px 0 0; background: transparent; color: #52525b; padding: 6px 14px; font: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
[role="tab"][aria-selected="true"] { background: #fff; border-color: #d4d4d8; color: #111; font-weight: 600; margin-bottom: -1px; }
[role="tabpanel"] { overflow: auto; padding: 12px; }
[role="tabpanel"][hidden] { display: none; }
table { border-collapse: collapse; }
td, th { font-family: Calibri, "Segoe UI", sans-serif; font-size: 12px; padding: 2px 6px; white-space: nowrap; }
"""

SCRIPT = """
const abas = [...document.querySelectorAll('[role="tab"]')];
const paineis = [...document.querySelectorAll('[role="tabpanel"]')];
function abrir(i) {
  abas.forEach((a, j) => { a.setAttribute('aria-selected', String(i === j)); a.tabIndex = i === j ? 0 : -1; });
  paineis.forEach((p, j) => { p.hidden = i !== j; });
}
abas.forEach((a, i) => a.addEventListener('click', () => abrir(i)));
abas.forEach((a, i) => a.addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (d) { const j = (i + d + abas.length) % abas.length; abrir(j); abas[j].focus(); }
}));
"""


class ErroPrevia(Exception):
    """Mensagem pronta para o analista, em português."""


def abas(exportado: str) -> List[Tuple[str, str]]:
    """(nome, tabela em HTML) de cada aba do HTML exportado pelo LibreOffice."""
    achadas = [(html.unescape(nome).strip(), ATRIBUTOS_INUTEIS.sub("", tabela)) for nome, tabela in ABA.findall(exportado)]
    if not achadas:
        raise ErroPrevia("A planilha está vazia ou o LibreOffice não exportou nenhuma aba.")
    return achadas


def pagina(lista: List[Tuple[str, str]], titulo: str) -> str:
    botoes = "".join(
        f'<button role="tab" id="aba-{i}" aria-controls="painel-{i}" aria-selected="{"true" if i == 0 else "false"}" '
        f'tabindex="{0 if i == 0 else -1}">{html.escape(nome)}</button>'
        for i, (nome, _) in enumerate(lista)
    )
    paineis = "".join(
        f'<div role="tabpanel" id="painel-{i}" aria-labelledby="aba-{i}"{"" if i == 0 else " hidden"}>{tabela}</div>'
        for i, (_, tabela) in enumerate(lista)
    )
    return (
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
        f"<title>{html.escape(titulo)}</title><style>{ESTILO}</style></head>"
        f'<body><div role="tablist" aria-label="Abas da planilha">{botoes}</div>{paineis}<script>{SCRIPT}</script></body></html>'
    )


def _soffice() -> str:
    caminho = shutil.which("soffice") or (str(SOFFICE_MAC) if SOFFICE_MAC.exists() else None)
    if not caminho:
        raise ErroPrevia("LibreOffice não encontrado. Instale com: brew install --cask libreoffice")
    return caminho


def converter(xlsx: Path, saida: Path, titulo: Optional[str] = None) -> int:
    if not xlsx.is_file():
        raise ErroPrevia(f"Arquivo da planilha não encontrado: {xlsx}")
    soffice = _soffice()
    with tempfile.TemporaryDirectory() as tmp:
        perfil = Path(tmp) / "perfil"
        try:
            subprocess.run(
                [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--convert-to", "html:HTML (StarCalc):EmbedImages",
                 "--outdir", tmp, str(xlsx)],
                capture_output=True, timeout=120, check=True, env=os.environ,
            )
        except subprocess.TimeoutExpired:
            raise ErroPrevia("A conversão da planilha passou de 2 minutos. Tente de novo.")
        except subprocess.CalledProcessError as e:
            raise ErroPrevia(f"O LibreOffice não conseguiu abrir a planilha ({e.returncode}).")
        exportado = Path(tmp) / f"{xlsx.stem}.html"
        if not exportado.exists():
            raise ErroPrevia("O LibreOffice não gerou a prévia da planilha.")
        lista = abas(exportado.read_text(encoding="utf-8", errors="replace"))
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "planilha.html").write_text(pagina(lista, titulo or xlsx.stem), encoding="utf-8")
    return len(lista)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Prévia de planilha (.xlsx) em HTML, com valores calculados.")
    sub = p.add_subparsers(dest="comando", required=True)
    g = sub.add_parser("gerar")
    g.add_argument("--xlsx", required=True, type=Path)
    g.add_argument("--saida", required=True, type=Path)
    g.add_argument("--titulo")
    a = p.parse_args(argv)
    try:
        print(json.dumps({"abas": converter(a.xlsx, a.saida, a.titulo)}))
    except (ErroPrevia, OSError, subprocess.SubprocessError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
