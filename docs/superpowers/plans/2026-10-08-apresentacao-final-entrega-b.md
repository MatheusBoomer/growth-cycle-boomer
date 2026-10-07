# Apresentação final — Entrega B (prévia e comentários) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No app, a apresentação gerada aparece como imagens de slide na coluna larga, e o analista comenta slides inteiros ou regiões (arrastando um retângulo); no roteiro, comenta por slide. Os comentários viram um pedido de ajuste estruturado, com recorte de cada região, para o agente corrigir só o que foi apontado.

**Architecture:** `scripts/previa_apresentacao.py` converte o `.pptx` (LibreOffice → PDF → poppler → PNG por slide), monta o mapa de campos a partir do próprio `.pptx` e recorta regiões. No núcleo, `comentarios.ts` (funções puras) e `ServicoComentarios` (prévia em cache por versão em `.app/previas/<id>/`, comentários em `.app/comentarios/<id>.json`, envio pelo `pedirAjuste` existente). No app, rotas novas, um `VisualizadorApresentacao` na coluna larga e comentários por bloco no card do roteiro.

**Tech Stack:** LibreOffice (cask), poppler, fonte Montserrat (cask); Python 3.9 (python-pptx, Pillow, pytest); TypeScript (núcleo, Next 16/React 19, vitest).

**Spec:** `docs/superpowers/specs/2026-10-07-apresentacao-final-pptx-design.md` (seções 6.4, 7 e parte 4 do design: comentários).

## Global Constraints

- Python 3.9 (`from __future__ import annotations`, `typing`); nada de dependência Python nova.
- Ferramentas do sistema: `brew install --cask libreoffice`, `brew install poppler`, `brew install --cask font-montserrat`. Sem elas, o app continua funcionando: o card mostra só o download e a verificação do sistema avisa (não bloqueia).
- Regiões em porcentagem do slide (`x`, `y`, `w`, `h` de 0 a 100, duas casas).
- Prévia em cache por versão do entregável (`.app/previas/<id>/`); uma versão nova (novo id) gera nova prévia.
- Comentários só em entregáveis `roteiro` ou `apresentacao` com status `pendente`; enviados ficam com `enviadoEm` e não podem mais ser editados.
- Textos ao analista em português, sem travessão no meio de frase.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Clique sem arrastar no slide** (retângulo de 0×0): não cria comentário de região; o analista usa "Comentar slide". Teste na Task 6.
2. **Arraste que sai da imagem** (soltar fora do slide): a região é recortada aos limites (0–100%). Teste na Task 6.
3. **LibreOffice ausente ou conversão travada**: a prévia responde "indisponível" com a mensagem, sem quebrar o card nem o chat. Teste na Task 4.
4. **Enviar sem comentários pendentes** ou duas vezes seguidas: segunda vez recusa com mensagem, sem pedir ajuste vazio. Teste na Task 4.
5. **Comentário em versão já substituída/aprovada**: recusado com mensagem. Teste na Task 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/previa_apresentacao.py` (novo) + `scripts/tests/test_previa_apresentacao.py` | Conversão em PNG, mapa de campos, recorte |
| `src/packages/core/src/comentarios.ts` (novo) + `test/comentarios.test.ts` | Tipos e funções puras (campo da região, texto do ajuste) |
| `src/packages/core/src/servico-comentarios.ts` (novo) + `test/servico-comentarios.test.ts` | Prévia em cache, CRUD de comentários, envio |
| `src/packages/core/src/previa.ts` (novo) | `criarPreviaPython(raiz)`: chama o script |
| `src/packages/core/src/entregaveis.ts` + teste | Visualizador também para `apresentacao` |
| `src/apps/web/lib/servidor.ts`, rotas `entregaveis/[id]/previa`, `…/comentarios`, `…/comentarios/[cid]`, `…/comentarios/enviar` | API |
| `src/apps/web/lib/api.ts`, `lib/regiao.ts` (+ teste), `components/trabalho/visualizador-apresentacao.tsx`, `area-de-trabalho.tsx`, `cards/previa-arquivo.tsx`, `cards/previa-roteiro.tsx` | Interface |
| `src/apps/web/app/api/sistema/route.ts`, `components/sistema/verificacao-sistema.tsx` | Verificação |
| `.claude/skills/09-apresentacao-final/SKILL.md` | Como ler o ajuste estruturado |

---

### Task 1: Ferramentas do sistema e verificação

**Files:**
- Modify: `src/apps/web/app/api/sistema/route.ts`
- Modify: `src/apps/web/components/sistema/verificacao-sistema.tsx`

- [ ] **Step 1: Instalar**

Run: `brew install --cask libreoffice && brew install poppler && brew install --cask font-montserrat`
Expected: instalações concluídas. Conferir: `command -v pdftoppm` e `(command -v soffice || ls /Applications/LibreOffice.app/Contents/MacOS/soffice)` e `ls ~/Library/Fonts | grep -i montserrat`.

- [ ] **Step 2: Rota `/api/sistema`**

Acrescentar, antes do `return`, a checagem das duas ferramentas e incluí-las na resposta:

```ts
  const soffice = await (async () => {
    for (const cmd of ["soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]) {
      try {
        await exec(cmd, ["--version"], { timeout: 20_000 })
        return true
      } catch {
        // tenta o próximo
      }
    }
    return false
  })()
  let poppler = true
  try {
    await exec("pdftoppm", ["-v"], { timeout: 10_000 })
  } catch {
    poppler = false
  }
```

e `return Response.json({ claude, python, ffmpeg, apify, previa: soffice && poppler })`.

- [ ] **Step 3: Aviso na verificação**

Em `verificacao-sistema.tsx`: `previa: boolean` na interface `Sistema` e, em `faltasBenchmark` (renomear para `faltasOpcionais`), o item `!sistema.previa && "instale LibreOffice e poppler para ver a prévia da apresentação no app (brew install --cask libreoffice; brew install poppler)"`. Ajustar o texto do alerta para: `Recursos opcionais: {faltas}. O resto do app funciona normalmente.` e manter a frase do benchmark para ffmpeg/Apify (dois alertas separados: um para benchmark, um para prévia).

- [ ] **Step 4: Conferir**

Run: `cd src && npx turbo typecheck lint --filter=web`
Expected: sem erros. Com o app rodando, `python3 -c "import json,urllib.request;print(json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/sistema'))['previa'])"` → `True`.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/app/api/sistema/route.ts src/apps/web/components/sistema/verificacao-sistema.tsx
git commit -m "feat(web): verificação do sistema mostra LibreOffice e poppler para a prévia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `scripts/previa_apresentacao.py`

**Files:**
- Create: `scripts/previa_apresentacao.py`
- Test: `scripts/tests/test_previa_apresentacao.py`

**Interfaces:**
- Consumes: `apresentacao_pptx` (`campos`, `caixa_percentual`); `gerar_apresentacao.gerar` (só nos testes).
- Produces: `mapa_do_pptx(pptx: Path) -> dict` → `{"slides": [{"numero": int, "titulo": str, "campos": {nome: {"x","y","w","h"}}}]}`; `converter(pptx: Path, pasta: Path) -> int` (grava `slide-01.png`…); `recortar(slide_png: Path, regiao: Dict[str, float], saida: Path) -> None`; `class ErroPrevia(Exception)`; CLI `gerar --pptx P --saida DIR` (grava PNGs + `mapa.json`, imprime `{"slides": n}`) e `recortar --slide PNG --regiao x,y,w,h --saida PNG`; erros `ERRO: …` em stderr, código 1.

- [ ] **Step 1: Testes que falham — `scripts/tests/test_previa_apresentacao.py`**

```python
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import gerar_apresentacao as ga  # noqa: E402
import previa_apresentacao as pv  # noqa: E402

TEM_FERRAMENTAS = (shutil.which("soffice") or Path("/Applications/LibreOffice.app/Contents/MacOS/soffice").exists()) and shutil.which("pdftoppm")


@pytest.fixture()
def deck(tmp_path):
    pasta = tmp_path / "clientes" / "teste"
    (pasta / "entrega/ativos-aprovados/graficos").mkdir(parents=True)
    Image.new("RGB", (1200, 600), (20, 60, 200)).save(pasta / "entrega/ativos-aprovados/graficos/roas.png")
    roteiro = {"versao": 1, "prospect": "Marca", "slides": [
        {"tipo": "capa", "prospect": "Marca"},
        {"tipo": "grafico", "titulo": "Cenário Atual", "subtitulo": "**ROAS** global",
         "imagem": "entrega/ativos-aprovados/graficos/roas.png", "conclusoes": ["Uma conclusão"]},
        {"tipo": "obrigado"},
    ]}
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro, pasta, saida)
    return saida


