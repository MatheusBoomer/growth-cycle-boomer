# Apresentação final .pptx — Entrega A (geração) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A etapa "Apresentação final" gera, a partir do que foi aprovado, um roteiro revisável e um `.pptx` editável no visual exato do deck de referência da agência.

**Architecture:** Um molde `.pptx` (um slide por tipo, campos marcados por texto alternativo, tipo marcado nas anotações do slide) é preparado uma vez a partir do deck original. O agente escreve `roteiro-apresentacao.json`; `scripts/gerar_apresentacao.py` valida o roteiro, duplica os slides-modelo, preenche textos e imagens e remove os modelos. O app ganha os entregáveis `roteiro` e `apresentacao`.

**Tech Stack:** Python 3.9 (`python-pptx` 1.0.2, Pillow, lxml via python-pptx, pytest); TypeScript (núcleo, MCP, Next 16/React 19, vitest).

**Spec:** `docs/superpowers/specs/2026-10-07-apresentacao-final-pptx-design.md` (seções 3 a 8; a Entrega B — prévia e comentários — terá plano próprio).

## Global Constraints

- Python 3.9: `from __future__ import annotations`, `typing` (`List`, `Dict`, `Optional`, `Tuple`); nada de `match`.
- Nenhuma dependência Python nova (só `python-pptx`, Pillow, stdlib).
- O deck original (`/Users/matheus/Downloads/Sottile Jalecos _ Diagnóstico + Estratégia de Mídia.pptx`) nunca entra no git; o molde versionado não pode conter texto nem imagem da Sottile (só o logo Boomer e textos de exemplo neutros).
- Imagens do roteiro: caminhos relativos à pasta do prospect, só `.png`/`.jpg`/`.jpeg`, sempre dentro dela.
- Mensagens ao analista em português do Brasil, sem travessão no meio de frase nos textos do app.
- Texto alternativo dos campos: `campo:<nome>`; tipo do slide-modelo: `tipo:<tipo>` nas anotações do slide.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Título/subtítulo sem `**` ou com `**` desbalanceado** (ex.: `"**ROAS Global vs"`): o texto sai inteiro, sem asteriscos visíveis; trecho aberto sem fechar fica normal. Teste na Task 2.
2. **Imagem muito larga ou muito alta para a área** (proporção oposta à do modelo): encaixa sem distorcer e centraliza. Teste na Task 2.
3. **Slide com `pendencia` no roteiro**: é pulado com aviso, nunca gera slide quebrado. Teste na Task 3.
4. **Roteiro com caminho de imagem que escapa da pasta (`../`) ou absoluto**: recusado com mensagem, nada é gerado. Teste na Task 3.
5. **Lista com mais itens do que o tipo aceita** (ex.: 5 conclusões em `grafico`): erro de validação apontando slide e campo, não slide estourado. Teste na Task 3.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/apresentacao_pptx.py` (novo) | Operações de baixo nível no `.pptx`: texto alternativo, tipo do slide, duplicar/remover slide, preencher texto/lista/bloco, trocar imagem, link, token, estimativa de estouro |
| `scripts/gerar_apresentacao.py` (novo) | Esquema dos tipos, validação do roteiro, montagem do deck, `mapa-slides.json`, CLI |
| `scripts/preparar_molde_apresentacao.py` (novo) | Uso único: deck original → molde neutro |
| `.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx` (novo) | Molde versionado |
| `.claude/skills/_shared/modelos-apresentacao/README.md` (novo) | Como editar o molde |
| `scripts/tests/test_apresentacao_pptx.py`, `test_gerar_apresentacao.py`, `test_molde_apresentacao.py` (novos) | Testes |
| `.claude/skills/09-apresentacao-final/SKILL.md`, `.claude/commands/apresentacao-final.md`, `.claude/skills/_shared/etapas.json`, `.claude/agents/designer-apresentacao.md`, `CLAUDE.md`, `.claude/skills/_shared/regras-de-validacao.md` | Processo |
| `src/packages/core/src/tipos.ts`, `entregaveis.ts`, `test/entregaveis.test.ts` | Tipos `roteiro` e `apresentacao` |
| `src/packages/mcp-planejamento/src/servidor.ts` | Enum de `propor_entregavel` |
| `src/apps/web/components/cards/card-entregavel.tsx`, `previa-arquivo.tsx`, `components/cards/previa-roteiro.tsx` (novo), `app/api/prospects/[slug]/arquivo/route.ts` | Card do roteiro e do `.pptx` |

## Esquema do roteiro (referência para todas as tasks)

Campos por tipo (`obrig.` = obrigatório; listas com mínimo–máximo):

| Tipo | Campos |
|---|---|
| `capa` | `prospect` (obrig.) |
| `jornada` | — |
| `divisoria` | `numero`, `titulo` |
| `grafico` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1–3) |
| `tabela_lateral` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1–3) |
| `imagem_larga` | `titulo`, `imagem`, `texto` |
| `analises_2_colunas` | `esquerda` e `direita`: `{ "titulo": str, "itens": [1–4] }` |
| `bullets` | `titulo`, `subtitulo`, `itens` (1–6) |
| `cartoes` | `titulo`, `subtitulo`, `cartoes` (3–3) |
| `benchmark` | `titulo`, `subtitulo`, `concorrente`, `imagens` (1–3), `conclusoes` (1–3), `link` |
| `obrigado` | — |

Opcionais em qualquer slide: `fonte` (str), `pendencia` (str: slide é pulado com aviso). Topo: `{ "versao": int, "prospect": str, "slides": [...] }`.

Campos do molde (texto alternativo) por tipo, e o modo de preenchimento:

| Tipo | Campo do molde ← valor do roteiro | Modo |
|---|---|---|
| `capa` | token `{{prospect}}` no texto | token |
| `divisoria` | `campo:numero` ← numero; `campo:titulo` ← titulo | texto |
| `grafico` / `tabela_lateral` | `campo:titulo`, `campo:subtitulo` (texto); `campo:conclusoes` (lista); `campo:imagem` | — |
| `imagem_larga` | `campo:titulo`, `campo:texto` (texto); `campo:imagem` | — |
| `analises_2_colunas` | `campo:esquerda`, `campo:direita` | bloco (título + itens) |
| `bullets` | `campo:titulo`, `campo:subtitulo`; `campo:itens` (lista) | — |
| `cartoes` | `campo:titulo`, `campo:subtitulo`; `campo:cartao_1..3` ← cartoes[i] (texto) | — |
| `benchmark` | `campo:titulo`, `campo:subtitulo`, `campo:concorrente` (texto); `campo:conclusoes` (lista); `campo:imagem_1..3` ← imagens[i]; `campo:link` (texto "Biblioteca de Anúncios" + hiperlink) | — |

---

### Task 1: Operações de baixo nível no `.pptx`

**Files:**
- Create: `scripts/apresentacao_pptx.py`
- Test: `scripts/tests/test_apresentacao_pptx.py`

**Interfaces:**
- Produces (em `apresentacao_pptx`): `texto_alternativo(shape) -> str`; `definir_texto_alternativo(shape, valor: str) -> None`; `campos(slide) -> Dict[str, shape]` (por `campo:<nome>`); `tipo_do_slide(slide) -> Optional[str]` (de `tipo:<x>` nas anotações); `marcar_tipo(slide, tipo: str) -> None`; `duplicar_slide(prs, modelo) -> slide`; `remover_slide(prs, slide) -> None`; `partes_negrito(texto: str) -> List[Tuple[str, bool]]`; `preencher_texto(shape, texto: str) -> None` (`\n` = novo parágrafo); `preencher_lista(shape, itens: List[str]) -> None`; `preencher_bloco(shape, titulo: str, itens: List[str]) -> None`; `trocar_imagem(slide, shape, caminho: Path) -> None`; `definir_link(shape, url: str) -> None`; `substituir_token(slide, token: str, valor: str) -> int`; `ocupacao(shape) -> float` (linhas estimadas / capacidade; > 1 = estoura); `caixa_percentual(prs, shape) -> Dict[str, float]` (`x`,`y`,`w`,`h` em %).

- [ ] **Step 1: Testes que falham — `scripts/tests/test_apresentacao_pptx.py`**

```python
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402


def png(caminho: Path, w: int, h: int, cor=(200, 30, 30)) -> Path:
    Image.new("RGB", (w, h), cor).save(caminho)
    return caminho


def caixa_texto(slide, campo, paragrafos, x=0.5, y=0.5, w=4.0, h=1.0, tamanho=16):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    for i, (texto, negrito) in enumerate(paragrafos):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if texto:
            r = p.add_run()
            r.text = texto
            r.font.size = Pt(tamanho)
            r.font.bold = negrito
            r.font.name = "Montserrat"
    ap.definir_texto_alternativo(tb, f"campo:{campo}")
    return tb


