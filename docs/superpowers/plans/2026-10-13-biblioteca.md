# Biblioteca de imagens do prospect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma aba "Biblioteca" na área de trabalho do prospect que reúne todas as imagens do planejamento (aprovados, propostas, anexos, insumos, criativos do benchmark, prévia de slides), filtradas por etapa, com ampliação, título editável, troca de etapa e menção no chat.

**Architecture:** O core ganha um módulo puro (`biblioteca.ts`) que classifica a lista de imagens do disco a partir do estado, do catálogo e dos ajustes manuais (`.app/biblioteca.json`). O `ServicoPlanejamento` varre as imagens, chama o classificador e grava ajustes. A web expõe `GET/PATCH /api/prospects/[slug]/biblioteca` e desenha a biblioteca como uma camada sobre as colunas de chat e painel, sem desmontar o chat.

**Tech Stack:** TypeScript, Node fs, Vitest, Next 16 (App Router, rotas de API), React 19, componentes de `@workspace/ui` (Base UI), lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-10-13-biblioteca-design.md`

## Global Constraints

- Etapas: `ORDEM_ETAPAS = ["01".."08","final"]`; a etapa 09 tem id `"final"`. Valor extra da biblioteca: `"sem-etapa"`.
- Formatos de imagem: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`. SVG fica de fora.
- O arquivo no disco nunca é renomeado, movido ou apagado pela biblioteca. Ajustes vivem só em `.app/biblioteca.json`.
- Ficam de fora da biblioteca: `.app/rascunhos/**` (inclusive `_work/`), `.app/comentarios/**`, prévias de versões anteriores da apresentação, propostas de entregáveis já aprovados.
- Textos de interface e código em `src/packages/core/src`, `src/apps/web/{app,components,hooks,lib}`: travessão (—) só entre números (teste `sem-travessao.test.ts`). Usar `·` ou vírgula.
- Português em nomes de código, comentários e mensagens, como no resto do repositório. Comentários só onde o porquê não é óbvio.
- Nada de PII: a biblioteca só mostra imagens e caminhos; nenhum texto de planilha é lido.
- Comandos rodam a partir de `src/` (monorepo Turbo). Testes do core: `cd src/packages/core && npx vitest run <arquivo>`. Testes da web: `cd src/apps/web && npx vitest run <arquivo>`. Typecheck geral: `cd src && npm run typecheck`. Lint: `cd src && npm run lint`.

## Review Focus

1. **Nome de arquivo com espaço ou acento** (`ação de mídia.png`): deve ser classificado, ter título legível ("Ação de mídia") e abrir pela rota `arquivo` (o `urlArquivo` já codifica). Teste no Task 1.
2. **Pasta de anúncio do benchmark só com vídeo** (`video.mp4`, sem imagem): não pode gerar card vazio nem quebrar a grade. Teste no Task 1.
3. **`biblioteca.json` com formato errado** (array, `null`, etapa inexistente, título não texto): lido como vazio ou com as entradas inválidas descartadas, sem derrubar a tela. Teste no Task 1 (`sanearAjustes`) e no Task 2 (JSON corrompido).
4. **"Mencionar no chat" com a etapa selecionada sem chat** (etapa liberada ou bloqueada mostra `EtapaLiberada`, sem compositor): deve avisar com toast em vez de não fazer nada em silêncio. Coberto no Task 6, verificação manual no Task 7.
5. **Setas do teclado enquanto o título está em edição**: ← → movem o cursor no campo, não trocam de imagem. Coberto no Task 5 (checagem de `INPUT/TEXTAREA/SELECT` no `onKeyDown`), verificação manual no Task 7.

---

## File Structure

**Core (`src/packages/core/`)**
- Create `src/biblioteca.ts`: tipos da biblioteca, `classificarBiblioteca`, `tituloLegivel`, `aplicarAjuste`, `sanearAjustes`, `ehImagem`, `etapaBibliotecaValida`, `ORDEM_BIBLIOTECA`, `SEM_ETAPA`. Puro, sem disco.
- Create `test/biblioteca.test.ts`.
- Modify `src/armazenamento.ts`: `listarImagensDoProspect(slug)`.
- Modify `src/servico-planejamento.ts`: `listarBiblioteca`, `ajustarBiblioteca`, `lerAjustes` (privado); `salvarAnexo` passa a receber a etapa e publica `{ tipo: "estado" }`.
- Modify `test/armazenamento.test.ts`, `test/servico-planejamento.test.ts`.

**Web (`src/apps/web/`)**
- Create `app/api/prospects/[slug]/biblioteca/route.ts`: GET e PATCH.
- Modify `app/api/prospects/[slug]/arquivo/route.ts`: MIME de webp/gif e revalidação por `Last-Modified` para imagens.
- Modify `app/api/prospects/[slug]/etapas/[etapa]/anexos/route.ts`: repassa a etapa.
- Modify `lib/api.ts`: `biblioteca`, `ajustarBiblioteca`.
- Create `lib/biblioteca.ts` + `lib/biblioteca.test.ts`: filtros, contagens, agrupamentos, rótulos. Puro.
- Create `hooks/use-biblioteca.ts`.
- Create `components/biblioteca/card-imagem.tsx`, `components/biblioteca/imagem-ampliada.tsx`, `components/biblioteca/biblioteca.tsx`.
- Modify `components/trabalho/trilha-etapas.tsx`: item "Biblioteca".
- Modify `components/trabalho/area-de-trabalho.tsx`: estado `bibliotecaAberta`, camada sobre as colunas, menção.

---

### Task 1: Classificador puro da biblioteca (core)

**Files:**
- Create: `src/packages/core/src/biblioteca.ts`
- Test: `src/packages/core/test/biblioteca.test.ts`

**Interfaces:**
- Consumes: `destinoAprovado(e)` de `src/entregaveis.ts`; `ORDEM_ETAPAS`, `Catalogo`, `Entregavel`, `Estado`, `EtapaId` de `src/tipos.ts`.
- Produces (usado pelos Tasks 2, 3, 4, 5, 6):
  ```ts
  export const SEM_ETAPA = "sem-etapa"
  export type EtapaBiblioteca = EtapaId | typeof SEM_ETAPA
  export const ORDEM_BIBLIOTECA: readonly EtapaBiblioteca[]
  export type OrigemImagem = "aprovado" | "proposta" | "substituido" | "anexo" | "insumo" | "benchmark" | "previa"
  export type GrupoImagem = { tipo: "anuncio"; marca: string } | { tipo: "previa" }
  export interface ItemBiblioteca { id: string; caminho: string; origem: OrigemImagem; etapa: EtapaBiblioteca; titulo: string; nomeArquivo: string; grupo?: GrupoImagem; imagens: string[]; capa: string; modificadoEm: string }
  export interface AjusteBiblioteca { etapa?: EtapaBiblioteca; titulo?: string }
  export type AjustesBiblioteca = Record<string, AjusteBiblioteca>
  export interface ArquivoBiblioteca { caminho: string; modificadoEm: string }
  export function ehImagem(caminho: string): boolean
  export function etapaBibliotecaValida(v: unknown): v is EtapaBiblioteca
  export function tituloLegivel(nomeArquivo: string): string
  export function classificarBiblioteca(e: { arquivos: ArquivoBiblioteca[]; estado: Estado; catalogo: Catalogo; ajustes: AjustesBiblioteca }): ItemBiblioteca[]
  export function aplicarAjuste(ajustes: AjustesBiblioteca, caminho: string, mudanca: AjusteBiblioteca): AjustesBiblioteca
  export function sanearAjustes(bruto: unknown): AjustesBiblioteca
  ```

- [ ] **Step 1: Write the failing test**