def test_mapa_do_pptx_tem_titulo_e_campos(deck):
    mapa = pv.mapa_do_pptx(deck)
    assert [s["numero"] for s in mapa["slides"]] == [1, 2, 3]
    s2 = mapa["slides"][1]
    assert s2["titulo"] == "Cenário Atual · ROAS global"
    assert {"titulo", "conclusoes", "imagem"} <= set(s2["campos"])
    assert all(0 <= v <= 100 for c in s2["campos"].values() for v in c.values())


def test_recortar_inclui_margem_e_destaque(tmp_path):
    slide = tmp_path / "slide-01.png"
    Image.new("RGB", (1000, 560), (255, 255, 255)).save(slide)
    saida = tmp_path / "c1.png"
    pv.recortar(slide, {"x": 60, "y": 30, "w": 30, "h": 40}, saida)
    with Image.open(saida) as img:
        largura, altura = img.size
        assert 300 < largura <= 1000 and 224 < altura <= 560
        cores = {img.getpixel((x, y)) for x in range(largura) for y in range(0, altura, 7)}
    assert (200, 111, 0) in cores  # contorno laranja da agência (#C86F00)


def test_recortar_regiao_invalida(tmp_path):
    slide = tmp_path / "s.png"
    Image.new("RGB", (100, 100)).save(slide)
    with pytest.raises(pv.ErroPrevia):
        pv.recortar(slide, {"x": 90, "y": 90, "w": 0, "h": 0}, tmp_path / "c.png")


@pytest.mark.skipif(not TEM_FERRAMENTAS, reason="LibreOffice ou poppler não instalados")
def test_converter_gera_um_png_por_slide(deck, tmp_path):
    pasta = tmp_path / "previa"
    n = pv.converter(deck, pasta)
    assert n == 3
    assert sorted(p.name for p in pasta.glob("slide-*.png")) == ["slide-01.png", "slide-02.png", "slide-03.png"]
    with Image.open(pasta / "slide-01.png") as img:
        assert abs(img.width / img.height - 16 / 9) < 0.02


@pytest.mark.skipif(not TEM_FERRAMENTAS, reason="LibreOffice ou poppler não instalados")
def test_cli_gerar_grava_mapa(deck, tmp_path, capsys):
    pasta = tmp_path / "previa"
    assert pv.main(["gerar", "--pptx", str(deck), "--saida", str(pasta)]) == 0
    assert json.loads(capsys.readouterr().out) == {"slides": 3}
    assert json.loads((pasta / "mapa.json").read_text(encoding="utf-8"))["slides"][1]["numero"] == 2


