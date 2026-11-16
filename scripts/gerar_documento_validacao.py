#!/usr/bin/env python3
"""
scripts/gerar_documento_validacao.py: monta o PDF do documento de validação do cliente (Skill 04).

O documento é enviado ao prospect antes da apresentação, para ele conferir se os
gráficos do histórico (já aprovados pelo analista) batem com o que ele conhece do
próprio negócio. O agente escreve o JSON de entrada e roda este script; o PDF nunca
é montado na mão, para manter a identidade visual idêntica em qualquer prospect.

Uso:
    python scripts/gerar_documento_validacao.py \
        --input entrada.json \
        --pasta-prospect clientes/<slug> \
        --output clientes/<slug>/.app/rascunhos/documento-validacao.pdf

## Estrutura do JSON de entrada

    {
      "prospect": "Nome do Prospect",
      "periodo": "Novembro/2025 a Outubro/2026",
      "secoes": [
        {
          "titulo": "Receita e investimento",
          "graficos": [
            {"arquivo": "investimento-meta.png",          // só o nome do PNG
             "observacao": "texto curto" }               // opcional: null ou "" = sem caixa
          ]
        }
      ],
      "limitacoes": {                                    // opcional: null = sem o bloco
        "titulo": "Ausência do Google Analytics e limitações",
        "itens": [{"titulo": "Sem sessões totais", "texto": "..."}]
      }
    }

`arquivo` é o nome de um PNG em `<pasta-prospect>/entrega/ativos-aprovados/graficos/`
(nada de subpastas nem `..`). Seção sem gráfico é omitida.

## Validações (falham com mensagem em português e sem deixar PDF)

- gráfico citado que não existe (ou não abre como imagem);
- observação ou texto com e-mail, CPF ou telefone de cliente final (regra de PII do projeto);
- campos obrigatórios ausentes, `secoes` que não é lista, caractere que a fonte do PDF
  não desenha (ex.: emoji).

O PDF é gravado num arquivo temporário na pasta de saída e só então movido para o
destino final, então uma falha no meio nunca deixa um PDF parcial.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------- identidade visual (amostrada do documento de referência da agência) ----------

AZUL_MARINHO = HexColor("#14213d")
LARANJA = HexColor("#e54800")
AMBAR = HexColor("#e5a100")
AMARELO_CLARO = HexColor("#fffaf0")
CINZA_CAIXA = HexColor("#f4f4f5")
CINZA_CARTAO = HexColor("#f7f7f8")
CINZA_BORDA = HexColor("#e2e5e9")
CINZA_TEXTO = HexColor("#333b47")
CINZA_SECUNDARIO = HexColor("#5f6b7a")
CINZA_RODAPE = HexColor("#8a919b")
BRANCO = HexColor("#ffffff")
AZUL_CLARO_TEXTO = HexColor("#d6dbe6")

PASTA_SCRIPT = Path(__file__).resolve().parent
LOGO = PASTA_SCRIPT / "assets" / "boomer-logo-escuro.png"
SUBPASTA_GRAFICOS = Path("entrega") / "ativos-aprovados" / "graficos"

LARGURA, ALTURA = A4
MARGEM_LATERAL = 36.0
MARGEM_TOPO = 40.0
MARGEM_BASE = 58.0
ALTURA_FAIXA = 112.0
ALTURA_FILETE_FAIXA = 3.0
LARGURA_CONTEUDO = LARGURA - 2 * MARGEM_LATERAL
ALTURA_MAX_GRAFICO = 430.0  # nenhum cartão passa disso, para título + observação caberem na página

TEXTO_INTRO = (
    "Este documento não é a apresentação final: é uma checagem rápida para confirmar que os dados "
    "usados na nossa análise estão corretos antes da reunião de Planejamento Estratégico. "
    "Revise os gráficos abaixo e, se algo estiver diferente do que você esperava, nos avise o quanto antes."
)
TITULO_FECHAMENTO = "Confirme os dados antes da apresentação"
TEXTO_FECHAMENTO = (
    "Se algo estiver diferente do que você esperava, nos avise agora: isso evita qualquer ajuste "
    "de última hora na apresentação."
)
TEXTO_RODAPE = "Documento de validação · Boomer"

# ---------- validação ----------

RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
RE_CPF = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b")
RE_TELEFONE = re.compile(r"\(\d{2}\)\s?\d{4,5}-\d{4}")

# Substituições simples para símbolos comuns que a fonte padrão do PDF (WinAnsi) não tem.
SUBSTITUICOES = {"→": "->", "←": "<-", "≥": ">=", "≤": "<=", "≈": "~", "−": "-", " ": " ", "​": ""}


class ErroDocumento(Exception):
    """Entrada inválida ou impossível de renderizar. A mensagem é em português."""


def _texto_obrigatorio(valor, descricao: str) -> str:
    if not isinstance(valor, str) or not valor.strip():
        raise ErroDocumento(f"Campo obrigatório ausente ou vazio: {descricao}.")
    return valor


def _limpar(texto: str) -> str:
    for de, para in SUBSTITUICOES.items():
        texto = texto.replace(de, para)
    for c in texto:
        try:
            c.encode("cp1252")
        except UnicodeEncodeError:
            raise ErroDocumento(
                f"O texto contém o caractere {c!r}, que a fonte do PDF não desenha. "
                "Reescreva sem ele."
            ) from None
    return texto


def _checar_pii(texto: str, onde: str) -> None:
    for regex, nome in ((RE_EMAIL, "e-mail"), (RE_CPF, "CPF"), (RE_TELEFONE, "telefone")):
        if regex.search(texto):
            raise ErroDocumento(
                f"{onde} parece conter {nome} de cliente final. O documento não pode trazer dado "
                "pessoal: reescreva a observação sem ele."
            )


def _nome_de_arquivo_seguro(nome: str) -> bool:
    return bool(nome) and nome not in {".", ".."} and "/" not in nome and "\\" not in nome and ".." not in nome


def validar_entrada(dados: dict, pasta_prospect: Path) -> None:
    """Confere a entrada inteira. Levanta ErroDocumento com a primeira falha encontrada."""
    if not isinstance(dados, dict):
        raise ErroDocumento("O JSON de entrada precisa ser um objeto com prospect, periodo e secoes.")
    _limpar(_texto_obrigatorio(dados.get("prospect"), "prospect"))
    _limpar(_texto_obrigatorio(dados.get("periodo"), "periodo"))

    secoes = dados.get("secoes")
    if not isinstance(secoes, list):
        raise ErroDocumento("O campo secoes precisa ser uma lista.")

    pasta_graficos = Path(pasta_prospect) / SUBPASTA_GRAFICOS
    total_graficos = 0
    for i, secao in enumerate(secoes, start=1):
        if not isinstance(secao, dict):
            raise ErroDocumento(f"A seção {i} precisa ser um objeto com titulo e graficos.")
        titulo = _texto_obrigatorio(secao.get("titulo"), f"titulo da seção {i}")
        _limpar(titulo)
        _checar_pii(titulo, f"O título da seção {i}")
        graficos = secao.get("graficos")
        if not isinstance(graficos, list):
            raise ErroDocumento(f"A seção '{titulo}' precisa de uma lista graficos (pode ser vazia).")
        for j, grafico in enumerate(graficos, start=1):
            if not isinstance(grafico, dict):
                raise ErroDocumento(f"O gráfico {j} da seção '{titulo}' precisa ser um objeto.")
            arquivo = _texto_obrigatorio(grafico.get("arquivo"), f"arquivo do gráfico {j} da seção '{titulo}'")
            if not _nome_de_arquivo_seguro(arquivo):
                raise ErroDocumento(
                    f"O nome do gráfico '{arquivo}' é inválido: informe só o nome do arquivo, "
                    "sem pasta nem '..'."
                )
            caminho = pasta_graficos / arquivo
            if not caminho.is_file():
                raise ErroDocumento(
                    f"Gráfico não encontrado: {arquivo}. Ele precisa estar em "
                    f"{SUBPASTA_GRAFICOS.as_posix()}/ do prospect (aprovado antes de gerar o PDF)."
                )
            try:
                with Image.open(caminho) as img:
                    img.verify()
            except Exception:
                raise ErroDocumento(f"O arquivo {arquivo} não abre como imagem.") from None
            observacao = grafico.get("observacao")
            if observacao is not None:
                if not isinstance(observacao, str):
                    raise ErroDocumento(f"A observação do gráfico {arquivo} precisa ser texto ou null.")
                _limpar(observacao)
                _checar_pii(observacao, f"A observação do gráfico {arquivo}")
            total_graficos += 1

    if total_graficos == 0:
        raise ErroDocumento("Nenhum gráfico informado: o documento precisa de pelo menos um gráfico.")

    limitacoes = dados.get("limitacoes")
    if limitacoes is not None:
        if not isinstance(limitacoes, dict):
            raise ErroDocumento("O campo limitacoes precisa ser null ou um objeto com titulo e itens.")
        _limpar(_texto_obrigatorio(limitacoes.get("titulo"), "titulo de limitacoes"))
        itens = limitacoes.get("itens")
        if not isinstance(itens, list):
            raise ErroDocumento("O campo limitacoes.itens precisa ser uma lista.")
        for k, item in enumerate(itens, start=1):
            if not isinstance(item, dict):
                raise ErroDocumento(f"O item {k} de limitacoes precisa ser um objeto com titulo e texto.")
            for campo in ("titulo", "texto"):
                valor = _texto_obrigatorio(item.get(campo), f"{campo} do item {k} de limitacoes")
                _limpar(valor)
                _checar_pii(valor, f"O item {k} de limitacoes")


# ---------- elementos do documento ----------

def _estilos() -> dict[str, ParagraphStyle]:
    base = dict(fontName="Helvetica", textColor=CINZA_TEXTO)
    return {
        "prospect": ParagraphStyle("prospect", fontName="Helvetica-Bold", fontSize=25, leading=29,
                                   textColor=AZUL_MARINHO),
        "periodo": ParagraphStyle("periodo", fontSize=10.5, leading=14, textColor=CINZA_SECUNDARIO,
                                  fontName="Helvetica"),
        "intro": ParagraphStyle("intro", fontSize=10, leading=16, **base),
        "secao": ParagraphStyle("secao", fontName="Helvetica-Bold", fontSize=15, leading=19,
                                textColor=AZUL_MARINHO),
        "observacao": ParagraphStyle("observacao", fontSize=9.6, leading=14.5, **base),
        "texto": ParagraphStyle("texto", fontSize=9.6, leading=15, **base),
        "item": ParagraphStyle("item", fontSize=9.6, leading=14.5, leftIndent=14, bulletIndent=3,
                               spaceAfter=5, **base),
        "fecha_titulo": ParagraphStyle("fecha_titulo", fontName="Helvetica-Bold", fontSize=13, leading=17,
                                       textColor=BRANCO, alignment=TA_CENTER),
        "fecha_texto": ParagraphStyle("fecha_texto", fontSize=10, leading=14.5, textColor=AZUL_CLARO_TEXTO,
                                      fontName="Helvetica", alignment=TA_CENTER),
    }


def _p(texto: str, estilo: ParagraphStyle, **kw) -> Paragraph:
    return Paragraph(escape(_limpar(texto)), estilo, **kw)


class CartaoGrafico(Flowable):
    """Cartão cinza-claro de borda arredondada com o PNG dentro, sempre na proporção original."""

    PAD = 9.0

    def __init__(self, caminho: Path, largura: float, altura_max: float = ALTURA_MAX_GRAFICO):
        super().__init__()
        self.caminho = Path(caminho)
        with Image.open(self.caminho) as img:
            self.px_largura, self.px_altura = img.size
        self.largura = largura
        self.altura_max = altura_max
        self._img_l = self._img_a = 0.0

    def wrap(self, avail_w: float, avail_h: float):
        largura = min(self.largura, avail_w)
        img_l = largura - 2 * self.PAD
        img_a = img_l * self.px_altura / self.px_largura
        limite = self.altura_max - 2 * self.PAD
        if img_a > limite:
            img_a = limite
            img_l = img_a * self.px_largura / self.px_altura
        self._img_l, self._img_a = img_l, img_a
        self.width, self.height = largura, img_a + 2 * self.PAD
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(CINZA_CARTAO)
        c.setStrokeColor(CINZA_BORDA)
        c.setLineWidth(0.8)
        c.roundRect(0, 0, self.width, self.height, 6, stroke=1, fill=1)
        x = (self.width - self._img_l) / 2
        c.drawImage(ImageReader(str(self.caminho)), x, self.PAD, self._img_l, self._img_a, mask="auto")


def _titulo_secao(titulo: str, estilos: dict) -> list:
    return [
        _p(titulo.upper(), estilos["secao"]),
        HRFlowable(width="100%", thickness=2, color=LARANJA, spaceBefore=4, spaceAfter=10),
    ]


def _caixa_observacao(texto: str, estilos: dict) -> Table:
    par = Paragraph(f"<b>Observação:</b> {escape(_limpar(texto))}", estilos["observacao"])
    t = Table([[par]], colWidths=[LARGURA_CONTEUDO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMARELO_CLARO),
        ("LINEBEFORE", (0, 0), (0, -1), 4, AMBAR),
        ("LEFTPADDING", (0, 0), (-1, -1), 17),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    return t


def _caixa_intro(estilos: dict) -> Table:
    t = Table([[Paragraph(escape(TEXTO_INTRO), estilos["intro"])]], colWidths=[LARGURA_CONTEUDO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CINZA_CAIXA),
        ("LINEBEFORE", (0, 0), (0, -1), 4, AZUL_MARINHO),
        ("LEFTPADDING", (0, 0), (-1, -1), 24),
        ("RIGHTPADDING", (0, 0), (-1, -1), 24),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    return t


def _bloco_fechamento(estilos: dict) -> Table:
    t = Table(
        [[Paragraph(escape(TITULO_FECHAMENTO), estilos["fecha_titulo"])],
         [Paragraph(escape(TEXTO_FECHAMENTO), estilos["fecha_texto"])]],
        colWidths=[LARGURA_CONTEUDO],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AZUL_MARINHO),
        ("LEFTPADDING", (0, 0), (-1, -1), 60),
        ("RIGHTPADDING", (0, 0), (-1, -1), 60),
        ("TOPPADDING", (0, 0), (-1, 0), 16),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 18),
    ]))
    return t


def _item_limitacao(item: dict, estilos: dict) -> Paragraph:
    titulo = escape(_limpar(item["titulo"]).strip())
    if not titulo.endswith((":", ".")):
        titulo += ":"
    return Paragraph(f"<b>{titulo}</b> {escape(_limpar(item['texto']))}", estilos["item"], bulletText="•")


def _montar_historia(dados: dict, pasta_prospect: Path) -> list:
    estilos = _estilos()
    pasta_graficos = Path(pasta_prospect) / SUBPASTA_GRAFICOS
    historia: list = [
        Spacer(1, ALTURA_FAIXA + ALTURA_FILETE_FAIXA - MARGEM_TOPO + 26),
        _p(dados["prospect"], estilos["prospect"]),
        Spacer(1, 3),
        _p(f"Período analisado: {dados['periodo']}", estilos["periodo"]),
        Spacer(1, 18),
        _caixa_intro(estilos),
        Spacer(1, 22),
    ]

    for secao in dados["secoes"]:
        graficos = secao["graficos"]
        if not graficos:
            continue
        for n, grafico in enumerate(graficos):
            bloco: list = []
            if n == 0:  # o título da seção nunca fica sozinho no fim da página
                bloco += _titulo_secao(secao["titulo"], estilos)
            bloco.append(CartaoGrafico(pasta_graficos / grafico["arquivo"], LARGURA_CONTEUDO))
            observacao = (grafico.get("observacao") or "").strip()
            if observacao:
                bloco += [Spacer(1, 8), _caixa_observacao(observacao, estilos)]
            historia.append(KeepTogether(bloco))
            historia.append(Spacer(1, 20))

    limitacoes = dados.get("limitacoes")
    if limitacoes and limitacoes.get("itens"):
        itens = [_item_limitacao(item, estilos) for item in limitacoes["itens"]]
        historia.append(KeepTogether(_titulo_secao(limitacoes["titulo"], estilos) + itens[:1]))
        historia.extend(itens[1:])
        historia.append(Spacer(1, 12))

    historia.append(KeepTogether([_bloco_fechamento(estilos)]))
    return historia


def _cabecalho_primeira_pagina(c, doc) -> None:
    """Faixa azul-marinho com o logo, o título do documento e o filete laranja (só na página 1)."""
    if doc.page != 1:
        return
    c.saveState()
    topo = ALTURA
    c.setFillColor(AZUL_MARINHO)
    c.rect(0, topo - ALTURA_FAIXA, LARGURA, ALTURA_FAIXA, stroke=0, fill=1)
    c.setFillColor(LARANJA)
    c.rect(0, topo - ALTURA_FAIXA - ALTURA_FILETE_FAIXA, LARGURA, ALTURA_FILETE_FAIXA, stroke=0, fill=1)
    logo_l = 150.0
    with Image.open(LOGO) as img:
        logo_a = logo_l * img.size[1] / img.size[0]
    c.drawImage(ImageReader(str(LOGO)), MARGEM_LATERAL, topo - 29 - logo_a, logo_l, logo_a, mask="auto")
    texto = c.beginText(MARGEM_LATERAL, topo - 90)
    texto.setFont("Helvetica-Bold", 9.5)
    texto.setCharSpace(2.6)
    texto.setFillColor(HexColor("#eef0f5"))
    texto.textOut("DOCUMENTO DE VALIDAÇÃO PRÉ-APRESENTAÇÃO")
    c.drawText(texto)
    c.restoreState()


class CanvasNumerado(rl_canvas.Canvas):
    """Canvas de duas passagens: só no fim se sabe o total de páginas para o rodapé."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._paginas_salvas: list[dict] = []

    def showPage(self):
        self._paginas_salvas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas_salvas)
        for estado in self._paginas_salvas:
            self.__dict__.update(estado)
            self._rodape(total)
            super().showPage()
        super().save()

    def _rodape(self, total: int) -> None:
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(CINZA_RODAPE)
        self.drawCentredString(LARGURA / 2, 30, f"{TEXTO_RODAPE} | Página {self._pageNumber} de {total}")
        self.restoreState()


