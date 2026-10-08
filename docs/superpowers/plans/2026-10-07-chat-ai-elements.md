# Chat da etapa com componentes do AI Elements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card de perguntas estruturadas (com resposta livre), processo do agente como ChainOfThought, anexos como etiquetas e ações Copiar/Citar nas respostas do agente.

**Architecture:** O card de perguntas segue o caminho de `propor_entregavel`: ferramenta no MCP `planejamento` → `ServicoPlanejamento.ferramenta` → estado (`Estado.perguntas`) + evento `card_perguntas` → card no chat → rota de resposta → `enfileirar` (mensagem automática ao agente). As outras três melhorias são só front-end, sobre primitivos que já existem em `packages/ui` (Base UI) e dois componentes novos adaptados do AI Elements (`chain-of-thought.tsx`, `question.tsx`).

**Tech Stack:** TypeScript, Next 16 / React 19, Base UI (`@base-ui/react`), Tailwind 4, lucide-react, vitest 5, MCP SDK + zod.

**Spec:** `docs/superpowers/specs/2026-10-07-chat-ai-elements-design.md`

## Global Constraints

- Nada de `npx shadcn add` do registro do AI Elements, nada do pacote `ai`, nada de `@radix-ui/*`.
- Componentes de `packages/ui` importam `cn` de `"cn"` (como `message.tsx` e `attachment.tsx`) e usam primitivos do Base UI.
- Nenhum travessão (U+2014) em código ou texto fora de intervalo numérico (teste `src/packages/core/test/sem-travessao.test.ts` cobre `core/src`, `mcp-planejamento/src`, `apps/web/{app,components,hooks,lib}`). Use vírgula, dois-pontos ou parênteses.
- Textos de interface e mensagens ao agente em português do Brasil.
- Limites do card: 1 a 4 perguntas; 2 a 6 opções por pergunta; "Outra resposta" sempre disponível.
- `Estado.versao` continua `1`; estados antigos sem `perguntas` são completados com `[]` na leitura.
- Comandos de teste: core `cd src/packages/core && npx vitest run <arquivo>`; web `cd src/apps/web && npx vitest run <arquivo>`. Tipos: `cd src && npm run typecheck`.

## Review Focus

- Responder um card com a etapa concluída/desatualizada: o servidor deve recusar com 409 (não enfileirar mensagem para etapa fechada). Teste na Task 2.
- Escolha única com opção marcada **e** "Outra" preenchida: o servidor recusa (400); a UI nunca deixa os dois juntos. Teste na Task 1.
- Rótulos de opção com espaços nas pontas ou caixa diferente ("Meta Ads" vs "meta ads "): recusados como repetidos; resposta usa o rótulo já normalizado (trim). Teste na Task 1.
- Mensagem só com anexo (texto vazio): rodapé `[Anexos]` sozinho, `semRodape` devolve `""` e o balão não mostra bolha vazia. Teste na Task 5.
- Texto do analista que contém literalmente `[Anexos]` no meio de uma linha não pode ser cortado: o rodapé só é reconhecido no formato exato `\n\n[Anexos]\n`. Teste na Task 5.

---

## File Structure

**Core (`src/packages/core/`)**
- Modify `src/tipos.ts`: tipos `Pergunta`, `RespostaPergunta`, `ConjuntoPerguntas`; `Estado.perguntas`; evento `card_perguntas`.
- Create `src/perguntas.ts`: funções puras (ler entrada, criar conjunto, responder).
- Modify `src/maquina-estados.ts`: `estadoInicial` com `perguntas: []`.
- Modify `src/armazenamento.ts`: `lerEstado` completa `perguntas`.
- Modify `src/servico-planejamento.ts`: ferramenta `fazer_perguntas` e `responderPerguntas`.
- Modify `src/prompts.ts`: `mensagemRespostas` e linha no system prompt.
- Modify `src/executor/fake.ts`: comando `demo:perguntar`.
- Tests: create `test/perguntas.test.ts`; modify `test/servico-planejamento.test.ts`, `test/armazenamento.test.ts`.

**MCP (`src/packages/mcp-planejamento/src/servidor.ts`)**: registrar `fazer_perguntas`.

**Regras do agente**: `.claude/skills/_shared/regras-de-validacao.md` (Regra 7).

**UI (`src/packages/ui/src/components/`)**
- Create `question.tsx`, `chain-of-thought.tsx`.

**Web (`src/apps/web/`)**
- Create `app/api/prospects/[slug]/perguntas/[id]/route.ts`.
- Modify `lib/api.ts`: `responderPerguntas`.
- Create `components/cards/card-perguntas.tsx`.
- Modify `lib/mencoes.ts` (+ test): rodapé `[Anexos]`, `extrairAnexos`, `nomeDoAnexo`, `caminhoNoProspect`.
- Create `components/chat/etiqueta-anexo.tsx`.
- Modify `components/chat/compositor.tsx`: anexos como etiquetas, arrastar, colar, citação.
- Modify `lib/passos.ts` (+ test): `iconeDoPasso`, `statusDosPassos`.
- Modify `components/chat/chat-etapa.tsx`: ChainOfThought e `ultima` resposta.
- Create `lib/citacao.ts` (+ test): `citacao`, `primeiroParagrafo`, `separadorAntes`.
- Create `components/chat/resposta-agente.tsx`: bolha + ações.
- Modify `components/chat/item-conversa.tsx`: `card_perguntas`, anexos no balão, `RespostaAgente`.
- Modify `components/trabalho/contexto-visualizador.tsx` e `components/trabalho/area-de-trabalho.tsx`: `inserirNoCompositor`.

---

### Task 1: Modelo de dados das perguntas (core, funções puras)

**Files:**
- Modify: `src/packages/core/src/tipos.ts` (perto de `Estado`, linha ~97, e `EventoConversa`, linha ~107)
- Create: `src/packages/core/src/perguntas.ts`
- Modify: `src/packages/core/src/maquina-estados.ts` (`estadoInicial`, linha ~19)
- Modify: `src/packages/core/src/armazenamento.ts` (`lerEstado`, linha ~118)
- Test: `src/packages/core/test/perguntas.test.ts`, `src/packages/core/test/armazenamento.test.ts`

**Interfaces:**
- Produces (tipos, em `@workspace/core/tipos`):
  ```ts
  export interface OpcaoPergunta { rotulo: string; descricao: string | null }
  export interface Pergunta { enunciado: string; descricao: string | null; multipla: boolean; opcoes: OpcaoPergunta[] }
  export interface RespostaPergunta { selecionadas: string[]; outra: string | null }
  export type StatusPerguntas = "pendente" | "respondida" | "sem_resposta"
  export interface ConjuntoPerguntas {
    id: string; etapa: EtapaId; perguntas: Pergunta[]; status: StatusPerguntas
    respostas: RespostaPergunta[] | null; criadoEm: string; respondidoEm: string | null
  }
  // Estado ganha: perguntas: ConjuntoPerguntas[]
  // EventoConversa ganha: { tipo: "card_perguntas"; conjuntoId: string; em: string }
  ```
- Produces (em `@workspace/core/perguntas`):
  - `lerPerguntas(entrada: unknown): Pergunta[]` (lança `ErroEntrada`)
  - `criarConjunto(estado: Estado, etapa: EtapaId, perguntas: Pergunta[], id: string, em: string): Estado`
  - `encontrarConjunto(estado: Estado, id: string): ConjuntoPerguntas` (lança `ErroNaoEncontrado`)
  - `responderConjunto(estado: Estado, id: string, entrada: unknown, em: string): Estado` (lança `TransicaoInvalida` se não pendente, `ErroEntrada` se resposta inválida)

- [ ] **Step 1: Escrever os testes que falham**

Create `src/packages/core/test/perguntas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"
import { criarConjunto, encontrarConjunto, lerPerguntas, responderConjunto } from "../src/perguntas"

const em = "2026-10-07T10:00:00.000Z"
const base = () => estadoInicial({ slug: "p", nome: "P", site: null }, em)
const entrada = [
  { enunciado: " Qual cenário usar como meta? ", multipla: false, opcoes: [{ rotulo: "Pessimista" }, { rotulo: " Realista " }, { rotulo: "Otimista" }] },
  { enunciado: "Quais canais priorizar?", descricao: "Pode marcar mais de um", multipla: true, opcoes: [{ rotulo: "Meta Ads" }, { rotulo: "Google Ads" }] },
]

describe("lerPerguntas", () => {
  it("normaliza textos, descrição ausente vira null e multipla só é true quando true", () => {
    const [p1, p2] = lerPerguntas([...entrada.slice(0, 1).map((p) => ({ ...p, multipla: "sim" })), entrada[1]])
    expect(p1).toEqual({
      enunciado: "Qual cenário usar como meta?",
      descricao: null,
      multipla: false,
      opcoes: [
        { rotulo: "Pessimista", descricao: null },
        { rotulo: "Realista", descricao: null },
        { rotulo: "Otimista", descricao: null },
      ],
    })
    expect(p2?.descricao).toBe("Pode marcar mais de um")
    expect(p2?.multipla).toBe(true)
  })

  it.each([
    ["nenhuma pergunta", []],
    ["mais de 4 perguntas", Array(5).fill(entrada[1])],
    ["não é lista", "x"],
    ["uma opção só", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "a" }] }]],
    ["7 opções", [{ enunciado: "A?", multipla: false, opcoes: Array.from({ length: 7 }, (_, i) => ({ rotulo: `o${i}` })) }]],
    ["enunciado vazio", [{ enunciado: "  ", multipla: false, opcoes: [{ rotulo: "a" }, { rotulo: "b" }] }]],
    ["rótulo vazio", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "a" }, { rotulo: " " }] }]],
    ["rótulo repetido (caixa e espaços)", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "Meta Ads" }, { rotulo: " meta ads " }] }]],
  ])("recusa %s", (_, valor) => {
    expect(() => lerPerguntas(valor)).toThrow(ErroEntrada)
  })
})

describe("criarConjunto e responderConjunto", () => {
  it("cria pendente e marca como sem_resposta só os pendentes da mesma etapa", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = criarConjunto(e, "04", lerPerguntas(entrada), "b", em)
    e = criarConjunto(e, "03", lerPerguntas(entrada), "c", em)
    expect(e.perguntas.map((c) => [c.id, c.status])).toEqual([
      ["a", "sem_resposta"],
      ["b", "pendente"],
      ["c", "pendente"],
    ])
  })

  it("grava as respostas normalizadas e recusa responder de novo", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = responderConjunto(
      e,
      "a",
      [
        { selecionadas: ["Realista"], outra: "  " },
        { selecionadas: ["Meta Ads", "Google Ads", "Meta Ads"], outra: " testar TikTok " },
      ],
      "2026-10-07T11:00:00.000Z",
    )
    const c = encontrarConjunto(e, "a")
    expect(c.status).toBe("respondida")
    expect(c.respondidoEm).toBe("2026-10-07T11:00:00.000Z")
    expect(c.respostas).toEqual([
      { selecionadas: ["Realista"], outra: null },
      { selecionadas: ["Meta Ads", "Google Ads"], outra: "testar TikTok" },
    ])
    expect(() => responderConjunto(e, "a", c.respostas, em)).toThrow(TransicaoInvalida)
  })

  it("recusa responder conjunto substituído ou inexistente", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = criarConjunto(e, "03", lerPerguntas(entrada), "b", em)
    const ok = [{ selecionadas: ["Realista"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]
    expect(() => responderConjunto(e, "a", ok, em)).toThrow(TransicaoInvalida)
    expect(() => responderConjunto(e, "zzz", ok, em)).toThrow(ErroNaoEncontrado)
  })

  it.each([
    ["faltando uma resposta", [{ selecionadas: ["Realista"], outra: null }]],
    ["pergunta sem nada marcado", [{ selecionadas: [], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["opção que não existe", [{ selecionadas: ["Neutro"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["duas opções em escolha única", [{ selecionadas: ["Realista", "Otimista"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["opção e Outra em escolha única", [{ selecionadas: ["Realista"], outra: "meio termo" }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["não é lista", { a: 1 }],
  ])("recusa resposta com %s", (_, respostas) => {
    const e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    expect(() => responderConjunto(e, "a", respostas, em)).toThrow(ErroEntrada)
  })
})
```