Create `src/packages/core/test/biblioteca.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  aplicarAjuste,
  classificarBiblioteca,
  sanearAjustes,
  tituloLegivel,
  type AjustesBiblioteca,
  type ArquivoBiblioteca,
} from "../src/biblioteca"
import { estadoInicial } from "../src/maquina-estados"
import type { Entregavel, Estado } from "../src/tipos"
import { catalogoReal } from "./ajuda"

const catalogo = catalogoReal()
const T = "2026-10-01T10:00:00.000Z"
const DEPOIS = "2026-10-02T10:00:00.000Z"

function arq(caminho: string, modificadoEm = T): ArquivoBiblioteca {
  return { caminho, modificadoEm }
}

function entregavel(p: Partial<Entregavel> & Pick<Entregavel, "id">): Entregavel {
  return {
    etapa: "03",
    tipo: "grafico",
    titulo: "Gráfico",
    arquivoRascunho: `.app/propostas/${p.id}.png`,
    nomeFinal: "grafico",
    status: "pendente",
    ajustePedido: null,
    criadoEm: T,
    decididoEm: null,
    ...p,
  }
}

function estadoCom(entregaveis: Entregavel[] = []): Estado {
  return { ...estadoInicial({ slug: "iszi", nome: "Iszi", site: null }, T), entregaveis }
}

function classificar(arquivos: ArquivoBiblioteca[], estado = estadoCom(), ajustes: AjustesBiblioteca = {}) {
  return classificarBiblioteca({ arquivos, estado, catalogo, ajustes })
}

describe("título legível", () => {
  it("tira extensão, prefixo de anexo e hífens, e põe a primeira letra em maiúscula", () => {
    expect(tituloLegivel("cac-mensal.png")).toBe("Cac mensal")
    expect(tituloLegivel("1728830000000-print_ads.png")).toBe("Print ads")
    expect(tituloLegivel("2025-ranking.png")).toBe("2025 ranking")
    expect(tituloLegivel("ação de mídia.png")).toBe("Ação de mídia")
    expect(tituloLegivel(".png")).toBe(".png")
  })
})

describe("aprovados", () => {
  it("pega etapa e título do entregável aprovado; sem entregável vai para sem-etapa", () => {
    const estado = estadoCom([entregavel({ id: "a1", etapa: "04", status: "aprovado", nomeFinal: "cac-mensal", titulo: "CAC mensal" })])
    const itens = classificar(
      [arq("entrega/ativos-aprovados/graficos/cac-mensal.png"), arq("entrega/ativos-aprovados/graficos/roas-mensal.png"), arq(".app/propostas/a1.png")],
      estado,
    )
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa, i.titulo])).toEqual([
      ["entrega/ativos-aprovados/graficos/cac-mensal.png", "aprovado", "04", "CAC mensal"],
      ["entrega/ativos-aprovados/graficos/roas-mensal.png", "aprovado", "sem-etapa", "Roas mensal"],
    ])
    expect(itens[0]).toMatchObject({ id: itens[0]!.caminho, nomeArquivo: "cac-mensal.png", imagens: [itens[0]!.caminho], capa: itens[0]!.caminho })
  })

  it("aceita nome com espaço e acento", () => {
    const [item] = classificar([arq("entrega/ativos-aprovados/graficos/ação de mídia.png")])
    expect(item).toMatchObject({ origem: "aprovado", titulo: "Ação de mídia", nomeArquivo: "ação de mídia.png" })
  })
})

describe("propostas", () => {
  it("pendente vira proposta, substituída vira substituido, órfã fica de fora", () => {
    const estado = estadoCom([
      entregavel({ id: "p1", etapa: "05", titulo: "Cenários" }),
      entregavel({ id: "p0", etapa: "05", status: "substituido", titulo: "Cenários antigos" }),
    ])
    const itens = classificar([arq(".app/propostas/p1.png"), arq(".app/propostas/p0.png"), arq(".app/propostas/orfa.png")], estado)
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa, i.titulo])).toEqual([
      [".app/propostas/p0.png", "substituido", "05", "Cenários antigos"],
      [".app/propostas/p1.png", "proposta", "05", "Cenários"],
    ])
  })
})

describe("anexos e insumos", () => {
  it("anexo na pasta da etapa fica na etapa; solto ou em pasta desconhecida vai para sem-etapa", () => {
    const itens = classificar([
      arq(".app/anexos/02/1728830000000-print_ads.png"),
      arq(".app/anexos/1728830000000-antigo.png"),
      arq(".app/anexos/xx/1-a.png"),
    ])
    // Dentro de sem-etapa, mesma data: desempate pelo caminho.
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa])).toEqual([
      [".app/anexos/02/1728830000000-print_ads.png", "anexo", "02"],
      [".app/anexos/1728830000000-antigo.png", "anexo", "sem-etapa"],
      [".app/anexos/xx/1-a.png", "anexo", "sem-etapa"],
    ])
    expect(itens[0]!.titulo).toBe("Print ads")
  })

  it("imagem na pasta de um insumo do catálogo fica na etapa dona do insumo", () => {
    const itens = classificar([arq("contexto/brutos/prints-campanhas/meta.jpg"), arq("contexto/brutos/prints-campanhas/relatorio.pdf")])
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa])).toEqual([["contexto/brutos/prints-campanhas/meta.jpg", "insumo", "07"]])
  })
})

describe("benchmark", () => {
  it("um item por anúncio, capa primeiro, etapa 06; pasta sem imagem não gera item", () => {
    const base = "dados/benchmark-meta/insider/midia"
    const itens = classificar([
      arq(`${base}/123/video-1-quadro-1.jpg`),
      arq(`${base}/123/video-1-capa.jpg`, DEPOIS),
      arq(`${base}/456/imagem-1.jpg`),
      arq(`${base}/789/video.mp4`),
    ])
    expect(itens).toHaveLength(2)
    const anuncio = itens.find((i) => i.caminho === `${base}/123`)!
    expect(anuncio).toMatchObject({
      origem: "benchmark",
      etapa: "06",
      titulo: "insider · anúncio 123",
      nomeArquivo: "123",
      grupo: { tipo: "anuncio", marca: "insider" },
      capa: `${base}/123/video-1-capa.jpg`,
      imagens: [`${base}/123/video-1-capa.jpg`, `${base}/123/video-1-quadro-1.jpg`],
      modificadoEm: DEPOIS,
    })
    expect(itens.find((i) => i.caminho === `${base}/456`)!.capa).toBe(`${base}/456/imagem-1.jpg`)
  })
})

describe("prévia da apresentação", () => {
  const velha = entregavel({ id: "v1", tipo: "apresentacao", etapa: "final", criadoEm: T, arquivoRascunho: ".app/propostas/v1.pptx" })
  const nova = entregavel({ id: "v2", tipo: "apresentacao", etapa: "final", criadoEm: DEPOIS, arquivoRascunho: ".app/propostas/v2.pptx" })

  it("só a versão mais recente com slides, em ordem, num item só", () => {
    const itens = classificar(
      [arq(".app/previas/v1/slide-01.png"), arq(".app/previas/v2/slide-02.png"), arq(".app/previas/v2/slide-01.png")],
      estadoCom([velha, nova]),
    )
    expect(itens).toEqual([
      {
        id: ".app/previas/v2",
        caminho: ".app/previas/v2",
        origem: "previa",
        etapa: "final",
        titulo: "Apresentação, prévia (2 slides)",
        nomeArquivo: "v2",
        grupo: { tipo: "previa" },
        imagens: [".app/previas/v2/slide-01.png", ".app/previas/v2/slide-02.png"],
        capa: ".app/previas/v2/slide-01.png",
        modificadoEm: T,
      },
    ])
  })

  it("se a versão nova ainda não tem prévia, mostra a anterior", () => {
    const itens = classificar([arq(".app/previas/v1/slide-01.png")], estadoCom([velha, nova]))
    expect(itens.map((i) => [i.caminho, i.titulo])).toEqual([[".app/previas/v1", "Apresentação, prévia (1 slide)"]])
  })
})

describe("o que fica de fora", () => {
  it("rascunhos, recortes de comentário, não imagens e imagens soltas fora das origens", () => {
    const itens = classificar([
      arq(".app/rascunhos/x.png"),
      arq(".app/rascunhos/_work/y.png"),
      arq(".app/comentarios/c1/recorte.png"),
      arq("contexto/notas.md"),
      arq("dados/grafico-solto.png"),
      arq("entrega/ativos-aprovados/graficos/vetor.svg"),
    ])
    expect(itens).toEqual([])
  })
})

describe("ajustes e ordem", () => {
  it("ajuste sobrescreve etapa (inclusive para sem-etapa) e título; ajuste de caminho inexistente é ignorado", () => {
    const estado = estadoCom([entregavel({ id: "a1", etapa: "04", status: "aprovado", nomeFinal: "cac", titulo: "CAC" })])
    const itens = classificar(
      [arq("entrega/ativos-aprovados/graficos/cac.png"), arq("entrega/ativos-aprovados/graficos/roas.png")],
      estado,
      {
        "entrega/ativos-aprovados/graficos/cac.png": { etapa: "sem-etapa" },
        "entrega/ativos-aprovados/graficos/roas.png": { etapa: "03", titulo: "ROAS por mês" },
        "entrega/ativos-aprovados/graficos/apagado.png": { etapa: "02" },
      },
    )
    expect(itens.map((i) => [i.caminho, i.etapa, i.titulo])).toEqual([
      ["entrega/ativos-aprovados/graficos/roas.png", "03", "ROAS por mês"],
      ["entrega/ativos-aprovados/graficos/cac.png", "sem-etapa", "CAC"],
    ])
  })

  it("ordena por etapa (final antes de sem-etapa) e, dentro da etapa, do mais novo para o mais velho", () => {
    const itens = classificar(
      [
        arq("entrega/ativos-aprovados/graficos/solto.png"),
        arq(".app/anexos/final/1-capa.png"),
        arq(".app/anexos/03/1-velho.png", T),
        arq(".app/anexos/03/2-novo.png", DEPOIS),
      ],
    )
    expect(itens.map((i) => i.caminho)).toEqual([
      ".app/anexos/03/2-novo.png",
      ".app/anexos/03/1-velho.png",
      ".app/anexos/final/1-capa.png",
      "entrega/ativos-aprovados/graficos/solto.png",
    ])
  })
})

describe("aplicarAjuste", () => {
  it("grava etapa e título, título vazio volta ao automático, ajuste vazio sai do arquivo", () => {
    let a = aplicarAjuste({}, "x.png", { etapa: "03", titulo: "  CAC  " })
    expect(a).toEqual({ "x.png": { etapa: "03", titulo: "CAC" } })
    a = aplicarAjuste(a, "x.png", { titulo: "" })
    expect(a).toEqual({ "x.png": { etapa: "03" } })
    a = aplicarAjuste({ "y.png": { titulo: "Y" } }, "y.png", { titulo: "   " })
    expect(a).toEqual({})
  })
})

describe("sanearAjustes", () => {
  it("formato errado vira vazio e entradas inválidas são descartadas", () => {
    expect(sanearAjustes(null)).toEqual({})
    expect(sanearAjustes([1, 2])).toEqual({})
    expect(sanearAjustes("oi")).toEqual({})
    expect(
      sanearAjustes({
        "a.png": { etapa: "03", titulo: " A " },
        "b.png": { etapa: "99", titulo: 5 },
        "c.png": null,
        "d.png": { etapa: "sem-etapa" },
      }),
    ).toEqual({ "a.png": { etapa: "03", titulo: "A" }, "d.png": { etapa: "sem-etapa" } })
  })
})
```


- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/packages/core && npx vitest run test/biblioteca.test.ts`
Expected: FAIL with "Failed to resolve import \"../src/biblioteca\"".

- [ ] **Step 3: Write the implementation**

Create `src/packages/core/src/biblioteca.ts`:

```ts
import { destinoAprovado } from "./entregaveis"
import { ORDEM_ETAPAS, type Catalogo, type Entregavel, type Estado, type EtapaId } from "./tipos"

export const SEM_ETAPA = "sem-etapa"
export type EtapaBiblioteca = EtapaId | typeof SEM_ETAPA
export const ORDEM_BIBLIOTECA: readonly EtapaBiblioteca[] = [...ORDEM_ETAPAS, SEM_ETAPA]

export type OrigemImagem = "aprovado" | "proposta" | "substituido" | "anexo" | "insumo" | "benchmark" | "previa"
export type GrupoImagem = { tipo: "anuncio"; marca: string } | { tipo: "previa" }

export interface ItemBiblioteca {
  /** = caminho: estável entre recargas. */
  id: string
  /** Relativo à pasta do prospect; num grupo (anúncio, prévia), a pasta do grupo. */
  caminho: string
  origem: OrigemImagem
  etapa: EtapaBiblioteca
  titulo: string
  nomeArquivo: string
  grupo?: GrupoImagem
  /** Uma imagem num item simples; todas as do grupo, capa primeiro. */
  imagens: string[]
  capa: string
  modificadoEm: string
}

export interface AjusteBiblioteca {
  etapa?: EtapaBiblioteca
  titulo?: string
}
export type AjustesBiblioteca = Record<string, AjusteBiblioteca>

export interface ArquivoBiblioteca {
  caminho: string
  modificadoEm: string
}

const IMAGEM = /\.(png|jpe?g|webp|gif)$/i
const BENCHMARK = /^dados\/benchmark-meta\/([^/]+)\/midia\/([^/]+)\/[^/]+$/
const PREVIA = /^\.app\/previas\/([^/]+)\/slide-\d+\.png$/i

export function ehImagem(caminho: string): boolean {
  return IMAGEM.test(caminho)
}

export function etapaBibliotecaValida(v: unknown): v is EtapaBiblioteca {
  return typeof v === "string" && (ORDEM_BIBLIOTECA as readonly string[]).includes(v)
}

const nomeDe = (caminho: string) => caminho.split("/").pop() ?? caminho

/** "1728830000000-print_ads.png" → "Print ads". O prefixo numérico longo é o carimbo de hora do anexo. */
export function tituloLegivel(nomeArquivo: string): string {
  const limpo = nomeArquivo
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{10,}-/, "")
    .replace(/[-_]+/g, " ")
    .trim()
  if (!limpo) return nomeArquivo
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