@pytest.fixture()
def deck(tmp_path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(10), Inches(5.625)
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    ap.marcar_tipo(slide, "grafico")
    caixa_texto(slide, "titulo", [("Título", True)])
    caixa_texto(slide, "conclusoes", [("Item modelo", False), ("", False), ("Outro", False)], y=2)
    pic = slide.shapes.add_picture(str(png(tmp_path / "m.png", 400, 200)), Inches(0.5), Inches(3), Inches(4), Inches(2))
    ap.definir_texto_alternativo(pic, "campo:imagem")
    return prs, slide, tmp_path


def test_texto_alternativo_e_campos(deck):
    prs, slide, _ = deck
    assert set(ap.campos(slide)) == {"titulo", "conclusoes", "imagem"}
    assert ap.texto_alternativo(ap.campos(slide)["imagem"]) == "campo:imagem"


def test_tipo_nas_anotacoes(deck):
    _, slide, _ = deck
    assert ap.tipo_do_slide(slide) == "grafico"


def test_partes_negrito():
    assert ap.partes_negrito("**Investimento total** em mídia") == [("Investimento total", True), (" em mídia", False)]
    assert ap.partes_negrito("sem marca") == [("sem marca", False)]
    assert ap.partes_negrito("**aberto sem fechar") == [("aberto sem fechar", False)]
    assert ap.partes_negrito("CENÁRIOS E IMPACTOS **ESPERADOS**") == [("CENÁRIOS E IMPACTOS ", False), ("ESPERADOS", True)]


def test_preencher_texto_mantem_fonte_e_aplica_negrito(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["titulo"]
    ap.preencher_texto(shape, "**ROAS** por plataforma")
    runs = shape.text_frame.paragraphs[0].runs
    assert [(r.text, r.font.bold) for r in runs] == [("ROAS", True), (" por plataforma", False)]
    assert all(r.font.size == Pt(16) and r.font.name == "Montserrat" for r in runs)
    assert "*" not in shape.text_frame.text


def test_preencher_texto_com_quebra_vira_paragrafos(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["titulo"]
    ap.preencher_texto(shape, "Linha 1\nLinha **2**")
    assert [p.text for p in shape.text_frame.paragraphs] == ["Linha 1", "Linha 2"]


def test_preencher_lista_usa_espacador_do_modelo(deck):
    _, slide, _ = deck
    shape = ap.campos(slide)["conclusoes"]
    ap.preencher_lista(shape, ["A", "B", "C"])
    assert [p.text for p in shape.text_frame.paragraphs] == ["A", "", "B", "", "C"]


def test_preencher_bloco(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    caixa_texto(slide, "esquerda", [("Análises sobre o **x**", False), ("", False), ("item", False)])
    shape = ap.campos(slide)["esquerda"]
    ap.preencher_bloco(shape, "Análises sobre o **investimento**", ["um", "dois"])
    assert [p.text for p in shape.text_frame.paragraphs] == ["Análises sobre o investimento", "", "um", "", "dois"]


@pytest.mark.parametrize("w,h", [(1600, 200), (200, 1600)])
def test_trocar_imagem_encaixa_sem_distorcer(deck, w, h):
    prs, slide, tmp = deck
    shape = ap.campos(slide)["imagem"]
    caixa = (shape.left, shape.top, shape.width, shape.height)
    ap.trocar_imagem(slide, shape, png(tmp / f"n{w}.png", w, h, (10, 10, 200)))
    assert abs(shape.width / shape.height - w / h) < 0.02
    assert shape.width <= caixa[2] + 1 and shape.height <= caixa[3] + 1
    assert abs((shape.left + shape.width / 2) - (caixa[0] + caixa[2] / 2)) < 2
    assert abs((shape.top + shape.height / 2) - (caixa[1] + caixa[3] / 2)) < 2


def test_duplicar_e_remover_slide(deck):
    prs, modelo, tmp = deck
    novo = ap.duplicar_slide(prs, modelo)
    assert set(ap.campos(novo)) == {"titulo", "conclusoes", "imagem"}
    assert ap.tipo_do_slide(novo) is None
    ap.preencher_texto(ap.campos(novo)["titulo"], "Novo")
    assert ap.campos(modelo)["titulo"].text_frame.text == "Título"
    ap.remover_slide(prs, modelo)
    assert len(prs.slides) == 1
    saida = tmp / "s.pptx"
    prs.save(saida)
    reaberto = Presentation(saida)
    assert ap.campos(reaberto.slides[0])["titulo"].text_frame.text == "Novo"


def test_imagem_do_slide_duplicado_e_trocada_sem_afetar_o_modelo(deck):
    prs, modelo, tmp = deck
    novo = ap.duplicar_slide(prs, modelo)
    ap.trocar_imagem(novo, ap.campos(novo)["imagem"], png(tmp / "outra.png", 300, 300, (0, 200, 0)))
    blob_modelo = ap.campos(modelo)["imagem"].image.blob
    blob_novo = ap.campos(novo)["imagem"].image.blob
    assert blob_modelo != blob_novo


def test_link_e_token(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    caixa_texto(slide, "link", [("Biblioteca de Anúncios", False)])
    caixa_texto(slide, "capa", [("PLANEJAMENTO", True), ("{{prospect}}", False)], y=2)
    ap.definir_link(ap.campos(slide)["link"], "https://www.facebook.com/ads/library/?view_all_page_id=1")
    assert ap.campos(slide)["link"].text_frame.paragraphs[0].runs[0].hyperlink.address.endswith("view_all_page_id=1")
    assert ap.substituir_token(slide, "{{prospect}}", "Sottile Jalecos") == 1
    assert "Sottile Jalecos" in ap.campos(slide)["capa"].text_frame.text


def test_ocupacao_estima_estouro(tmp_path):
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    curta = caixa_texto(slide, "a", [("curto", False)], w=4, h=1, tamanho=12)
    longa = caixa_texto(slide, "b", [("x" * 600, False)], w=2, h=0.5, tamanho=12)
    assert ap.ocupacao(curta) < 1.0
    assert ap.ocupacao(longa) > 1.0


def test_caixa_percentual(deck):
    prs, slide, _ = deck
    c = ap.caixa_percentual(prs, ap.campos(slide)["imagem"])
    assert c == {"x": 5.0, "y": pytest.approx(53.33, 0.01), "w": 40.0, "h": pytest.approx(35.56, 0.01)}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_apresentacao_pptx.py -q -p no:warnings`
Expected: FAIL com `ModuleNotFoundError: No module named 'apresentacao_pptx'`.

- [ ] **Step 3: Implementar `scripts/apresentacao_pptx.py`**

```python
#!/usr/bin/env python3
"""
scripts/apresentacao_pptx.py: operações de baixo nível sobre o molde da
apresentação final (python-pptx). Campos são marcados pelo texto alternativo
"campo:<nome>" (editável no Google Slides); o tipo do slide-modelo fica nas
anotações ("tipo:<tipo>"). Usado por gerar_apresentacao.py e
preparar_molde_apresentacao.py.
"""

from __future__ import annotations

import copy
import math
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image
from pptx.oxml.ns import qn

NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
TAGS_FORMA = {qn("p:sp"), qn("p:pic"), qn("p:graphicFrame"), qn("p:grpSp"), qn("p:cxnSp")}


def _cnvpr(shape):
    return shape._element.find(".//" + qn("p:cNvPr"))


def texto_alternativo(shape) -> str:
    el = _cnvpr(shape)
    return (el.get("descr") or "") if el is not None else ""


def definir_texto_alternativo(shape, valor: str) -> None:
    _cnvpr(shape).set("descr", valor)


def campos(slide) -> Dict[str, object]:
    resultado: Dict[str, object] = {}
    for shape in slide.shapes:
        m = re.match(r"^campo:([\w-]+)$", texto_alternativo(shape).strip())
        if m:
            resultado[m.group(1)] = shape
    return resultado


def tipo_do_slide(slide) -> Optional[str]:
    if not slide.has_notes_slide:
        return None
    m = re.search(r"tipo:([\w-]+)", slide.notes_slide.notes_text_frame.text)
    return m.group(1) if m else None


def marcar_tipo(slide, tipo: str) -> None:
    slide.notes_slide.notes_text_frame.text = f"tipo:{tipo}"


def duplicar_slide(prs, modelo):
    """Cópia do slide (formas, imagens e links), no fim do deck, sem as anotações."""
    novo = prs.slides.add_slide(modelo.slide_layout)
    arvore = novo.shapes._spTree
    for el in list(arvore):
        if el.tag in TAGS_FORMA:
            arvore.remove(el)
    mapa: Dict[str, str] = {}
    for rid, rel in modelo.part.rels.items():
        if rel.reltype.endswith("/notesSlide") or rel.reltype.endswith("/slideLayout"):
            continue
        if rel.is_external:
            mapa[rid] = novo.part.rels.get_or_add_ext_rel(rel.reltype, rel.target_ref)
        else:
            mapa[rid] = novo.part.rels.get_or_add(rel.reltype, rel.target_part)
    for el in modelo.shapes._spTree:
        if el.tag not in TAGS_FORMA:
            continue
        copia = copy.deepcopy(el)
        for no in copia.iter():
            for attr, valor in list(no.attrib.items()):
                if attr.startswith(NS_REL) and valor in mapa:
                    no.set(attr, mapa[valor])
        arvore.append(copia)
    return novo


def remover_slide(prs, slide) -> None:
    lista = prs.slides._sldIdLst
    for sld in list(lista):
        if prs.part.related_part(sld.rId) is slide.part:
            prs.part.drop_rel(sld.rId)
            lista.remove(sld)
            return
    raise ValueError("slide não pertence à apresentação")


def partes_negrito(texto: str) -> List[Tuple[str, bool]]:
    """'**a** b' -> [('a', True), (' b', False)]. '**' sem par fica como texto normal, sem asteriscos."""
    pedacos = texto.split("**")
    if len(pedacos) % 2 == 0:  # ímpar de '**': o último trecho aberto vira normal
        pedacos = pedacos[:-2] + [pedacos[-2] + pedacos[-1]]
    partes = [(p, i % 2 == 1) for i, p in enumerate(pedacos) if p]
    return partes or [("", False)]


def _paragrafos(shape):
    return shape.text_frame._txBody.findall(qn("a:p"))


def _tem_texto(p) -> bool:
    return any((t.text or "").strip() for t in p.iter(qn("a:t")))


def _paragrafo(modelo, texto: str):
    p = copy.deepcopy(modelo)
    run_modelo = p.find(qn("a:r"))
    rpr = copy.deepcopy(run_modelo.find(qn("a:rPr"))) if run_modelo is not None and run_modelo.find(qn("a:rPr")) is not None else None
    for filho in list(p):
        if filho.tag in (qn("a:r"), qn("a:br"), qn("a:fld")):
            p.remove(filho)
    fim = p.find(qn("a:endParaRPr"))
    for trecho, negrito in partes_negrito(texto) if texto else []:
        r = p.makeelement(qn("a:r"), {})
        novo_rpr = copy.deepcopy(rpr) if rpr is not None else r.makeelement(qn("a:rPr"), {"lang": "pt-BR"})
        novo_rpr.set("b", "1" if negrito else "0")
        r.append(novo_rpr)
        t = r.makeelement(qn("a:t"), {})
        t.text = trecho
        r.append(t)
        if fim is not None:
            fim.addprevious(r)
        else:
            p.append(r)
    return p


def _substituir_paragrafos(shape, novos) -> None:
    corpo = shape.text_frame._txBody
    for p in _paragrafos(shape):
        corpo.remove(p)
    for p in novos:
        corpo.append(p)


def _modelos(shape):
    """(modelo de texto, espaçador vazio logo depois ou None, segundo modelo de texto ou None)."""
    ps = _paragrafos(shape)
    com_texto = [i for i, p in enumerate(ps) if _tem_texto(p)]
    i0 = com_texto[0] if com_texto else 0
    espacador = ps[i0 + 1] if i0 + 1 < len(ps) and not _tem_texto(ps[i0 + 1]) else None
    segundo = ps[com_texto[1]] if len(com_texto) > 1 else None
    return ps[i0], espacador, segundo


def preencher_texto(shape, texto: str) -> None:
    modelo, _, _ = _modelos(shape)
    _substituir_paragrafos(shape, [_paragrafo(modelo, linha) for linha in texto.split("\n")])


def preencher_lista(shape, itens: List[str]) -> None:
    modelo, espacador, _ = _modelos(shape)
    novos = []
    for i, item in enumerate(itens):
        if i and espacador is not None:
            novos.append(copy.deepcopy(espacador))
        novos.append(_paragrafo(modelo, item))
    _substituir_paragrafos(shape, novos)


def preencher_bloco(shape, titulo: str, itens: List[str]) -> None:
    modelo_titulo, espacador, modelo_item = _modelos(shape)
    modelo_item = modelo_item if modelo_item is not None else modelo_titulo
    novos = [_paragrafo(modelo_titulo, titulo)]
    for item in itens:
        if espacador is not None:
            novos.append(copy.deepcopy(espacador))
        novos.append(_paragrafo(modelo_item, item))
    _substituir_paragrafos(shape, novos)


def trocar_imagem(slide, shape, caminho: Path) -> None:
    """Troca a imagem mantendo a proporção da nova, centralizada na área original."""
    _, rid = slide.part.get_or_add_image_part(str(caminho))
    blip_fill = shape._element.find(qn("p:blipFill"))
    blip_fill.find(qn("a:blip")).set(qn("r:embed"), rid)
    recorte = blip_fill.find(qn("a:srcRect"))
    if recorte is not None:
        blip_fill.remove(recorte)
    with Image.open(caminho) as img:
        largura, altura = img.size
    x, y, w, h = shape.left, shape.top, shape.width, shape.height
    escala = min(w / largura, h / altura)
    nw, nh = int(largura * escala), int(altura * escala)
    shape.left, shape.top, shape.width, shape.height = x + (w - nw) // 2, y + (h - nh) // 2, nw, nh


def definir_link(shape, url: str) -> None:
    for p in shape.text_frame.paragraphs:
        for r in p.runs:
            r.hyperlink.address = url


def substituir_token(slide, token: str, valor: str) -> int:
    trocas = 0
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for t in shape.text_frame._txBody.iter(qn("a:t")):
            if t.text and token in t.text:
                t.text = t.text.replace(token, valor)
                trocas += 1
    return trocas


def _tamanho_pt(shape) -> float:
    for rpr in shape.text_frame._txBody.iter(qn("a:rPr")):
        if rpr.get("sz"):
            return int(rpr.get("sz")) / 100
    return 14.0


def ocupacao(shape) -> float:
    """Linhas estimadas / linhas que cabem. Aproximação (largura média de caractere ≈ 0,5 × tamanho)."""
    tamanho = _tamanho_pt(shape)
    largura_pt, altura_pt = shape.width / 12700, shape.height / 12700
    por_linha = max(1, int(largura_pt / (0.5 * tamanho)))
    linhas = sum(max(1, math.ceil(len(p.text) / por_linha)) for p in shape.text_frame.paragraphs)
    capacidade = max(1, int(altura_pt / (1.2 * tamanho)))
    return linhas / capacidade


def caixa_percentual(prs, shape) -> Dict[str, float]:
    W, H = prs.slide_width, prs.slide_height
    return {
        "x": round(shape.left / W * 100, 2),
        "y": round(shape.top / H * 100, 2),
        "w": round(shape.width / W * 100, 2),
        "h": round(shape.height / H * 100, 2),
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_apresentacao_pptx.py -q -p no:warnings`
Expected: todos PASS. Se `get_or_add_ext_rel`/`get_or_add` ou `sld.rId` tiverem outro nome na versão instalada (1.0.2), ajustar ao nome real (conferir com `python3 -c "import pptx.opc.package as m; help(m._Relationships)"`) e registrar a decisão.

- [ ] **Step 5: Commit**

```bash
git add scripts/apresentacao_pptx.py scripts/tests/test_apresentacao_pptx.py
git commit -m "feat(apresentacao): operações de baixo nível no pptx (campos, duplicar, preencher, imagem)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Molde a partir do deck original

**Files:**
- Create: `scripts/preparar_molde_apresentacao.py`
- Create: `.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx` (gerado)
- Create: `.claude/skills/_shared/modelos-apresentacao/README.md`
- Test: `scripts/tests/test_molde_apresentacao.py`

**Interfaces:**
- Consumes: `apresentacao_pptx` (Task 1).
- Produces: molde com 11 slides, um por tipo (`tipo_do_slide` = capa, jornada, divisoria, grafico, tabela_lateral, imagem_larga, analises_2_colunas, bullets, cartoes, benchmark, obrigado) e os campos da tabela "Campos do molde"; constante `CAMINHO_MOLDE` em `gerar_apresentacao.py` (Task 3) aponta para ele.

- [ ] **Step 1: Teste que falha — `scripts/tests/test_molde_apresentacao.py`**

```python
from __future__ import annotations

import sys
from pathlib import Path

from pptx import Presentation

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402

MOLDE = RAIZ / ".claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx"
ESPERADO = {
    "capa": set(),
    "jornada": set(),
    "divisoria": {"numero", "titulo"},
    "grafico": {"titulo", "subtitulo", "conclusoes", "imagem"},
    "tabela_lateral": {"titulo", "subtitulo", "conclusoes", "imagem"},
    "imagem_larga": {"titulo", "texto", "imagem"},
    "analises_2_colunas": {"esquerda", "direita"},
    "bullets": {"titulo", "subtitulo", "itens"},
    "cartoes": {"titulo", "subtitulo", "cartao_1", "cartao_2", "cartao_3"},
    "benchmark": {"titulo", "subtitulo", "concorrente", "conclusoes", "imagem_1", "imagem_2", "imagem_3", "link"},
    "obrigado": set(),
}


def test_molde_tem_um_slide_por_tipo_com_os_campos():
    prs = Presentation(MOLDE)
    tipos = {ap.tipo_do_slide(s): s for s in prs.slides}
    assert set(tipos) == set(ESPERADO)
    assert len(prs.slides) == len(ESPERADO)
    for tipo, slide in tipos.items():
        assert set(ap.campos(slide)) == ESPERADO[tipo], tipo


def test_capa_tem_token_do_prospect():
    prs = Presentation(MOLDE)
    capa = next(s for s in prs.slides if ap.tipo_do_slide(s) == "capa")
    assert any("{{prospect}}" in sh.text_frame.text for sh in capa.shapes if sh.has_text_frame)


def test_molde_nao_tem_conteudo_do_prospect_de_referencia():
    prs = Presentation(MOLDE)
    texto = " ".join(sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame).lower()
    for proibido in ("sottile", "baunni", "scrub", "4.858", "smooth"):
        assert proibido not in texto, proibido
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_molde_apresentacao.py -q -p no:warnings`
Expected: FAIL (arquivo do molde não existe).

- [ ] **Step 3: Implementar `scripts/preparar_molde_apresentacao.py`**

Os identificadores de forma vêm do inventário do deck original (página → `shape_id` → campo):

```python
#!/usr/bin/env python3
"""
scripts/preparar_molde_apresentacao.py: uso único. Transforma o deck de
referência da agência (exportado do Google Slides como .pptx) no molde da
apresentação final: um slide por tipo, campos marcados por texto alternativo,
tipo nas anotações, conteúdo do prospect trocado por textos de exemplo e
imagens por um retângulo neutro. O deck original nunca vai para o git.

    python3 scripts/preparar_molde_apresentacao.py --original <deck.pptx> --saida .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path
from typing import Dict, List

from PIL import Image
from pptx import Presentation
from pptx.oxml.ns import qn

import apresentacao_pptx as ap

# página do deck original (1-based) -> tipo; a ordem aqui é a ordem dos slides no molde
MODELOS: Dict[int, str] = {
    1: "capa", 2: "jornada", 3: "divisoria", 4: "grafico", 18: "tabela_lateral", 55: "imagem_larga",
    7: "analises_2_colunas", 27: "bullets", 26: "cartoes", 33: "benchmark", 61: "obrigado",
}

# (página, shape_id) -> campo
CAMPOS: Dict[tuple, str] = {
    (3, 78): "titulo", (3, 80): "numero",
    (4, 85): "titulo", (4, 88): "subtitulo", (4, 87): "conclusoes", (4, 89): "imagem",
    (18, 211): "titulo", (18, 212): "subtitulo", (18, 214): "conclusoes", (18, 213): "imagem",
    (55, 536): "titulo", (55, 537): "texto", (55, 538): "imagem",
    (7, 114): "esquerda", (7, 112): "direita",
    (27, 292): "titulo", (27, 293): "subtitulo", (27, 290): "itens",
    (26, 281): "titulo", (26, 282): "subtitulo", (26, 283): "cartao_1", (26, 284): "cartao_2", (26, 285): "cartao_3",
    (33, 338): "titulo", (33, 339): "subtitulo", (33, 340): "concorrente", (33, 341): "conclusoes",
    (33, 342): "link", (33, 343): "imagem_1", (33, 344): "imagem_2", (33, 345): "imagem_3",
}

EXEMPLOS_TEXTO: Dict[str, str] = {
    "titulo": "Título da seção",
    "subtitulo": "**Destaque** do subtítulo",
    "numero": "01.",
    "texto": "Texto explicativo do slide.",
    "concorrente": "Concorrente",
    "link": "Biblioteca de Anúncios",
    "cartao_1": "Pilar 1",
    "cartao_2": "Pilar 2",
    "cartao_3": "Pilar 3",
}
EXEMPLOS_LISTA: Dict[str, List[str]] = {
    "conclusoes": ["Conclusão 1", "Conclusão 2"],
    "itens": ["Item 1", "Item 2", "Item 3"],
}


def _neutra(pasta: Path, largura: int, altura: int) -> Path:
    caminho = pasta / f"neutra-{largura}x{altura}.png"
    Image.new("RGB", (max(largura, 1), max(altura, 1)), (225, 228, 235)).save(caminho)
    return caminho


def preparar(original: Path, saida: Path) -> None:
    prs = Presentation(original)
    slides = list(prs.slides)
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        modelos = []
        for pagina, tipo in MODELOS.items():
            slide = slides[pagina - 1]
            ap.marcar_tipo(slide, tipo)
            for shape in slide.shapes:
                campo = CAMPOS.get((pagina, shape.shape_id))
                if campo is None:
                    continue
                ap.definir_texto_alternativo(shape, f"campo:{campo}")
                if campo.startswith("imagem"):
                    proporcao = shape.width / shape.height
                    ap.trocar_imagem(slide, shape, _neutra(pasta, int(400 * proporcao), 400))
                elif campo in EXEMPLOS_LISTA:
                    ap.preencher_lista(shape, EXEMPLOS_LISTA[campo])
                elif campo in ("esquerda", "direita"):
                    ap.preencher_bloco(shape, "Análises sobre o **tema**", ["Análise 1", "Análise 2"])
                else:
                    ap.preencher_texto(shape, EXEMPLOS_TEXTO[campo])
            if tipo == "capa":
                # Só o nome do prospect (2º parágrafo) vira token: o título mistura fontes e fica intacto.
                for shape in slide.shapes:
                    if shape.has_text_frame and len(shape.text_frame.paragraphs) > 1:
                        textos = list(shape.text_frame.paragraphs[1]._p.iter(qn("a:t")))
                        if textos:
                            textos[0].text = "{{prospect}}"
                            for t in textos[1:]:
                                t.text = ""
            modelos.append(slide)
        for slide in slides:
            if slide not in modelos:
                ap.remover_slide(prs, slide)
        # reordena na ordem de MODELOS
        lista = prs.slides._sldIdLst
        ids = {prs.part.related_part(s.rId): s for s in lista}
        for slide in modelos:
            el = ids[slide.part]
            lista.remove(el)
            lista.append(el)
        saida.parent.mkdir(parents=True, exist_ok=True)
        prs.save(saida)


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--original", required=True, type=Path)
    p.add_argument("--saida", required=True, type=Path)
    a = p.parse_args(argv)
    preparar(a.original, a.saida)
    print(f"Molde salvo em {a.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Observação para quem implementa: na capa, "PLANEJAMENTO" e "ESTRATÉGICO" usam fontes diferentes (Montserrat Black e Montserrat), por isso o script troca só o texto do 2º parágrafo pelo token, sem reescrever o título.

- [ ] **Step 4: Gerar o molde e rodar o teste**

Run:
```bash
cd scripts && python3 preparar_molde_apresentacao.py --original "/Users/matheus/Downloads/Sottile Jalecos _ Diagnóstico + Estratégia de Mídia.pptx" --saida ../.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx && cd .. && python3 -m pytest scripts/tests/test_molde_apresentacao.py -q -p no:warnings
```
Expected: "Molde salvo em …" e 3 PASS. Se `test_molde_nao_tem_conteudo_do_prospect_de_referencia` falhar, achar a forma com o texto proibido (`python3 -c` listando textos por slide) e incluí-la em `CAMPOS` ou neutralizá-la no script — nunca relaxar o teste.

- [ ] **Step 5: Conferir que o molde não carrega imagens do deck original**

Run: `python3 -c "import zipfile;z=zipfile.ZipFile('.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx');m=[n for n in z.namelist() if n.startswith('ppt/media/')];print(len(m), m[:20])"`
Expected: só o logo (repetido ou não), os fundos do mestre/layout e as imagens neutras; tamanho total do arquivo abaixo de ~3 MB. Abrir 2–3 imagens de `ppt/media` com Read para confirmar que não há gráfico ou criativo da Sottile.

- [ ] **Step 6: README do molde — `.claude/skills/_shared/modelos-apresentacao/README.md`**

```markdown
# Molde da apresentação final

`molde-apresentacao.pptx` tem um slide-modelo por tipo (ver
`docs/superpowers/specs/2026-10-07-apresentacao-final-pptx-design.md`, seção 3).
O script `scripts/gerar_apresentacao.py` duplica esses modelos na ordem do
roteiro e preenche os campos.

- **Campos:** cada caixa de texto ou imagem preenchida tem texto alternativo
  `campo:<nome>` (no Google Slides: botão direito → Texto alternativo).
- **Tipo do slide-modelo:** nas anotações do apresentador, `tipo:<tipo>`.
- **Capa:** o nome do prospect entra no lugar de `{{prospect}}`.

Para mudar o visual: abrir no Google Slides, editar mantendo os textos
alternativos e as anotações, exportar como .pptx por cima deste arquivo e
rodar `python3 -m pytest scripts/tests/test_molde_apresentacao.py`.
```

- [ ] **Step 7: Commit**

```bash
git add scripts/preparar_molde_apresentacao.py scripts/tests/test_molde_apresentacao.py .claude/skills/_shared/modelos-apresentacao
git commit -m "feat(apresentacao): molde com um slide por tipo, preparado a partir do deck da agência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `gerar_apresentacao.py` (validação, montagem, mapa)

**Files:**
- Create: `scripts/gerar_apresentacao.py`
- Test: `scripts/tests/test_gerar_apresentacao.py`

**Interfaces:**
- Consumes: `apresentacao_pptx` (Task 1); molde real (Task 2).
- Produces: `ESQUEMA: Dict[str, Dict[str, tuple]]`; `class ErroRoteiro(Exception)`; `validar_roteiro(roteiro: dict, pasta_prospect: Path, tipos_do_molde: set) -> Tuple[List[str], List[str]]` (erros, avisos); `gerar(roteiro: dict, pasta_prospect: Path, saida: Path, molde: Path = CAMINHO_MOLDE) -> dict` (`{"slides": int, "avisos": [...], "mapa": Path}`, levanta `ErroRoteiro`); CLI `--roteiro --prospect --output [--molde]`; `mapa-slides.json` ao lado do `.pptx`: `{"slides": [{"numero": int, "tipo": str, "roteiro": int, "campos": {nome: {"x","y","w","h"}}}]}`.

- [ ] **Step 1: Testes que falham — `scripts/tests/test_gerar_apresentacao.py`**

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from PIL import Image
from pptx import Presentation

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import apresentacao_pptx as ap  # noqa: E402
import gerar_apresentacao as ga  # noqa: E402


@pytest.fixture()
def prospect(tmp_path):
    pasta = tmp_path / "clientes" / "teste"
    (pasta / "entrega/ativos-aprovados/graficos").mkdir(parents=True)
    (pasta / "dados/benchmark-meta/x/midia/1").mkdir(parents=True)
    Image.new("RGB", (1200, 600), (20, 60, 200)).save(pasta / "entrega/ativos-aprovados/graficos/roas.png")
    Image.new("RGB", (400, 700), (200, 60, 20)).save(pasta / "dados/benchmark-meta/x/midia/1/imagem-1.jpg")
    return pasta


def roteiro_basico():
    return {
        "versao": 1,
        "prospect": "Marca Teste",
        "slides": [
            {"tipo": "capa", "prospect": "Marca Teste"},
            {"tipo": "jornada"},
            {"tipo": "divisoria", "numero": "01.", "titulo": "CENÁRIO **ATUAL**"},
            {
                "tipo": "grafico",
                "titulo": "Cenário Atual",
                "subtitulo": "**ROAS Global** vs ROAS por plataforma",
                "imagem": "entrega/ativos-aprovados/graficos/roas.png",
                "conclusoes": ["Média de 12,0x", "Correlação negativa com investimento"],
                "fonte": "secoes/03-macro-financeiro.md",
            },
            {
                "tipo": "benchmark",
                "titulo": "Benchmarking",
                "subtitulo": "Qual a jornada de compra anunciada pela concorrência?",
                "concorrente": "Concorrente X",
                "imagens": ["dados/benchmark-meta/x/midia/1/imagem-1.jpg"],
                "conclusoes": ["Usa muito UGC"],
                "link": "https://www.facebook.com/ads/library/?view_all_page_id=1",
            },
            {"tipo": "obrigado"},
        ],
    }


def tipos_molde():
    return {ap.tipo_do_slide(s) for s in Presentation(ga.CAMINHO_MOLDE).slides}


def test_roteiro_valido_nao_tem_erros(prospect):
    erros, _ = ga.validar_roteiro(roteiro_basico(), prospect, tipos_molde())
    assert erros == []


@pytest.mark.parametrize(
    "alteracao,trecho",
    [
        (lambda r: r["slides"].append({"tipo": "inexistente"}), "tipo"),
        (lambda r: r["slides"][3].pop("titulo"), "titulo"),
        (lambda r: r["slides"][3].update(conclusoes=["a", "b", "c", "d", "e"]), "conclusoes"),
        (lambda r: r["slides"][3].update(imagem="../../fora.png"), "fora da pasta"),
        (lambda r: r["slides"][3].update(imagem="/etc/passwd"), "fora da pasta"),
        (lambda r: r["slides"][3].update(imagem="entrega/nao-existe.png"), "não encontrada"),
        (lambda r: r["slides"][3].update(imagem="secoes/x.md"), "png"),
        (lambda r: r["slides"][4].update(link="ftp://x"), "link"),
    ],
)
def test_erros_de_validacao_apontam_slide_e_campo(prospect, alteracao, trecho):
    roteiro = roteiro_basico()
    alteracao(roteiro)
    erros, _ = ga.validar_roteiro(roteiro, prospect, tipos_molde())
    assert erros and any(trecho in e for e in erros), erros
    assert all(e.startswith("Slide ") for e in erros)


def test_gerar_monta_deck_na_ordem_sem_modelos(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    r = ga.gerar(roteiro_basico(), prospect, saida)
    prs = Presentation(saida)
    assert r["slides"] == len(prs.slides) == 6
    assert all(ap.tipo_do_slide(s) is None for s in prs.slides)
    textos = [" ".join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame) for s in prs.slides]
    assert "Marca Teste" in textos[0] and "{{prospect}}" not in textos[0]
    assert "CENÁRIO ATUAL" in textos[2]
    assert "Média de 12,0x" in textos[3] and "Correlação negativa" in textos[3]
    assert "Concorrente X" in textos[4]
    c = ap.campos(prs.slides[4])
    assert c["link"].text_frame.paragraphs[0].runs[0].hyperlink.address.endswith("view_all_page_id=1")


def test_benchmark_com_menos_imagens_remove_as_areas_sobrando(prospect, tmp_path):
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro_basico(), prospect, saida)
    c = ap.campos(Presentation(saida).slides[4])
    assert "imagem_1" in c and "imagem_2" not in c and "imagem_3" not in c


def test_slide_com_pendencia_e_pulado_com_aviso(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(4, {"tipo": "grafico", "pendencia": "Gráfico de CAC não foi aprovado na etapa 04"})
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert r["slides"] == 6
    assert any("pulado" in a and "CAC" in a for a in r["avisos"])


def test_aviso_de_texto_que_estoura(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"][3]["conclusoes"] = ["x" * 400, "y" * 400, "z" * 400]
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("Slide 4" in a and "conclusoes" in a for a in r["avisos"])


def test_mapa_de_slides(prospect, tmp_path):
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    mapa = json.loads(Path(r["mapa"]).read_text(encoding="utf-8"))
    s4 = mapa["slides"][3]
    assert s4["numero"] == 4 and s4["tipo"] == "grafico" and s4["roteiro"] == 3
    assert set(s4["campos"]) >= {"titulo", "conclusoes", "imagem"}
    assert all(set(v) == {"x", "y", "w", "h"} for v in s4["campos"].values())


def test_roteiro_invalido_nao_gera_arquivo(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].append({"tipo": "inexistente"})
    with pytest.raises(ga.ErroRoteiro):
        ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert not (tmp_path / "deck.pptx").exists()


def test_cli_erro_em_portugues(prospect, tmp_path, capsys):
    caminho = tmp_path / "roteiro.json"
    caminho.write_text("{ não é json", encoding="utf-8")
    codigo = ga.main(["--roteiro", str(caminho), "--prospect", str(prospect), "--output", str(tmp_path / "d.pptx")])
    assert codigo == 1
    assert "ERRO" in capsys.readouterr().err
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_gerar_apresentacao.py -q -p no:warnings`
Expected: FAIL com `ModuleNotFoundError: No module named 'gerar_apresentacao'`.

- [ ] **Step 3: Implementar `scripts/gerar_apresentacao.py`**

```python
#!/usr/bin/env python3
"""
scripts/gerar_apresentacao.py: gera a apresentação final (.pptx) a partir do
roteiro aprovado (roteiro-apresentacao.json), duplicando os slides-modelo do
molde da agência e preenchendo textos e imagens.

    python3 scripts/gerar_apresentacao.py --roteiro <roteiro.json> --prospect clientes/<slug> --output <arquivo.pptx>

Valida o roteiro antes de gerar (erros: código 1, nada é gravado). Avisos
(slide pulado por pendência, texto que provavelmente estoura a caixa) saem na
tela. Grava mapa-slides.json ao lado do .pptx (áreas dos campos em % do slide).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

from pptx import Presentation

import apresentacao_pptx as ap

RAIZ = Path(__file__).resolve().parent.parent
CAMINHO_MOLDE = RAIZ / ".claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx"
EXTENSOES_IMAGEM = {".png", ".jpg", ".jpeg"}
LIMITE_OCUPACAO = 1.1

# campo -> ("texto" | "lista" | "imagem" | "imagens" | "bloco" | "link", mínimo, máximo)
ESQUEMA: Dict[str, Dict[str, tuple]] = {
    "capa": {"prospect": ("texto", 1, 1)},
    "jornada": {},
    "divisoria": {"numero": ("texto", 1, 1), "titulo": ("texto", 1, 1)},
    "grafico": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "conclusoes": ("lista", 1, 3)},
    "tabela_lateral": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "conclusoes": ("lista", 1, 3)},
    "imagem_larga": {"titulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "texto": ("texto", 1, 1)},
    "analises_2_colunas": {"esquerda": ("bloco", 1, 4), "direita": ("bloco", 1, 4)},
    "bullets": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "itens": ("lista", 1, 6)},
    "cartoes": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "cartoes": ("lista", 3, 3)},
    "benchmark": {
        "titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "concorrente": ("texto", 1, 1),
        "imagens": ("imagens", 1, 3), "conclusoes": ("lista", 1, 3), "link": ("link", 1, 1),
    },
    "obrigado": {},
}


class ErroRoteiro(Exception):
    """Roteiro inválido; a mensagem lista os problemas, um por linha."""


def _textos(valor) -> bool:
    return isinstance(valor, list) and all(isinstance(v, str) and v.strip() for v in valor)


def _validar_imagem(rel, pasta: Path, onde: str, erros: List[str]) -> None:
    if not isinstance(rel, str) or not rel.strip():
        erros.append(f"{onde}: caminho de imagem vazio.")
        return
    alvo = (pasta / rel).resolve()
    if Path(rel).is_absolute() or pasta.resolve() not in alvo.parents:
        erros.append(f"{onde}: imagem fora da pasta do prospect ({rel}).")
    elif alvo.suffix.lower() not in EXTENSOES_IMAGEM:
        erros.append(f"{onde}: a imagem precisa ser png ou jpg ({rel}).")
    elif not alvo.is_file():
        erros.append(f"{onde}: imagem não encontrada ({rel}).")


def validar_roteiro(roteiro: dict, pasta_prospect: Path, tipos_do_molde: set) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    avisos: List[str] = []
    slides = roteiro.get("slides") if isinstance(roteiro, dict) else None
    if not isinstance(slides, list) or not slides:
        return ["Slide -: o roteiro não tem a lista \"slides\"."], avisos
    for i, s in enumerate(slides, start=1):
        if not isinstance(s, dict):
            erros.append(f"Slide {i}: formato inválido.")
            continue
        tipo = s.get("tipo")
        if tipo not in ESQUEMA or tipo not in tipos_do_molde:
            erros.append(f"Slide {i}: tipo \"{tipo}\" não existe no molde.")
            continue
        if s.get("pendencia"):
            continue
        for campo, (modo, minimo, maximo) in ESQUEMA[tipo].items():
            onde = f"Slide {i} ({tipo}), campo {campo}"
            valor = s.get(campo)
            if valor is None:
                erros.append(f"{onde}: obrigatório.")
            elif modo in ("texto", "link") and (not isinstance(valor, str) or not valor.strip()):
                erros.append(f"{onde}: precisa ser um texto.")
            elif modo == "link" and not valor.startswith(("https://", "http://")):
                erros.append(f"{onde}: o link precisa começar com https://.")
            elif modo == "lista" and (not _textos(valor) or not minimo <= len(valor) <= maximo):
                erros.append(f"{onde}: precisa ter de {minimo} a {maximo} itens de texto.")
            elif modo == "imagem":
                _validar_imagem(valor, pasta_prospect, onde, erros)
            elif modo == "imagens":
                if not isinstance(valor, list) or not minimo <= len(valor) <= maximo:
                    erros.append(f"{onde}: precisa ter de {minimo} a {maximo} imagens.")
                else:
                    for img in valor:
                        _validar_imagem(img, pasta_prospect, onde, erros)
            elif modo == "bloco":
                if not isinstance(valor, dict) or not isinstance(valor.get("titulo"), str) or not _textos(valor.get("itens")) \
                        or not minimo <= len(valor["itens"]) <= maximo:
                    erros.append(f"{onde}: precisa de \"titulo\" e de {minimo} a {maximo} \"itens\".")
    return erros, avisos


def _preencher(prs, slide, tipo: str, dados: dict, pasta: Path, numero: int, avisos: List[str]) -> None:
    c = ap.campos(slide)
    for campo, (modo, _, _) in ESQUEMA[tipo].items():
        valor = dados[campo]
        if tipo == "capa":
            ap.substituir_token(slide, "{{prospect}}", valor)
        elif modo == "texto" and campo in c:
            ap.preencher_texto(c[campo], valor)
        elif modo == "lista" and tipo == "cartoes":
            for j, texto in enumerate(valor, start=1):
                ap.preencher_texto(c[f"cartao_{j}"], texto)
        elif modo == "lista":
            ap.preencher_lista(c[campo], valor)
        elif modo == "bloco":
            ap.preencher_bloco(c[campo], valor["titulo"], valor["itens"])
        elif modo == "imagem":
            ap.trocar_imagem(slide, c[campo], pasta / valor)
        elif modo == "imagens":
            for j in range(1, 4):
                forma = c.get(f"imagem_{j}")
                if forma is None:
                    continue
                if j <= len(valor):
                    ap.trocar_imagem(slide, forma, pasta / valor[j - 1])
                else:
                    forma._element.getparent().remove(forma._element)
        elif modo == "link":
            ap.definir_link(c[campo], valor)
    for nome, forma in ap.campos(slide).items():
        if forma.has_text_frame and ap.ocupacao(forma) > LIMITE_OCUPACAO:
            avisos.append(f"Slide {numero}, campo {nome}: o texto provavelmente não cabe na caixa ({ap.ocupacao(forma):.0%} do espaço).")


def gerar(roteiro: dict, pasta_prospect: Path, saida: Path, molde: Path = CAMINHO_MOLDE) -> dict:
    prs = Presentation(molde)
    modelos = {ap.tipo_do_slide(s): s for s in prs.slides}
    erros, avisos = validar_roteiro(roteiro, pasta_prospect, set(modelos))
    if erros:
        raise ErroRoteiro("\n".join(erros))
    mapa = []
    numero = 0
    for indice, s in enumerate(roteiro["slides"]):
        if s.get("pendencia"):
            avisos.append(f"Slide do roteiro #{indice + 1} ({s['tipo']}) pulado: {s['pendencia']}")
            continue
        numero += 1
        novo = ap.duplicar_slide(prs, modelos[s["tipo"]])
        _preencher(prs, novo, s["tipo"], s, pasta_prospect, numero, avisos)
        mapa.append({
            "numero": numero,
            "tipo": s["tipo"],
            "roteiro": indice,
            "campos": {nome: ap.caixa_percentual(prs, forma) for nome, forma in ap.campos(novo).items()},
        })
    for modelo in modelos.values():
        ap.remover_slide(prs, modelo)
    saida.parent.mkdir(parents=True, exist_ok=True)
    prs.save(saida)
    caminho_mapa = saida.with_name("mapa-slides.json")
    caminho_mapa.write_text(json.dumps({"slides": mapa}, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"slides": numero, "avisos": avisos, "mapa": caminho_mapa}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Gera a apresentação final (.pptx) a partir do roteiro.")
    p.add_argument("--roteiro", required=True, type=Path)
    p.add_argument("--prospect", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--molde", type=Path, default=CAMINHO_MOLDE)
    a = p.parse_args(argv)
    try:
        roteiro = json.loads(a.roteiro.read_text(encoding="utf-8"))
        r = gerar(roteiro, a.prospect, a.output, a.molde)
    except json.JSONDecodeError as e:
        print(f"ERRO: o roteiro não é um JSON válido (linha {e.lineno}): {e.msg}", file=sys.stderr)
        return 1
    except ErroRoteiro as e:
        print(f"ERRO: roteiro inválido:\n{e}", file=sys.stderr)
        return 1
    print(f"Apresentação gerada: {a.output} ({r['slides']} slides)")
    for aviso in r["avisos"]:
        print(f"- Aviso: {aviso}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests -q -p no:warnings`
Expected: todos PASS (incluindo os de coleta e validação antigos).

- [ ] **Step 5: Commit**

```bash
git add scripts/gerar_apresentacao.py scripts/tests/test_gerar_apresentacao.py
git commit -m "feat(apresentacao): gerar_apresentacao valida o roteiro e monta o pptx a partir do molde

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tipos `roteiro` e `apresentacao` no núcleo e no MCP

**Files:**
- Modify: `src/packages/core/src/tipos.ts:12`
- Modify: `src/packages/core/src/entregaveis.ts` (`EXTENSAO_POR_TIPO`, `PASTA_POR_TIPO`, `destinoAprovado`)
- Modify: `src/packages/core/test/entregaveis.test.ts`
- Modify: `src/packages/mcp-planejamento/src/servidor.ts` (enum e descrição de `propor_entregavel`)

**Interfaces:**
- Produces: `TIPOS_ENTREGAVEL` com `"roteiro"` e `"apresentacao"`; `destinoAprovado({tipo:"roteiro", nomeFinal, etapa})` = `entrega/ativos-aprovados/apresentacao/<nomeFinal>.json`; `destinoAprovado({tipo:"apresentacao", ...})` = `entrega/apresentacao-final.pptx` (independe do nome).

- [ ] **Step 1: Testes que falham (acrescentar em `entregaveis.test.ts`)**

```ts
describe("entregáveis da apresentação final", () => {
  it("roteiro vai para ativos-aprovados/apresentacao", () => {
    expect(destinoAprovado({ tipo: "roteiro", nomeFinal: "roteiro-apresentacao", etapa: "final" })).toBe(
      "entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json",
    )
  })
  it("apresentação aprovada vai sempre para entrega/apresentacao-final.pptx", () => {
    expect(destinoAprovado({ tipo: "apresentacao", nomeFinal: "qualquer", etapa: "final" })).toBe("entrega/apresentacao-final.pptx")
  })
  it("proposta exige a extensão do tipo", () => {
    const base = estadoInicial({ slug: "x", nome: "X", site: null }, EM)
    expect(() =>
      proporEntregavel(base, { etapa: "final", tipo: "apresentacao", titulo: "Deck", arquivoRascunho: ".app/propostas/a.pdf", nomeFinal: "deck" }, "a1", EM),
    ).toThrow(".pptx")
    expect(() =>
      proporEntregavel(base, { etapa: "final", tipo: "roteiro", titulo: "Roteiro", arquivoRascunho: ".app/propostas/r.json", nomeFinal: "roteiro-apresentacao" }, "r1", EM),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/entregaveis.test.ts`
Expected: FAIL (tipo inválido / erro de tipo do TS em `tipo: "roteiro"`).

- [ ] **Step 3: Implementar**

`tipos.ts`:
```ts
export const TIPOS_ENTREGAVEL = ["grafico", "tabela", "secao", "planilha", "documento", "html", "roteiro", "apresentacao"] as const
```

`entregaveis.ts`: acrescentar `roteiro: ".json", apresentacao: ".pptx"` em `EXTENSAO_POR_TIPO`; `roteiro: "apresentacao", apresentacao: "apresentacao"` em `PASTA_POR_TIPO`; e no início de `destinoAprovado`:
```ts
  if (e.tipo === "apresentacao") return "entrega/apresentacao-final.pptx"
```

`servidor.ts` (`propor_entregavel`): enum `["grafico", "tabela", "secao", "planilha", "documento", "html", "roteiro", "apresentacao"]`, descrição do tipo `"grafico/tabela = PNG; secao = .md; planilha = .xlsx; documento = .docx; html = .html; roteiro = .json (roteiro da apresentação); apresentacao = .pptx"` e, no texto da ferramenta, "…documento, HTML, roteiro ou apresentação…".

Conferir se `servico-planejamento.ts` ou o validador do MCP repetem a lista de tipos (`grep -rn '"html"' src/packages`) e atualizar onde houver.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src && npx turbo test typecheck --filter=@workspace/core --filter=@workspace/mcp-planejamento`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core src/packages/mcp-planejamento
git commit -m "feat(core): entregáveis roteiro (.json) e apresentacao (.pptx) da apresentação final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Card do roteiro e do `.pptx` no app

**Files:**
- Create: `src/apps/web/components/cards/previa-roteiro.tsx`
- Modify: `src/apps/web/components/cards/previa-arquivo.tsx`
- Modify: `src/apps/web/components/cards/card-entregavel.tsx` (`ROTULO_TIPO`)
- Modify: `src/apps/web/app/api/prospects/[slug]/arquivo/route.ts` (`TIPOS`: `.json`, `.pptx`)
- Create: `src/apps/web/lib/roteiro.ts` + `src/apps/web/lib/roteiro.test.ts`

**Interfaces:**
- Consumes: tipos da Task 4; `urlArquivo(slug, caminho, download?)`; `useVisualizador().abrirArquivo`.
- Produces: `resumoDoSlide(slide: SlideRoteiro): { titulo: string; linhas: string[]; imagens: string[] }` em `lib/roteiro.ts`; componente `PreviaRoteiro({ slug, caminho })`.

- [ ] **Step 1: Teste que falha — `src/apps/web/lib/roteiro.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { resumoDoSlide } from "./roteiro"

describe("resumo de cada slide do roteiro", () => {
  it("gráfico: título e subtítulo sem asteriscos, conclusões e imagem", () => {
    const r = resumoDoSlide({
      tipo: "grafico",
      titulo: "Cenário Atual",
      subtitulo: "**ROAS** por plataforma",
      imagem: "entrega/ativos-aprovados/graficos/roas.png",
      conclusoes: ["a", "b"],
    })
    expect(r).toEqual({ titulo: "Cenário Atual · ROAS por plataforma", linhas: ["a", "b"], imagens: ["entrega/ativos-aprovados/graficos/roas.png"] })
  })
  it("análises em 2 colunas e cartões viram linhas legíveis", () => {
    expect(resumoDoSlide({ tipo: "analises_2_colunas", esquerda: { titulo: "Sobre **x**", itens: ["1"] }, direita: { titulo: "Sobre y", itens: ["2"] } }).linhas).toEqual([
      "Sobre x: 1",
      "Sobre y: 2",
    ])
    expect(resumoDoSlide({ tipo: "cartoes", titulo: "Desafios", subtitulo: "Como", cartoes: ["A", "B", "C"] }).linhas).toEqual(["A", "B", "C"])
  })
  it("capa, divisória e benchmark", () => {
    expect(resumoDoSlide({ tipo: "capa", prospect: "Marca" }).titulo).toBe("Capa · Marca")
    expect(resumoDoSlide({ tipo: "divisoria", numero: "01.", titulo: "CENÁRIO **ATUAL**" }).titulo).toBe("01. CENÁRIO ATUAL")
    expect(resumoDoSlide({ tipo: "benchmark", titulo: "Benchmarking", subtitulo: "s", concorrente: "X", imagens: ["a.jpg"], conclusoes: ["c"], link: "https://x" }).imagens).toEqual(["a.jpg"])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/roteiro`
Expected: FAIL (`Cannot find module './roteiro'`).

- [ ] **Step 3: Implementar `lib/roteiro.ts`**

```ts
/** Slide do roteiro-apresentacao.json (ver scripts/gerar_apresentacao.py, ESQUEMA). */
export type SlideRoteiro = {
  tipo: string
  pendencia?: string
  fonte?: string
  [campo: string]: unknown
}

const semNegrito = (t: unknown) => (typeof t === "string" ? t.replaceAll("**", "") : "")
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(semNegrito) : [])

const NOMES: Record<string, string> = { capa: "Capa", jornada: "Jornada", obrigado: "Obrigado" }

export function resumoDoSlide(s: SlideRoteiro): { titulo: string; linhas: string[]; imagens: string[] } {
  const imagens = [s.imagem, ...(Array.isArray(s.imagens) ? s.imagens : [])].filter((x): x is string => typeof x === "string")
  if (s.tipo === "capa") return { titulo: `Capa · ${semNegrito(s.prospect)}`, linhas: [], imagens }
  if (s.tipo === "divisoria") return { titulo: `${semNegrito(s.numero)} ${semNegrito(s.titulo)}`.trim(), linhas: [], imagens }
  if (s.tipo === "analises_2_colunas") {
    const coluna = (c: unknown) => {
      const o = (c ?? {}) as { titulo?: string; itens?: unknown }
      return lista(o.itens).map((i) => `${semNegrito(o.titulo)}: ${i}`)
    }
    return { titulo: "Análises", linhas: [...coluna(s.esquerda), ...coluna(s.direita)], imagens }
  }
  const titulo = [semNegrito(s.titulo), semNegrito(s.subtitulo)].filter(Boolean).join(" · ") || NOMES[s.tipo] || s.tipo
  const prefixo = s.tipo === "benchmark" && s.concorrente ? `${semNegrito(s.concorrente)}: ` : ""
  const linhas = [...lista(s.conclusoes), ...lista(s.itens), ...lista(s.cartoes), ...(typeof s.texto === "string" ? [semNegrito(s.texto)] : [])]
  return { titulo: prefixo + titulo, linhas, imagens }
}
```

- [ ] **Step 4: `components/cards/previa-roteiro.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { urlArquivo } from "@/lib/api"
import { resumoDoSlide, type SlideRoteiro } from "@/lib/roteiro"

/** Roteiro da apresentação, um bloco por slide: tipo, título, miniaturas e conclusões. */
export function PreviaRoteiro({ slug, caminho }: { slug: string; caminho: string }) {
  const url = urlArquivo(slug, caminho)
  const [carregado, setCarregado] = useState<{ url: string; slides: SlideRoteiro[] | null } | null>(null)
  const { abrirArquivo } = useVisualizador()
  const slides = carregado?.url === url ? carregado.slides : undefined

  useEffect(() => {
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { slides?: SlideRoteiro[] } | null) => ativo && setCarregado({ url, slides: Array.isArray(j?.slides) ? j.slides : null }))
      .catch(() => ativo && setCarregado({ url, slides: null }))
    return () => {
      ativo = false
    }
  }, [url])

  if (slides === undefined) return <Skeleton className="h-40 w-full" />
  if (slides === null) return <p className="text-destructive text-sm">Não consegui ler o roteiro.</p>
  return (
    <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
      {slides.map((s, i) => {
        const r = resumoDoSlide(s)
        return (
          <li key={i} className={`rounded-md border p-2 text-sm ${s.pendencia ? "border-amber-500/60 bg-amber-500/5" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">{i + 1}</span>
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                {s.tipo}
              </Badge>
              <span className="truncate font-medium">{r.titulo}</span>
            </div>
            {s.pendencia ? (
              <p className="mt-1 ml-8 text-xs text-amber-600">Pendência: {s.pendencia}</p>
            ) : (
              <div className="mt-1 ml-8 flex gap-2">
                {r.imagens.map((img) => (
                  <button key={img} type="button" onClick={() => abrirArquivo(img)} className="shrink-0" title={img}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                    <img src={urlArquivo(slug, img)} alt="" className="h-14 w-auto rounded border bg-white" />
                  </button>
                ))}
                {r.linhas.length > 0 && (
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                    {r.linhas.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {typeof s.fonte === "string" && <p className="text-muted-foreground mt-1 ml-8 font-mono text-[10px]">fonte: {s.fonte}</p>}
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 5: Ligar no card**

- `card-entregavel.tsx` → `ROTULO_TIPO`: `roteiro: "Roteiro da apresentação"`, `apresentacao: "Apresentação (.pptx)"`.
- `previa-arquivo.tsx`: antes do `return` final, acrescentar:
```tsx
  if (tipo === "roteiro") return <PreviaRoteiro slug={slug} caminho={caminho} />
  if (tipo === "apresentacao") {
    return (
      <Attachment state="done">
        <AttachmentMedia variant="icon">
          <PresentationIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{titulo}</AttachmentTitle>
          <AttachmentDescription>PowerPoint · abra no Google Slides (Arquivo → Importar slides) ou no PowerPoint</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction render={<a href={urlArquivo(slug, caminho, true)} download aria-label="Baixar" />} nativeButton={false}>
            <DownloadIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    )
  }
```
  (importar `PresentationIcon` de `lucide-react` e `PreviaRoteiro` de `./previa-roteiro`).
- `arquivo/route.ts` → `TIPOS`: `".json": "application/json; charset=utf-8"`, `".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"`.

- [ ] **Step 6: Rodar testes, typecheck e lint**

Run: `cd src && npx turbo test typecheck lint --filter=web`
Expected: tudo verde, sem avisos novos nos arquivos tocados.

- [ ] **Step 7: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): card do roteiro da apresentação (slide a slide) e download do pptx

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Skill 09, comando, etapa e documentação

**Files:**
- Create: `.claude/skills/09-apresentacao-final/SKILL.md`
- Modify: `.claude/commands/apresentacao-final.md`
- Modify: `.claude/skills/_shared/etapas.json` (etapa `final`: `skill`, `descricao`)
- Modify: `.claude/agents/designer-apresentacao.md` (aviso de desativado no topo)
- Modify: `CLAUDE.md` (ordem de execução e subagentes)
- Modify: `.claude/skills/_shared/regras-de-validacao.md` (Regra 7: tipos `roteiro`/`apresentacao`)

- [ ] **Step 1: `.claude/skills/09-apresentacao-final/SKILL.md`**

````markdown
---
name: 09-apresentacao-final
description: Monta a apresentação final do planejamento para o prospect, no padrão visual da agência, como um .pptx editável. Escreve o roteiro slide a slide a partir do que foi aprovado (gráficos e seções), passa pela aprovação do analista e gera o arquivo com scripts/gerar_apresentacao.py. Use depois da Skill 08 (plano-de-acao) concluída, quando o analista pedir a apresentação final.
---

# Skill 09 — Apresentação final

Última etapa. Transforma o que foi aprovado em `entrega/ativos-aprovados/` na
apresentação que vai para o prospect, no molde da agência
(`.claude/skills/_shared/modelos-apresentacao/`). Não cria análise nova nem
gráfico novo: organiza, condensa e monta.

## Antes de começar

Confira que existe material das 6 seções do deck em `entrega/ativos-aprovados/`:

| Seção do deck | Onde está | Etapa de origem |
|---|---|---|
| 01. Cenário atual | `graficos/*`, `secoes/03-*.md`, `secoes/04-*.md` | 03 e 04 |
| 02. Desafios | gargalos e hipóteses em `contexto/decisoes/`, `secoes/05-*.md` | 02 a 05 |
| 03. Benchmarking | `secoes/06-benchmark.md`, `dados/benchmark-meta/<marca>/` | 06 |
| 04. Metas | `graficos/cenarios-*`, `graficos/tabela-cenarios-*`, `secoes/05-*.md` | 05 |
| 05. Cenários e impactos | `secoes/05-*.md`, `secoes/07-midia-paga.md`, `graficos/tabela-*` | 05 e 07 |
| 06. Plano de ação | `plano-de-acao/*.docx`, `secoes/07-*.md` | 08 |

Faltando material de uma seção, diga ao analista o que falta e de qual etapa
vem; não monte um deck incompleto em silêncio.

## Fase 1 — Roteiro

Escreva `roteiro-apresentacao.json` (na interface, em
`clientes/<slug>/.app/rascunhos/`; no terminal, em `clientes/<slug>/entrega/`).
Formato e tipos: `docs/superpowers/specs/2026-10-07-apresentacao-final-pptx-design.md`
(seções 3 e 4) e o `ESQUEMA` em `scripts/gerar_apresentacao.py`.

Regras:
- Ordem: capa → jornada → divisória 01 + slides → … → divisória 06 + slides → obrigado.
  Divisórias: "CENÁRIO **ATUAL**", "DESAFIOS", "ANÁLISE DE **BENCHMARKING**",
  "**METAS**", "**CENÁRIOS** E IMPACTOS **ESPERADOS**", "PLANO **DE AÇÃO**".
- Um slide `grafico` por gráfico aprovado relevante; tabelas aprovadas usam
  `tabela_lateral` (tabela alta) ou `imagem_larga` (tabela larga).
- Títulos curtos no padrão do deck ("Cenário Atual", "Metas do projeto"…);
  subtítulos com o destaque em `**negrito**`.
- Conclusões: no máximo 3 por slide, frases curtas (até ~90 caracteres),
  condensando as seções aprovadas, com número e comparação quando houver.
  Registre a seção de origem em `fonte`. Nunca invente número ou análise.
- Benchmark: um slide `benchmark` por concorrente, com até 3 criativos de
  `dados/benchmark-meta/<marca>/midia/` (prefira o quadro mais representativo
  de cada vídeo), conclusões da camada Lição + Evidência e o link da página na
  Biblioteca (`resumo.md`, "Página na Biblioteca").
- Slide sem material: `{"tipo": "...", "pendencia": "o que falta e de qual etapa"}`.
- PII: as regras do `CLAUDE.md` raiz valem para o deck.

Interface: `propor_entregavel` tipo `roteiro`, `nome_final` `roteiro-apresentacao`.
Terminal: mostre o roteiro resumido slide a slide e peça a checagem.

## Fase 2 — Deck

Com o roteiro aprovado:

```bash
python3 scripts/gerar_apresentacao.py --roteiro <roteiro.json> --prospect clientes/<slug> --output <saida.pptx>
```

- Interface: `--output clientes/<slug>/.app/rascunhos/apresentacao-final.pptx` e
  `propor_entregavel` tipo `apresentacao`, `nome_final` `apresentacao-final`.
- Terminal: `--output clientes/<slug>/entrega/apresentacao-final.pptx`.
- `ERRO:` → corrija o roteiro nos pontos citados e rode de novo.
- Avisos de texto que não cabe → encurte aquela frase no roteiro e regere antes
  de propor. Avisos de slide pulado → conte ao analista.

## Ajustes

Pedido de ajuste (inclusive comentários por slide) → altere **só** o roteiro
nos slides citados, regere o deck e proponha de novo (roteiro, se mudou o
conteúdo; apresentação, sempre). Nunca edite o `.pptx` à mão.

## Encerramento e handoff

Ao concluir, marque "Apresentação final" como ✅ em
`contexto/status-planejamento.md` e diga ao analista, em linguagem natural,
que a apresentação está em `entrega/apresentacao-final.pptx` e que abre no
Google Slides (Arquivo → Importar slides) ou no PowerPoint. Este é o fim do
processo.
````

- [ ] **Step 2: Comando, etapa, subagente, CLAUDE.md e Regra 7**

- `.claude/commands/apresentacao-final.md`:
```markdown
---
description: "Etapa final — roteiro e apresentação .pptx no molde da agência (Skill 09)"
---
Use a skill `09-apresentacao-final` para montar a apresentação final do prospect em andamento nesta conversa.
```
- `etapas.json`, etapa `final`: `"skill": "09-apresentacao-final"` e `"descricao": "Monta a apresentação (.pptx) no molde da agência a partir de tudo o que foi aprovado."`. Conferir no catálogo do núcleo (`src/packages/core/src/catalogo.ts`) se `skill` é validada contra a pasta `.claude/skills/` e rodar `npx vitest run` no core.
- `designer-apresentacao.md`: logo após o frontmatter, acrescentar:
```markdown
> **Desativado.** A apresentação final é gerada pela Skill 09
> (`09-apresentacao-final`) como .pptx no molde da agência. Este subagente fica
> como referência para um renderizador Canva futuro, que usaria o mesmo
> `roteiro-apresentacao.json` aprovado.
```
- `CLAUDE.md` raiz: na ordem de execução, trocar a última linha por `09-apresentacao-final (roteiro + .pptx no molde da agência; comando: /apresentacao-final)`; em "Subagentes disponíveis", a linha do `designer-apresentacao` passa a: `**`designer-apresentacao`** — desativado; a apresentação final é gerada pela Skill 09 (.pptx).`
- `regras-de-validacao.md`, Regra 7: acrescentar à lista de scripts que geram arquivo: `gerar_apresentacao.py` (tipo `apresentacao`, `.pptx`), e citar o tipo `roteiro` (`.json`).

- [ ] **Step 3: Conferências**

Run: `grep -rn "designer-apresentacao" CLAUDE.md .claude/commands; cd src/packages/core && npx vitest run 2>&1 | grep -E "Tests "`
Expected: `CLAUDE.md` só cita o subagente como desativado; comando aponta para a skill 09; core verde.

- [ ] **Step 4: Commit**

```bash
git add .claude CLAUDE.md
git commit -m "feat(skill-09): apresentação final por roteiro e pptx no molde da agência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Validação com o `sottile-teste`

**Files:**
- Create: `docs/superpowers/validacoes/2026-10-07-apresentacao-final-a.md`

- [ ] **Step 1: Suítes completas**

Run: `python3 -m pytest scripts/tests -q -p no:warnings && (cd src && npx turbo test typecheck lint)`
Expected: tudo verde.

- [ ] **Step 2: Roteiro de validação**

Montar, no scratchpad, um `roteiro-apresentacao.json` do `sottile-teste` com pelo menos um slide de cada tipo, usando só arquivos de `clientes/sottile-teste/entrega/ativos-aprovados/graficos/` e `dados/benchmark-meta/*/midia/`, e conclusões copiadas das seções aprovadas (é dado de teste, não vai para o git).

- [ ] **Step 3: Gerar e conferir a estrutura**

Run: `python3 scripts/gerar_apresentacao.py --roteiro <scratchpad>/roteiro.json --prospect clientes/sottile-teste --output <scratchpad>/deck.pptx`
Expected: "Apresentação gerada" com o número de slides do roteiro; avisos, se houver, coerentes. Conferir com `python3 -c` que cada slide tem os textos esperados e nenhum `{{` ou `**` sobrando, e que imagens não ficaram distorcidas (proporção de cada imagem = proporção do arquivo de origem).

- [ ] **Step 4: Conferência visual pelo analista**

Enviar o `deck.pptx` ao analista (SendUserFile) pedindo que abra no Google Slides e compare com o PDF de referência (fundo, fontes, posições, tarjas). Registrar o retorno; correções de posição viram ajustes no molde (Task 2) com novo commit.

- [ ] **Step 5: Registrar e commitar**

`docs/superpowers/validacoes/2026-10-07-apresentacao-final-a.md` no formato dos registros existentes: comandos, número de slides, avisos, divergências visuais apontadas e o que foi ajustado.

```bash
git add docs/superpowers/validacoes/2026-10-07-apresentacao-final-a.md
git commit -m "docs: validação da Entrega A da apresentação final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