Add to `src/packages/core/test/armazenamento.test.ts`, inside `describe("FsArmazenamento", ...)`:

```ts
  it("estado gravado antes do card de perguntas é lido com perguntas vazias", async () => {
    await arm.criarPasta("iszi")
    const antigo: Record<string, unknown> = { ...estadoInicial({ slug: "iszi", nome: "Iszi", site: null }, "2026-10-07T10:00:00.000Z") }
    delete antigo.perguntas
    await mkdir(path.join(raiz, "clientes/iszi/.app"), { recursive: true })
    await writeFile(path.join(raiz, "clientes/iszi/.app/estado.json"), JSON.stringify(antigo))
    expect((await arm.lerEstado("iszi"))?.perguntas).toEqual([])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/perguntas.test.ts test/armazenamento.test.ts`
Expected: FAIL (`Cannot find module '../src/perguntas'` e `perguntas` undefined).

- [ ] **Step 3: Tipos**

Em `src/packages/core/src/tipos.ts`, antes de `export interface Estado`:

```ts
export interface OpcaoPergunta {
  rotulo: string
  descricao: string | null
}

export interface Pergunta {
  enunciado: string
  descricao: string | null
  multipla: boolean
  opcoes: OpcaoPergunta[]
}

export interface RespostaPergunta {
  selecionadas: string[]
  outra: string | null
}

export type StatusPerguntas = "pendente" | "respondida" | "sem_resposta"

/** Card de perguntas do agente (ferramenta fazer_perguntas). `respostas` segue a ordem de `perguntas`. */
export interface ConjuntoPerguntas {
  id: string
  etapa: EtapaId
  perguntas: Pergunta[]
  status: StatusPerguntas
  respostas: RespostaPergunta[] | null
  criadoEm: string
  respondidoEm: string | null
}
```

Em `Estado`, depois de `insumos: EstadoInsumo[]`: `perguntas: ConjuntoPerguntas[]`.
Em `EventoConversa`, depois de `card_insumo`: `| { tipo: "card_perguntas"; conjuntoId: string; em: string }`.

- [ ] **Step 4: Módulo puro**

Create `src/packages/core/src/perguntas.ts`:

```ts
import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "./erros"
import type { ConjuntoPerguntas, Estado, EtapaId, Pergunta, RespostaPergunta } from "./tipos"

const MIN_PERGUNTAS = 1
const MAX_PERGUNTAS = 4
const MIN_OPCOES = 2
const MAX_OPCOES = 6

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}

function textoObrigatorio(v: unknown, campo: string): string {
  if (typeof v !== "string" || !v.trim()) throw new ErroEntrada(`${campo} é obrigatório.`)
  return v.trim()
}

function textoOpcional(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/** Converte a entrada da ferramenta fazer_perguntas em perguntas válidas. */
export function lerPerguntas(entrada: unknown): Pergunta[] {
  if (!Array.isArray(entrada) || entrada.length < MIN_PERGUNTAS || entrada.length > MAX_PERGUNTAS) {
    throw new ErroEntrada(`Envie de ${MIN_PERGUNTAS} a ${MAX_PERGUNTAS} perguntas em "perguntas".`)
  }
  return entrada.map((bruta, i) => {
    const p = objeto(bruta)
    const n = i + 1
    const enunciado = textoObrigatorio(p.enunciado, `Pergunta ${n}: enunciado`)
    const brutas = Array.isArray(p.opcoes) ? p.opcoes : []
    if (brutas.length < MIN_OPCOES || brutas.length > MAX_OPCOES) {
      throw new ErroEntrada(`A pergunta ${n} precisa de ${MIN_OPCOES} a ${MAX_OPCOES} opções.`)
    }
    const opcoes = brutas.map((o, j) => {
      const r = objeto(o)
      return { rotulo: textoObrigatorio(r.rotulo, `Pergunta ${n}, opção ${j + 1}: rotulo`), descricao: textoOpcional(r.descricao) }
    })
    const chaves = opcoes.map((o) => o.rotulo.toLowerCase())
    if (new Set(chaves).size !== chaves.length) throw new ErroEntrada(`A pergunta ${n} tem opções com o mesmo rótulo.`)
    return { enunciado, descricao: textoOpcional(p.descricao), multipla: p.multipla === true, opcoes }
  })
}

/** Novo card pendente; os pendentes da mesma etapa ficam sem resposta. */
export function criarConjunto(estado: Estado, etapa: EtapaId, perguntas: Pergunta[], id: string, em: string): Estado {
  const conjuntos: ConjuntoPerguntas[] = estado.perguntas.map((c) =>
    c.etapa === etapa && c.status === "pendente" ? { ...c, status: "sem_resposta" } : c,
  )
  conjuntos.push({ id, etapa, perguntas, status: "pendente", respostas: null, criadoEm: em, respondidoEm: null })
  return { ...estado, perguntas: conjuntos, atualizadoEm: em }
}

export function encontrarConjunto(estado: Estado, id: string): ConjuntoPerguntas {
  const c = estado.perguntas.find((x) => x.id === id)
  if (!c) throw new ErroNaoEncontrado(`Perguntas ${id} não encontradas.`)
  return c
}

function lerRespostas(conjunto: ConjuntoPerguntas, entrada: unknown): RespostaPergunta[] {
  if (!Array.isArray(entrada) || entrada.length !== conjunto.perguntas.length) {
    throw new ErroEntrada("Responda todas as perguntas.")
  }
  return conjunto.perguntas.map((p, i) => {
    const r = objeto(entrada[i])
    const n = i + 1
    const marcadas = Array.isArray(r.selecionadas) ? r.selecionadas.filter((s): s is string => typeof s === "string") : []
    const selecionadas = [...new Set(marcadas)]
    const outra = textoOpcional(r.outra)
    const validos = new Set(p.opcoes.map((o) => o.rotulo))
    const invalida = selecionadas.find((s) => !validos.has(s))
    if (invalida !== undefined) throw new ErroEntrada(`"${invalida}" não é uma opção da pergunta ${n}.`)
    if (selecionadas.length === 0 && !outra) throw new ErroEntrada(`Responda a pergunta ${n}.`)
    if (!p.multipla && selecionadas.length + (outra ? 1 : 0) > 1) {
      throw new ErroEntrada(`A pergunta ${n} aceita só uma resposta.`)
    }
    return { selecionadas, outra }
  })
}

export function responderConjunto(estado: Estado, id: string, entrada: unknown, em: string): Estado {
  const alvo = encontrarConjunto(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(
      alvo.status === "respondida"
        ? "Estas perguntas já foram respondidas."
        : "Estas perguntas foram substituídas por outras mais recentes.",
    )
  }
  const respostas = lerRespostas(alvo, entrada)
  return {
    ...estado,
    perguntas: estado.perguntas.map((c) => (c.id === id ? { ...c, status: "respondida", respostas, respondidoEm: em } : c)),
    atualizadoEm: em,
  }
}
```

- [ ] **Step 5: Estado inicial e leitura tolerante**

`src/packages/core/src/maquina-estados.ts`, em `estadoInicial`, depois de `insumos: [],`: `perguntas: [],`.

`src/packages/core/src/armazenamento.ts`, substituir `lerEstado`:

```ts
  async lerEstado(slug: string): Promise<Estado | null> {
    const texto = await this.lerTexto(slug, ARQUIVO_ESTADO)
    if (!texto) return null
    const estado = JSON.parse(texto) as Estado
    // estado.json gravado antes do card de perguntas não tem o campo
    return { ...estado, perguntas: estado.perguntas ?? [] }
  }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run test/perguntas.test.ts test/armazenamento.test.ts`
Expected: PASS.

Run: `cd src && npm run typecheck`
Expected: só erros em `apps/web/components/chat/item-conversa.tsx` se o switch não cobrir `card_perguntas` (resolvido na Task 4). Se houver qualquer outro erro, corrija antes do commit. Se o switch der erro, adicione temporariamente `case "card_perguntas": return null` em `item-conversa.tsx` (a Task 4 substitui).

- [ ] **Step 7: Commit**

