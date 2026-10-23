"""Gráficos e tabelas PNG no padrão visual da agência (`.claude/skills/_shared/padrao-visual.md`): 7 pol de largura, 300 dpi,
todo o texto em 8 pt, Arial, marcadores circulares, meses em maiúsculas a 45 graus, legenda no canto superior esquerdo."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

AZUL, LARANJA, VERDE = "#1f6feb", "#f08c1a", "#2da44e"
CLARO = {"Benchmark": "#9aa4b2"}
MESES_CURTOS = ["OUT/25", "NOV/25", "DEZ/25", "JAN/26", "FEV/26", "MAR/26", "ABR/26", "MAI/26", "JUN/26", "JUL/26", "AGO/26", "SET/26"]
LARGURA = 7.0
FONTE = 8


def configurar() -> None:
    plt.rcParams.update({
        "font.family": "Arial", "font.size": FONTE, "axes.titlesize": FONTE, "axes.labelsize": FONTE,
        "xtick.labelsize": FONTE, "ytick.labelsize": FONTE, "legend.fontsize": FONTE,
        "axes.spines.top": False, "axes.spines.right": False,
    })


def brl(v: float, casas: int = 2) -> str:
    return f"R$ {v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def num(v: float, casas: int = 0) -> str:
    return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(v: float, casas: int = 1) -> str:
    return f"{v:.{casas}f}".replace(".", ",") + "%"


def nome_produto(nome: str) -> str:
    """'SÉRUM VITAMINA C 15% 30ML' vira 'Sérum Vitamina C 15% 30 ml' (título legível, unidades em minúscula)."""
    import re

    t = nome.title()
    t = re.sub(r"(\d)Ml\b", r"\1 ml", t)
    t = re.sub(r"(\d)G\b", r"\1 g", t)
    for errado, certo in ((" De ", " de "), (" Da ", " da "), (" Do ", " do "), (" Com ", " com "), (" Para ", " para "), (" Os ", " os "), (" E ", " e "),
                          ("Fps", "FPS"), ("Aha", "AHA"), ("Gg", "GG")):
        t = t.replace(errado, certo)
    return t.replace("(Caixa", "(caixa")


def formatador(tipo: str) -> FuncFormatter:
    if tipo == "R$":
        return FuncFormatter(lambda v, _: f"R$ {v / 1000:,.0f} mil".replace(",", "."))
    if tipo == "R$ unidade":
        return FuncFormatter(lambda v, _: f"R$ {v:,.0f}".replace(",", "."))
    if tipo == "%":
        return FuncFormatter(lambda v, _: f"{v:.1f}%".replace(".", ","))
    if tipo == "x":
        return FuncFormatter(lambda v, _: f"{v:.1f}x".replace(".", ","))
    return FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", "."))


def linha(
    destino: Path, titulo: str, rotulo_y: str, tipo_y: str,
    series: Sequence[tuple[str, Sequence[float], str]],
    referencias: Sequence[tuple[str, str, float, str]] = (),
    altura: float = 3.8,
) -> None:
    """`referencias`: (estilo 'media'|'meta'|'benchmark', legenda, valor, cor). No máximo 3."""
    configurar()
    assert len(referencias) <= 3, "padrão visual: no máximo 3 linhas de referência"
    fig, ax = plt.subplots(figsize=(LARGURA, altura))
    x = list(range(len(MESES_CURTOS)))
    for rotulo, valores, cor in series:
        ax.plot(x, valores, color=cor, marker="o", markersize=3.5, linewidth=1.2, label=rotulo)
    for estilo, legenda, valor, cor in referencias:
        ax.axhline(valor, color=cor, linewidth=0.9, linestyle="--" if estilo in ("media", "meta") else ":", alpha=1 if estilo != "benchmark" else 0.9, label=legenda)
    ax.set_xticks(x, MESES_CURTOS, rotation=45, ha="right")
    ax.set_ylabel(rotulo_y)
    ax.yaxis.set_major_formatter(formatador(tipo_y))
    ax.grid(axis="y", alpha=0.3, linewidth=0.6)
    ax.set_title(titulo, loc="left", fontweight="bold")
    # folga no topo para a legenda (canto superior esquerdo) não cobrir as linhas
    base, topo = ax.get_ylim()
    ax.set_ylim(base, topo + (topo - base) * (0.075 * (len(series) + len(referencias)) + 0.05))
    ax.legend(loc="upper left", frameon=False)
    fig.tight_layout()
    destino.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(destino, dpi=300)
    plt.close(fig)


def barras(
    destino: Path, titulo: str, rotulo_y: str, tipo_y: str, categorias: Sequence[str], valores: Sequence[float],
    cores: Sequence[str] | str = AZUL, rotulos: Sequence[str] | None = None, horizontal: bool = False, altura: float = 3.8,
) -> None:
    configurar()
    fig, ax = plt.subplots(figsize=(LARGURA, altura))
    if horizontal:
        pos = list(range(len(categorias)))[::-1]
        ax.barh(pos, valores, color=cores)
        ax.set_yticks(pos, categorias)
        ax.xaxis.set_major_formatter(formatador(tipo_y))
        ax.set_xlabel(rotulo_y)
        ax.grid(axis="x", alpha=0.3, linewidth=0.6)
        for p, v, r in zip(pos, valores, rotulos or [""] * len(valores)):
            ax.text(v, p, f" {r}", va="center", fontsize=FONTE)
    else:
        ax.bar(categorias, valores, color=cores)
        ax.yaxis.set_major_formatter(formatador(tipo_y))
        ax.set_ylabel(rotulo_y)
        ax.grid(axis="y", alpha=0.3, linewidth=0.6)
        for i, (v, r) in enumerate(zip(valores, rotulos or [""] * len(valores))):
            ax.text(i, v, r, ha="center", va="bottom", fontsize=FONTE)
    ax.set_title(titulo, loc="left", fontweight="bold")
    fig.tight_layout()
    destino.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(destino, dpi=300)
    plt.close(fig)


def tabela(destino: Path, titulo: str, colunas: Sequence[str], linhas: Sequence[Sequence[str]], larguras: Sequence[float], destaque_ultima: bool = False) -> None:
    configurar()
    altura = 0.30 + 0.24 * (len(linhas) + 1)
    fig, ax = plt.subplots(figsize=(LARGURA, altura))
    ax.axis("off")
    ax.set_title(titulo, loc="left", fontweight="bold")
    t = ax.table(cellText=[list(l) for l in linhas], colLabels=list(colunas), colWidths=list(larguras), loc="upper left", cellLoc="left")
    t.auto_set_font_size(False)
    t.set_fontsize(FONTE)
    for (r, _), c in t.get_celld().items():
        c.set_edgecolor("#d0d4da")
        c.set_height(0.24 / altura)
        c.PAD = 0.02  # recuo proporcional à largura da célula: o padrão (0,1) joga o texto longe da borda
        if r == 0:
            c.set_facecolor("#eef1f5")
            c.set_text_props(fontweight="bold")
        if destaque_ultima and r == len(linhas):
            c.set_text_props(fontweight="bold")
            c.set_facecolor("#f6f8fa")
    fig.tight_layout()
    destino.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(destino, dpi=300)
    plt.close(fig)
