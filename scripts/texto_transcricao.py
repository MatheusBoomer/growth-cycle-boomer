"""Leitura da transcrição da reunião de apresentação e busca de trechos citados.

Usada pela etapa 10 (revisão pós-apresentação) para conferir se cada trecho que o
analista cita na revisão existe de fato na transcrição, tolerando diferenças de
aspas, travessão, maiúsculas e quebra de linha.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

EXTENSOES_TEXTO = (".txt", ".md")
_SUBSTITUICOES = str.maketrans({
    "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
    "‘": "'", "’": "'",
    "–": "-", "—": "-",
    "…": "...",
})
_ESPACOS = re.compile(r"\s+")
_PONTAS = " .,;:!?\"'"


class ErroTranscricao(Exception):
    """A transcrição não pôde ser lida (arquivo ausente, formato não suportado ou ilegível)."""


def extrair_texto(caminho: Path) -> str:
    """Devolve o texto da transcrição (.docx, .txt ou .md), uma linha por parágrafo ou célula.

    No .docx vêm primeiro os parágrafos e depois as células de tabelas, porque alguns
    exportadores põem a fala inteira em tabela.
    """
    caminho = Path(caminho)
    extensao = caminho.suffix.lower()
    if extensao not in (".docx", *EXTENSOES_TEXTO):
        raise ErroTranscricao(
            f"Formato '{extensao or caminho.name}' não suportado para a transcrição; use .docx, .txt ou .md."
        )
    if not caminho.is_file():
        raise ErroTranscricao(f"Transcrição não encontrada: {caminho}")
    if extensao == ".docx":
        return _extrair_docx(caminho)
    try:
        dados = caminho.read_bytes()
    except OSError as erro:  # sem permissão, é um diretório etc.
        raise ErroTranscricao(f"Não foi possível ler a transcrição {caminho}: {erro}") from erro
    try:
        return dados.decode("utf-8")
    except UnicodeDecodeError:
        return dados.decode("latin-1")


def _extrair_docx(caminho: Path) -> str:
    from docx import Document

    try:
        doc = Document(str(caminho))
    except Exception as erro:  # arquivo corrompido ou que não é um .docx de verdade
        raise ErroTranscricao(f"Não foi possível abrir a transcrição {caminho}: {erro}") from erro
    linhas = [p.text for p in doc.paragraphs]
    for tabela in doc.tables:
        for linha in tabela.rows:
            for celula in linha.cells:
                linhas.append(celula.text)
    return "\n".join(linhas)


def normalizar(texto: str) -> str:
    """Acentos em NFC, minúsculas, aspas/travessões/reticências padronizados, espaços colapsados, pontas aparadas."""
    texto = unicodedata.normalize("NFC", texto).lower().translate(_SUBSTITUICOES)
    texto = _ESPACOS.sub(" ", texto)
    return texto.strip(_PONTAS)


def contem_trecho(texto_normalizado: str, trecho: str) -> bool:
    """True se o trecho (normalizado aqui) não é vazio e aparece no texto já normalizado."""
    alvo = normalizar(trecho)
    return bool(alvo) and alvo in texto_normalizado