function maisRecente(arquivos: ArquivoBiblioteca[]): string {
  return arquivos.reduce((max, a) => (a.modificadoEm > max ? a.modificadoEm : max), arquivos[0]!.modificadoEm)
}

function pastasDeInsumoComImagem(catalogo: Catalogo): { pasta: string; etapa: EtapaBiblioteca }[] {
  return catalogo.insumos
    .filter((i) => i.tipo === "arquivo" && i.destino.endsWith("/") && i.formatos.some((f) => ehImagem(`x${f}`)))
    .map((i) => ({ pasta: i.destino, etapa: catalogo.etapas.find((e) => e.insumos.some((r) => r.id === i.id))?.id ?? SEM_ETAPA }))
}

export function classificarBiblioteca({
  arquivos,
  estado,
  catalogo,
  ajustes,
}: {
  arquivos: ArquivoBiblioteca[]
  estado: Estado
  catalogo: Catalogo
  ajustes: AjustesBiblioteca
}): ItemBiblioteca[] {
  const aprovados = new Map<string, Entregavel>()
  const porProposta = new Map<string, Entregavel>()
  for (const e of estado.entregaveis) {
    porProposta.set(e.arquivoRascunho, e)
    if (e.status === "aprovado") aprovados.set(destinoAprovado(e), e)
  }
  const pastasInsumo = pastasDeInsumoComImagem(catalogo)
  const itens: ItemBiblioteca[] = []
  const anuncios = new Map<string, { marca: string; anuncio: string; arquivos: ArquivoBiblioteca[] }>()
  const previas = new Map<string, ArquivoBiblioteca[]>()

  for (const a of arquivos) {
    const c = a.caminho
    if (!ehImagem(c) || c.startsWith(".app/rascunhos/") || c.startsWith(".app/comentarios/")) continue
    const nome = nomeDe(c)
    const simples = (origem: OrigemImagem, etapa: EtapaBiblioteca, titulo?: string) =>
      itens.push({ id: c, caminho: c, origem, etapa, titulo: titulo ?? tituloLegivel(nome), nomeArquivo: nome, imagens: [c], capa: c, modificadoEm: a.modificadoEm })

    const anuncio = BENCHMARK.exec(c)
    const previa = PREVIA.exec(c)
    if (c.startsWith("entrega/ativos-aprovados/")) {
      const e = aprovados.get(c)
      simples("aprovado", e?.etapa ?? SEM_ETAPA, e?.titulo)
    } else if (c.startsWith(".app/propostas/")) {
      const e = porProposta.get(c)
      // A cópia aprovada já aparece em ativos-aprovados/.
      if (!e || e.status === "aprovado") continue
      simples(e.status === "pendente" ? "proposta" : "substituido", e.etapa, e.titulo)
    } else if (c.startsWith(".app/anexos/")) {
      const partes = c.split("/")
      const pasta = partes.length === 4 ? partes[2]! : ""
      simples("anexo", (ORDEM_ETAPAS as readonly string[]).includes(pasta) ? (pasta as EtapaId) : SEM_ETAPA)
    } else if (anuncio) {
      const [, marca, id] = anuncio
      const pasta = `dados/benchmark-meta/${marca}/midia/${id}`
      const grupo = anuncios.get(pasta) ?? { marca: marca!, anuncio: id!, arquivos: [] }
      grupo.arquivos.push(a)
      anuncios.set(pasta, grupo)
    } else if (previa) {
      const id = previa[1]!
      previas.set(id, [...(previas.get(id) ?? []), a])
    } else {
      const insumo = pastasInsumo.find((p) => c.startsWith(p.pasta))
      if (insumo) simples("insumo", insumo.etapa)
    }
  }

  for (const [pasta, g] of anuncios) {
    const ordenadas = g.arquivos.map((x) => x.caminho).sort()
    const capa = ordenadas.find((x) => nomeDe(x).toLowerCase().includes("capa")) ?? ordenadas[0]!
    itens.push({
      id: pasta,
      caminho: pasta,
      origem: "benchmark",
      etapa: "06",
      titulo: `${g.marca} · anúncio ${g.anuncio}`,
      nomeArquivo: g.anuncio,
      grupo: { tipo: "anuncio", marca: g.marca },
      imagens: [capa, ...ordenadas.filter((x) => x !== capa)],
      capa,
      modificadoEm: maisRecente(g.arquivos),
    })
  }

  const apresentacao = estado.entregaveis
    .filter((e) => e.tipo === "apresentacao" && previas.has(e.id))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))[0]
  if (apresentacao) {
    const slides = previas.get(apresentacao.id)!
    const imagens = slides.map((x) => x.caminho).sort()
    const pasta = `.app/previas/${apresentacao.id}`
    itens.push({
      id: pasta,
      caminho: pasta,
      origem: "previa",
      etapa: "final",
      titulo: `Apresentação, prévia (${imagens.length} ${imagens.length === 1 ? "slide" : "slides"})`,
      nomeArquivo: apresentacao.id,
      grupo: { tipo: "previa" },
      imagens,
      capa: imagens[0]!,
      modificadoEm: maisRecente(slides),
    })
  }

  const ordem = (e: EtapaBiblioteca) => ORDEM_BIBLIOTECA.indexOf(e)
  return itens
    .map((i) => {
      const aj = ajustes[i.caminho]
      if (!aj) return i
      return { ...i, ...(aj.etapa ? { etapa: aj.etapa } : {}), ...(aj.titulo ? { titulo: aj.titulo } : {}) }
    })
    .sort(
      (a, b) =>
        ordem(a.etapa) - ordem(b.etapa) ||
        (a.modificadoEm < b.modificadoEm ? 1 : a.modificadoEm > b.modificadoEm ? -1 : 0) ||
        (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0),
    )
}

/** Título vazio apaga o título do ajuste (volta ao automático); ajuste sem nada sai do mapa. */
export function aplicarAjuste(ajustes: AjustesBiblioteca, caminho: string, mudanca: AjusteBiblioteca): AjustesBiblioteca {
  const atual: AjusteBiblioteca = { ...ajustes[caminho] }
  if (mudanca.etapa !== undefined) atual.etapa = mudanca.etapa
  if (mudanca.titulo !== undefined) {
    const titulo = mudanca.titulo.trim()
    if (titulo) atual.titulo = titulo
    else delete atual.titulo
  }
  const novo = { ...ajustes }
  if (atual.etapa === undefined && atual.titulo === undefined) delete novo[caminho]
  else novo[caminho] = atual
  return novo
}

