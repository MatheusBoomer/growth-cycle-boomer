#!/usr/bin/env python3
"""
Gera os documentos brutos da Verdeluz (marca FICTÍCIA): kickoff-transcricao-bruta.docx, formulario-cliente.docx,
site-simulado.md e prints-campanhas/print-01.png a print-04.png (painéis simulados de Meta Ads e Google Ads).

    python3 scripts/fixture_verdeluz/gerar_brutos.py --saida <pasta>
"""

from __future__ import annotations

import argparse
from pathlib import Path

import docx
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from docx.shared import Pt  # noqa: E402

try:
    from . import ancoras as a
    from . import gerar_dados
    from .textos import FALANTES, FORMULARIO, KICKOFF, SITE_SIMULADO
except ImportError:  # execução direta do script
    import ancoras as a  # type: ignore[no-redef]
    import gerar_dados  # type: ignore[no-redef]
    from textos import FALANTES, FORMULARIO, KICKOFF, SITE_SIMULADO  # type: ignore[no-redef]

PALAVRAS_POR_SEGUNDO = 1.6


def _marca(segundos: float) -> str:
    s = int(segundos)
    return f"[{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}]"


def _gravar_kickoff(destino: Path) -> None:
    d = docx.Document()
    d.add_heading("Transcrição bruta da reunião de kickoff (FICTÍCIO)", level=1)
    d.add_paragraph("Verdeluz Cosméticos Veganos. Gravação transcrita automaticamente, sem revisão. Documento fictício para o cliente de teste.")
    tempo = 0.0
    for chave, fala in KICKOFF:
        d.add_paragraph(f"{_marca(tempo)} {FALANTES[chave]}: {fala}")
        tempo += len(fala.split()) / PALAVRAS_POR_SEGUNDO + 4
    d.add_paragraph(f"{_marca(tempo)} [fim da gravação]")
    d.sections[0].footer.paragraphs[0].text = "FICTÍCIO · cliente de teste da agência"
    d.save(destino)


def _gravar_formulario(destino: Path) -> None:
    d = docx.Document()
    d.add_heading("Formulário pré-kickoff (FICTÍCIO)", level=1)
    tabela = d.add_table(rows=1, cols=2)
    tabela.style = "Table Grid"
    tabela.rows[0].cells[0].text, tabela.rows[0].cells[1].text = "Pergunta", "Resposta"
    for pergunta, resposta in FORMULARIO:
        linha = tabela.add_row().cells
        linha[0].text, linha[1].text = pergunta, resposta
    for linha in tabela.rows:
        for c in linha.cells:
            for p in c.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10)
    d.sections[0].footer.paragraphs[0].text = "FICTÍCIO · cliente de teste da agência"
    d.save(destino)


def _imagem_tabela(destino: Path, titulo: str, colunas: list[str], linhas: list[list[str]], rodape: str) -> None:
    fig, ax = plt.subplots(figsize=(11, 3.6), dpi=110)
    ax.axis("off")
    fig.suptitle(titulo, x=0.02, ha="left", fontsize=13, fontweight="bold")
    larguras = [0.38] + [0.62 / (len(colunas) - 1)] * (len(colunas) - 1)
    tabela = ax.table(cellText=linhas, colLabels=colunas, colWidths=larguras, loc="upper center", cellLoc="left")
    tabela.auto_set_font_size(False)
    tabela.set_fontsize(10)
    tabela.scale(1, 1.7)
    for (linha, _), celula in tabela.get_celld().items():
        celula.set_edgecolor("#d0d4da")
        if linha == 0:
            celula.set_facecolor("#eef1f5")
            celula.set_text_props(fontweight="bold")
    fig.text(0.5, 0.5, "FICTÍCIO", fontsize=70, color="#999999", alpha=0.12, rotation=20, ha="center", va="center")
    fig.text(0.02, 0.03, rodape, fontsize=8, color="#555555")
    fig.savefig(destino)
    plt.close(fig)