def gerar(dados: dict, pasta_prospect: Path, saida: Path, _comprimir: bool = True) -> Path:
    """Valida e gera o PDF em `saida`. Em qualquer falha, nenhum arquivo é deixado.

    `_comprimir=False` só existe para os testes lerem o texto do PDF.
    """
    pasta_prospect = Path(pasta_prospect)
    saida = Path(saida)
    validar_entrada(dados, pasta_prospect)
    saida.parent.mkdir(parents=True, exist_ok=True)

    fd, nome_tmp = tempfile.mkstemp(prefix=".documento-validacao-", suffix=".pdf.tmp", dir=saida.parent)
    os.close(fd)
    tmp = Path(nome_tmp)
    try:
        doc = BaseDocTemplate(
            str(tmp),
            pagesize=A4,
            leftMargin=MARGEM_LATERAL, rightMargin=MARGEM_LATERAL,
            topMargin=MARGEM_TOPO, bottomMargin=MARGEM_BASE,
            title=f"Documento de validação - {dados['prospect']}",
            author="Boomer",
            pageCompression=1 if _comprimir else 0,
        )
        quadro = Frame(
            MARGEM_LATERAL, MARGEM_BASE, LARGURA_CONTEUDO, ALTURA - MARGEM_TOPO - MARGEM_BASE,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="conteudo",
        )
        doc.addPageTemplates([PageTemplate(id="unico", frames=[quadro], onPage=_cabecalho_primeira_pagina)])
        doc.build(_montar_historia(dados, pasta_prospect), canvasmaker=CanvasNumerado)
        umask = os.umask(0)
        os.umask(umask)
        os.chmod(tmp, 0o666 & ~umask)  # mkstemp cria com 0600; o app web precisa ler o arquivo final
        os.replace(tmp, saida)
    except ErroDocumento:
        raise
    except Exception as exc:
        raise ErroDocumento(f"Não foi possível montar o PDF: {exc}") from exc
    finally:
        if tmp.exists():
            tmp.unlink()
    return saida


# ---------- linha de comando ----------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gera o PDF do documento de validação do cliente.")
    parser.add_argument("--input", required=True, help="JSON com prospect, período, seções e limitações")
    parser.add_argument("--pasta-prospect", required=True, help="pasta do prospect (clientes/<slug>)")
    parser.add_argument("--output", required=True, help="caminho do PDF a gerar")
    args = parser.parse_args(argv)

    try:
        try:
            dados = json.loads(Path(args.input).read_text(encoding="utf-8"))
        except FileNotFoundError:
            raise ErroDocumento(f"Arquivo de entrada não encontrado: {args.input}") from None
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ErroDocumento(f"JSON de entrada inválido: {exc}") from None
        saida = gerar(dados, Path(args.pasta_prospect), Path(args.output))
    except ErroDocumento as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1
    print(f"PDF gerado: {saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