def test_cli_pptx_inexistente(tmp_path, capsys):
    assert pv.main(["gerar", "--pptx", str(tmp_path / "nao.pptx"), "--saida", str(tmp_path / "p")]) == 1
    assert "ERRO" in capsys.readouterr().err
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_previa_apresentacao.py -q -p no:warnings`
Expected: FAIL com `ModuleNotFoundError: No module named 'previa_apresentacao'`.

- [ ] **Step 3: Implementar `scripts/previa_apresentacao.py`**

```python
#!/usr/bin/env python3
"""
scripts/previa_apresentacao.py: prévia da apresentação final no app.

    python3 scripts/previa_apresentacao.py gerar --pptx <deck.pptx> --saida <pasta>
    python3 scripts/previa_apresentacao.py recortar --slide <slide-NN.png> --regiao x,y,w,h --saida <recorte.png>

gerar: LibreOffice converte o .pptx em PDF e o poppler (pdftoppm) gera um PNG por
slide (slide-01.png…); grava mapa.json com o título e a área de cada campo (em %
do slide), lidos do próprio .pptx pelo texto alternativo. Imprime {"slides": n}.
recortar: recorta a região comentada (em %) com margem e contorno laranja, para o
agente ver exatamente o que o analista apontou.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from PIL import Image, ImageDraw
from pptx import Presentation

import apresentacao_pptx as ap

LARANJA = (200, 111, 0)
SOFFICE_MAC = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")


class ErroPrevia(Exception):
    """Mensagem pronta para o analista, em português."""


def _titulo(slide) -> str:
    c = ap.campos(slide)
    partes: List[str] = []
    for nome in ("titulo", "subtitulo", "concorrente"):
        if nome in c:
            texto = " ".join(c[nome].text_frame.text.split())
            if texto:
                partes.append(texto)
    if not partes:
        for forma in slide.shapes:
            if forma.has_text_frame and forma.text_frame.text.strip():
                partes.append(" ".join(forma.text_frame.text.split())[:80])
                break
    return " · ".join(partes)


def mapa_do_pptx(pptx: Path) -> dict:
    prs = Presentation(pptx)
    return {
        "slides": [
            {
                "numero": i,
                "titulo": _titulo(s),
                "campos": {nome: ap.caixa_percentual(prs, forma) for nome, forma in ap.campos(s).items()},
            }
            for i, s in enumerate(prs.slides, start=1)
        ]
    }


def _soffice() -> str:
    caminho = shutil.which("soffice") or (str(SOFFICE_MAC) if SOFFICE_MAC.exists() else None)
    if not caminho:
        raise ErroPrevia("LibreOffice não encontrado. Instale com: brew install --cask libreoffice")
    return caminho


def converter(pptx: Path, pasta: Path) -> int:
    if not pptx.is_file():
        raise ErroPrevia(f"Arquivo da apresentação não encontrado: {pptx}")
    if not shutil.which("pdftoppm"):
        raise ErroPrevia("poppler não encontrado. Instale com: brew install poppler")
    soffice = _soffice()
    pasta.mkdir(parents=True, exist_ok=True)
    for antigo in pasta.glob("slide-*.png"):
        antigo.unlink()
    with tempfile.TemporaryDirectory() as tmp:
        perfil = Path(tmp) / "perfil"
        try:
            subprocess.run(
                [soffice, f"-env:UserInstallation={perfil.as_uri()}", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(pptx)],
                capture_output=True, timeout=180, check=True,
            )
        except subprocess.TimeoutExpired:
            raise ErroPrevia("A conversão da apresentação passou de 3 minutos. Tente de novo.")
        except subprocess.CalledProcessError as e:
            raise ErroPrevia(f"O LibreOffice não conseguiu converter a apresentação ({e.returncode}).")
        pdf = Path(tmp) / f"{pptx.stem}.pdf"
        if not pdf.exists():
            raise ErroPrevia("O LibreOffice não gerou o PDF da apresentação.")
        subprocess.run(["pdftoppm", "-png", "-r", "110", str(pdf), str(pasta / "p")], capture_output=True, timeout=180, check=True)
    paginas = sorted(pasta.glob("p-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    for i, p in enumerate(paginas, start=1):
        p.rename(pasta / f"slide-{i:02d}.png")
    return len(paginas)


def recortar(slide_png: Path, regiao: Dict[str, float], saida: Path) -> None:
    x, y, w, h = (float(regiao[k]) for k in ("x", "y", "w", "h"))
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > 100.01 or y + h > 100.01:
        raise ErroPrevia("Região inválida para o recorte.")
    with Image.open(slide_png) as img:
        img = img.convert("RGB")
        W, H = img.size
        x0, y0, x1, y1 = x / 100 * W, y / 100 * H, (x + w) / 100 * W, (y + h) / 100 * H
        mx, my = 0.08 * W, 0.08 * H
        caixa = (int(max(0, x0 - mx)), int(max(0, y0 - my)), int(min(W, x1 + mx)), int(min(H, y1 + my)))
        desenho = ImageDraw.Draw(img)
        desenho.rectangle((x0, y0, x1, y1), outline=LARANJA, width=max(3, W // 250))
        saida.parent.mkdir(parents=True, exist_ok=True)
        img.crop(caixa).save(saida)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Prévia da apresentação final (PNG por slide, mapa e recortes).")
    sub = p.add_subparsers(dest="comando", required=True)
    g = sub.add_parser("gerar")
    g.add_argument("--pptx", required=True, type=Path)
    g.add_argument("--saida", required=True, type=Path)
    r = sub.add_parser("recortar")
    r.add_argument("--slide", required=True, type=Path)
    r.add_argument("--regiao", required=True)
    r.add_argument("--saida", required=True, type=Path)
    a = p.parse_args(argv)
    try:
        if a.comando == "gerar":
            n = converter(a.pptx, a.saida)
            (a.saida / "mapa.json").write_text(json.dumps(mapa_do_pptx(a.pptx), ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"slides": n}))
        else:
            valores = [float(v) for v in a.regiao.split(",")]
            if len(valores) != 4:
                raise ErroPrevia("A região precisa ser x,y,w,h.")
            recortar(a.slide, dict(zip(("x", "y", "w", "h"), valores)), a.saida)
    except (ErroPrevia, ValueError, OSError, subprocess.SubprocessError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests -q -p no:warnings`
Expected: todos PASS (os de conversão rodam porque a Task 1 instalou as ferramentas; se aparecerem como `skipped`, a instalação falhou: voltar à Task 1).

- [ ] **Step 5: Conferir uma página convertida**

Run: `python3 scripts/previa_apresentacao.py gerar --pptx clientes/sottile-teste/entrega/teste-apresentacao-gerada.pptx --saida <scratchpad>/previa` e abrir `slide-04.png` com Read.
Expected: slide com fundo escuro, título, gráfico e conclusões legíveis.

- [ ] **Step 6: Commit**

```bash
git add scripts/previa_apresentacao.py scripts/tests/test_previa_apresentacao.py
git commit -m "feat(apresentacao): prévia em PNG por slide, mapa de campos e recorte de região

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Funções puras de comentários (núcleo)

**Files:**
- Create: `src/packages/core/src/comentarios.ts`
- Test: `src/packages/core/test/comentarios.test.ts`

**Interfaces:**
- Produces: `type Regiao = { x: number; y: number; w: number; h: number }`; `interface Comentario { id: string; slide: number; regiao: Regiao | null; campo: string | null; texto: string; criadoEm: string; enviadoEm: string | null }`; `interface MapaPrevia { slides: { numero: number; titulo: string; campos: Record<string, Regiao> }[] }`; `regiaoValida(r: unknown): r is Regiao`; `campoDaRegiao(r: Regiao, campos: Record<string, Regiao>): string | null`; `textoDoAjuste(p: { titulo: string; comentarios: Comentario[]; rotulo: (slide: number) => string; recortes: Record<string, string> }): string`.

- [ ] **Step 1: Testes que falham — `test/comentarios.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { campoDaRegiao, regiaoValida, textoDoAjuste, type Comentario } from "../src/comentarios"

const campos = {
  titulo: { x: 4.4, y: 7, w: 84, h: 9 },
  imagem: { x: 3.6, y: 27, w: 64, h: 63 },
  conclusoes: { x: 69, y: 37, w: 29, h: 37 },
}

describe("comentários de slide", () => {
  it("região válida: dentro do slide e com tamanho", () => {
    expect(regiaoValida({ x: 10, y: 10, w: 20, h: 20 })).toBe(true)
    expect(regiaoValida({ x: 90, y: 10, w: 20, h: 20 })).toBe(false)
    expect(regiaoValida({ x: 10, y: 10, w: 0, h: 20 })).toBe(false)
    expect(regiaoValida({ x: "a", y: 1, w: 1, h: 1 })).toBe(false)
    expect(regiaoValida(null)).toBe(false)
  })

  it("campo da região é o de maior sobreposição", () => {
    expect(campoDaRegiao({ x: 70, y: 40, w: 25, h: 20 }, campos)).toBe("conclusoes")
    expect(campoDaRegiao({ x: 5, y: 30, w: 30, h: 30 }, campos)).toBe("imagem")
  })

  it("região que quase não toca em campo nenhum fica sem campo", () => {
    expect(campoDaRegiao({ x: 0, y: 92, w: 10, h: 7 }, campos)).toBeNull()
  })

  it("texto do ajuste numera, rotula, cita recortes e orienta o agente", () => {
    const base = { criadoEm: "2026-10-08T10:00:00.000Z", enviadoEm: null }
    const comentarios: Comentario[] = [
      { ...base, id: "c1", slide: 12, regiao: { x: 69, y: 37, w: 29, h: 37 }, campo: "conclusoes", texto: "a 2ª conclusão está errada" },
      { ...base, id: "c2", slide: 18, regiao: null, campo: null, texto: "esse slide pode sair" },
    ]
    const t = textoDoAjuste({
      titulo: "Apresentação final",
      comentarios,
      rotulo: (n) => (n === 12 ? 'Slide 12 · "ROAS Global"' : `Slide ${n}`),
      recortes: { c1: "clientes/x/.app/comentarios/e1/c1.png" },
    })
    expect(t).toContain('Ajustes em "Apresentação final" (2):')
    expect(t).toContain('1. Slide 12 · "ROAS Global" · região: conclusoes (recorte: clientes/x/.app/comentarios/e1/c1.png)')
    expect(t).toContain('   "a 2ª conclusão está errada"')
    expect(t).toContain("2. Slide 18 · slide inteiro")
    expect(t).toContain("Corrija só o roteiro nos slides citados")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/comentarios.test.ts`
Expected: FAIL (`Cannot find module '../src/comentarios'`).

- [ ] **Step 3: Implementar `src/comentarios.ts`**

```ts
/** Região de um slide em % (0 a 100). */
export type Regiao = { x: number; y: number; w: number; h: number }

export interface Comentario {
  id: string
  /** Número do slide na prévia (apresentação) ou do bloco no roteiro, a partir de 1. */
  slide: number
  regiao: Regiao | null
  /** Campo do molde que a região atinge (titulo, conclusoes…), quando há mapa. */
  campo: string | null
  texto: string
  criadoEm: string
  enviadoEm: string | null
}

export interface MapaPrevia {
  slides: { numero: number; titulo: string; campos: Record<string, Regiao> }[]
}

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v)

export function regiaoValida(r: unknown): r is Regiao {
  if (!r || typeof r !== "object") return false
  const { x, y, w, h } = r as Record<string, unknown>
  if (![x, y, w, h].every(num)) return false
  const [rx, ry, rw, rh] = [x, y, w, h] as number[]
  return rx >= 0 && ry >= 0 && rw > 0 && rh > 0 && rx + rw <= 100.01 && ry + rh <= 100.01
}

function intersecao(a: Regiao, b: Regiao): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** Campo com maior sobreposição; null se nenhum cobre ao menos 20% da região. */
export function campoDaRegiao(r: Regiao, campos: Record<string, Regiao>): string | null {
  let melhor: string | null = null
  let maior = 0
  for (const [nome, caixa] of Object.entries(campos)) {
    const area = intersecao(r, caixa)
    if (area > maior) {
      maior = area
      melhor = nome
    }
  }
  return maior >= 0.2 * r.w * r.h ? melhor : null
}

export function textoDoAjuste(p: {
  titulo: string
  comentarios: Comentario[]
  rotulo: (slide: number) => string
  recortes: Record<string, string>
}): string {
  const linhas = [`Ajustes em "${p.titulo}" (${p.comentarios.length}):`]
  p.comentarios.forEach((c, i) => {
    let onde = "slide inteiro"
    if (c.regiao) {
      onde = `região: ${c.campo ?? "área marcada"}`
      if (p.recortes[c.id]) onde += ` (recorte: ${p.recortes[c.id]})`
    }
    linhas.push(`${i + 1}. ${p.rotulo(c.slide)} · ${onde}`, `   "${c.texto.trim()}"`)
  })
  linhas.push(
    "",
    "Corrija só o roteiro nos slides citados (abra cada recorte com Read para ver a região marcada), regere a apresentação e proponha de novo.",
  )
  return linhas.join("\n")
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run test/comentarios.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/comentarios.ts src/packages/core/test/comentarios.test.ts
git commit -m "feat(core): comentários de slide (região, campo atingido e texto do ajuste)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `ServicoComentarios` e prévia em cache

**Files:**
- Create: `src/packages/core/src/previa.ts`
- Create: `src/packages/core/src/servico-comentarios.ts`
- Test: `src/packages/core/test/servico-comentarios.test.ts`

**Interfaces:**
- Consumes: `FsArmazenamento` (`lerTexto`, `gravarTexto`, `caminhoAbsoluto`, `existeArquivo`), `ServicoPlanejamento` (`estado(slug)`, `pedirAjuste(slug, id, texto)`), `encontrarEntregavel`, Task 3.
- Produces: `interface Previa { gerar(pptxAbs: string, pastaAbs: string): Promise<{ slides: number } | { erro: string }>; recortar(slideAbs: string, regiao: Regiao, saidaAbs: string): Promise<void> }`; `criarPreviaPython(raiz: string, python?: string): Previa`; `class ServicoComentarios` com `previa(slug, id): Promise<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }>` (`slides` = caminhos relativos ao prospect dos PNGs), `listar(slug, id): Promise<Comentario[]>`, `criar(slug, id, d: { slide: number; regiao: Regiao | null; texto: string }): Promise<Comentario>`, `editar(slug, id, cid, texto): Promise<void>`, `apagar(slug, id, cid): Promise<void>`, `enviar(slug, id): Promise<number>`.

- [ ] **Step 1: Testes que falham — `test/servico-comentarios.test.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import type { Previa } from "../src/previa"
import { ServicoComentarios } from "../src/servico-comentarios"
import type { Entregavel, Estado } from "../src/tipos"
import { raizTemporaria } from "./ajuda"

const SLUG = "teste-apresentacao"
let raiz: string
let arm: FsArmazenamento
let ajustes: { id: string; texto: string }[]
let geradas: number
let entregaveis: Entregavel[]
let previaFalha: string | null

const entregavel = (over: Partial<Entregavel> = {}): Entregavel => ({
  id: "e1",
  etapa: "final",
  tipo: "apresentacao",
  titulo: "Apresentação final",
  arquivoRascunho: ".app/propostas/e1.pptx",
  nomeFinal: "apresentacao-final",
  status: "pendente",
  ajustePedido: null,
  criadoEm: "2026-10-08T10:00:00.000Z",
  decididoEm: null,
  ...over,
})

const previaFalsa: Previa = {
  async gerar(_pptx, pasta) {
    if (previaFalha) return { erro: previaFalha }
    geradas++
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "slide-01.png"), "png")
    await writeFile(path.join(pasta, "slide-02.png"), "png")
    await writeFile(
      path.join(pasta, "mapa.json"),
      JSON.stringify({ slides: [{ numero: 1, titulo: "Capa", campos: {} }, { numero: 2, titulo: "Cenário Atual · ROAS", campos: { conclusoes: { x: 69, y: 37, w: 29, h: 37 } } }] }),
    )
    return { slides: 2 }
  },
  async recortar(_slide, _r, saida) {
    await mkdir(path.dirname(saida), { recursive: true })
    await writeFile(saida, "recorte")
  },
}

function servico() {
  let n = 0
  return new ServicoComentarios({
    armazenamento: arm,
    planejamento: {
      estado: async () => ({ entregaveis }) as unknown as Estado,
      pedirAjuste: async (_slug, id, texto) => {
        ajustes.push({ id, texto })
      },
    },
    previa: previaFalsa,
    agora: () => "2026-10-08T12:00:00.000Z",
    gerarId: () => `c${++n}`,
  })
}

beforeEach(async () => {
  raiz = await raizTemporaria()
  arm = new FsArmazenamento(raiz, async () => {})
  await mkdir(path.join(raiz, "clientes", SLUG, ".app/propostas"), { recursive: true })
  await writeFile(path.join(raiz, "clientes", SLUG, ".app/propostas/e1.pptx"), "pptx")
  ajustes = []
  geradas = 0
  previaFalha = null
  entregaveis = [entregavel()]
})

describe("prévia da apresentação", () => {
  it("gera uma vez por versão e devolve slides e mapa", async () => {
    const s = servico()
    const p1 = await s.previa(SLUG, "e1")
    const p2 = await s.previa(SLUG, "e1")
    expect(geradas).toBe(1)
    expect(p1).toEqual(p2)
    expect(p1.disponivel).toBe(true)
    expect(p1.slides).toEqual([".app/previas/e1/slide-01.png", ".app/previas/e1/slide-02.png"])
    expect(p1.mapa?.slides[1]?.titulo).toBe("Cenário Atual · ROAS")
  })

  it("sem LibreOffice responde indisponível com a mensagem", async () => {
    previaFalha = "LibreOffice não encontrado."
    const p = await servico().previa(SLUG, "e1")
    expect(p).toEqual({ disponivel: false, slides: [], mapa: null, erro: "LibreOffice não encontrado." })
  })

  it("só para entregáveis do tipo apresentação", async () => {
    entregaveis = [entregavel({ tipo: "html", arquivoRascunho: ".app/propostas/e1.html" })]
    await expect(servico().previa(SLUG, "e1")).rejects.toThrow("apresentação")
  })
})

describe("comentários", () => {
  it("cria com o campo atingido pela região, edita e apaga", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    const c = await s.criar(SLUG, "e1", { slide: 2, regiao: { x: 70, y: 40, w: 20, h: 20 }, texto: "  conclusão errada " })
    expect(c).toMatchObject({ id: "c1", slide: 2, campo: "conclusoes", texto: "conclusão errada", enviadoEm: null })
    await s.editar(SLUG, "e1", "c1", "conclusão 2 errada")
    expect((await s.listar(SLUG, "e1"))[0]?.texto).toBe("conclusão 2 errada")
    await s.apagar(SLUG, "e1", "c1")
    expect(await s.listar(SLUG, "e1")).toEqual([])
  })

  it("recusa texto vazio, região inválida e slide inexistente", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await expect(s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "  " })).rejects.toThrow("comentário")
    await expect(s.criar(SLUG, "e1", { slide: 1, regiao: { x: 95, y: 0, w: 10, h: 10 }, texto: "x" })).rejects.toThrow("Região")
    await expect(s.criar(SLUG, "e1", { slide: 9, regiao: null, texto: "x" })).rejects.toThrow("Slide")
  })

  it("recusa comentar versão que não está aguardando aprovação", async () => {
    entregaveis = [entregavel({ status: "substituido" })]
    await expect(servico().criar(SLUG, "e1", { slide: 1, regiao: null, texto: "x" })).rejects.toThrow("aguardando")
  })

  it("enviar recorta regiões, pede ajuste com o texto estruturado e marca como enviados", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await s.criar(SLUG, "e1", { slide: 2, regiao: { x: 70, y: 40, w: 20, h: 20 }, texto: "conclusão errada" })
    await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "tira a capa" })
    expect(await s.enviar(SLUG, "e1")).toBe(2)
    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]!.texto).toContain('Slide 2 · "Cenário Atual · ROAS" · região: conclusoes (recorte: clientes/teste-apresentacao/.app/comentarios/e1/c1.png)')
    expect(ajustes[0]!.texto).toContain('Slide 1 · "Capa" · slide inteiro')
    expect((await s.listar(SLUG, "e1")).every((c) => c.enviadoEm === "2026-10-08T12:00:00.000Z")).toBe(true)
    await expect(s.editar(SLUG, "e1", "c1", "x")).rejects.toThrow("enviado")
  })

  it("enviar sem pendentes recusa e não pede ajuste", async () => {
    await expect(servico().enviar(SLUG, "e1")).rejects.toThrow("Nenhum comentário")
    expect(ajustes).toHaveLength(0)
  })

  it("roteiro: comentário por bloco, rotulado pelo título do slide do roteiro", async () => {
    entregaveis = [entregavel({ id: "r1", tipo: "roteiro", arquivoRascunho: ".app/propostas/r1.json", nomeFinal: "roteiro-apresentacao" })]
    await writeFile(
      path.join(raiz, "clientes", SLUG, ".app/propostas/r1.json"),
      JSON.stringify({ slides: [{ tipo: "capa", prospect: "X" }, { tipo: "grafico", titulo: "Cenário Atual", subtitulo: "**ROAS**" }] }),
    )
    const s = servico()
    await s.criar(SLUG, "r1", { slide: 2, regiao: null, texto: "trocar o gráfico" })
    await expect(s.criar(SLUG, "r1", { slide: 2, regiao: { x: 1, y: 1, w: 5, h: 5 }, texto: "x" })).rejects.toThrow("roteiro")
    await s.enviar(SLUG, "r1")
    expect(ajustes[0]!.texto).toContain('Slide 2 do roteiro · grafico "Cenário Atual · ROAS" · slide inteiro')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-comentarios.test.ts`
Expected: FAIL (`Cannot find module '../src/previa'`).

- [ ] **Step 3: Implementar `src/previa.ts`**

```ts
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { Regiao } from "./comentarios"

const exec = promisify(execFile)

export interface Previa {
  gerar(pptxAbs: string, pastaAbs: string): Promise<{ slides: number } | { erro: string }>
  recortar(slideAbs: string, regiao: Regiao, saidaAbs: string): Promise<void>
}

function mensagem(e: unknown): string {
  const stderr = (e as { stderr?: string }).stderr ?? ""
  const linha = stderr.split("\n").find((l) => l.startsWith("ERRO:"))
  return linha ? linha.replace(/^ERRO:\s*/, "") : "Não consegui gerar a prévia da apresentação."
}

/** Chama scripts/previa_apresentacao.py (LibreOffice + poppler). */
export function criarPreviaPython(raiz: string, python = "python3"): Previa {
  const script = path.join(raiz, "scripts", "previa_apresentacao.py")
  return {
    async gerar(pptxAbs, pastaAbs) {
      try {
        const { stdout } = await exec(python, [script, "gerar", "--pptx", pptxAbs, "--saida", pastaAbs], { timeout: 400_000 })
        return JSON.parse(stdout) as { slides: number }
      } catch (e) {
        return { erro: mensagem(e) }
      }
    },
    async recortar(slideAbs, r, saidaAbs) {
      await exec(python, [script, "recortar", "--slide", slideAbs, "--regiao", `${r.x},${r.y},${r.w},${r.h}`, "--saida", saidaAbs], {
        timeout: 60_000,
      })
    },
  }
}
```

- [ ] **Step 4: Implementar `src/servico-comentarios.ts`**

```ts
import { campoDaRegiao, regiaoValida, textoDoAjuste, type Comentario, type MapaPrevia, type Regiao } from "./comentarios"
import type { FsArmazenamento } from "./armazenamento"
import { encontrarEntregavel } from "./entregaveis"
import { ErroEntrada, TransicaoInvalida } from "./erros"
import type { Previa } from "./previa"
import type { Entregavel, Estado } from "./tipos"

export interface DependenciasComentarios {
  armazenamento: FsArmazenamento
  planejamento: { estado(slug: string): Promise<Estado>; pedirAjuste(slug: string, id: string, texto: string): Promise<void> }
  previa: Previa
  agora?: () => string
  gerarId?: () => string
}

type SlideRoteiro = { tipo?: string; titulo?: string; subtitulo?: string; concorrente?: string }
const semNegrito = (t: unknown) => (typeof t === "string" ? t.replaceAll("**", "").trim() : "")

/** Prévia da apresentação (PNG por slide, em cache por versão) e comentários do analista. */
export class ServicoComentarios {
  private readonly arm: FsArmazenamento
  private readonly planejamento: DependenciasComentarios["planejamento"]
  private readonly gerador: Previa
  private readonly agora: () => string
  private readonly gerarId: () => string

  constructor(d: DependenciasComentarios) {
    this.arm = d.armazenamento
    this.planejamento = d.planejamento
    this.gerador = d.previa
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.gerarId = d.gerarId ?? (() => crypto.randomUUID())
  }

  private async entregavel(slug: string, id: string): Promise<Entregavel> {
    return encontrarEntregavel(await this.planejamento.estado(slug), id)
  }

  private async lerMapa(slug: string, id: string): Promise<MapaPrevia | null> {
    const texto = await this.arm.lerTexto(slug, `.app/previas/${id}/mapa.json`)
    return texto ? (JSON.parse(texto) as MapaPrevia) : null
  }

  async previa(slug: string, id: string): Promise<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }> {
    const e = await this.entregavel(slug, id)
    if (e.tipo !== "apresentacao") throw new ErroEntrada("A prévia em imagens é só para a apresentação.")
    let mapa = await this.lerMapa(slug, id)
    if (!mapa) {
      const r = await this.gerador.gerar(this.arm.caminhoAbsoluto(slug, e.arquivoRascunho), this.arm.caminhoAbsoluto(slug, `.app/previas/${id}`))
      if ("erro" in r) return { disponivel: false, slides: [], mapa: null, erro: r.erro }
      mapa = await this.lerMapa(slug, id)
    }
    const total = mapa?.slides.length ?? 0
    const slides = Array.from({ length: total }, (_, i) => `.app/previas/${id}/slide-${String(i + 1).padStart(2, "0")}.png`)
    return { disponivel: true, slides, mapa, erro: null }
  }

  async listar(slug: string, id: string): Promise<Comentario[]> {
    const texto = await this.arm.lerTexto(slug, `.app/comentarios/${id}.json`)
    return texto ? (JSON.parse(texto) as Comentario[]) : []
  }

  private async gravar(slug: string, id: string, lista: Comentario[]): Promise<void> {
    await this.arm.gravarTexto(slug, `.app/comentarios/${id}.json`, JSON.stringify(lista, null, 2))
  }

  private async roteiro(slug: string, e: Entregavel): Promise<SlideRoteiro[]> {
    const texto = await this.arm.lerTexto(slug, e.arquivoRascunho)
    const slides = texto ? (JSON.parse(texto) as { slides?: SlideRoteiro[] }).slides : null
    return Array.isArray(slides) ? slides : []
  }

  private async exigirPendente(slug: string, id: string): Promise<Entregavel> {
    const e = await this.entregavel(slug, id)
    if (e.tipo !== "apresentacao" && e.tipo !== "roteiro") throw new ErroEntrada("Comentários são para o roteiro e a apresentação.")
    if (e.status !== "pendente") throw new TransicaoInvalida("Esta versão não está aguardando aprovação.")
    return e
  }

  async criar(slug: string, id: string, d: { slide: number; regiao: Regiao | null; texto: string }): Promise<Comentario> {
    const e = await this.exigirPendente(slug, id)
    const texto = (d.texto ?? "").trim()
    if (!texto) throw new ErroEntrada("Escreva o comentário.")
    if (d.regiao !== null && !regiaoValida(d.regiao)) throw new ErroEntrada("Região inválida.")
    let campo: string | null = null
    if (e.tipo === "roteiro") {
      if (d.regiao) throw new ErroEntrada("No roteiro, comente o slide inteiro.")
      const total = (await this.roteiro(slug, e)).length
      if (!Number.isInteger(d.slide) || d.slide < 1 || d.slide > total) throw new ErroEntrada(`Slide ${d.slide} não existe no roteiro.`)
    } else {
      const mapa = await this.lerMapa(slug, id)
      const total = mapa?.slides.length ?? 0
      if (!Number.isInteger(d.slide) || d.slide < 1 || d.slide > total) throw new ErroEntrada(`Slide ${d.slide} não existe na prévia.`)
      const slide = mapa?.slides[d.slide - 1]
      if (d.regiao && slide) campo = campoDaRegiao(d.regiao, slide.campos)
    }
    const c: Comentario = { id: this.gerarId(), slide: d.slide, regiao: d.regiao, campo, texto, criadoEm: this.agora(), enviadoEm: null }
    await this.gravar(slug, id, [...(await this.listar(slug, id)), c])
    return c
  }

  private async alterar(slug: string, id: string, cid: string, f: (c: Comentario) => Comentario | null): Promise<void> {
    await this.exigirPendente(slug, id)
    const lista = await this.listar(slug, id)
    const alvo = lista.find((c) => c.id === cid)
    if (!alvo) throw new ErroEntrada("Comentário não encontrado.")
    if (alvo.enviadoEm) throw new TransicaoInvalida("Este comentário já foi enviado ao agente.")
    const novo = f(alvo)
    await this.gravar(slug, id, novo ? lista.map((c) => (c.id === cid ? novo : c)) : lista.filter((c) => c.id !== cid))
  }

  async editar(slug: string, id: string, cid: string, texto: string): Promise<void> {
    if (!texto.trim()) throw new ErroEntrada("Escreva o comentário.")
    await this.alterar(slug, id, cid, (c) => ({ ...c, texto: texto.trim() }))
  }

  async apagar(slug: string, id: string, cid: string): Promise<void> {
    await this.alterar(slug, id, cid, () => null)
  }

  async enviar(slug: string, id: string): Promise<number> {
    const e = await this.exigirPendente(slug, id)
    const lista = await this.listar(slug, id)
    const pendentes = lista.filter((c) => !c.enviadoEm).sort((a, b) => a.slide - b.slide)
    if (pendentes.length === 0) throw new ErroEntrada("Nenhum comentário novo para enviar.")
    const recortes: Record<string, string> = {}
    let rotulo: (n: number) => string
    if (e.tipo === "apresentacao") {
      const mapa = await this.lerMapa(slug, id)
      for (const c of pendentes) {
        if (!c.regiao) continue
        const rel = `.app/comentarios/${id}/${c.id}.png`
        await this.gerador.recortar(
          this.arm.caminhoAbsoluto(slug, `.app/previas/${id}/slide-${String(c.slide).padStart(2, "0")}.png`),
          c.regiao,
          this.arm.caminhoAbsoluto(slug, rel),
        )
        recortes[c.id] = `clientes/${slug}/${rel}`
      }
      rotulo = (n) => {
        const titulo = mapa?.slides[n - 1]?.titulo
        return titulo ? `Slide ${n} · "${titulo}"` : `Slide ${n}`
      }
    } else {
      const slides = await this.roteiro(slug, e)
      rotulo = (n) => {
        const s = slides[n - 1] ?? {}
        const titulo = [semNegrito(s.titulo), semNegrito(s.subtitulo), semNegrito(s.concorrente)].filter(Boolean).join(" · ")
        return `Slide ${n} do roteiro · ${s.tipo ?? "slide"}${titulo ? ` "${titulo}"` : ""}`
      }
    }
    await this.planejamento.pedirAjuste(slug, id, textoDoAjuste({ titulo: e.titulo, comentarios: pendentes, rotulo, recortes }))
    const em = this.agora()
    const enviados = new Set(pendentes.map((c) => c.id))
    await this.gravar(slug, id, lista.map((c) => (enviados.has(c.id) ? { ...c, enviadoEm: em } : c)))
    return pendentes.length
  }
}
```

Observação: se `ErroEntrada`/`TransicaoInvalida` tiverem outro nome em `src/erros.ts`, usar os nomes reais (já usados em `entregaveis.ts`).

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core/src/previa.ts src/packages/core/src/servico-comentarios.ts src/packages/core/test/servico-comentarios.test.ts
git commit -m "feat(core): prévia da apresentação em cache e comentários por slide e região

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rotas e visualizador para a apresentação no núcleo

**Files:**
- Modify: `src/apps/web/lib/servidor.ts` (instancia `ServicoComentarios`)
- Create: `src/apps/web/app/api/prospects/[slug]/entregaveis/[id]/previa/route.ts`
- Create: `src/apps/web/app/api/prospects/[slug]/entregaveis/[id]/comentarios/route.ts`
- Create: `src/apps/web/app/api/prospects/[slug]/entregaveis/[id]/comentarios/[cid]/route.ts`
- Create: `src/apps/web/app/api/prospects/[slug]/entregaveis/[id]/comentarios/enviar/route.ts`
- Modify: `src/apps/web/lib/api.ts`
- Modify: `src/packages/core/src/entregaveis.ts` + `test/entregaveis.test.ts` (`entregavelVisivel` e `htmlParaAbrir` aceitam `apresentacao`)

**Interfaces:**
- Produces: `servidor().comentarios: ServicoComentarios`; rotas `GET …/previa`, `GET|POST …/comentarios` (`POST` body `{ slide, regiao, texto }`), `PATCH|DELETE …/comentarios/[cid]` (`PATCH` body `{ texto }`), `POST …/comentarios/enviar`; em `api.ts`: `previa(slug, id)`, `comentarios(slug, id)`, `comentar(slug, id, d)`, `editarComentario(slug, id, cid, texto)`, `apagarComentario(slug, id, cid)`, `enviarComentarios(slug, id)`; `TIPOS_VISUALIZADOR = ["html", "apresentacao"]` em `entregaveis.ts`.

- [ ] **Step 1: Teste que falha (acrescentar em `entregaveis.test.ts`)**

```ts
describe("visualizador também mostra a apresentação", () => {
  const ap = (id: string, over: Partial<Entregavel> = {}): Entregavel => ({
    ...html(id),
    etapa: "final",
    tipo: "apresentacao",
    arquivoRascunho: `.app/propostas/${id}.pptx`,
    nomeFinal: "apresentacao-final",
    ...over,
  })
  it("entregavelVisivel aceita apresentação", () => {
    expect(entregavelVisivel([ap("a1")], "final", "apresentacao-final")?.id).toBe("a1")
  })
  it("apresentação nova abre o visualizador sozinha", () => {
    expect(htmlParaAbrir([], [ap("a1")], "final")).toBe("apresentacao-final")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/entregaveis.test.ts`
Expected: FAIL nos dois testes novos.

- [ ] **Step 3: Implementar em `entregaveis.ts`**

Acrescentar `export const TIPOS_VISUALIZADOR: TipoEntregavel[] = ["html", "apresentacao"]` e trocar, em `entregavelVisivel`, `e.tipo !== "html"` por `!TIPOS_VISUALIZADOR.includes(e.tipo)`; em `htmlParaAbrir`, `e.tipo === "html"` por `TIPOS_VISUALIZADOR.includes(e.tipo)`. Atualizar os comentários das duas funções ("HTML ou apresentação").

Run: `cd src/packages/core && npx vitest run`
Expected: PASS (inclusive o teste antigo "ignora a seção de texto com o mesmo nome final").

- [ ] **Step 4: `servidor.ts`**

```ts
import { criarPreviaPython } from "@workspace/core/previa"
import { ServicoComentarios } from "@workspace/core/servico-comentarios"
```
Adicionar `comentarios: ServicoComentarios` à interface `Servidor` e, depois de criar `servico`:
```ts
  const comentarios = new ServicoComentarios({ armazenamento, planejamento: servico, previa: criarPreviaPython(raiz) })
```
incluindo `comentarios` em `registro.__planejamento`.

- [ ] **Step 5: Rotas**

`…/[id]/previa/route.ts`:
```ts
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Gera (uma vez por versão) e devolve as imagens dos slides e o mapa de campos. */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/previa">) {
  try {
    const { slug, id } = await ctx.params
    return json(await servidor().comentarios.previa(slug, id))
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`…/[id]/comentarios/route.ts`:
```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import type { Regiao } from "@workspace/core/comentarios"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios">) {
  try {
    const { slug, id } = await ctx.params
    return json({ comentarios: await servidor().comentarios.listar(slug, id) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios">) {
  try {
    const { slug, id } = await ctx.params
    const d = await lerJson<{ slide?: number; regiao?: Regiao | null; texto?: string }>(req)
    const c = await servidor().comentarios.criar(slug, id, { slide: Number(d.slide), regiao: d.regiao ?? null, texto: d.texto ?? "" })
    return json({ comentario: c }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`…/comentarios/[cid]/route.ts`:
```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function PATCH(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/[cid]">) {
  try {
    const { slug, id, cid } = await ctx.params
    const { texto } = await lerJson<{ texto?: string }>(req)
    await servidor().comentarios.editar(slug, id, cid, texto ?? "")
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/[cid]">) {
  try {
    const { slug, id, cid } = await ctx.params
    await servidor().comentarios.apagar(slug, id, cid)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`…/comentarios/enviar/route.ts`:
```ts
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/enviar">) {
  try {
    const { slug, id } = await ctx.params
    return json({ enviados: await servidor().comentarios.enviar(slug, id) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

Se `json` não aceitar status como 2º argumento, usar o padrão das outras rotas (conferir `lib/http.ts`).

- [ ] **Step 6: `lib/api.ts`**

```ts
  previa: (slug: string, id: string) =>
    chamar<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }>(`${base(slug)}/entregaveis/${id}/previa`),
  comentarios: (slug: string, id: string) => chamar<{ comentarios: Comentario[] }>(`${base(slug)}/entregaveis/${id}/comentarios`),
  comentar: (slug: string, id: string, d: { slide: number; regiao: Regiao | null; texto: string }) =>
    chamar<{ comentario: Comentario }>(`${base(slug)}/entregaveis/${id}/comentarios`, comJson("POST", d)),
  editarComentario: (slug: string, id: string, cid: string, texto: string) =>
    chamar(`${base(slug)}/entregaveis/${id}/comentarios/${cid}`, comJson("PATCH", { texto })),
  apagarComentario: (slug: string, id: string, cid: string) => chamar(`${base(slug)}/entregaveis/${id}/comentarios/${cid}`, { method: "DELETE" }),
  enviarComentarios: (slug: string, id: string) => chamar<{ enviados: number }>(`${base(slug)}/entregaveis/${id}/comentarios/enviar`, { method: "POST" }),
```
com `import type { Comentario, MapaPrevia, Regiao } from "@workspace/core/comentarios"`.

- [ ] **Step 7: Conferir**

Run: `cd src && npx turbo test typecheck lint --filter=web --filter=@workspace/core`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/packages/core src/apps/web/lib src/apps/web/app/api/prospects
git commit -m "feat(web): rotas da prévia e dos comentários; visualizador aceita a apresentação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Visualizador da apresentação com comentários

**Files:**
- Create: `src/apps/web/lib/regiao.ts` + `src/apps/web/lib/regiao.test.ts`
- Create: `src/apps/web/components/trabalho/visualizador-apresentacao.tsx`
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx` (escolhe o visualizador pelo tipo)
- Modify: `src/apps/web/components/cards/previa-arquivo.tsx` + `card-entregavel.tsx` (botão "Abrir prévia" no card da apresentação)

**Interfaces:**
- Consumes: rotas e `api.*` da Task 5; `entregavelVisivel`; `urlArquivo`.
- Produces: `regiaoDoArraste(a: Ponto, b: Ponto, caixa: { left: number; top: number; width: number; height: number }): Regiao | null`; `VisualizadorApresentacao({ slug, entregavel, telaCheia, aoAlternarTelaCheia, aoFechar })` (mesma assinatura do `VisualizadorHtml`).

- [ ] **Step 1: Teste que falha — `lib/regiao.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { regiaoDoArraste } from "./regiao"

const caixa = { left: 100, top: 50, width: 1000, height: 562.5 }

describe("região arrastada sobre o slide", () => {
  it("converte o arraste em % do slide, em qualquer direção", () => {
    expect(regiaoDoArraste({ x: 700, y: 200 }, { x: 400, y: 100 }, caixa)).toEqual({ x: 30, y: 8.89, w: 30, h: 17.78 })
  })
  it("arraste que sai da imagem fica limitado às bordas", () => {
    expect(regiaoDoArraste({ x: 900, y: 500 }, { x: 2000, y: 900 }, caixa)).toEqual({ x: 80, y: 80, w: 20, h: 20 })
  })
  it("clique sem arrastar não vira região", () => {
    expect(regiaoDoArraste({ x: 500, y: 300 }, { x: 503, y: 302 }, caixa)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/regiao`
Expected: FAIL (`Cannot find module './regiao'`).

- [ ] **Step 3: `lib/regiao.ts`**

```ts
import type { Regiao } from "@workspace/core/comentarios"

export type Ponto = { x: number; y: number }

const r2 = (v: number) => Math.round(v * 100) / 100
const dentro = (v: number) => Math.min(100, Math.max(0, v))

/** Retângulo arrastado (pixels da tela) → região em % do slide. null para clique sem arraste (< 2%). */
export function regiaoDoArraste(a: Ponto, b: Ponto, caixa: { left: number; top: number; width: number; height: number }): Regiao | null {
  const px = (v: number) => dentro(((v - caixa.left) / caixa.width) * 100)
  const py = (v: number) => dentro(((v - caixa.top) / caixa.height) * 100)
  const [x1, x2, y1, y2] = [px(a.x), px(b.x), py(a.y), py(b.y)]
  const r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  if (r.w < 2 || r.h < 2) return null
  return { x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) }
}
```

Run: `cd src/apps/web && npx vitest run lib/regiao`
Expected: PASS.

- [ ] **Step 4: `components/trabalho/visualizador-apresentacao.tsx`**

```tsx
"use client"

import { DownloadIcon, Maximize2Icon, MessageSquarePlusIcon, Minimize2Icon, SendIcon, Trash2Icon, XIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react"
import { toast } from "sonner"
import type { Comentario, MapaPrevia, Regiao } from "@workspace/core/comentarios"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { regiaoDoArraste, type Ponto } from "@/lib/regiao"

type Previa = { disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }
type Rascunho = { slide: number; regiao: Regiao | null }

const pct = (r: Regiao) => ({ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` })

/** Apresentação em imagens de slide, com comentários por slide e por região (arrastar sobre o slide). */
export function VisualizadorApresentacao({
  slug,
  entregavel,
  telaCheia,
  aoAlternarTelaCheia,
  aoFechar,
}: {
  slug: string
  entregavel: Entregavel | null
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoFechar: () => void
}) {
  const id = entregavel?.id ?? null
  const [previa, setPrevia] = useState<{ id: string; dados: Previa | null } | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [texto, setTexto] = useState("")
  const [arraste, setArraste] = useState<{ slide: number; inicio: Ponto; atual: Ponto; caixa: DOMRect } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const pendentes = comentarios.filter((c) => !c.enviadoEm)
  const enviados = comentarios.filter((c) => c.enviadoEm)
  const podeComentar = entregavel?.status === "pendente"
  const dados = previa && previa.id === id ? previa.dados : undefined

  const recarregarComentarios = useCallback(async () => {
    if (!id) return
    try {
      setComentarios((await api.comentarios(slug, id)).comentarios)
    } catch {
      // sem comentários ainda
    }
  }, [slug, id])

  useEffect(() => {
    if (!id) return
    let ativo = true
    void api
      .previa(slug, id)
      .then((d) => ativo && setPrevia({ id, dados: d }))
      .catch((e) => ativo && setPrevia({ id, dados: { disponivel: false, slides: [], mapa: null, erro: mensagemDeErro(e) } }))
    void recarregarComentarios()
    return () => {
      ativo = false
    }
  }, [slug, id, recarregarComentarios])

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  function iniciarArraste(slide: number, ev: EventoPonteiro<HTMLDivElement>) {
    if (!podeComentar || ev.button !== 0) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const p = { x: ev.clientX, y: ev.clientY }
    setArraste({ slide, inicio: p, atual: p, caixa: ev.currentTarget.getBoundingClientRect() })
  }

  function terminarArraste() {
    if (!arraste) return
    const regiao = regiaoDoArraste(arraste.inicio, arraste.atual, arraste.caixa)
    setArraste(null)
    if (regiao) {
      setRascunho({ slide: arraste.slide, regiao })
      setTexto("")
    }
  }

  async function salvar() {
    if (!id || !rascunho || !texto.trim()) return
    setOcupado(true)
    try {
      await api.comentar(slug, id, { ...rascunho, texto })
      setRascunho(null)
      setTexto("")
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function apagar(cid: string) {
    if (!id) return
    try {
      await api.apagarComentario(slug, id, cid)
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    }
  }

  async function enviar() {
    if (!id) return
    setOcupado(true)
    try {
      const { enviados: n } = await api.enviarComentarios(slug, id)
      toast.success(n === 1 ? "1 ajuste enviado ao agente." : `${n} ajustes enviados ao agente.`)
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const numeroDe = (c: Comentario) => pendentes.indexOf(c) + 1
  const regiaoAoVivo = arraste ? regiaoDoArraste(arraste.inicio, arraste.atual, arraste.caixa) : null

  return (
    <section className="bg-background flex h-full min-h-0 flex-col" aria-label="Visualizador da apresentação">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Apresentação"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "default" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {entregavel && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Baixar .pptx"
              title="Baixar .pptx"
              render={<a href={urlArquivo(slug, entregavel.arquivoRascunho, true)} download />}
              nativeButton={false}
            >
              <DownloadIcon />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
            {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>

      {!entregavel ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Apresentação indisponível</EmptyTitle>
            <EmptyDescription>Esta versão não está mais entre os entregáveis da etapa.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : dados === undefined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm">
          <Spinner />
          <span className="text-muted-foreground">Gerando a prévia dos slides…</span>
        </div>
      ) : dados === null || !dados.disponivel ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Prévia indisponível</EmptyTitle>
            <EmptyDescription>{dados?.erro ?? "Não consegui gerar a prévia."} Baixe o .pptx e abra no Google Slides.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {dados.slides.map((caminho, i) => {
              const numero = i + 1
              const doSlide = pendentes.filter((c) => c.slide === numero)
              return (
                <li key={caminho} className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span className="font-mono">{numero}</span>
                    <span className="truncate">{dados.mapa?.slides[i]?.titulo}</span>
                    {podeComentar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => {
                          setRascunho({ slide: numero, regiao: null })
                          setTexto("")
                        }}
                      >
                        <MessageSquarePlusIcon /> Comentar slide
                      </Button>
                    )}
                  </div>
                  <div
                    className={cn("relative select-none", podeComentar && "cursor-crosshair")}
                    onPointerDown={(ev) => iniciarArraste(numero, ev)}
                    onPointerMove={(ev) => arraste && setArraste({ ...arraste, atual: { x: ev.clientX, y: ev.clientY } })}
                    onPointerUp={terminarArraste}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                    <img src={urlArquivo(slug, caminho)} alt={`Slide ${numero}`} draggable={false} className="w-full rounded-md border" />
                    {doSlide.map((c) =>
                      c.regiao ? (
                        <div key={c.id} className="border-primary bg-primary/10 pointer-events-none absolute rounded-sm border-2" style={pct(c.regiao)}>
                          <span className="bg-primary text-primary-foreground absolute -top-3 -left-3 flex size-6 items-center justify-center rounded-full text-xs font-medium">
                            {numeroDe(c)}
                          </span>
                        </div>
                      ) : (
                        <span
                          key={c.id}
                          className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-medium"
                        >
                          {numeroDe(c)}
                        </span>
                      ),
                    )}
                    {arraste?.slide === numero && regiaoAoVivo && (
                      <div className="border-primary pointer-events-none absolute border-2 border-dashed" style={pct(regiaoAoVivo)} />
                    )}
                    {rascunho?.slide === numero && rascunho.regiao && (
                      <div className="border-primary pointer-events-none absolute border-2 border-dashed" style={pct(rascunho.regiao)} />
                    )}
                  </div>
                  {rascunho?.slide === numero && (
                    <div className="space-y-2 rounded-md border p-2">
                      <p className="text-muted-foreground text-xs">
                        {rascunho.regiao ? "Comentário sobre a área marcada" : "Comentário sobre o slide inteiro"}
                      </p>
                      <Textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que está errado ou pode melhorar?" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={salvar} disabled={!texto.trim() || ocupado}>
                          Adicionar comentário
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRascunho(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <aside className="flex w-72 shrink-0 flex-col border-l">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Comentários</h3>
              {pendentes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {podeComentar ? "Arraste sobre um slide para marcar uma área, ou use Comentar slide." : "Esta versão não aceita mais comentários."}
                </p>
              ) : (
                <ol className="space-y-2">
                  {pendentes.map((c) => (
                    <li key={c.id} className="rounded-md border p-2 text-sm">
                      <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                        <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">{numeroDe(c)}</span>
                        Slide {c.slide} · {c.regiao ? (c.campo ?? "área marcada") : "slide inteiro"}
                        <Button variant="ghost" size="icon-sm" className="ml-auto size-6" aria-label="Apagar comentário" onClick={() => apagar(c.id)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                      {c.texto}
                    </li>
                  ))}
                </ol>
              )}
              {enviados.length > 0 && (
                <details className="text-muted-foreground text-xs">
                  <summary className="cursor-pointer">Enviados ao agente ({enviados.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {enviados.map((c) => (
                      <li key={c.id}>
                        Slide {c.slide}: {c.texto}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {podeComentar && (
              <div className="border-t p-3">
                <Button className="w-full" onClick={enviar} disabled={pendentes.length === 0 || ocupado}>
                  {ocupado ? <Spinner /> : <SendIcon />} Enviar {pendentes.length || ""} {pendentes.length === 1 ? "ajuste" : "ajustes"} ao agente
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Ligar na área de trabalho e no card**

- `area-de-trabalho.tsx`: na montagem de `painelVisualizador`, calcular `const aberto = entregavelVisivel(dados.estado.entregaveis, etapa, visualizador.nomeFinal)` e renderizar `VisualizadorApresentacao` quando `aberto?.tipo === "apresentacao"`, senão `VisualizadorHtml` (mesmas props). Atualizar o comentário "HTML novo proposto…" para "HTML ou apresentação nova…".
- `card-entregavel.tsx`: `aoAbrir` passa a ser `e.tipo === "html" || e.tipo === "apresentacao" ? () => abrir(e.etapa, e.nomeFinal) : () => abrirArquivo(e.arquivoRascunho)`.
- `previa-arquivo.tsx`, bloco `tipo === "apresentacao"`: acrescentar, antes do download, `{aoAbrir && (<Button size="sm" variant="outline" onClick={aoAbrir}><PanelRightOpenIcon /> Abrir prévia</Button>)}` dentro de `AttachmentActions`.

- [ ] **Step 6: Conferir**

Run: `cd src && npx turbo test typecheck lint --filter=web`
Expected: tudo verde, sem avisos novos nos arquivos tocados.

- [ ] **Step 7: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): prévia da apresentação com comentários por slide e por região

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Comentários por slide no card do roteiro e skill 09

**Files:**
- Modify: `src/apps/web/components/cards/previa-roteiro.tsx`
- Modify: `src/apps/web/components/cards/previa-arquivo.tsx` (passa `entregavelId` e `podeComentar` para o roteiro)
- Modify: `src/apps/web/components/cards/card-entregavel.tsx`
- Modify: `.claude/skills/09-apresentacao-final/SKILL.md` (seção "Ajustes")

**Interfaces:**
- Consumes: `api.comentarios`, `api.comentar`, `api.apagarComentario`, `api.enviarComentarios` (Task 5).
- Produces: `PreviaRoteiro({ slug, caminho, entregavelId?: string, podeComentar?: boolean })`; `PreviaArquivo` ganha `entregavelId?: string` e `podeComentar?: boolean`.

- [ ] **Step 1: `previa-roteiro.tsx`**

Acrescentar as props `entregavelId?: string` e `podeComentar?: boolean`; estado `comentarios: Comentario[]`, `abertoEm: number | null`, `texto: string`; carregar com `api.comentarios(slug, entregavelId)` quando houver `entregavelId` (mesmo padrão `ativo`/limpeza do efeito de carga). Em cada `<li>`:

```tsx
            {podeComentar && entregavelId && (
              <div className="mt-1 ml-8">
                {comentarios.filter((c) => !c.enviadoEm && c.slide === i + 1).map((c) => (
                  <p key={c.id} className="text-primary flex items-center gap-1 text-xs">
                    <MessageSquareIcon className="size-3" /> {c.texto}
                    <button type="button" className="text-muted-foreground ml-1 hover:underline" onClick={() => apagar(c.id)}>
                      apagar
                    </button>
                  </p>
                ))}
                {abertoEm === i + 1 ? (
                  <div className="mt-1 flex gap-2">
                    <Textarea autoFocus rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que mudar neste slide?" />
                    <Button size="sm" onClick={() => comentar(i + 1)} disabled={!texto.trim()}>
                      Adicionar
                    </Button>
                  </div>
                ) : (
                  <button type="button" className="text-muted-foreground text-xs hover:underline" onClick={() => { setAbertoEm(i + 1); setTexto("") }}>
                    Comentar
                  </button>
                )}
              </div>
            )}
```

e, depois da lista, quando houver pendentes:

```tsx
      {podeComentar && entregavelId && pendentes.length > 0 && (
        <Button size="sm" className="mt-2" onClick={enviar}>
          <SendIcon /> Enviar {pendentes.length} {pendentes.length === 1 ? "ajuste" : "ajustes"} ao agente
        </Button>
      )}
```

com `comentar(slide)`, `apagar(cid)` e `enviar()` chamando a API, recarregando os comentários e mostrando `toast.error(mensagemDeErro(e))` em falha (mesmo padrão do `VisualizadorApresentacao`).

- [ ] **Step 2: Repassar as props**

`previa-arquivo.tsx`: props `entregavelId?: string` e `podeComentar?: boolean`; `if (tipo === "roteiro") return <PreviaRoteiro slug={slug} caminho={caminho} entregavelId={entregavelId} podeComentar={podeComentar} />`. `card-entregavel.tsx`: passar `entregavelId={e.id}` e `podeComentar={e.status === "pendente"}`.

- [ ] **Step 3: Skill 09 — seção "Ajustes"**

Substituir o texto da seção por:

```markdown
## Ajustes

Os ajustes chegam de dois jeitos: o texto livre do "Pedir ajuste" ou a lista
estruturada que o app monta a partir dos comentários do analista, no formato:

    Ajustes em "Apresentação final" (2):
    1. Slide 12 · "Cenário Atual · ROAS Global" · região: conclusoes (recorte: clientes/<slug>/.app/comentarios/<id>/c1.png)
       "a 2ª conclusão está errada, a média é 0,40%"
    2. Slide 18 · "Benchmarking · Baunni" · slide inteiro
       "esse slide pode sair"

- Abra cada recorte com Read antes de corrigir: ele mostra a área marcada
  (contorno laranja).
- "Slide N" é a posição no deck gerado (slides com pendência foram pulados);
  ache o slide no roteiro pelo título citado. No roteiro, "Slide N do roteiro"
  é a posição no próprio roteiro.
- Altere **só** os slides citados, regere o deck e proponha de novo (roteiro,
  se mudou o conteúdo; apresentação, sempre). Nunca edite o `.pptx` à mão.
```

- [ ] **Step 4: Conferir e commitar**

Run: `cd src && npx turbo test typecheck lint --filter=web`
Expected: verde.

```bash
git add src/apps/web .claude/skills/09-apresentacao-final/SKILL.md
git commit -m "feat(web): comentários por slide no card do roteiro; skill 09 lê o ajuste estruturado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Validação ponta a ponta

**Files:**
- Create: `docs/superpowers/validacoes/2026-10-08-apresentacao-final-b.md`

- [ ] **Step 1: Suítes**

Run: `python3 -m pytest scripts/tests -q -p no:warnings && (cd src && npx turbo test typecheck lint)`
Expected: tudo verde, sem testes de prévia `skipped`.

- [ ] **Step 2: Entregável de teste pela API**

Num prospect de teste criado pela API (modo demonstração, porta livre; nunca no `sottile-teste` de produção do analista), copiar `teste-apresentacao-gerada.pptx` para `.app/rascunhos/` e propor via `demo:propor apresentacao <caminho>`. Conferir com chamadas HTTP (urllib):
- `GET …/previa` → `disponivel: true`, 14 slides, mapa com títulos;
- `POST …/comentarios` com região sobre as conclusões do slide 4 → `campo: "conclusoes"`; com slide inteiro; com região 0×0 → 400;
- `POST …/comentarios/enviar` → `enviados: 2`; o recorte `c1.png` existe e mostra a área (abrir com Read); a conversa recebeu a mensagem de ajuste estruturada; segundo envio → 400.

- [ ] **Step 3: Conferência na tela pelo analista**

Pedir ao analista que abra o prospect de teste, clique em "Abrir prévia", arraste sobre um slide, comente, envie, e confirme que o fluxo está como esperado. Registrar o retorno.

- [ ] **Step 4: Registrar e commitar**

`docs/superpowers/validacoes/2026-10-08-apresentacao-final-b.md` no formato dos registros existentes (comandos, respostas, recortes conferidos, retorno do analista). Apagar o prospect de teste (vai para a Lixeira).

```bash
git add docs/superpowers/validacoes/2026-10-08-apresentacao-final-b.md
git commit -m "docs: validação da Entrega B da apresentação final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
