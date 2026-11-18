from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest
from docx import Document

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import previa_documento as pd  # noqa: E402

TEM_SOFFICE = shutil.which("soffice") or Path("/Applications/LibreOffice.app/Contents/MacOS/soffice").exists()


def test_documento_inexistente_da_erro_em_portugues(tmp_path):
    with pytest.raises(pd.ErroPrevia, match="não encontrado"):
        pd.converter(tmp_path / "nao-existe.docx", tmp_path / "saida")


def test_main_devolve_1_e_mensagem_com_erro(tmp_path, capsys):
    assert pd.main(["gerar", "--docx", str(tmp_path / "x.docx"), "--saida", str(tmp_path / "s")]) == 1
    assert capsys.readouterr().err.startswith("ERRO:")


@pytest.mark.skipif(not TEM_SOFFICE, reason="LibreOffice não instalado")
def test_converte_docx_em_pdf(tmp_path, capsys):
    docx = tmp_path / "plano de ação.docx"
    doc = Document()
    doc.add_heading("Plano de ação", 1)
    doc.add_paragraph("Primeira onda: ajustes de conversão.")
    doc.save(docx)
    assert pd.main(["gerar", "--docx", str(docx), "--saida", str(tmp_path / "saida")]) == 0
    assert '"pdf": "documento.pdf"' in capsys.readouterr().out
    assert (tmp_path / "saida" / "documento.pdf").read_bytes().startswith(b"%PDF")