```bash
git add src/packages/core/src/tipos.ts src/packages/core/src/perguntas.ts src/packages/core/src/maquina-estados.ts src/packages/core/src/armazenamento.ts src/packages/core/test/perguntas.test.ts src/packages/core/test/armazenamento.test.ts src/apps/web/components/chat/item-conversa.tsx
git commit -m "feat(core): modelo do card de perguntas"
```

---

### Task 2: Ferramenta `fazer_perguntas` e resposta no serviço

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts` (despacho em `ferramenta`, linha ~543; novos métodos)
- Modify: `src/packages/core/src/prompts.ts`
- Test: `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Consumes: `lerPerguntas`, `criarConjunto`, `encontrarConjunto`, `responderConjunto` (Task 1).
- Produces:
  - `ServicoPlanejamento.responderPerguntas(slug: string, id: string, respostas: unknown): Promise<void>`
  - ferramenta `"fazer_perguntas"` aceita `{ perguntas: unknown }`.
  - `mensagemRespostas(c: ConjuntoPerguntas): string` em `prompts.ts`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/packages/core/test/servico-planejamento.test.ts`, ajustar o import de erros para incluir `ErroNaoEncontrado` e `TransicaoInvalida`:

```ts
import { ErroEntrada, ErroNaoEncontrado, ErroProspectExistente, ErroTurnoAtivo, TransicaoInvalida } from "../src/erros"
```

E adicionar no fim do arquivo:

```ts
describe("card de perguntas", () => {
  const perguntas = [
    { enunciado: "Qual cenário usar como meta?", multipla: false, opcoes: [{ rotulo: "Pessimista" }, { rotulo: "Realista" }, { rotulo: "Otimista" }] },
    { enunciado: "Quais canais priorizar?", multipla: true, opcoes: [{ rotulo: "Meta Ads" }, { rotulo: "Google Ads" }] },
  ]
  const respostas = [
    { selecionadas: ["Realista"], outra: null },
    { selecionadas: ["Meta Ads", "Google Ads"], outra: "testar TikTok só no Q4" },
  ]

  async function comPerguntas() {
    const slug = await prospectNaEtapa03()
    const r = await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas })
    expect(r.ok).toBe(true)
    const id = (await servico.estado(slug)).perguntas.at(-1)!.id
    return { slug, id, r }
  }

  it("fazer_perguntas cria o conjunto pendente, o card e pede para encerrar", async () => {
    const { slug, id, r } = await comPerguntas()
    expect(r.mensagem).toContain("Encerre sua resposta")
    const e = await servico.estado(slug)
    expect(e.perguntas).toHaveLength(1)
    expect(e.perguntas[0]).toMatchObject({ id, etapa: "03", status: "pendente" })
    expect((await servico.conversa(slug, "03")).some((ev) => ev.tipo === "card_perguntas" && ev.conjuntoId === id)).toBe(true)
  })

  it("fazer_perguntas inválida volta como erro para o agente, sem criar card", async () => {
    const slug = await prospectNaEtapa03()
    const r = await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas: [] })
    expect(r.ok).toBe(false)
    expect(r.mensagem).toContain("1 a 4")
    expect((await servico.estado(slug)).perguntas).toEqual([])
  })

  it("responder marca respondida e enfileira as respostas formatadas", async () => {
    const { slug, id } = await comPerguntas()
    await servico.responderPerguntas(slug, id, respostas)
    expect((await servico.estado(slug)).perguntas[0]?.status).toBe("respondida")
    expect(enfileirados).toEqual([slug])
    const texto = (await servico.retirarFila(slug))?.texto ?? ""
    expect(texto.split("\n")[0]).toContain("RESPONDEU")
    expect(texto).toContain("1. Qual cenário usar como meta? → Realista")
    expect(texto).toContain("2. Quais canais priorizar? → Meta Ads; Google Ads; Outra: “testar TikTok só no Q4”")
    await expect(servico.responderPerguntas(slug, id, respostas)).rejects.toBeInstanceOf(TransicaoInvalida)
  })

  it("pergunta nova substitui a pendente; a antiga não aceita resposta", async () => {
    const { slug, id } = await comPerguntas()
    await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas })
    expect((await servico.estado(slug)).perguntas.map((c) => c.status)).toEqual(["sem_resposta", "pendente"])
    await expect(servico.responderPerguntas(slug, id, respostas)).rejects.toBeInstanceOf(TransicaoInvalida)
    expect(enfileirados).toEqual([])
  })

  it("resposta inválida, conjunto inexistente e etapa fechada são recusados sem enfileirar", async () => {
    const { slug, id } = await comPerguntas()
    await expect(servico.responderPerguntas(slug, id, [respostas[0]])).rejects.toBeInstanceOf(ErroEntrada)
    await expect(servico.responderPerguntas(slug, "nao-existe", respostas)).rejects.toBeInstanceOf(ErroNaoEncontrado)
    const e = await servico.estado(slug)
    e.etapas["03"].status = "concluida"
    await writeFile(path.join(raiz, "clientes", slug, ".app/estado.json"), JSON.stringify(e))
    await expect(servico.responderPerguntas(slug, id, respostas)).rejects.toBeInstanceOf(TransicaoInvalida)
    expect(enfileirados).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-planejamento.test.ts -t "card de perguntas"`
Expected: FAIL (`Ferramenta desconhecida: fazer_perguntas`, `responderPerguntas is not a function`).

- [ ] **Step 3: Mensagem ao agente e system prompt**

Em `src/packages/core/src/prompts.ts`, trocar o import do topo por:

```ts
import type { ConjuntoPerguntas, EtapaCatalogo } from "./tipos"
```

No `systemPromptModoInterface`, logo depois da linha que começa com `- Para pedir um arquivo ao analista, chame \`solicitar_insumo\``, inserir:

```
- Para pedir uma decisão entre alternativas, chame \`fazer_perguntas\` (até 4 perguntas, cada uma com 2 a 6 opções; o analista sempre pode escrever outra resposta) em vez de listar as opções no texto. Depois de chamar, encerre a resposta e espere: as respostas chegam como nova mensagem.
```

No fim do arquivo:

```ts
export function mensagemRespostas(c: ConjuntoPerguntas): string {
  const linhas = c.perguntas.map((p, i) => {
    const r = c.respostas?.[i]
    const partes = [...(r?.selecionadas ?? []), ...(r?.outra ? [`Outra: “${r.outra}”`] : [])]
    return `${i + 1}. ${p.enunciado} → ${partes.join("; ")}`
  })
  return `O analista RESPONDEU às perguntas (${c.id}):\n${linhas.join("\n")}\nSiga a partir dessas respostas.`
}
```

- [ ] **Step 4: Serviço**

Em `src/packages/core/src/servico-planejamento.ts`:

1. Imports: adicionar `import { criarConjunto, encontrarConjunto, lerPerguntas, responderConjunto } from "./perguntas"` e incluir `mensagemRespostas` no import existente de `./prompts`.
2. Em `ferramenta(...)`, depois da linha de `solicitar_insumo`:

```ts
      if (nome === "fazer_perguntas") return await this.ferramentaPerguntar(ctx.slug, ctx.etapa, dados)
```

3. Depois de `ferramentaSolicitar`, adicionar:

```ts
  private async ferramentaPerguntar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const perguntas = lerPerguntas(d.perguntas)
    const id = this.gerarId()
    await this.mutar(slug, (e) => ({ estado: criarConjunto(e, etapa, perguntas, id, this.agora()), resultado: undefined }))
    await this.registrarConversa(slug, etapa, { tipo: "card_perguntas", conjuntoId: id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Perguntas mostradas ao analista (id ${id}). Encerre sua resposta agora e aguarde: as respostas chegam como nova mensagem.`,
    }
  }
```

4. Na seção `// ---------- entregáveis ----------`, depois de `pedirAjuste`, adicionar:

```ts
  async responderPerguntas(slug: string, id: string, respostas: unknown): Promise<void> {
    const conjunto = await this.mutar(slug, (e) => {
      let novo = responderConjunto(e, id, respostas, this.agora())
      const alvo = encontrarConjunto(novo, id)
      novo = me.registrarMensagemAnalista(novo, alvo.etapa, this.agora())
      return { estado: novo, resultado: alvo }
    })
    await this.enfileirar(slug, conjunto.etapa, mensagemRespostas(conjunto))
  }
```

`registrarMensagemAnalista` lança `TransicaoInvalida` quando a etapa não está `em_andamento`/`pronta`; como roda dentro do mesmo `mutar`, nada é gravado nesse caso.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run`
Expected: PASS (inclui `sem-travessao` e `prompts`).

- [ ] **Step 6: Commit**

```bash
git add src/packages/core/src/servico-planejamento.ts src/packages/core/src/prompts.ts src/packages/core/test/servico-planejamento.test.ts
git commit -m "feat(core): ferramenta fazer_perguntas e resposta do analista"
```

---

### Task 3: Ferramenta no MCP, Regra 7 e modo demonstração

**Files:**
- Modify: `src/packages/mcp-planejamento/src/servidor.ts`
- Modify: `.claude/skills/_shared/regras-de-validacao.md` (Regra 7, linha ~86)
- Modify: `src/packages/core/src/executor/fake.ts`

**Interfaces:**
- Consumes: ferramenta `"fazer_perguntas"` no endpoint `/api/interno/ferramentas` (Task 2; a rota é genérica, não muda).
- Produces: mensagem `demo:perguntar` no executor demo (`PLANEJAMENTO_EXECUTOR=demo`) cria um card de exemplo.

- [ ] **Step 1: Registrar a ferramenta no MCP**

Em `src/packages/mcp-planejamento/src/servidor.ts`, depois do bloco de `solicitar_insumo`:

```ts
servidor.registerTool(
  "fazer_perguntas",
  {
    title: "Fazer perguntas ao analista",
    description:
      "Mostra ao analista um card com até 4 perguntas de alternativas. Use quando precisar de uma decisão entre opções definidas, em vez de listar opções no texto. Toda pergunta já tem um campo de resposta livre. Depois de chamar, encerre a resposta e aguarde: as respostas chegam como nova mensagem.",
    inputSchema: {
      perguntas: z
        .array(
          z.object({
            enunciado: z.string().describe("A pergunta, curta e direta"),
            descricao: z.string().optional().describe("Contexto opcional mostrado abaixo da pergunta"),
            multipla: z.boolean().describe("true = o analista pode marcar várias opções"),
            opcoes: z
              .array(z.object({ rotulo: z.string(), descricao: z.string().optional() }))
              .min(2)
              .max(6),
          }),
        )
        .min(1)
        .max(4),
    },
  },
  async (args) => chamarApp("fazer_perguntas", args),
)
```

- [ ] **Step 2: Regra 7**

Em `.claude/skills/_shared/regras-de-validacao.md`, na seção `## 7. Modo interface`:

1. Trocar `(\`propor_entregavel\`, \`solicitar_insumo\`, \`sinalizar_etapa_pronta\`)` por `(\`propor_entregavel\`, \`solicitar_insumo\`, \`fazer_perguntas\`, \`sinalizar_etapa_pronta\`)`.
2. Depois do item `- **Insumos:** ...`, inserir:

```markdown
- **Decisões entre alternativas:** quando precisar que o analista escolha
  entre opções definidas (cenário, prioridade, premissa), chame
  `fazer_perguntas` com até 4 perguntas em vez de listar as opções no texto.
  Toda pergunta já aceita resposta livre. Depois de chamar, encerre a
  resposta; as respostas chegam como nova mensagem ("RESPONDEU").
  Perguntas abertas de esclarecimento continuam no chat normal.
```

- [ ] **Step 3: Modo demonstração**

Em `src/packages/core/src/executor/fake.ts`, dentro de `criarExecutorDemo`, extrair o `fetch` para uma função local e acrescentar o comando `demo:perguntar`. Substituir o corpo de `criarExecutorDemo` por:

```ts
export function criarExecutorDemo(): Executor {
  return new FakeExecutor(async function* (pedido, sinal) {
    const env = () =>
      (JSON.parse(pedido.mcpConfig) as { mcpServers: { planejamento: { env: Record<string, string> } } }).mcpServers.planejamento.env
    const chamarFerramenta = async (ferramenta: string, entrada: unknown) => {
      const { PLANEJAMENTO_APP_URL, PLANEJAMENTO_TOKEN } = env()
      const resposta = await fetch(`${PLANEJAMENTO_APP_URL}/api/interno/ferramentas`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${PLANEJAMENTO_TOKEN}` },
        body: JSON.stringify({ ferramenta, entrada }),
      })
      return ((await resposta.json()) as { mensagem?: string }).mensagem ?? "sem resposta"
    }

    const comando = pedido.mensagem.match(/demo:propor\s+(\S+)\s+(\S+)/)
    if (comando) {
      const [, tipo, caminho] = comando
      const mensagem = await chamarFerramenta("propor_entregavel", {
        tipo,
        titulo: `Demonstração (${tipo})`,
        arquivo_rascunho: caminho,
        nome_final: `demonstracao-${tipo}`,
      })
      yield* roteiroSimples(`Modo demonstração: ${mensagem}`)(pedido, sinal)
      return
    }
    if (pedido.mensagem.includes("demo:perguntar")) {
      const mensagem = await chamarFerramenta("fazer_perguntas", {
        perguntas: [
          {
            enunciado: "Qual cenário usar como meta do projeto?",
            descricao: "Os três cenários estão na projeção aprovada.",
            multipla: false,
            opcoes: [{ rotulo: "Pessimista" }, { rotulo: "Realista" }, { rotulo: "Otimista" }],
          },
          {
            enunciado: "Quais canais priorizar no primeiro trimestre?",
            multipla: true,
            opcoes: [{ rotulo: "Meta Ads" }, { rotulo: "Google Ads" }, { rotulo: "E-mail" }],
          },
        ],
      })
      yield* roteiroSimples(`Modo demonstração: ${mensagem}`)(pedido, sinal)
      return
    }
    const texto = `Modo demonstração (sem Claude). Recebi: “${pedido.mensagem.slice(0, 200)}”`
    yield* roteiroSimples(texto)(pedido, sinal)
  })
}
```

Atualizar o comentário JSDoc acima da função para citar também `"demo:perguntar"` ("faz o demo chamar fazer_perguntas com duas perguntas de exemplo").

- [ ] **Step 4: Verificar**

Run: `cd src && npm run typecheck && cd packages/core && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/mcp-planejamento/src/servidor.ts .claude/skills/_shared/regras-de-validacao.md src/packages/core/src/executor/fake.ts
git commit -m "feat(mcp): ferramenta fazer_perguntas, Regra 7 e demo:perguntar"
```

---

### Task 4: Card de perguntas na interface

**Files:**
- Create: `src/apps/web/app/api/prospects/[slug]/perguntas/[id]/route.ts`
- Modify: `src/apps/web/lib/api.ts`
- Create: `src/packages/ui/src/components/question.tsx`
- Create: `src/apps/web/components/cards/card-perguntas.tsx`
- Modify: `src/apps/web/components/chat/item-conversa.tsx`

**Interfaces:**
- Consumes: `ServicoPlanejamento.responderPerguntas` (Task 2); tipos `ConjuntoPerguntas`, `RespostaPergunta` (Task 1).
- Produces:
  - `POST /api/prospects/[slug]/perguntas/[id]` com corpo `{ respostas: RespostaPergunta[] }` → `{ ok: true }`.
  - `api.responderPerguntas(slug: string, id: string, respostas: RespostaPergunta[]): Promise<unknown>`.
  - `@workspace/ui/components/question`: `Question`, `QuestionPrompt`, `QuestionDescription`, `QuestionOptions`, `QuestionOption`, `QuestionInput`.
  - `CardPerguntas({ slug, conjunto, bloqueado }: { slug: string; conjunto: ConjuntoPerguntas; bloqueado: string | null })`.

Não há testes de componente no projeto (sem jsdom); a lógica de validação está coberta no core. Esta task fecha com typecheck, lint e a checagem manual do Step 6.

- [ ] **Step 1: Rota e cliente**

Create `src/apps/web/app/api/prospects/[slug]/perguntas/[id]/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/perguntas/[id]">) {
  try {
    const { slug, id } = await ctx.params
    const { respostas } = await lerJson<{ respostas?: unknown }>(req)
    await servidor().servico.responderPerguntas(slug, id, respostas)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

Em `src/apps/web/lib/api.ts`: importar o tipo (`import type { EtapaId, RespostaPergunta, ResultadoValidacao } from "@workspace/core/tipos"`) e, depois de `pedirAjuste`, adicionar:

```ts
  responderPerguntas: (slug: string, id: string, respostas: RespostaPergunta[]) =>
    chamar(`${base(slug)}/perguntas/${encodeURIComponent(id)}`, comJson("POST", { respostas })),
```

- [ ] **Step 2: Primitivos `question.tsx` (adaptado do AI Elements, sem Radix nem `ai`)**

Create `src/packages/ui/src/components/question.tsx`:

```tsx
import * as React from "react"
import { cn } from "cn"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

/** Uma pergunta: fieldset para que `disabled` desligue opções e campo de uma vez. */
function Question({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="question" className={cn("flex min-w-0 flex-col gap-2 border-0 p-0", className)} {...props} />
}

function QuestionPrompt({ className, ...props }: React.ComponentProps<"legend">) {
  return <legend data-slot="question-prompt" className={cn("mb-1 text-sm font-medium", className)} {...props} />
}

function QuestionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="question-description" className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function QuestionOptions({ className, multipla = false, ...props }: React.ComponentProps<"div"> & { multipla?: boolean }) {
  return (
    <div
      data-slot="question-options"
      role={multipla ? "group" : "radiogroup"}
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  )
}

function QuestionOption({
  className,
  marcada = false,
  multipla = false,
  ...props
}: React.ComponentProps<typeof Button> & { marcada?: boolean; multipla?: boolean }) {
  return (
    <Button
      type="button"
      data-slot="question-option"
      data-marcada={marcada}
      role={multipla ? "checkbox" : "radio"}
      aria-checked={marcada}
      variant={marcada ? "default" : "outline"}
      size="sm"
      className={cn("h-auto min-h-7 max-w-full py-1 text-left whitespace-normal", className)}
      {...props}
    />
  )
}

function QuestionInput({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea data-slot="question-input" rows={2} className={cn("min-h-0 text-sm", className)} {...props} />
}

export { Question, QuestionPrompt, QuestionDescription, QuestionOptions, QuestionOption, QuestionInput }
```

- [ ] **Step 3: `CardPerguntas`**

Create `src/apps/web/components/cards/card-perguntas.tsx`:

```tsx
"use client"

import { MessageCircleQuestionIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { ConjuntoPerguntas, RespostaPergunta } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Question,
  QuestionDescription,
  QuestionInput,
  QuestionOption,
  QuestionOptions,
  QuestionPrompt,
} from "@workspace/ui/components/question"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"

const vazia = (): RespostaPergunta => ({ selecionadas: [], outra: null })

export function CardPerguntas({
  slug,
  conjunto,
  bloqueado,
}: {
  slug: string
  conjunto: ConjuntoPerguntas
  bloqueado: string | null
}) {
  const [respostas, setRespostas] = useState<RespostaPergunta[]>(() => conjunto.perguntas.map(vazia))
  const [outraAberta, setOutraAberta] = useState<boolean[]>(() => conjunto.perguntas.map(() => false))
  const [enviando, setEnviando] = useState(false)

  const respondida = conjunto.status === "respondida"
  const substituida = conjunto.status === "sem_resposta"
  const editavel = conjunto.status === "pendente" && bloqueado === null
  const mostradas = respondida && conjunto.respostas ? conjunto.respostas : respostas
  const completo = respostas.every((r) => r.selecionadas.length > 0 || (r.outra ?? "").trim() !== "")

  function mudar(i: number, f: (r: RespostaPergunta) => RespostaPergunta) {
    setRespostas((rs) => rs.map((r, j) => (j === i ? f(r) : r)))
  }

  function alternar(i: number, rotulo: string) {
    const multipla = conjunto.perguntas[i]!.multipla
    mudar(i, (r) => {
      if (multipla) {
        const tem = r.selecionadas.includes(rotulo)
        return { ...r, selecionadas: tem ? r.selecionadas.filter((s) => s !== rotulo) : [...r.selecionadas, rotulo] }
      }
      return { selecionadas: r.selecionadas[0] === rotulo ? [] : [rotulo], outra: null }
    })
    if (!multipla) setOutraAberta((a) => a.map((v, j) => (j === i ? false : v)))
  }

  function abrirOutra(i: number) {
    setOutraAberta((a) => a.map((v, j) => (j === i ? true : v)))
    if (!conjunto.perguntas[i]!.multipla) mudar(i, (r) => ({ ...r, selecionadas: [] }))
  }

  async function enviar() {
    setEnviando(true)
    try {
      await api.responderPerguntas(
        slug,
        conjunto.id,
        respostas.map((r) => ({ selecionadas: r.selecionadas, outra: r.outra?.trim() || null })),
      )
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={cn("bg-card max-w-xl rounded-xl border p-4", substituida && "opacity-60")}>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircleQuestionIcon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{conjunto.perguntas.length === 1 ? "Pergunta do agente" : "Perguntas do agente"}</span>
        {respondida && <Badge variant="secondary" className="ml-auto">Respondida</Badge>}
        {substituida && <Badge variant="outline" className="ml-auto">Substituída por uma pergunta mais recente</Badge>}
      </div>
      <div className="flex flex-col gap-5">
        {conjunto.perguntas.map((p, i) => {
          const r = mostradas[i] ?? vazia()
          const outraVisivel = respondida ? r.outra !== null : outraAberta[i]
          return (
            <Question key={i} disabled={!editavel || enviando}>
              <QuestionPrompt>
                {conjunto.perguntas.length > 1 && <span className="text-muted-foreground mr-1">{i + 1}.</span>}
                {p.enunciado}
              </QuestionPrompt>
              {p.descricao && <QuestionDescription>{p.descricao}</QuestionDescription>}
              <QuestionOptions multipla={p.multipla} aria-label={p.enunciado}>
                {p.opcoes.map((o) => {
                  const marcada = r.selecionadas.includes(o.rotulo)
                  return (
                    <QuestionOption
                      key={o.rotulo}
                      marcada={marcada}
                      multipla={p.multipla}
                      title={o.descricao ?? undefined}
                      className={cn(respondida && !marcada && "opacity-50")}
                      onClick={() => alternar(i, o.rotulo)}
                    >
                      {o.rotulo}
                    </QuestionOption>
                  )
                })}
                {editavel && !outraAberta[i] && (
                  <QuestionOption marcada={false} multipla={p.multipla} onClick={() => abrirOutra(i)}>
                    Outra…
                  </QuestionOption>
                )}
              </QuestionOptions>
              {outraVisivel &&
                (respondida ? (
                  <p className="text-sm italic">Outra: {r.outra}</p>
                ) : (
                  <QuestionInput
                    autoFocus
                    placeholder="Escreva sua resposta"
                    value={r.outra ?? ""}
                    onChange={(e) => mudar(i, (atual) => ({ ...atual, outra: e.target.value }))}
                  />
                ))}
            </Question>
          )
        })}
      </div>
      {conjunto.status === "pendente" && (
        <div className="mt-4 flex items-center gap-3">
          {bloqueado && <p className="text-muted-foreground text-xs">{bloqueado}</p>}
          <Button className="ml-auto" disabled={!editavel || !completo || enviando} onClick={() => void enviar()}>
            {enviando && <Spinner />} Enviar respostas
          </Button>
        </div>
      )}
    </div>
  )
}
```

Confirme que `Badge` tem as variantes `secondary` e `outline` em `src/packages/ui/src/components/badge.tsx`; se o nome for outro, use a variante neutra existente.

- [ ] **Step 4: Ligar no chat**

Em `src/apps/web/components/chat/item-conversa.tsx`: importar `import { CardPerguntas } from "@/components/cards/card-perguntas"` e, depois do `case "card_insumo"` (substituindo o `case "card_perguntas": return null` temporário da Task 1, se existir):

```tsx
    case "card_perguntas": {
      const conjunto = dados.estado.perguntas.find((c) => c.id === evento.conjuntoId)
      if (!conjunto) return null
      const status = dados.estado.etapas[etapa].status
      const bloqueado =
        status === "concluida" || status === "desatualizada"
          ? "Etapa fechada para conversa. Use Reabrir ou Revisar no painel para responder."
          : null
      return <CardPerguntas slug={slug} conjunto={conjunto} bloqueado={bloqueado} />
    }
```

- [ ] **Step 5: Verificar tipos e lint**

Run: `cd src && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Checagem manual**

Run: `cd src/apps/web && PLANEJAMENTO_EXECUTOR=demo npm run dev`. Abrir um prospect de teste numa etapa em andamento e enviar `demo:perguntar`.
Esperado: card com 2 perguntas; "Enviar respostas" desabilitado até as duas terem resposta; na 1ª (escolha única) marcar "Realista" e depois "Outra…" desmarca "Realista"; na 2ª marcar duas opções e "Outra…" com texto; enviar mostra o separador "O analista RESPONDEU às perguntas (...)" e o card fica "Respondida" com as escolhas; recarregar a página mantém o card respondido; enviar `demo:perguntar` de novo e depois mais uma vez deixa o anterior "Substituída por uma pergunta mais recente".

- [ ] **Step 7: Commit**

```bash
git add "src/apps/web/app/api/prospects/[slug]/perguntas" src/apps/web/lib/api.ts src/packages/ui/src/components/question.tsx src/apps/web/components/cards/card-perguntas.tsx src/apps/web/components/chat/item-conversa.tsx
git commit -m "feat(web): card de perguntas com resposta livre"
```

---

### Task 5: Rodapé de anexos (funções puras)

**Files:**
- Modify: `src/apps/web/lib/mencoes.ts`
- Test: `src/apps/web/lib/mencoes.test.ts`

**Interfaces:**
- Produces (em `@/lib/mencoes`):
  - `textoParaAgente(texto: string, slug: string, anexos?: string[]): string` (anexos = caminhos como devolvidos por `api.enviarAnexo`, ex.: `clientes/p/.app/anexos/123-a.xlsx`)
  - `semRodape(texto: string): string` (agora também tira `[Anexos]`)
  - `extrairAnexos(texto: string): string[]`
  - `nomeDoAnexo(caminho: string): string` (última parte, sem o prefixo numérico `123-`)
  - `caminhoNoProspect(caminho: string, slug: string): string` (tira `clientes/<slug>/`)

- [ ] **Step 1: Escrever os testes que falham**

Em `src/apps/web/lib/mencoes.test.ts`, trocar o import por:

```ts
import { caminhoNoProspect, consultaDeMencao, extrairAnexos, extrairMencoes, nomeDoAnexo, semRodape, textoParaAgente } from "./mencoes"
```

E adicionar no fim:

```ts
describe("anexos na mensagem", () => {
  const anexo = "clientes/p/.app/anexos/1728300000000-historico mensal.xlsx"

  it("acrescenta o rodapé [Anexos] depois do de menções e some na hora de mostrar", () => {
    const t = textoParaAgente("olha o @dados/x.xlsx", "p", [anexo, "clientes/p/.app/anexos/2-print.png"])
    expect(t).toBe(
      "olha o @dados/x.xlsx\n\n[Arquivos mencionados]\n- clientes/p/dados/x.xlsx\n\n[Anexos]\n- clientes/p/.app/anexos/1728300000000-historico mensal.xlsx\n- clientes/p/.app/anexos/2-print.png",
    )
    expect(semRodape(t)).toBe("olha o @dados/x.xlsx")
    expect(extrairAnexos(t)).toEqual([anexo, "clientes/p/.app/anexos/2-print.png"])
  })

  it("mensagem só com anexo", () => {
    const t = textoParaAgente("", "p", [anexo])
    expect(t).toBe(`\n\n[Anexos]\n- ${anexo}`)
    expect(semRodape(t)).toBe("")
    expect(extrairAnexos(t)).toEqual([anexo])
  })

  it("sem anexos não muda nada e texto com [Anexos] no meio da linha não é cortado", () => {
    expect(textoParaAgente("oi", "p", [])).toBe("oi")
    expect(extrairAnexos("oi")).toEqual([])
    const literal = "veja a seção [Anexos] do relatório"
    expect(semRodape(literal)).toBe(literal)
    expect(extrairAnexos(literal)).toEqual([])
  })

  it("nome e caminho do anexo para mostrar e abrir", () => {
    expect(nomeDoAnexo(anexo)).toBe("historico mensal.xlsx")
    expect(nomeDoAnexo("clientes/p/dados/x.xlsx")).toBe("x.xlsx")
    expect(caminhoNoProspect(anexo, "p")).toBe(".app/anexos/1728300000000-historico mensal.xlsx")
    expect(caminhoNoProspect("dados/x.xlsx", "p")).toBe("dados/x.xlsx")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/mencoes.test.ts`
Expected: FAIL (`extrairAnexos` não exportado).

- [ ] **Step 3: Implementar**

Em `src/apps/web/lib/mencoes.ts`, atualizar o comentário do topo para citar os anexos e substituir `textoParaAgente` e `semRodape`; acrescentar as novas funções:

```ts
const RODAPE = "\n\n[Arquivos mencionados]\n"
const RODAPE_ANEXOS = "\n\n[Anexos]\n"

export function textoParaAgente(texto: string, slug: string, anexos: string[] = []): string {
  const mencoes = extrairMencoes(texto)
  let saida = texto
  if (mencoes.length > 0) saida += `${RODAPE}${mencoes.map((m) => `- clientes/${slug}/${m}`).join("\n")}`
  if (anexos.length > 0) saida += `${RODAPE_ANEXOS}${anexos.map((c) => `- ${c}`).join("\n")}`
  return saida
}

/** Mensagem como o analista escreveu, sem os rodapés técnicos para o agente. */
export function semRodape(texto: string): string {
  const cortes = [texto.indexOf(RODAPE), texto.indexOf(RODAPE_ANEXOS)].filter((i) => i !== -1)
  return cortes.length === 0 ? texto : texto.slice(0, Math.min(...cortes))
}

/** Caminhos do rodapé [Anexos] (como o app devolveu no upload). */
export function extrairAnexos(texto: string): string[] {
  const i = texto.indexOf(RODAPE_ANEXOS)
  if (i === -1) return []
  return texto
    .slice(i + RODAPE_ANEXOS.length)
    .split("\n")
    .map((l) => l.match(/^- (.+)$/)?.[1])
    .filter((c): c is string => c !== undefined)
}

/** Nome para mostrar: último trecho do caminho, sem o prefixo numérico que o upload acrescenta. */
export function nomeDoAnexo(caminho: string): string {
  return (caminho.split("/").pop() ?? caminho).replace(/^\d+-/, "")
}

/** Caminho relativo à pasta do prospect (o que o visualizador espera). */
export function caminhoNoProspect(caminho: string, slug: string): string {
  const prefixo = `clientes/${slug}/`
  return caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : caminho
}
```

(O `RODAPE` já existe no arquivo; mantenha uma única declaração.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/apps/web && npx vitest run lib/mencoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/mencoes.ts src/apps/web/lib/mencoes.test.ts
git commit -m "feat(web): rodapé [Anexos] nas mensagens ao agente"
```

---

### Task 6: Anexos como etiquetas (compositor e balão)

**Files:**
- Create: `src/apps/web/components/chat/etiqueta-anexo.tsx`
- Modify: `src/apps/web/components/chat/compositor.tsx`
- Modify: `src/apps/web/components/chat/item-conversa.tsx` (case `mensagem_analista`)

**Interfaces:**
- Consumes: `textoParaAgente(texto, slug, anexos)`, `extrairAnexos`, `nomeDoAnexo`, `caminhoNoProspect`, `semRodape` (Task 5); `Attachment*` de `@workspace/ui/components/attachment`.
- Produces: `EtiquetaAnexo({ nome, estado?, erro?, aoRemover?, aoAbrir? })`.

- [ ] **Step 1: `EtiquetaAnexo`**

Create `src/apps/web/components/chat/etiqueta-anexo.tsx`:

```tsx
"use client"

import { FileIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon, XIcon, type LucideIcon } from "lucide-react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@workspace/ui/components/attachment"
import { Spinner } from "@workspace/ui/components/spinner"

function iconeDoArquivo(nome: string): LucideIcon {
  const ext = nome.split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon
  if (["xlsx", "xls", "csv"].includes(ext)) return FileSpreadsheetIcon
  if (["pdf", "docx", "doc", "md", "txt"].includes(ext)) return FileTextIcon
  return FileIcon
}

export function EtiquetaAnexo({
  nome,
  estado = "done",
  erro = null,
  aoRemover,
  aoAbrir,
}: {
  nome: string
  estado?: "uploading" | "done" | "error"
  erro?: string | null
  aoRemover?: () => void
  aoAbrir?: () => void
}) {
  const Icone = iconeDoArquivo(nome)
  return (
    <Attachment size="sm" state={estado} title={erro ?? nome} className="min-w-0">
      <AttachmentMedia>{estado === "uploading" ? <Spinner /> : <Icone />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{nome}</AttachmentTitle>
        {erro && <AttachmentDescription>{erro}</AttachmentDescription>}
      </AttachmentContent>
      {aoAbrir && <AttachmentTrigger aria-label={`Abrir ${nome}`} onClick={aoAbrir} />}
      {aoRemover && (
        <AttachmentActions>
          <AttachmentAction aria-label={`Remover ${nome}`} onClick={aoRemover}>
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}
```

- [ ] **Step 2: Compositor**

Em `src/apps/web/components/chat/compositor.tsx`:

1. Imports: remover `Spinner` só se deixar de ser usado (continua usado no botão Enviar); adicionar `import { AttachmentGroup } from "@workspace/ui/components/attachment"` e `import { EtiquetaAnexo } from "./etiqueta-anexo"`.
2. Antes de `export function Compositor`, declarar:

```ts
interface AnexoCompositor {
  id: number
  nome: string
  caminho: string | null
  estado: "uploading" | "done" | "error"
  erro: string | null
}
```

3. Trocar `const [anexando, setAnexando] = useState(false)` por:

```ts
  const [anexos, setAnexos] = useState<AnexoCompositor[]>([])
  const proximoAnexo = useRef(0)
  const [arrastando, setArrastando] = useState(false)
  const subindo = anexos.some((a) => a.estado === "uploading")
  const prontos = anexos.filter((a) => a.estado === "done" && a.caminho).map((a) => a.caminho!)
```

4. Substituir `enviar` e `anexar`:

```ts
  async function enviar() {
    const limpo = texto.trim()
    if (!limpo && prontos.length === 0) return
    setEnviando(true)
    try {
      await api.enviarMensagem(slug, etapa, textoParaAgente(limpo, slug, prontos))
      setTexto("")
      setAnexos([])
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function anexar(lista: FileList | File[] | null) {
    const arquivos = lista ? Array.from(lista) : []
    if (entradaArquivo.current) entradaArquivo.current.value = ""
    await Promise.all(
      arquivos.map(async (arquivo) => {
        const id = ++proximoAnexo.current
        setAnexos((a) => [...a, { id, nome: arquivo.name, caminho: null, estado: "uploading", erro: null }])
        try {
          const { caminho } = await api.enviarAnexo(slug, etapa, arquivo)
          setAnexos((a) => a.map((x) => (x.id === id ? { ...x, caminho, estado: "done" } : x)))
        } catch (e) {
          setAnexos((a) => a.map((x) => (x.id === id ? { ...x, estado: "error", erro: mensagemDeErro(e) } : x)))
        }
      }),
    )
  }

  const podeEnviar = !desabilitado && !enviando && !subindo && (texto.trim() !== "" || prontos.length > 0)
```

5. No `onKeyDown` do `Textarea`, trocar `if (!desabilitado && !enviando) void enviar()` por `if (podeEnviar) void enviar()`.
6. No `Textarea`, acrescentar:

```tsx
          onPaste={(e) => {
            const arquivos = Array.from(e.clipboardData.files)
            if (arquivos.length === 0 || desabilitado) return
            e.preventDefault()
            void anexar(arquivos)
          }}
```

7. Trocar a `div` externa `<div className="mx-auto flex max-w-3xl flex-col gap-2">` por uma área que aceita arrastar:

```tsx
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-2 rounded-lg transition-shadow",
          arrastando && "ring-primary/50 ring-2 ring-offset-4 ring-offset-background",
        )}
        onDragOver={(e) => {
          if (desabilitado || !e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false)
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setArrastando(false)
          if (!desabilitado) void anexar(e.dataTransfer.files)
        }}
      >
```

8. Logo depois de `{motivo && ...}`, antes do `<div className="relative">`:

```tsx
        {anexos.length > 0 && (
          <AttachmentGroup>
            {anexos.map((a) => (
              <EtiquetaAnexo
                key={a.id}
                nome={a.nome}
                estado={a.estado}
                erro={a.erro}
                aoRemover={() => setAnexos((lista) => lista.filter((x) => x.id !== a.id))}
              />
            ))}
          </AttachmentGroup>
        )}
```

9. Botão de clipe: `disabled={desabilitado}` e conteúdo sempre `<PaperclipIcon />`. Botão Enviar: `disabled={!podeEnviar}`.
10. Atualizar o placeholder: `"Escreva para o agente… (@ menciona um arquivo, arraste ou cole para anexar, Enter envia)"`.

- [ ] **Step 3: Balão do analista com etiquetas**

Em `src/apps/web/components/chat/item-conversa.tsx`:

1. Imports: `import { AttachmentGroup } from "@workspace/ui/components/attachment"`, `import { EtiquetaAnexo } from "./etiqueta-anexo"`, e incluir `caminhoNoProspect, extrairAnexos, nomeDoAnexo` no import de `@/lib/mencoes`.
2. Adicionar, depois de `TextoComMencoes`:

```tsx
/** Anexos enviados junto com a mensagem; clicar abre o arquivo na lateral. */
function AnexosDaMensagem({ texto, slug }: { texto: string; slug: string }) {
  const { abrirArquivo } = useVisualizador()
  const anexos = extrairAnexos(texto)
  if (anexos.length === 0) return null
  return (
    <AttachmentGroup className="justify-end">
      {anexos.map((c) => (
        <EtiquetaAnexo key={c} nome={nomeDoAnexo(c)} aoAbrir={() => abrirArquivo(caminhoNoProspect(c, slug))} />
      ))}
    </AttachmentGroup>
  )
}
```

3. No ramo não automático de `mensagem_analista`, substituir o conteúdo de `<MessageContent>` por:

```tsx
          <MessageContent>
            {semRodape(evento.texto).trim() && (
              <Bubble variant="default" align="end">
                <BubbleContent className="whitespace-pre-wrap">
                  <TextoComMencoes texto={evento.texto} />
                </BubbleContent>
              </Bubble>
            )}
            <AnexosDaMensagem texto={evento.texto} slug={slug} />
          </MessageContent>
```

- [ ] **Step 4: Verificar**

Run: `cd src && npm run typecheck && npm run lint && cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Checagem manual**

Com `PLANEJAMENTO_EXECUTOR=demo npm run dev`:
- anexar por clipe, por arrastar e colando uma imagem: etiqueta com spinner e depois ícone; ✕ remove;
- forçar erro (anexar com o servidor parado ou um arquivo de 0 bytes, se a rota recusar): etiqueta vermelha com mensagem, ignorada no envio;
- Enviar fica desabilitado durante o upload; enviar só com anexo funciona;
- a mensagem enviada mostra as etiquetas embaixo do balão (sem balão vazio quando não há texto) e clicar abre o arquivo na lateral;
- o eco do demo ("Recebi: …") mostra o rodapé `[Anexos]` com o caminho `clientes/<slug>/.app/anexos/...`.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web/components/chat/etiqueta-anexo.tsx src/apps/web/components/chat/compositor.tsx src/apps/web/components/chat/item-conversa.tsx
git commit -m "feat(web): anexos como etiquetas, com arrastar e colar"
```

---

### Task 7: Processo do agente como ChainOfThought

**Files:**
- Modify: `src/apps/web/lib/passos.ts`
- Test: `src/apps/web/lib/passos.test.ts`
- Create: `src/packages/ui/src/components/chain-of-thought.tsx`
- Modify: `src/apps/web/components/chat/chat-etapa.tsx`

**Interfaces:**
- Produces (em `@/lib/passos`):
  - `type IconePasso = "ler" | "escrever" | "script" | "busca" | "web" | "skill" | "subagente" | "fala" | "outro"`
  - `iconeDoPasso(e: EventoProcesso): IconePasso`
  - `statusDosPassos(quantidade: number, aoVivo: boolean): ("complete" | "active")[]`
- Produces (em `@workspace/ui/components/chain-of-thought`): `ChainOfThought` (props do `Collapsible.Root` do Base UI: `open`, `defaultOpen`, `onOpenChange`), `ChainOfThoughtHeader` (`icon?: LucideIcon`), `ChainOfThoughtContent`, `ChainOfThoughtStep` (`icon?`, `label: ReactNode`, `description?: ReactNode`, `status?: "complete" | "active" | "pending"`).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/apps/web/lib/passos.test.ts`, trocar o import por:

```ts
import { agruparProcesso, iconeDoPasso, separarProcessoAoVivo, statusDosPassos, type ItemChat } from "./passos"
```

E adicionar no fim:

```ts
describe("passos no ChainOfThought", () => {
  const atividade = (nome: string): EventoConversa => ({ tipo: "atividade", nome, detalhe: "x", em })

  it.each([
    ["Read", "ler"],
    ["Write", "escrever"],
    ["Edit", "escrever"],
    ["MultiEdit", "escrever"],
    ["Bash", "script"],
    ["Glob", "busca"],
    ["Grep", "busca"],
    ["WebSearch", "web"],
    ["WebFetch", "web"],
    ["mcp__firecrawl__firecrawl_scrape", "web"],
    ["Skill", "skill"],
    ["Agent", "subagente"],
    ["Task", "subagente"],
    ["mcp__claude_ai_Canva__export-design", "outro"],
  ])("%s usa o ícone %s", (nome, icone) => {
    expect(iconeDoPasso(atividade(nome) as Extract<EventoConversa, { tipo: "atividade" }>)).toBe(icone)
  })

  it("fala intermediária usa o ícone de fala", () => {
    expect(iconeDoPasso({ tipo: "texto_agente", texto: "vou ler", em })).toBe("fala")
  })

  it("ao vivo, só o último passo está ativo; encerrado, todos concluídos", () => {
    expect(statusDosPassos(3, true)).toEqual(["complete", "complete", "active"])
    expect(statusDosPassos(3, false)).toEqual(["complete", "complete", "complete"])
    expect(statusDosPassos(0, true)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/passos.test.ts`
Expected: FAIL (`iconeDoPasso` não exportado).

- [ ] **Step 3: Funções puras**

No fim de `src/apps/web/lib/passos.ts`:

```ts
export type IconePasso = "ler" | "escrever" | "script" | "busca" | "web" | "skill" | "subagente" | "fala" | "outro"

/** Ícone do passo pelo nome da ferramenta (o mesmo `nome` que `descreverAtividade` grava). */
export function iconeDoPasso(e: EventoProcesso): IconePasso {
  if (e.tipo === "texto_agente") return "fala"
  const n = e.nome
  if (n === "Read") return "ler"
  if (n === "Write" || n === "Edit" || n === "MultiEdit") return "escrever"
  if (n === "Bash") return "script"
  if (n === "Glob" || n === "Grep") return "busca"
  if (n === "WebSearch" || n === "WebFetch" || n.startsWith("mcp__firecrawl")) return "web"
  if (n === "Skill") return "skill"
  if (n === "Agent" || n === "Task") return "subagente"
  return "outro"
}

/** Com o turno em andamento, o último passo é o que o agente está fazendo agora. */
export function statusDosPassos(quantidade: number, aoVivo: boolean): ("complete" | "active")[] {
  return Array.from({ length: quantidade }, (_, i) => (aoVivo && i === quantidade - 1 ? "active" : "complete"))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/apps/web && npx vitest run lib/passos.test.ts`
Expected: PASS.

- [ ] **Step 5: Componente `chain-of-thought.tsx` (adaptado do AI Elements para Base UI)**

Create `src/packages/ui/src/components/chain-of-thought.tsx`:

```tsx
"use client"

import * as React from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { BrainIcon, ChevronDownIcon, DotIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

type StatusPasso = "complete" | "active" | "pending"

function ChainOfThought({ className, ...props }: React.ComponentProps<typeof Collapsible.Root>) {
  return <Collapsible.Root data-slot="chain-of-thought" className={cn("w-full min-w-0", className)} {...props} />
}

function ChainOfThoughtHeader({
  className,
  children,
  icon: Icone = BrainIcon,
  ...props
}: React.ComponentProps<typeof Collapsible.Trigger> & { icon?: LucideIcon }) {
  return (
    <Collapsible.Trigger
      data-slot="chain-of-thought-header"
      className={cn(
        "group/cot flex w-full cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors select-none hover:text-foreground",
        className,
      )}
      {...props}
    >
      <Icone className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/cot:rotate-180" />
    </Collapsible.Trigger>
  )
}

function ChainOfThoughtContent({ className, ...props }: React.ComponentProps<typeof Collapsible.Panel>) {
  return <Collapsible.Panel data-slot="chain-of-thought-content" className={cn("mt-2 flex flex-col", className)} {...props} />
}

function ChainOfThoughtStep({
  className,
  icon: Icone = DotIcon,
  label,
  description,
  status = "complete",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  icon?: LucideIcon
  label: React.ReactNode
  description?: React.ReactNode
  status?: StatusPasso
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="chain-of-thought-step"
      data-status={status}
      className={cn(
        "group/passo flex gap-2 text-xs",
        status === "complete" && "text-muted-foreground",
        status === "active" && "text-foreground",
        status === "pending" && "text-muted-foreground/50",
        className,
      )}
      {...props}
    >
      <div className="relative flex flex-col items-center self-stretch">
        <Icone className={cn("mt-0.5 size-3.5 shrink-0", status === "active" && "animate-pulse")} />
        <div className="w-px flex-1 bg-border group-last/passo:hidden" />
      </div>
      <div className="min-w-0 flex-1 pb-2.5">
        <div className={cn("min-w-0", status === "active" && "shimmer")}>{label}</div>
        {description && <div className="mt-1 text-muted-foreground">{description}</div>}
        {children}
      </div>
    </div>
  )
}

export { ChainOfThought, ChainOfThoughtHeader, ChainOfThoughtContent, ChainOfThoughtStep, type StatusPasso }
```

Se o import `@base-ui/react/collapsible` não resolver, conferir o caminho em `node_modules/@base-ui/react/collapsible` (o pacote existe na raiz do workspace) e o nome do atributo de aberto no trigger (`data-panel-open`) na doc do Base UI.

- [ ] **Step 6: Usar no chat**

Em `src/apps/web/components/chat/chat-etapa.tsx`:

1. Imports: trocar `import { ChevronRightIcon, WrenchIcon } from "lucide-react"` por

```ts
import {
  BotIcon,
  FileTextIcon,
  GlobeIcon,
  MessageSquareTextIcon,
  PencilLineIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from "@workspace/ui/components/chain-of-thought"
```

e o import de `@/lib/passos` por `import { agruparProcesso, iconeDoPasso, separarProcessoAoVivo, statusDosPassos, type EventoProcesso, type IconePasso } from "@/lib/passos"`.

2. Substituir `ListaDeProcesso` por:

```tsx
const ICONES: Record<IconePasso, LucideIcon> = {
  ler: FileTextIcon,
  escrever: PencilLineIcon,
  script: TerminalIcon,
  busca: SearchIcon,
  web: GlobeIcon,
  skill: SparklesIcon,
  subagente: BotIcon,
  fala: MessageSquareTextIcon,
  outro: WrenchIcon,
}

/** Processo de um trecho do turno (passos + falas intermediárias). Ao vivo, abre expandido com o último passo ativo. */
function ListaDeProcesso({ itens, slug, resumo, aoVivo = false }: { itens: EventoProcesso[]; slug: string; resumo: string; aoVivo?: boolean }) {
  const status = statusDosPassos(itens.length, aoVivo)
  return (
    <ChainOfThought defaultOpen={aoVivo}>
      <ChainOfThoughtHeader icon={WrenchIcon}>{resumo}</ChainOfThoughtHeader>
      <ChainOfThoughtContent className="pl-0.5">
        {itens.map((e, i) => (
          <ChainOfThoughtStep
            key={`${e.em}-${i}`}
            icon={ICONES[iconeDoPasso(e)]}
            status={status[i]}
            label={
              e.tipo === "atividade" ? (
                <span className="block truncate" title={e.detalhe}>
                  {linhaDoProcesso(e, slug)}
                </span>
              ) : (
                <div className="text-foreground/80 text-sm">
                  <Markdown>{e.texto}</Markdown>
                </div>
              )
            }
          />
        ))}
      </ChainOfThoughtContent>
    </ChainOfThought>
  )
}
```

3. Remover `const atual = aoVivo.at(-1)` e substituir o bloco `{ativoAqui && (...)}` por:

```tsx
              {ativoAqui && (
                <MessageScrollerItem messageId="ao-vivo">
                  <Message align="start">
                    <MessageContent>
                      {(delta || aoVivo.length === 0) && (
                        <Bubble variant="muted">
                          <BubbleContent>
                            {delta ? <Markdown>{delta}</Markdown> : <span className="shimmer block truncate">Pensando…</span>}
                          </BubbleContent>
                        </Bubble>
                      )}
                      {aoVivo.length > 0 && <ListaDeProcesso itens={aoVivo} slug={slug} resumo={resumoDoProcesso(aoVivo)} aoVivo />}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
```

O bloco ao vivo e o bloco encerrado são instâncias diferentes (chaves diferentes), então ao fim do turno o processo volta à lista recolhido.

- [ ] **Step 7: Verificar**

Run: `cd src && npm run typecheck && npm run lint && cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Checagem manual**

Rodar uma etapa real (sem `PLANEJAMENTO_EXECUTOR=demo`) por alguns passos: o processo aparece aberto, com ícones por ferramenta, linha vertical entre passos e o último com shimmer; quando o turno termina, vira "Processo · N passos" recolhido, e clicar expande com todos concluídos. Conferir em tema claro e escuro.

- [ ] **Step 9: Commit**

```bash
git add src/apps/web/lib/passos.ts src/apps/web/lib/passos.test.ts src/packages/ui/src/components/chain-of-thought.tsx src/apps/web/components/chat/chat-etapa.tsx
git commit -m "feat(web): processo do agente como ChainOfThought"
```

---

### Task 8: Ações Copiar e Responder a este trecho

**Files:**
- Create: `src/apps/web/lib/citacao.ts`
- Test: `src/apps/web/lib/citacao.test.ts`
- Create: `src/apps/web/components/chat/resposta-agente.tsx`
- Modify: `src/apps/web/components/trabalho/contexto-visualizador.tsx`, `src/apps/web/components/trabalho/area-de-trabalho.tsx`
- Modify: `src/apps/web/components/chat/compositor.tsx` (inserção no cursor)
- Modify: `src/apps/web/components/chat/item-conversa.tsx`, `src/apps/web/components/chat/chat-etapa.tsx`

**Interfaces:**
- Produces (em `@/lib/citacao`):
  - `citacao(trecho: string): string` → linhas com `> ` + `"\n\n"` no fim
  - `primeiroParagrafo(markdown: string): string`
  - `separadorAntes(antes: string, trecho: string): string`
- Produces: `ControleVisualizador.inserirNoCompositor(texto: string): void`; `ItemConversa` ganha prop opcional `ultima?: boolean`; `RespostaAgente({ texto, ultima }: { texto: string; ultima: boolean })`.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/apps/web/lib/citacao.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { citacao, primeiroParagrafo, separadorAntes } from "./citacao"

describe("citação de resposta do agente", () => {
  it("cita cada linha e deixa uma linha em branco para a resposta", () => {
    expect(citacao("  ROAS caiu 12%.\nCPA subiu.\n\nVer abril.  ")).toBe("> ROAS caiu 12%.\n> CPA subiu.\n>\n> Ver abril.\n\n")
  })

  it("primeiro parágrafo do markdown", () => {
    expect(primeiroParagrafo("\n\nPrimeiro\ncontinua.\n\nSegundo")).toBe("Primeiro\ncontinua.")
    expect(primeiroParagrafo("único")).toBe("único")
  })

  it("separador: citação começa em linha própria; menção só precisa de espaço", () => {
    expect(separadorAntes("", "> a\n\n")).toBe("")
    expect(separadorAntes("texto", "> a\n\n")).toBe("\n\n")
    expect(separadorAntes("texto\n", "> a\n\n")).toBe("\n")
    expect(separadorAntes("texto\n\n", "> a\n\n")).toBe("")
    expect(separadorAntes("texto", "@a.png ")).toBe(" ")
    expect(separadorAntes("texto ", "@a.png ")).toBe("")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/citacao.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `citacao.ts`**

Create `src/apps/web/lib/citacao.ts`:

```ts
// "Responder a este trecho": a resposta do agente entra no campo de mensagem como citação markdown.

export function citacao(trecho: string): string {
  const linhas = trecho.trim().split("\n")
  return `${linhas.map((l) => (l.trim() ? `> ${l.trim()}` : ">")).join("\n")}\n\n`
}

export function primeiroParagrafo(markdown: string): string {
  return markdown.trim().split(/\n\s*\n/)[0] ?? ""
}

/** O que vai entre o texto já digitado e o trecho inserido no cursor. */
export function separadorAntes(antes: string, trecho: string): string {
  if (!antes) return ""
  if (trecho.startsWith(">")) return antes.endsWith("\n\n") ? "" : antes.endsWith("\n") ? "\n" : "\n\n"
  return /\s$/.test(antes) ? "" : " "
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/apps/web && npx vitest run lib/citacao.test.ts`
Expected: PASS.

- [ ] **Step 5: Contexto e compositor**

`src/apps/web/components/trabalho/contexto-visualizador.tsx`: em `ControleVisualizador`, depois de `mencionar`:

```ts
  /** Insere um texto qualquer (ex.: citação) no campo de mensagem, na posição do cursor. */
  inserirNoCompositor: (texto: string) => void
```

e no valor padrão do `createContext`: `inserirNoCompositor: () => {},`.

`src/apps/web/components/trabalho/area-de-trabalho.tsx`: depois de `mencionar`:

```ts
  const inserirTexto = useCallback((texto: string) => inserirNoCompositor.current?.(texto), [])
```

e no `useMemo` do `controle`: `() => ({ abrir, abrirArquivo, mencionar, inserirNoCompositor: inserirTexto, registrarCompositor })`, com `inserirTexto` na lista de dependências.

`src/apps/web/components/chat/compositor.tsx`: importar `import { separadorAntes } from "@/lib/citacao"` e, no `registrarCompositor`, trocar

```ts
        const separador = antes && !/\s$/.test(antes) ? " " : ""
```

por

```ts
        const separador = separadorAntes(antes, trecho)
```

- [ ] **Step 6: `RespostaAgente`**

Create `src/apps/web/components/chat/resposta-agente.tsx`:

```tsx
"use client"

import { CheckIcon, CopyIcon, QuoteIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Message, MessageContent, MessageFooter } from "@workspace/ui/components/message"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { citacao, primeiroParagrafo } from "@/lib/citacao"

/** Resposta do agente com Copiar e Responder a este trecho (aparecem no hover; sempre na última). */
export function RespostaAgente({ texto, ultima }: { texto: string; ultima: boolean }) {
  const { inserirNoCompositor } = useVisualizador()
  const corpo = useRef<HTMLDivElement>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 2000)
    return () => clearTimeout(t)
  }, [copiado])

  function copiar() {
    navigator.clipboard.writeText(texto).then(
      () => setCopiado(true),
      () => toast.error("Não consegui copiar."),
    )
  }

  function citar() {
    const sel = window.getSelection()
    const el = corpo.current
    const dentro = sel && !sel.isCollapsed && el && el.contains(sel.anchorNode) && el.contains(sel.focusNode)
    const trecho = dentro ? sel.toString() : primeiroParagrafo(texto)
    if (trecho.trim()) inserirNoCompositor(citacao(trecho))
  }

  return (
    <Message align="start">
      <MessageContent>
        <div ref={corpo}>
          <Bubble variant="muted">
            <BubbleContent>
              <Markdown>{texto}</Markdown>
            </BubbleContent>
          </Bubble>
        </div>
        <MessageFooter
          className={cn(
            "gap-0.5 px-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100",
            ultima && "opacity-100",
          )}
        >
          <Button variant="ghost" size="icon-xs" title="Copiar" aria-label="Copiar resposta" onClick={copiar}>
            {copiado ? <CheckIcon /> : <CopyIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Responder a este trecho (cita o texto selecionado ou o primeiro parágrafo)"
            aria-label="Responder a este trecho"
            onMouseDown={(e) => e.preventDefault()}
            onClick={citar}
          >
            <QuoteIcon />
          </Button>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}
```

(`onMouseDown` com `preventDefault` evita que o clique desfaça a seleção antes de `citar` ler.)

- [ ] **Step 7: Ligar no chat**

`src/apps/web/components/chat/item-conversa.tsx`:
1. `import { RespostaAgente } from "./resposta-agente"`.
2. Acrescentar `ultima = false` aos parâmetros desestruturados e `ultima?: boolean` ao tipo das props.
3. Substituir o `case "texto_agente"` por:

```tsx
    case "texto_agente":
      return <RespostaAgente texto={evento.texto} ultima={ultima} />
```

4. Remover imports que ficarem sem uso.

`src/apps/web/components/chat/chat-etapa.tsx`: depois de `const { itens, aoVivo } = ...`, calcular

```ts
  const indiceUltimaResposta = itens.reduce(
    (ultimo, i, posicao) => (i.tipo === "evento" && i.evento.tipo === "texto_agente" ? posicao : ultimo),
    -1,
  )
```

e trocar o `itens.map((item) => ...)` por `itens.map((item, posicao) => ...)`, passando `ultima={posicao === indiceUltimaResposta}` para `<ItemConversa ... />`.

- [ ] **Step 8: Verificar**

Run: `cd src && npm run typecheck && npm run lint && cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 9: Checagem manual**

Com o demo: na última resposta os dois ícones aparecem sempre; nas anteriores, só no hover. Copiar cola o markdown original e o ícone vira ✓ por 2 s. Selecionar uma frase dentro de uma resposta e clicar em citar insere `> frase` + linha em branco no campo; sem seleção, cita o 1º parágrafo; com texto já digitado, a citação começa em linha nova; o "Mencionar no chat" dos cards continua inserindo `@arquivo ` com espaço.

- [ ] **Step 10: Commit**

```bash
git add src/apps/web/lib/citacao.ts src/apps/web/lib/citacao.test.ts src/apps/web/components/chat/resposta-agente.tsx src/apps/web/components/trabalho/contexto-visualizador.tsx src/apps/web/components/trabalho/area-de-trabalho.tsx src/apps/web/components/chat/compositor.tsx src/apps/web/components/chat/item-conversa.tsx src/apps/web/components/chat/chat-etapa.tsx
git commit -m "feat(web): copiar e citar respostas do agente"
```

---

### Task 9: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Suite completa**

Run: `cd src && npm run typecheck && npm run lint && npm test`
Expected: tudo PASS (inclui `sem-travessao`).

- [ ] **Step 2: Checagem manual integrada (critério de sucesso da spec)**

Numa etapa real de um prospect de teste: acompanhar o processo ao vivo com o passo atual destacado; anexar por botão, arrastar e colar; copiar e citar uma resposta; pedir ao agente algo que leve a uma decisão entre alternativas (ex.: na Skill 05, "me pergunte qual cenário usar e quais canais priorizar") e conferir que ele usa `fazer_perguntas`; responder com uma opção e uma "Outra" e ver o agente seguir a partir das respostas.

- [ ] **Step 3: Commit de ajustes (se houver)**

```bash
git add -A src .claude/skills/_shared/regras-de-validacao.md
git commit -m "fix(chat): ajustes da verificação final"
```