/** O biblioteca.json é editável à mão: o que não tiver a forma esperada é descartado. */
export function sanearAjustes(bruto: unknown): AjustesBiblioteca {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {}
  const ajustes: AjustesBiblioteca = {}
  for (const [caminho, valor] of Object.entries(bruto)) {
    if (!valor || typeof valor !== "object") continue
    const { etapa, titulo } = valor as Record<string, unknown>
    const ajuste: AjusteBiblioteca = {}
    if (etapaBibliotecaValida(etapa)) ajuste.etapa = etapa
    if (typeof titulo === "string" && titulo.trim()) ajuste.titulo = titulo.trim()
    if (ajuste.etapa !== undefined || ajuste.titulo !== undefined) ajustes[caminho] = ajuste
  }
  return ajustes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src/packages/core && npx vitest run test/biblioteca.test.ts test/sem-travessao.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/biblioteca.ts src/packages/core/test/biblioteca.test.ts
git commit -m "feat(core): classificador da biblioteca de imagens"
```

---

### Task 2: Varredura, ajustes e anexos por etapa no serviço (core + rota de anexos)

**Files:**
- Modify: `src/packages/core/src/armazenamento.ts` (novo método em `FsArmazenamento`, depois de `listarArquivosDoProspect`)
- Modify: `src/packages/core/src/servico-planejamento.ts` (imports; `salvarAnexo` em ~489; métodos novos na seção `// ---------- leitura ----------`)
- Modify: `src/apps/web/app/api/prospects/[slug]/etapas/[etapa]/anexos/route.ts`
- Test: `src/packages/core/test/armazenamento.test.ts`, `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Consumes (Task 1): `classificarBiblioteca`, `aplicarAjuste`, `sanearAjustes`, `etapaBibliotecaValida`, `ehImagem`, tipos `ItemBiblioteca`, `AjustesBiblioteca`, `EtapaBiblioteca`.
- Produces:
  ```ts
  // FsArmazenamento
  listarImagensDoProspect(slug: string): Promise<ArquivoProspect[]>
  // ServicoPlanejamento
  listarBiblioteca(slug: string): Promise<ItemBiblioteca[]>
  ajustarBiblioteca(slug: string, caminho: string, mudanca: { etapa?: unknown; titulo?: unknown }): Promise<ItemBiblioteca>
  salvarAnexo(slug: string, etapa: EtapaId, nomeOriginal: string, dados: Uint8Array): Promise<string> // "clientes/<slug>/.app/anexos/<etapa>/<ts>-<nome>"
  ```
  Erros: etapa inválida ou `titulo` não texto → `ErroEntrada` (400); caminho fora do prospect → `ErroCaminhoForaDoProspect` (400); caminho que não é item da biblioteca → `ErroNaoEncontrado` (404).

- [ ] **Step 1: Write the failing tests**

Append to `src/packages/core/test/armazenamento.test.ts` (uses the `arm` that the file's `beforeEach` builds over a `raizTemporaria()`):

```ts
describe("imagens do prospect para a biblioteca", () => {
  it("lista imagens de qualquer pasta, inclusive .app, sem ocultos nem não imagens", async () => {
    await arm.criarPasta("iszi")
    const um = new Uint8Array([1])
    await arm.gravarBinario("iszi", "entrega/ativos-aprovados/graficos/cac.png", um)
    await arm.gravarBinario("iszi", ".app/previas/x/slide-01.png", um)
    await arm.gravarBinario("iszi", "dados/benchmark-meta/m/midia/1/capa.JPG", um)
    await arm.gravarBinario("iszi", "dados/.oculto.png", um)
    await arm.gravarTexto("iszi", "contexto/notas.md", "x")
    const caminhos = (await arm.listarImagensDoProspect("iszi")).map((a) => a.caminho)
    expect(caminhos).toEqual(
      expect.arrayContaining([
        "entrega/ativos-aprovados/graficos/cac.png",
        ".app/previas/x/slide-01.png",
        "dados/benchmark-meta/m/midia/1/capa.JPG",
      ]),
    )
    expect(caminhos).not.toContain("dados/.oculto.png")
    expect(caminhos).not.toContain("contexto/notas.md")
    expect((await arm.listarImagensDoProspect("iszi"))[0]!.modificadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
```

Append to `src/packages/core/test/servico-planejamento.test.ts` (reuses `raiz`, `servico`, `barramento`, `eventos` from the file's `beforeEach`; add `ErroCaminhoForaDoProspect, ErroNaoEncontrado` to the existing `../src/erros` import):

```ts
describe("biblioteca", () => {
  async function imagem(slug: string, rel: string) {
    const abs = path.join(raiz, "clientes", slug, rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, "png")
  }

  it("anexo vai para a pasta da etapa, aparece na biblioteca e avisa as telas abertas", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    barramento.assinar(slug, (ev) => eventos.push(ev))
    const caminho = await servico.salvarAnexo(slug, "02", "Print Ads.png", new Uint8Array([1]))
    expect(caminho).toMatch(/^clientes\/iszi-cosmeticos\/\.app\/anexos\/02\/\d+-Print_Ads\.png$/)
    expect(eventos).toContainEqual({ tipo: "estado" })
    const anexo = (await servico.listarBiblioteca(slug)).find((i) => i.origem === "anexo")
    expect(anexo).toMatchObject({ etapa: "02", titulo: "Print Ads" })
  })

  it("ajusta etapa e título; título vazio volta ao automático; avisa as telas", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac-mensal.png"
    await imagem(slug, rel)
    barramento.assinar(slug, (ev) => eventos.push(ev))

    let item = await servico.ajustarBiblioteca(slug, rel, { etapa: "04", titulo: "CAC mensal (12 meses)" })
    expect(item).toMatchObject({ caminho: rel, etapa: "04", titulo: "CAC mensal (12 meses)" })
    expect(eventos).toContainEqual({ tipo: "estado" })
    const salvo = JSON.parse(await readFile(path.join(raiz, "clientes", slug, ".app/biblioteca.json"), "utf8"))
    expect(salvo).toEqual({ [rel]: { etapa: "04", titulo: "CAC mensal (12 meses)" } })

    item = await servico.ajustarBiblioteca(slug, rel, { titulo: "  " })
    expect(item).toMatchObject({ etapa: "04", titulo: "Cac mensal" })
  })

  it("recusa etapa inválida, título não texto, caminho fora do prospect e arquivo que não é imagem da biblioteca", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac.png"
    await imagem(slug, rel)
    await expect(servico.ajustarBiblioteca(slug, rel, { etapa: "09" })).rejects.toBeInstanceOf(ErroEntrada)
    await expect(servico.ajustarBiblioteca(slug, rel, { titulo: 5 })).rejects.toBeInstanceOf(ErroEntrada)
    await expect(servico.ajustarBiblioteca(slug, "../outro/x.png", { etapa: "03" })).rejects.toBeInstanceOf(ErroCaminhoForaDoProspect)
    await expect(servico.ajustarBiblioteca(slug, "CLAUDE.md", { etapa: "03" })).rejects.toBeInstanceOf(ErroNaoEncontrado)
    await expect(servico.ajustarBiblioteca(slug, "entrega/ativos-aprovados/graficos/nao-existe.png", { etapa: "03" })).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    )
    expect(existsSync(path.join(raiz, "clientes", slug, ".app/biblioteca.json"))).toBe(false)
  })

  it("biblioteca.json corrompido é lido como vazio e reescrito no próximo ajuste; ajuste de arquivo apagado sai", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac.png"
    await imagem(slug, rel)
    const arquivoAjustes = path.join(raiz, "clientes", slug, ".app/biblioteca.json")
    await writeFile(arquivoAjustes, "{oops")
    expect((await servico.listarBiblioteca(slug)).map((i) => i.etapa)).toEqual(["sem-etapa"])

    await writeFile(arquivoAjustes, JSON.stringify({ "entrega/ativos-aprovados/graficos/apagado.png": { etapa: "02" } }))
    await servico.ajustarBiblioteca(slug, rel, { etapa: "03" })
    expect(JSON.parse(await readFile(arquivoAjustes, "utf8"))).toEqual({ [rel]: { etapa: "03" } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src/packages/core && npx vitest run test/armazenamento.test.ts test/servico-planejamento.test.ts`
Expected: FAIL with "listarImagensDoProspect is not a function", "listarBiblioteca is not a function" and a type/arity failure on `salvarAnexo` (the anexo lands in `.app/anexos/<ts>-02` instead of the etapa folder).

- [ ] **Step 3: Implement `listarImagensDoProspect`**

In `src/packages/core/src/armazenamento.ts`, add the import and the method right after `listarArquivosDoProspect`:

```ts
import { ehImagem } from "./biblioteca"
```

```ts
  /** Todas as imagens do prospect, inclusive em .app/ (a biblioteca decide o que mostra). */
  async listarImagensDoProspect(slug: string): Promise<ArquivoProspect[]> {
    const pasta = this.pastaProspect(slug)
    let itens
    try {
      itens = await readdir(pasta, { recursive: true, withFileTypes: true })
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
    const imagens: ArquivoProspect[] = []
    for (const i of itens) {
      if (!i.isFile() || i.name.startsWith(".") || !ehImagem(i.name)) continue
      const abs = path.join(i.parentPath, i.name)
      const info = await stat(abs)
      imagens.push({ caminho: emBarras(path.relative(pasta, abs)), modificadoEm: info.mtime.toISOString() })
    }
    return imagens
  }
```

- [ ] **Step 4: Implement the service methods and the anexo change**

In `src/packages/core/src/servico-planejamento.ts`:

Add imports:

```ts
import {
  aplicarAjuste,
  classificarBiblioteca,
  etapaBibliotecaValida,
  sanearAjustes,
  type AjustesBiblioteca,
  type EtapaBiblioteca,
  type ItemBiblioteca,
} from "./biblioteca"
```

and `ErroCaminhoForaDoProspect` is not needed here (it comes from `relativoAoProspect`). Add the constant next to `ARQUIVO_STATUS`:

```ts
const ARQUIVO_BIBLIOTECA = ".app/biblioteca.json"
```

Add to the `// ---------- leitura ----------` section, after `respostaEstado`:

```ts
  async listarBiblioteca(slug: string): Promise<ItemBiblioteca[]> {
    const estado = await this.estado(slug)
    const [arquivos, ajustes] = await Promise.all([this.arm.listarImagensDoProspect(slug), this.lerAjustesBiblioteca(slug)])
    return classificarBiblioteca({ arquivos, estado, catalogo: this.catalogo, ajustes })
  }

  /** Etapa e título escolhidos pelo analista; o arquivo no disco não muda. */
  async ajustarBiblioteca(slug: string, caminho: string, mudanca: { etapa?: unknown; titulo?: unknown }): Promise<ItemBiblioteca> {
    const rel = this.arm.relativoAoProspect(slug, caminho)
    if (mudanca.etapa !== undefined && !etapaBibliotecaValida(mudanca.etapa)) {
      throw new ErroEntrada(`Etapa inválida: ${JSON.stringify(mudanca.etapa)}`)
    }
    if (mudanca.titulo !== undefined && typeof mudanca.titulo !== "string") throw new ErroEntrada("O título precisa ser texto.")
    if (!(await this.listarBiblioteca(slug)).some((i) => i.caminho === rel)) {
      throw new ErroNaoEncontrado(`Imagem não encontrada na biblioteca: ${rel}`)
    }
    await this.exclusivo(slug, async () => {
      const ajustes = aplicarAjuste(await this.lerAjustesBiblioteca(slug), rel, {
        etapa: mudanca.etapa as EtapaBiblioteca | undefined,
        titulo: mudanca.titulo as string | undefined,
      })
      const vivos: AjustesBiblioteca = {}
      for (const [k, v] of Object.entries(ajustes)) {
        if (await this.arm.existeArquivo(slug, k).catch(() => false)) vivos[k] = v
      }
      await this.arm.gravarTexto(slug, ARQUIVO_BIBLIOTECA, JSON.stringify(vivos, null, 2))
    })
    this.barramento.publicar(slug, { tipo: "estado" })
    return (await this.listarBiblioteca(slug)).find((i) => i.caminho === rel)!
  }

  private async lerAjustesBiblioteca(slug: string): Promise<AjustesBiblioteca> {
    const texto = await this.arm.lerTexto(slug, ARQUIVO_BIBLIOTECA)
    if (!texto) return {}
    try {
      return sanearAjustes(JSON.parse(texto))
    } catch (e) {
      console.error(`${ARQUIVO_BIBLIOTECA} inválido em ${slug}; tratado como vazio.`, e)
      return {}
    }
  }
```

Replace `salvarAnexo`:

```ts
  async salvarAnexo(slug: string, etapa: EtapaId, nomeOriginal: string, dados: Uint8Array): Promise<string> {
    const rel = `.app/anexos/${etapa}/${Date.now()}-${nomeSeguro(nomeOriginal)}`
    await this.arm.gravarBinario(slug, rel, dados)
    // A biblioteca aberta recarrega com o anexo novo.
    this.barramento.publicar(slug, { tipo: "estado" })
    return `clientes/${slug}/${rel}`
  }
```

- [ ] **Step 5: Pass the etapa in the anexos route**

In `src/apps/web/app/api/prospects/[slug]/etapas/[etapa]/anexos/route.ts`, replace the body of the `try`:

```ts
    const { slug, etapa } = await ctx.params
    const id = validarEtapa(etapa)
    const arquivo = (await req.formData()).get("arquivo")
    if (!(arquivo instanceof File)) throw new ErroEntrada("Nenhum arquivo enviado.")
    const caminho = await servidor().servico.salvarAnexo(slug, id, arquivo.name, new Uint8Array(await arquivo.arrayBuffer()))
    return json({ caminho })
```

- [ ] **Step 6: Run tests and typecheck**

Run: `cd src/packages/core && npx vitest run` then `cd src && npm run typecheck`
Expected: all core tests PASS (including `arquivos-prospect.test.ts`, unchanged: `.app/anexos/02/...` still starts with `.app/anexos/`); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/packages/core/src/armazenamento.ts src/packages/core/src/servico-planejamento.ts \
  src/packages/core/test/armazenamento.test.ts src/packages/core/test/servico-planejamento.test.ts \
  "src/apps/web/app/api/prospects/[slug]/etapas/[etapa]/anexos/route.ts"
git commit -m "feat(core): biblioteca no serviço e anexos gravados por etapa"
```

---

### Task 3: Rotas da biblioteca, cache de imagens e cliente da API (web)

**Files:**
- Create: `src/apps/web/app/api/prospects/[slug]/biblioteca/route.ts`
- Modify: `src/apps/web/app/api/prospects/[slug]/arquivo/route.ts`
- Modify: `src/apps/web/lib/api.ts`

**Interfaces:**
- Consumes (Task 2): `servico.listarBiblioteca(slug)`, `servico.ajustarBiblioteca(slug, caminho, { etapa, titulo })`.
- Produces:
  - `GET /api/prospects/[slug]/biblioteca` → `{ itens: ItemBiblioteca[] }`
  - `PATCH /api/prospects/[slug]/biblioteca` body `{ caminho: string; etapa?: EtapaBiblioteca; titulo?: string }` → `{ item: ItemBiblioteca }`
  - `api.biblioteca(slug): Promise<{ itens: ItemBiblioteca[] }>`
  - `api.ajustarBiblioteca(slug, caminho, mudanca: AjusteBiblioteca): Promise<{ item: ItemBiblioteca }>`

- [ ] **Step 1: Create the biblioteca route**

`src/apps/web/app/api/prospects/[slug]/biblioteca/route.ts`:

```ts
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/biblioteca">) {
  try {
    const { slug } = await ctx.params
    return json({ itens: await servidor().servico.listarBiblioteca(slug) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

/** Ajuste manual de etapa e título de uma imagem (o arquivo no disco não muda). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/prospects/[slug]/biblioteca">) {
  try {
    const { slug } = await ctx.params
    const corpo = await lerJson<{ caminho?: unknown; etapa?: unknown; titulo?: unknown }>(req)
    if (typeof corpo.caminho !== "string" || !corpo.caminho) throw new ErroEntrada("Informe o caminho da imagem.")
    const item = await servidor().servico.ajustarBiblioteca(slug, corpo.caminho, { etapa: corpo.etapa, titulo: corpo.titulo })
    return json({ item })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 2: MIME and revalidation for images in the arquivo route**

Replace `src/apps/web/app/api/prospects/[slug]/arquivo/route.ts` with:

```ts
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"
import { politicaDeConteudoArquivo } from "@workspace/core/seguranca"
import { json, respostaDeErro } from "@/lib/http"
import { nomeDeDownload } from "@/lib/nome-download"
import { servidor } from "@/lib/servidor"

const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

const IMAGENS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])
// Imagens revalidam pela data de modificação: a grade da biblioteca não baixa tudo de novo a cada abertura,
// e um gráfico sobrescrito (mesmo nome, nova aprovação) chega na hora.
const CACHE_IMAGEM = "private, max-age=0, must-revalidate"

export async function GET(req: NextRequest, ctx: RouteContext<"/api/prospects/[slug]/arquivo">) {
  try {
    const { slug } = await ctx.params
    const caminho = req.nextUrl.searchParams.get("caminho") ?? ""
    const download = req.nextUrl.searchParams.get("download") === "1"
    const abs = servidor().armazenamento.caminhoAbsoluto(slug, caminho)
    const ext = path.extname(abs).toLowerCase()
    const imagem = IMAGENS.has(ext) && !download
    let dados: Buffer
    let modificadoEm: Date
    try {
      const info = await stat(abs)
      modificadoEm = new Date(Math.floor(info.mtimeMs / 1000) * 1000)
      if (imagem) {
        const desde = Date.parse(req.headers.get("if-modified-since") ?? "")
        if (!Number.isNaN(desde) && desde >= modificadoEm.getTime()) {
          return new Response(null, { status: 304, headers: { "cache-control": CACHE_IMAGEM, "last-modified": modificadoEm.toUTCString() } })
        }
      }
      dados = await readFile(abs)
    } catch {
      return json({ erro: "Arquivo não encontrado." }, 404)
    }
    const headers: Record<string, string> = {
      "content-type": TIPOS[ext] ?? "application/octet-stream",
      "cache-control": imagem ? CACHE_IMAGEM : "no-store",
    }
    if (imagem) headers["last-modified"] = modificadoEm.toUTCString()
    const politica = politicaDeConteudoArquivo(path.extname(abs))
    if (politica) headers["content-security-policy"] = politica
    if (download) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(nomeDeDownload(req.nextUrl.searchParams.get("nome"), abs))}`
    return new Response(new Uint8Array(dados), { headers })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 3: API client**

In `src/apps/web/lib/api.ts`, add the import:

```ts
import type { AjusteBiblioteca, ItemBiblioteca } from "@workspace/core/biblioteca"
```

and two entries in `api` (after `enviarAnexo`):

```ts
  biblioteca: (slug: string) => chamar<{ itens: ItemBiblioteca[] }>(`${base(slug)}/biblioteca`, { cache: "no-store" }),
  ajustarBiblioteca: (slug: string, caminho: string, mudanca: AjusteBiblioteca) =>
    chamar<{ item: ItemBiblioteca }>(`${base(slug)}/biblioteca`, comJson("PATCH", { caminho, ...mudanca })),
```

- [ ] **Step 4: Typecheck, lint and smoke test the routes**

Run: `cd src && npm run typecheck && npm run lint`
Expected: clean.

Then start the app (`cd src && npm run dev`, wait for "Ready") and in another shell:

```bash
curl -s http://127.0.0.1:3000/api/prospects/adda/biblioteca | python3 -c "import json,sys; d=json.load(sys.stdin)['itens']; print(len(d), sorted({i['etapa'] for i in d}), sorted({i['origem'] for i in d}))"
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H 'content-type: application/json' -d '{"caminho":"entrega/ativos-aprovados/graficos/x.png","etapa":"03"}' http://127.0.0.1:3000/api/prospects/adda/biblioteca
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H 'content-type: application/json' -d '{"caminho":"../x.png","etapa":"03"}' http://127.0.0.1:3000/api/prospects/adda/biblioteca
P=$(curl -s http://127.0.0.1:3000/api/prospects/adda/biblioteca | python3 -c "import json,sys,urllib.parse; print(urllib.parse.quote(json.load(sys.stdin)['itens'][0]['capa']))")
LM=$(curl -sI "http://127.0.0.1:3000/api/prospects/adda/arquivo?caminho=$P" | grep -i '^last-modified' | cut -d' ' -f2- | tr -d '\r')
curl -s -o /dev/null -w "%{http_code}\n" -H "If-Modified-Since: $LM" "http://127.0.0.1:3000/api/prospects/adda/arquivo?caminho=$P"
```

Expected: first line shows ~25 items with `sem-etapa` and `final` among the etapas; the PATCHes print `404` and `400`; the last request prints `304`. Use the port `next dev` printed if it is not 3000. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add "src/apps/web/app/api/prospects/[slug]/biblioteca/route.ts" "src/apps/web/app/api/prospects/[slug]/arquivo/route.ts" src/apps/web/lib/api.ts
git commit -m "feat(web): rotas da biblioteca e revalidação de imagens"
```

---

### Task 4: Filtros, contagens e agrupamentos da biblioteca (web, puro)

**Files:**
- Create: `src/apps/web/lib/biblioteca.ts`
- Test: `src/apps/web/lib/biblioteca.test.ts`

**Interfaces:**
- Consumes (Task 1): `ORDEM_BIBLIOTECA`, `EtapaBiblioteca`, `ItemBiblioteca`, `OrigemImagem`; `Catalogo` de `@workspace/core/tipos`.
- Produces (usado pelos Tasks 5 e 6):
  ```ts
  export const ORIGENS_FILTRO: readonly ["aprovado", "proposta", "anexo", "insumo", "benchmark", "previa"]
  export type OrigemFiltro = (typeof ORIGENS_FILTRO)[number]
  export const ROTULO_ORIGEM: Record<OrigemImagem, string>
  export const ROTULO_FILTRO_ORIGEM: Record<OrigemFiltro, string>
  export type FiltroEtapa = EtapaBiblioteca | "todas"
  export interface FiltrosBiblioteca { etapa: FiltroEtapa; busca: string; origens: ReadonlySet<OrigemFiltro>; versoesAntigas: boolean }
  export const FILTROS_INICIAIS: FiltrosBiblioteca
  export function normalizarBusca(texto: string): string
  export function filtrarItens(itens: ItemBiblioteca[], f: FiltrosBiblioteca): ItemBiblioteca[]
  export function contarPorEtapa(itens: ItemBiblioteca[], f: FiltrosBiblioteca): Record<FiltroEtapa, number>
  export function agruparPorEtapa(itens: ItemBiblioteca[]): { etapa: EtapaBiblioteca; itens: ItemBiblioteca[] }[]
  export function agruparPorMarca(itens: ItemBiblioteca[]): { marca: string | null; itens: ItemBiblioteca[] }[]
  export function ordemDeExibicao(itens: ItemBiblioteca[]): ItemBiblioteca[]
  export function rotuloEtapa(catalogo: Catalogo, etapa: EtapaBiblioteca, curto?: boolean): string
  export function totalVisivel(itens: ItemBiblioteca[]): number
  ```

- [ ] **Step 1: Write the failing test**

`src/apps/web/lib/biblioteca.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import {
  agruparPorEtapa,
  agruparPorMarca,
  contarPorEtapa,
  FILTROS_INICIAIS,
  filtrarItens,
  ordemDeExibicao,
  rotuloEtapa,
  totalVisivel,
  type FiltrosBiblioteca,
} from "./biblioteca"

function item(p: Partial<ItemBiblioteca> & Pick<ItemBiblioteca, "caminho">): ItemBiblioteca {
  return {
    id: p.caminho,
    origem: "aprovado",
    etapa: "03",
    titulo: p.caminho,
    nomeArquivo: p.caminho.split("/").pop()!,
    imagens: [p.caminho],
    capa: p.caminho,
    modificadoEm: "2026-10-01T10:00:00.000Z",
    ...p,
  }
}

const cac = item({ caminho: "g/cac-mensal.png", titulo: "CAC mensal", etapa: "04" })
const acao = item({ caminho: "g/acao.png", titulo: "Ação de mídia", etapa: "07", origem: "anexo" })
const velho = item({ caminho: "p/velho.png", titulo: "Cenários antigos", etapa: "05", origem: "substituido" })
const pendente = item({ caminho: "p/novo.png", titulo: "Cenários", etapa: "05", origem: "proposta" })
const insider = item({ caminho: "b/insider/1", etapa: "06", origem: "benchmark", grupo: { tipo: "anuncio", marca: "insider" } })
const alpha = item({ caminho: "b/alpha/1", etapa: "06", origem: "benchmark", grupo: { tipo: "anuncio", marca: "alpha" } })
const solto = item({ caminho: "x/solto.png", etapa: "sem-etapa" })
const todos = [cac, acao, velho, pendente, insider, alpha, solto]

const com = (f: Partial<FiltrosBiblioteca>): FiltrosBiblioteca => ({ ...FILTROS_INICIAIS, ...f })

describe("filtros da biblioteca", () => {
  it("por padrão esconde versões antigas e mostra o resto", () => {
    expect(filtrarItens(todos, FILTROS_INICIAIS)).not.toContain(velho)
    expect(filtrarItens(todos, FILTROS_INICIAIS)).toHaveLength(6)
    expect(filtrarItens(todos, com({ versoesAntigas: true }))).toContain(velho)
  })

  it("versões antigas seguem o filtro de Pendentes", () => {
    expect(filtrarItens(todos, com({ versoesAntigas: true, origens: new Set(["aprovado"]) }))).not.toContain(velho)
  })

  it("filtra por etapa e por origem", () => {
    expect(filtrarItens(todos, com({ etapa: "06" }))).toEqual([insider, alpha])
    expect(filtrarItens(todos, com({ origens: new Set(["anexo"]) }))).toEqual([acao])
  })

  it("busca no título e no nome do arquivo, sem diferenciar maiúscula nem acento", () => {
    expect(filtrarItens(todos, com({ busca: "acao" }))).toEqual([acao])
    expect(filtrarItens(todos, com({ busca: "CAC-MENSAL" }))).toEqual([cac])
  })

  it("contagem por etapa respeita busca e origem, mas não a etapa escolhida", () => {
    const c = contarPorEtapa(todos, com({ etapa: "04" }))
    expect(c.todas).toBe(6)
    expect(c["06"]).toBe(2)
    expect(c["05"]).toBe(1)
    expect(c["01"]).toBe(0)
    expect(c["sem-etapa"]).toBe(1)
  })

  it("total da trilha não conta versões antigas", () => {
    expect(totalVisivel(todos)).toBe(6)
  })
})

describe("agrupamentos", () => {
  it("por etapa na ordem do planejamento, sem etapa no fim, grupos vazios fora", () => {
    expect(agruparPorEtapa([solto, cac, insider]).map((g) => g.etapa)).toEqual(["04", "06", "sem-etapa"])
  })

  it("por marca: soltos primeiro, depois marcas em ordem alfabética", () => {
    expect(agruparPorMarca([insider, cac, alpha])).toEqual([
      { marca: null, itens: [cac] },
      { marca: "alpha", itens: [alpha] },
      { marca: "insider", itens: [insider] },
    ])
  })

  it("ordem de exibição segue os agrupamentos (é a ordem das setas na imagem ampliada)", () => {
    expect(ordemDeExibicao([solto, insider, cac, alpha])).toEqual([cac, alpha, insider, solto])
  })
})

describe("rótulos de etapa", () => {
  const catalogo = {
    etapas: [
      { id: "03", numero: "03", titulo: "Diagnóstico de performance" },
      { id: "final", numero: "", titulo: "Apresentação final" },
    ],
    insumos: [],
  } as unknown as Catalogo

  it("longo para cabeçalho, curto para a pílula", () => {
    expect(rotuloEtapa(catalogo, "03")).toBe("03 · Diagnóstico de performance")
    expect(rotuloEtapa(catalogo, "03", true)).toBe("03")
    expect(rotuloEtapa(catalogo, "final")).toBe("Apresentação final")
    expect(rotuloEtapa(catalogo, "final", true)).toBe("Final")
    expect(rotuloEtapa(catalogo, "sem-etapa")).toBe("Sem etapa")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/apps/web && npx vitest run lib/biblioteca.test.ts`
Expected: FAIL with "Failed to resolve import \"./biblioteca\"".

- [ ] **Step 3: Write the implementation**

`src/apps/web/lib/biblioteca.ts`:

```ts
import { ORDEM_BIBLIOTECA, type EtapaBiblioteca, type ItemBiblioteca, type OrigemImagem } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"

/** "substituido" não tem filtro próprio: aparece com "Mostrar versões antigas" e segue o filtro de Pendentes. */
export const ORIGENS_FILTRO = ["aprovado", "proposta", "anexo", "insumo", "benchmark", "previa"] as const
export type OrigemFiltro = (typeof ORIGENS_FILTRO)[number]

export const ROTULO_ORIGEM: Record<OrigemImagem, string> = {
  aprovado: "Aprovado",
  proposta: "Pendente",
  substituido: "Substituído",
  anexo: "Anexo",
  insumo: "Insumo",
  benchmark: "Benchmark",
  previa: "Prévia",
}

export const ROTULO_FILTRO_ORIGEM: Record<OrigemFiltro, string> = {
  aprovado: "Aprovados",
  proposta: "Pendentes",
  anexo: "Anexos",
  insumo: "Insumos",
  benchmark: "Benchmark",
  previa: "Prévias",
}

export type FiltroEtapa = EtapaBiblioteca | "todas"

export interface FiltrosBiblioteca {
  etapa: FiltroEtapa
  busca: string
  origens: ReadonlySet<OrigemFiltro>
  versoesAntigas: boolean
}

export const FILTROS_INICIAIS: FiltrosBiblioteca = {
  etapa: "todas",
  busca: "",
  origens: new Set(ORIGENS_FILTRO),
  versoesAntigas: false,
}

export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function passaSemEtapa(i: ItemBiblioteca, f: FiltrosBiblioteca): boolean {
  if (i.origem === "substituido") {
    if (!f.versoesAntigas || !f.origens.has("proposta")) return false
  } else if (!f.origens.has(i.origem)) {
    return false
  }
  const busca = normalizarBusca(f.busca)
  return !busca || normalizarBusca(i.titulo).includes(busca) || normalizarBusca(i.nomeArquivo).includes(busca)
}

export function filtrarItens(itens: ItemBiblioteca[], f: FiltrosBiblioteca): ItemBiblioteca[] {
  return itens.filter((i) => passaSemEtapa(i, f) && (f.etapa === "todas" || i.etapa === f.etapa))
}

/** Contagem de cada pílula: considera busca e origem, mas não a etapa escolhida. */
export function contarPorEtapa(itens: ItemBiblioteca[], f: FiltrosBiblioteca): Record<FiltroEtapa, number> {
  const contagem = Object.fromEntries([["todas", 0], ...ORDEM_BIBLIOTECA.map((e) => [e, 0])]) as Record<FiltroEtapa, number>
  for (const i of itens) {
    if (!passaSemEtapa(i, f)) continue
    contagem.todas++
    contagem[i.etapa]++
  }
  return contagem
}

export function agruparPorEtapa(itens: ItemBiblioteca[]): { etapa: EtapaBiblioteca; itens: ItemBiblioteca[] }[] {
  return ORDEM_BIBLIOTECA.map((etapa) => ({ etapa, itens: itens.filter((i) => i.etapa === etapa) })).filter((g) => g.itens.length > 0)
}

export function agruparPorMarca(itens: ItemBiblioteca[]): { marca: string | null; itens: ItemBiblioteca[] }[] {
  const soltos = itens.filter((i) => i.grupo?.tipo !== "anuncio")
  const marcas = new Map<string, ItemBiblioteca[]>()
  for (const i of itens) {
    if (i.grupo?.tipo === "anuncio") marcas.set(i.grupo.marca, [...(marcas.get(i.grupo.marca) ?? []), i])
  }
  const grupos: { marca: string | null; itens: ItemBiblioteca[] }[] = soltos.length ? [{ marca: null, itens: soltos }] : []
  for (const marca of [...marcas.keys()].sort((a, b) => a.localeCompare(b))) grupos.push({ marca, itens: marcas.get(marca)! })
  return grupos
}

/** A mesma ordem em que a grade desenha os cards. */
export function ordemDeExibicao(itens: ItemBiblioteca[]): ItemBiblioteca[] {
  return agruparPorEtapa(itens).flatMap((g) => agruparPorMarca(g.itens).flatMap((m) => m.itens))
}

export function rotuloEtapa(catalogo: Catalogo, etapa: EtapaBiblioteca, curto = false): string {
  if (etapa === "sem-etapa") return "Sem etapa"
  const e = catalogo.etapas.find((x) => x.id === etapa)
  if (!e) return etapa
  if (curto) return e.numero || "Final"
  return e.numero ? `${e.numero} · ${e.titulo}` : e.titulo
}

export function totalVisivel(itens: ItemBiblioteca[]): number {
  return itens.filter((i) => i.origem !== "substituido").length
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src/apps/web && npx vitest run lib/biblioteca.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/biblioteca.ts src/apps/web/lib/biblioteca.test.ts
git commit -m "feat(web): filtros e agrupamentos da biblioteca"
```

---

### Task 5: Imagem ampliada (web)

**Files:**
- Create: `src/apps/web/components/biblioteca/imagem-ampliada.tsx`

**Interfaces:**
- Consumes: `ItemBiblioteca`, `AjusteBiblioteca`, `EtapaBiblioteca`, `ORDEM_BIBLIOTECA` (Task 1); `ROTULO_ORIGEM`, `rotuloEtapa` (Task 4); `urlArquivo`, `api.mostrarNoFinder`, `mensagemDeErro` de `@/lib/api`; `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` de `@workspace/ui/components/dialog`.
- Produces (usado pelo Task 6):
  ```tsx
  export function ImagemAmpliada(props: {
    slug: string
    catalogo: Catalogo
    itens: ItemBiblioteca[]          // ordem de exibição do filtro atual
    indice: number | null            // null = fechada
    aoMudarIndice: (indice: number | null) => void
    aoAjustar: (caminho: string, mudanca: AjusteBiblioteca) => void
    aoMencionar: (caminho: string) => void  // caminho da imagem na tela
  }): React.ReactNode
  ```
  Behavior: ← → (botões e teclado) percorrem as imagens do grupo e depois passam para o item vizinho; teclado ignorado quando o foco está num `INPUT`, `TEXTAREA` ou `SELECT`. Trocar a etapa com um filtro de etapa ativo tira o item da lista: o diálogo passa a mostrar o próximo da lista (útil para triar "Sem etapa") ou fecha se não houver.

- [ ] **Step 1: Write the component**

`src/apps/web/components/biblioteca/imagem-ampliada.tsx`:

```tsx
"use client"

import { AtSignIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FolderOpenIcon, ImageOffIcon, PencilIcon } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { ORDEM_BIBLIOTECA, type AjusteBiblioteca, type EtapaBiblioteca, type ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { ROTULO_ORIGEM, rotuloEtapa } from "@/lib/biblioteca"

interface Props {
  slug: string
  catalogo: Catalogo
  itens: ItemBiblioteca[]
  indice: number | null
  aoMudarIndice: (indice: number | null) => void
  aoAjustar: (caminho: string, mudanca: AjusteBiblioteca) => void
  aoMencionar: (caminho: string) => void
}

export function ImagemAmpliada(props: Props) {
  const item = props.indice === null ? null : (props.itens[props.indice] ?? null)
  return (
    <Dialog open={item !== null} onOpenChange={(aberto) => !aberto && props.aoMudarIndice(null)}>
      <DialogContent className="h-[90vh] gap-0 p-0 sm:max-w-[min(1200px,95vw)]">
        {/* key: outro item zera a imagem do grupo e a edição do título. */}
        {item && props.indice !== null && <Conteudo key={item.id} {...props} item={item} indice={props.indice} />}
      </DialogContent>
    </Dialog>
  )
}

function Conteudo({ slug, catalogo, itens, indice, item, aoMudarIndice, aoAjustar, aoMencionar }: Props & { item: ItemBiblioteca; indice: number }) {
  const [sub, setSub] = useState(0)
  const [titulo, setTitulo] = useState<string | null>(null)
  const [quebrada, setQuebrada] = useState<string | null>(null)
  const atual = item.imagens[sub] ?? item.capa

  const temAnterior = sub > 0 || indice > 0
  const temProxima = sub < item.imagens.length - 1 || indice < itens.length - 1
  function ir(delta: 1 | -1) {
    const proxSub = sub + delta
    if (proxSub >= 0 && proxSub < item.imagens.length) return setSub(proxSub)
    const prox = indice + delta
    if (prox >= 0 && prox < itens.length) aoMudarIndice(prox)
  }

  function aoTeclar(ev: KeyboardEvent<HTMLDivElement>) {
    const alvo = ev.target as HTMLElement
    if (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT") return
    if (ev.key === "ArrowRight") {
      ev.preventDefault()
      ir(1)
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault()
      ir(-1)
    }
  }

  function salvarTitulo() {
    if (titulo !== null && titulo.trim() !== item.titulo) aoAjustar(item.caminho, { titulo })
    setTitulo(null)
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] md:grid-cols-[1fr_300px] md:grid-rows-1" onKeyDown={aoTeclar}>
      <div className="bg-muted relative flex min-h-0 items-center justify-center overflow-hidden rounded-l-xl p-4">
        {quebrada === atual ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <ImageOffIcon className="size-8" aria-hidden /> Não consegui abrir esta imagem.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
          <img key={atual} src={urlArquivo(slug, atual)} alt={item.titulo} onError={() => setQuebrada(atual)} className="max-h-full max-w-full rounded-md bg-white object-contain" />
        )}
        <Button variant="secondary" size="icon" className="absolute top-1/2 left-3 -translate-y-1/2" aria-label="Anterior" disabled={!temAnterior} onClick={() => ir(-1)}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="secondary" size="icon" className="absolute top-1/2 right-3 -translate-y-1/2" aria-label="Próxima" disabled={!temProxima} onClick={() => ir(1)}>
          <ChevronRightIcon />
        </Button>
        {item.imagens.length > 1 && (
          <Badge variant="secondary" className="absolute bottom-3 left-1/2 -translate-x-1/2 tabular-nums">
            {sub + 1} de {item.imagens.length}
          </Badge>
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t p-4 md:border-t-0 md:border-l">
        {titulo === null ? (
          <div className="flex items-start gap-1 pr-8">
            <DialogTitle className="min-w-0 flex-1 text-base break-words">{item.titulo}</DialogTitle>
            <Button variant="ghost" size="icon-sm" aria-label="Editar título" title="Editar título" onClick={() => setTitulo(item.titulo)}>
              <PencilIcon />
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-1 pr-8"
            onSubmit={(ev) => {
              ev.preventDefault()
              salvarTitulo()
            }}
          >
            <DialogTitle className="sr-only">{item.titulo}</DialogTitle>
            <Input
              autoFocus
              aria-label="Título"
              value={titulo}
              onChange={(ev) => setTitulo(ev.target.value)}
              onBlur={salvarTitulo}
              onKeyDown={(ev) => {
                if (ev.key === "Escape") {
                  ev.preventDefault()
                  ev.stopPropagation()
                  setTitulo(null)
                }
              }}
            />
            <p className="text-muted-foreground text-xs">Enter salva. Vazio volta ao título automático.</p>
          </form>
        )}
        <DialogDescription className="sr-only">Imagem ampliada da biblioteca do prospect.</DialogDescription>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground text-xs font-medium">Etapa</span>
          <select
            value={item.etapa}
            onChange={(ev) => aoAjustar(item.caminho, { etapa: ev.target.value as EtapaBiblioteca })}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          >
            {ORDEM_BIBLIOTECA.map((e) => (
              <option key={e} value={e}>
                {rotuloEtapa(catalogo, e)}
              </option>
            ))}
          </select>
        </label>

        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Origem</dt>
            <dd>
              <Badge variant="outline">{ROTULO_ORIGEM[item.origem]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Arquivo</dt>
            <dd className="font-mono text-xs break-all">{atual}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={() => aoMencionar(atual)}>
            <AtSignIcon /> Mencionar no chat
          </Button>
          <Button variant="outline" render={<a href={urlArquivo(slug, atual, true)} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
          <Button variant="outline" onClick={() => void api.mostrarNoFinder(slug, atual).catch((e) => toast.error(mensagemDeErro(e)))}>
            <FolderOpenIcon /> Mostrar no Finder
          </Button>
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `cd src && npm run typecheck && npm run lint`
Expected: clean. If lint flags `react-hooks/set-state-in-effect` or similar, there is no effect here; if it flags the `return setSub(...)` expression in `ir`, rewrite as `{ setSub(proxSub); return }`.

- [ ] **Step 3: Commit**

```bash
git add src/apps/web/components/biblioteca/imagem-ampliada.tsx
git commit -m "feat(web): imagem ampliada da biblioteca"
```

---

### Task 6: Grade da biblioteca, item na trilha e camada na área de trabalho (web)

**Files:**
- Create: `src/apps/web/hooks/use-biblioteca.ts`
- Create: `src/apps/web/components/biblioteca/card-imagem.tsx`
- Create: `src/apps/web/components/biblioteca/biblioteca.tsx`
- Modify: `src/apps/web/components/trabalho/trilha-etapas.tsx`
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx`

**Interfaces:**
- Consumes: `api.biblioteca`, `api.ajustarBiblioteca` (Task 3); tudo de `@/lib/biblioteca` (Task 4); `ImagemAmpliada` (Task 5); `alvoDeDigitacao` de `@/lib/layout-colunas`.
- Produces:
  ```ts
  useBiblioteca(slug: string, sinal: unknown): { itens: ItemBiblioteca[] | null; erro: string | null; recarregar: () => Promise<void>; ajustar: (caminho: string, mudanca: AjusteBiblioteca) => Promise<void> }
  <Biblioteca slug catalogo itens erro aoAjustar aoMencionar aoFechar />
  <TrilhaEtapas ... bibliotecaAberta totalBiblioteca aoAbrirBiblioteca />
  ```

- [ ] **Step 1: Hook**

`src/apps/web/hooks/use-biblioteca.ts`:

```ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AjusteBiblioteca, ItemBiblioteca } from "@workspace/core/biblioteca"
import { api, mensagemDeErro } from "@/lib/api"

/** `sinal` muda a cada recarga do estado do prospect (aprovação, anexo, ajuste): a lista é buscada de novo. */
export function useBiblioteca(slug: string, sinal: unknown) {
  const [itens, setItens] = useState<ItemBiblioteca[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const r = await api.biblioteca(slug)
      setItens(r.itens)
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [slug])

  useEffect(() => {
    void recarregar()
  }, [recarregar, sinal])

  const ajustar = useCallback(
    async (caminho: string, mudanca: AjusteBiblioteca) => {
      // Otimista: a etapa muda na hora; o título só quando não está vazio (vazio volta ao automático, que vem do servidor).
      setItens(
        (atual) =>
          atual?.map((i) =>
            i.caminho !== caminho
              ? i
              : { ...i, ...(mudanca.etapa ? { etapa: mudanca.etapa } : {}), ...(mudanca.titulo?.trim() ? { titulo: mudanca.titulo.trim() } : {}) },
          ) ?? null,
      )
      try {
        const { item } = await api.ajustarBiblioteca(slug, caminho, mudanca)
        setItens((atual) => atual?.map((i) => (i.caminho === caminho ? item : i)) ?? null)
      } catch (e) {
        toast.error(mensagemDeErro(e))
        await recarregar()
      }
    },
    [slug, recarregar],
  )

  return { itens, erro, recarregar, ajustar }
}
```

- [ ] **Step 2: Card**

`src/apps/web/components/biblioteca/card-imagem.tsx`:

```tsx
"use client"

import { ImageOffIcon, LayersIcon } from "lucide-react"
import { useState } from "react"
import type { ItemBiblioteca } from "@workspace/core/biblioteca"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { urlArquivo } from "@/lib/api"
import { ROTULO_ORIGEM } from "@/lib/biblioteca"

export function CardImagem({ slug, item, aoAbrir }: { slug: string; item: ItemBiblioteca; aoAbrir: () => void }) {
  const [quebrada, setQuebrada] = useState(false)
  return (
    <button
      type="button"
      onClick={aoAbrir}
      title={item.caminho}
      className="bg-card hover:border-primary/50 focus-visible:ring-ring/50 flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="bg-muted relative flex aspect-[4/3] items-center justify-center overflow-hidden">
        {quebrada ? (
          <ImageOffIcon className="text-muted-foreground size-8" aria-label="Imagem não encontrada" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
          <img
            src={urlArquivo(slug, item.capa)}
            alt={item.titulo}
            loading="lazy"
            decoding="async"
            onError={() => setQuebrada(true)}
            className="h-full w-full object-contain"
          />
        )}
        {item.imagens.length > 1 && (
          <Badge variant="secondary" className="absolute right-2 bottom-2 tabular-nums">
            <LayersIcon /> {item.imagens.length}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.titulo}</span>
          <Badge variant={item.origem === "aprovado" ? "default" : "outline"} className={cn(item.origem === "substituido" && "opacity-60")}>
            {ROTULO_ORIGEM[item.origem]}
          </Badge>
        </div>
        <span className="text-muted-foreground truncate font-mono text-xs">{item.nomeArquivo}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Biblioteca (topo + grade)**

`src/apps/web/components/biblioteca/biblioteca.tsx`:

```tsx
"use client"

import { HistoryIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ORDEM_BIBLIOTECA, type AjusteBiblioteca, type ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
  agruparPorEtapa,
  agruparPorMarca,
  contarPorEtapa,
  FILTROS_INICIAIS,
  filtrarItens,
  ordemDeExibicao,
  ORIGENS_FILTRO,
  ROTULO_FILTRO_ORIGEM,
  rotuloEtapa,
  type FiltroEtapa,
  type FiltrosBiblioteca,
} from "@/lib/biblioteca"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { CardImagem } from "./card-imagem"
import { ImagemAmpliada } from "./imagem-ampliada"

const PILULAS: FiltroEtapa[] = ["todas", ...ORDEM_BIBLIOTECA]

export function Biblioteca({
  slug,
  catalogo,
  itens,
  erro,
  aoAjustar,
  aoMencionar,
  aoFechar,
}: {
  slug: string
  catalogo: Catalogo
  itens: ItemBiblioteca[] | null
  erro: string | null
  aoAjustar: (caminho: string, mudanca: AjusteBiblioteca) => void
  aoMencionar: (caminho: string) => void
  aoFechar: () => void
}) {
  const [filtros, setFiltros] = useState<FiltrosBiblioteca>(FILTROS_INICIAIS)
  const [aberto, setAberto] = useState<number | null>(null)
  const contagem = useMemo(() => contarPorEtapa(itens ?? [], filtros), [itens, filtros])
  const visiveis = useMemo(() => ordemDeExibicao(filtrarItens(itens ?? [], filtros)), [itens, filtros])
  const indicePorId = useMemo(() => new Map(visiveis.map((i, n) => [i.id, n])), [visiveis])

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !alvoDeDigitacao(document.activeElement as HTMLElement | null)) aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aoFechar])

  const mudar = (parcial: Partial<FiltrosBiblioteca>) => setFiltros((f) => ({ ...f, ...parcial }))

  let corpo: React.ReactNode
  if (itens === null) {
    corpo = erro ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Não consegui carregar a biblioteca</EmptyTitle>
          <EmptyDescription>{erro}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  } else if (itens.length === 0) {
    corpo = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nenhuma imagem ainda</EmptyTitle>
          <EmptyDescription>Gráficos aprovados, anexos e o benchmark aparecem aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (visiveis.length === 0) {
    corpo = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{filtros.busca.trim() ? "Nenhuma imagem para esta busca" : "Nenhuma imagem nesta etapa"}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  } else {
    corpo = (
      <div className="flex flex-col gap-6">
        {agruparPorEtapa(visiveis).map((g) => (
          <section key={g.etapa} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{rotuloEtapa(catalogo, g.etapa)}</h3>
            {agruparPorMarca(g.itens).map((m) => (
              <div key={m.marca ?? ""} className="flex flex-col gap-2">
                {m.marca && <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{m.marca}</h4>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {m.itens.map((i) => (
                    <CardImagem key={i.id} slug={slug} item={i} aoAbrir={() => setAberto(indicePorId.get(i.id) ?? null)} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Biblioteca">
      <header className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">Biblioteca</h1>
          <div className="relative ml-auto w-full max-w-xs">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" aria-hidden />
            <Input className="pl-8" placeholder="Buscar por nome" aria-label="Buscar por nome" value={filtros.busca} onChange={(ev) => mudar({ busca: ev.target.value })} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ListFilterIcon /> Origem
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ORIGENS_FILTRO.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o}
                  checked={filtros.origens.has(o)}
                  onCheckedChange={(marcado) => {
                    const origens = new Set(filtros.origens)
                    if (marcado) origens.add(o)
                    else origens.delete(o)
                    mudar({ origens })
                  }}
                >
                  {ROTULO_FILTRO_ORIGEM[o]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={filtros.versoesAntigas ? "secondary" : "outline"}
            size="sm"
            aria-pressed={filtros.versoesAntigas}
            onClick={() => mudar({ versoesAntigas: !filtros.versoesAntigas })}
          >
            <HistoryIcon /> Versões antigas
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar biblioteca" title="Fechar (Esc)" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
        <nav aria-label="Filtrar por etapa" className="flex flex-wrap gap-1">
          {PILULAS.map((e) => (
            <Button
              key={e}
              size="sm"
              variant={filtros.etapa === e ? "secondary" : "ghost"}
              aria-pressed={filtros.etapa === e}
              className={cn("gap-1.5", contagem[e] === 0 && filtros.etapa !== e && "text-muted-foreground/60")}
              onClick={() => mudar({ etapa: e })}
            >
              {e === "todas" ? "Todas" : rotuloEtapa(catalogo, e, true)}
              <span className="text-muted-foreground text-xs tabular-nums">{contagem[e]}</span>
            </Button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{corpo}</div>
      <ImagemAmpliada
        slug={slug}
        catalogo={catalogo}
        itens={visiveis}
        indice={aberto}
        aoMudarIndice={setAberto}
        aoAjustar={aoAjustar}
        aoMencionar={(caminho) => {
          setAberto(null)
          aoMencionar(caminho)
        }}
      />
    </section>
  )
}
```

- [ ] **Step 4: Item "Biblioteca" na trilha**

In `src/apps/web/components/trabalho/trilha-etapas.tsx`:

Change the lucide import to `import { ArrowLeftIcon, ImagesIcon } from "lucide-react"`. Add three props to the component signature and its type:

```tsx
  bibliotecaAberta,
  totalBiblioteca,
  aoAbrirBiblioteca,
}: {
  catalogo: Catalogo
  estado: Estado
  selecionada: EtapaId
  aoSelecionar: (etapa: EtapaId) => void
  bibliotecaAberta: boolean
  /** null enquanto a lista não carregou. */
  totalBiblioteca: number | null
  aoAbrirBiblioteca: () => void
}) {
```

Right after the closing `</nav>`, before `<div className="mt-auto pt-4">`, add:

```tsx
      <p className="text-muted-foreground px-2 pt-4 pb-1 text-xs font-medium tracking-wide uppercase">Arquivos</p>
      <Button
        variant="ghost"
        className={cn("h-auto justify-start gap-2 px-2 py-1.5 font-normal", bibliotecaAberta && "bg-muted font-medium")}
        aria-pressed={bibliotecaAberta}
        onClick={aoAbrirBiblioteca}
      >
        <ImagesIcon className="size-4" />
        <span className="flex-1 truncate text-left">Biblioteca</span>
        {totalBiblioteca !== null && <span className="text-muted-foreground text-xs tabular-nums">{totalBiblioteca}</span>}
      </Button>
```

- [ ] **Step 5: Camada na área de trabalho**

In `src/apps/web/components/trabalho/area-de-trabalho.tsx`:

Imports to add:

```tsx
import { toast } from "sonner"
import { Biblioteca } from "@/components/biblioteca/biblioteca"
import { useBiblioteca } from "@/hooks/use-biblioteca"
import { totalVisivel } from "@/lib/biblioteca"
```

After `const inserirNoCompositor = useRef<...>(null)` (line ~60), add:

```tsx
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false)
  // `dados` muda a cada evento de estado (aprovação, anexo, ajuste): a biblioteca recarrega junto.
  const biblioteca = useBiblioteca(slug, dados)
  const trilhaCaixaRef = useRef<HTMLDivElement>(null)
  const [larguraTrilha, setLarguraTrilha] = useState(0)
  const carregado = dados !== null
```

After the `registrarCompositor` callback, add:

```tsx
  const selecionarEtapa = useCallback((id: EtapaId) => {
    setBibliotecaAberta(false)
    setSelecionada(id)
  }, [])
  const fecharBiblioteca = useCallback(() => setBibliotecaAberta(false), [])
  // Menciona no chat da etapa selecionada na trilha (não na etapa da imagem): o chat fica montado por baixo da biblioteca.
  const mencionarDaBiblioteca = useCallback((caminho: string) => {
    setBibliotecaAberta(false)
    if (!inserirNoCompositor.current) {
      toast.error("Abra uma etapa com chat para mencionar a imagem.")
      return
    }
    inserirNoCompositor.current(`@${caminho} `)
  }, [])

  // A biblioteca cobre tudo à direita da trilha; a largura da trilha muda quando o analista arrasta a alça.
  useEffect(() => {
    const el = trilhaCaixaRef.current
    if (!el) return
    const observador = new ResizeObserver(([entrada]) => setLarguraTrilha(entrada?.contentRect.width ?? 0))
    observador.observe(el)
    return () => observador.disconnect()
  }, [carregado])
```

In the JSX:

1. Root div: `className={cn("relative h-svh", arrastando && "[&_iframe]:pointer-events-none")}`.
2. Trilha panel content becomes:

```tsx
            <div ref={trilhaCaixaRef} className="h-full">
              <TrilhaEtapas
                catalogo={dados.catalogo}
                estado={dados.estado}
                selecionada={etapa}
                aoSelecionar={selecionarEtapa}
                bibliotecaAberta={bibliotecaAberta}
                totalBiblioteca={biblioteca.itens ? totalVisivel(biblioteca.itens) : null}
                aoAbrirBiblioteca={() => setBibliotecaAberta(true)}
              />
            </div>
```

3. Right before `{visualizadorAberto && telaCheia && ...}`, add:

```tsx
        {bibliotecaAberta && (
          <div className="bg-background absolute inset-y-0 right-0 z-30 border-l" style={{ left: larguraTrilha }}>
            <Biblioteca
              slug={slug}
              catalogo={dados.catalogo}
              itens={biblioteca.itens}
              erro={biblioteca.erro}
              aoAjustar={(caminho, mudanca) => void biblioteca.ajustar(caminho, mudanca)}
              aoMencionar={mencionarDaBiblioteca}
              aoFechar={fecharBiblioteca}
            />
          </div>
        )}
```

`TrilhaEtapas`'s `aside` already has `h-full`-compatible classes (`flex min-h-0 flex-col`); if the trilha stops filling the column height after wrapping it, add `h-full` to the `aside` className.

- [ ] **Step 6: Typecheck, lint and full test run**

Run: `cd src && npm run typecheck && npm run lint && npm test`
Expected: all clean and green (core + web, including `sem-travessao.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/apps/web/hooks/use-biblioteca.ts src/apps/web/components/biblioteca/ \
  src/apps/web/components/trabalho/trilha-etapas.tsx src/apps/web/components/trabalho/area-de-trabalho.tsx
git commit -m "feat(web): aba Biblioteca na área de trabalho"
```

---

### Task 7: Verificação manual no app

**Files:** nenhum (se algo falhar, corrigir no arquivo do task dono e commitar como `fix(web): ...` ou `fix(core): ...`).

- [ ] **Step 1: Subir o app**

Run: `cd src && npm run dev`, abrir `http://127.0.0.1:3000` (ou a porta que o Next imprimir).

- [ ] **Step 2: `adda`**

- Trilha mostra "Biblioteca" com a contagem. Clicar abre a grade cobrindo chat e painel; a trilha continua visível.
- Os ~24 gráficos estão em "Sem etapa"; a prévia da apresentação aparece em "Final" como um card só, com a contagem de slides; ao ampliar, ← → percorrem os slides.
- Ampliar um gráfico, trocar a etapa para 03 e editar o título. Recarregar a página (Cmd+R): o gráfico continua na 03 com o novo título. Conferir `clientes/adda/.app/biblioteca.json`.
- Apagar o título (campo vazio, Enter): volta ao título automático.
- Com o filtro "Sem etapa" ativo, mover um gráfico para outra etapa: o diálogo passa para o próximo item.
- No campo de título, ← → movem o cursor e não trocam de imagem.
- "Baixar" baixa o PNG; "Mostrar no Finder" abre o Finder com o arquivo selecionado.
- Esc fecha o diálogo; um segundo Esc fecha a biblioteca. Clicar numa etapa da trilha também fecha.
- Desfazer os ajustes de teste no `adda` (apagar `.app/biblioteca.json`) ao final.

- [ ] **Step 3: `sottile-teste`**

- Filtro 06: os criativos aparecem agrupados por marca, um card por anúncio, com a capa; o card mostra o número de imagens.
- Busca por parte do nome de um gráfico (com e sem acento) encontra o gráfico.
- Desmarcar "Benchmark" no menu de origem esconde os criativos e zera a contagem da 06 (se não houver outra imagem lá).

- [ ] **Step 4: Anexo e menção**

- Num prospect com uma etapa em andamento, anexar uma imagem no chat dessa etapa: ela aparece na biblioteca, na etapa certa, sem recarregar a página. O arquivo fica em `.app/anexos/<etapa>/`.
- Com a etapa 07 selecionada na trilha, abrir a biblioteca, ampliar um gráfico de outra etapa e clicar "Mencionar no chat": a biblioteca fecha e a etiqueta aparece no compositor da 07.
- Selecionar uma etapa liberada ainda não iniciada (sem chat), abrir a biblioteca e mencionar: aparece o toast "Abra uma etapa com chat para mencionar a imagem."

- [ ] **Step 5: Encerrar**

Parar o dev server. Se houve correções, confirmar `cd src && npm test && npm run typecheck && npm run lint` verdes e commitar.