def _brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _prints(destino: Path, m: dict) -> None:
    destino.mkdir(parents=True, exist_ok=True)
    meta, google = float(m["inv_meta"][-1]), float(m["inv_gg"][-1])
    ticket = float(m["ticket"][-1])

    def linhas(total: float, partes: list[float], roas: list[float], nomes: list[str], status: list[str], diario: list[float]) -> list[list[str]]:
        saida = []
        for nome, p, r, s, dia in zip(nomes, partes, roas, status, diario):
            gasto = total * p
            saida.append([nome, s, _brl(dia), _brl(gasto), str(round(gasto * r / ticket)), f"{r:.2f}".replace(".", ",")])
        return saida

    cols = ["Campanha", "Status", "Orçamento diário", "Gasto no mês", "Compras", "ROAS"]
    _imagem_tabela(
        destino / "print-01.png", "Meta Ads Manager · Campanhas · setembro de 2026 (simulado)", cols,
        linhas(meta, [0.38, 0.22, 0.17, 0.15, 0.08], [3.2, 3.6, 2.9, 6.1, 2.4],
               ["[CONV] Rotina completa always-on", "[CAT] Catálogo dinâmico", "[CONV] Sérum de vitamina C", "[REM] Remarketing 30 dias", "[SAZ] Primavera"],
               ["Ativa", "Ativa", "Ativa", "Ativa", "Ativa"], [260.0, 150.0, 120.0, 100.0, 60.0]),
        "Dados simulados para o cliente de teste. ROAS segundo a plataforma, sem conferência com o GA4.")
    _imagem_tabela(
        destino / "print-02.png", "Meta Ads Manager · Públicos e posicionamentos · setembro de 2026 (simulado)",
        ["Segmento", "Gasto", "Compras", "CPA", "ROAS"],
        [[n, _brl(meta * p), str(round(meta * p * r / ticket)), _brl(meta * p / max(1, round(meta * p * r / ticket))), f"{r:.2f}".replace(".", ",")]
         for n, p, r in [("Mulheres 25 a 34", 0.34, 3.1), ("Mulheres 35 a 44", 0.29, 3.6), ("Mulheres 45 a 54", 0.12, 3.9),
                          ("Homens 25 a 44", 0.05, 1.8), ("Instagram Feed", 0.30, 3.0), ("Instagram Reels", 0.35, 3.2), ("Instagram Stories", 0.20, 3.5)]],
        "Dados simulados para o cliente de teste.")
    _imagem_tabela(
        destino / "print-03.png", "Google Ads · Campanhas · setembro de 2026 (simulado)", cols,
        linhas(google, [0.12, 0.28, 0.30, 0.30], [9.4, 2.6, 4.1, 3.3],
               ["Search · Marca", "Search · Genérico", "Shopping", "Performance Max"], ["Ativa"] * 4, [45.0, 110.0, 120.0, 120.0]),
        "Dados simulados para o cliente de teste. ROAS segundo a plataforma.")
    _imagem_tabela(
        destino / "print-04.png", "Google Merchant Center · Desempenho de produtos · setembro de 2026 (simulado)",
        ["Produto", "Status", "Cliques", "Gasto", "ROAS"],
        [["Sérum de Vitamina C 15%", "Estoque baixo", "9.840", _brl(google * 0.22), "5,10"],
         ["Hidratante Facial Gel-Creme", "Aprovado", "7.310", _brl(google * 0.17), "4,30"],
         ["Protetor Solar Facial FPS 50", "Aprovado", "6.920", _brl(google * 0.15), "4,00"],
         ["Kit Rotina Essencial", "Aprovado", "4.480", _brl(google * 0.12), "3,70"],
         ["Kit Glow", "Aprovado", "3.050", _brl(google * 0.08), "3,10"]],
        "Dados simulados para o cliente de teste.")


def gerar(saida: Path, semente: int = 2026) -> None:
    saida = Path(saida)
    saida.mkdir(parents=True, exist_ok=True)
    _gravar_kickoff(saida / "kickoff-transcricao-bruta.docx")
    _gravar_formulario(saida / "formulario-cliente.docx")
    (saida / "site-simulado.md").write_text(SITE_SIMULADO, encoding="utf-8")
    _prints(saida / "prints-campanhas", gerar_dados._serie_mensal(np.random.default_rng(semente)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--saida", required=True, type=Path)
    args = parser.parse_args()
    gerar(args.saida)
