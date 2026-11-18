#!/usr/bin/env python3
"""
scripts/previa_documento.py: prévia de um documento Word (.docx) no app, sem baixar.

    python3 scripts/previa_documento.py gerar --docx <documento.docx> --saida <pasta>

O LibreOffice converte o .docx em `<saida>/documento.pdf`, que o app mostra no
visualizador de PDF do navegador (páginas como no Word, com zoom e rolagem).
Usa o mesmo LibreOffice e as mesmas fontes da prévia da apresentação.
Imprime {"pdf": "documento.pdf"}.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional

from previa_apresentacao import FONTS_CONF, ErroPrevia, _soffice

NOME_PDF = "documento.pdf"


def converter(docx: Path, pasta: Path) -> Path:
    if not docx.is_file():
        raise ErroPrevia(f"Arquivo do documento não encontrado: {docx}")
    soffice = _soffice()
    pasta.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        perfil = Path(tmp) / "perfil"
        conf = Path(tmp) / "fonts.conf"
        conf.write_text(FONTS_CONF.format(cache=Path(tmp) / "fc-cache"), encoding="utf-8")
        try:
            subprocess.run(
                [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(docx)],
                capture_output=True, timeout=120, check=True, env={**os.environ, "FONTCONFIG_FILE": str(conf)},
            )
        except subprocess.TimeoutExpired:
            raise ErroPrevia("A conversão do documento passou de 2 minutos. Tente de novo.")
        except subprocess.CalledProcessError as e:
            raise ErroPrevia(f"O LibreOffice não conseguiu converter o documento ({e.returncode}).")
        pdf = Path(tmp) / f"{docx.stem}.pdf"
        if not pdf.exists():
            raise ErroPrevia("O LibreOffice não gerou o PDF do documento.")
        destino = pasta / NOME_PDF
        shutil.move(str(pdf), destino)
    return destino


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Prévia de um documento Word (.docx) como PDF.")
    sub = p.add_subparsers(dest="comando", required=True)
    g = sub.add_parser("gerar")
    g.add_argument("--docx", required=True, type=Path)
    g.add_argument("--saida", required=True, type=Path)
    a = p.parse_args(argv)
    try:
        destino = converter(a.docx, a.saida)
        print(json.dumps({"pdf": destino.name}))
    except (ErroPrevia, OSError, subprocess.SubprocessError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
