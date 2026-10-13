# Modo dev de comentários — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ferramenta só de desenvolvimento em `src/apps/web` para apontar blocos da tela, salvar comentários com contexto (componente, seletor, texto, recorte) e deixar o Claude Code executá-los e limpá-los pelo terminal.

**Architecture:** um núcleo puro (`lib/modo-dev/nucleo.ts`) com tipos, validação e as funções de DOM/fiber; um armazenamento em arquivo (`lib/modo-dev/armazenamento.ts`) com a pasta injetada; rotas `/api/dev/comentarios` que respondem 404 fora do `next dev`; um componente client único carregado pelo layout só em desenvolvimento; um script Node puro para listar e limpar; e uma skill com o roteiro do agente.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript 5, Tailwind 4, vitest 5, jsdom 30 (só testes), modern-screenshot 4.7 (recorte), Node 26 (type stripping no script), npm workspaces em `src/`.

**Spec:** `docs/superpowers/specs/2026-10-13-modo-dev-comentarios-design.md`

## Global Constraints

- Todos os comandos `npm` rodam em `src/` (raiz do workspace), salvo indicação.
- Dev × produção: `process.env.NODE_ENV === "development"`. Nada além disso.
- Pasta de dados: `<raiz-do-repositório>/.dev-comentarios/` com `comentarios.json` e `capturas/<id>.png`; raiz = `process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")` nas rotas e `process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")` no script.
- Nomes: código em `lib/modo-dev/` e `components/modo-dev/`; rota `/api/dev/comentarios`; skill `dev-comentarios`. Não usar "comentarios" solto em nomes que colidam com `ServicoComentarios`.
- Arquivos de `lib/modo-dev/` e `scripts/dev-comentarios.ts`: imports entre si com extensão `.ts` explícita; nada de `@/` ou `@workspace/*`; imports só de tipo marcados com `type`; sem `enum`, `namespace` ou parameter properties (o Node apaga tipos, não transforma sintaxe).
- Limites: comentário 1 a 2000 caracteres (após trim); texto visível até 300; cadeia até 8 nomes; seletor até 8 níveis; PNG até 5 MB decodificado; recorte com no máximo 1600 px no maior lado.
- Textos de interface e identificadores em português, como no resto do app.
- Commits no padrão do repositório (`feat(web): …`, `docs: …`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Ids gerados pelo React/Radix/Base UI** (`_r_1_`, `radix-_r_2_`, `base-ui-…`) mudam entre carregamentos: o seletor nunca pode ancorar neles. Teste na Task 3.
2. **Componentes do app com nome que começa como um genérico** (`CardEntregavel`, `CardProspect`, `DialogoNovoProspect`) precisam aparecer na cadeia; só os nomes exatos de `packages/ui` são ignorados. Teste na Task 2.
3. **Dois salvamentos quase simultâneos** (Ctrl+Enter duplo, duas abas) não podem perder comentário nem repetir número. Teste de concorrência na Task 5, mais a trava `salvando` na interface (Task 8).
4. **PNG vindo como data URL ou maior que 5 MB** depois de decodificado: aceitar o prefixo `data:image/png;base64,`, recusar acima de 5 MB e o que não for PNG. Testes na Task 5.
5. **Loop de re-renderização:** o `MutationObserver` dos pinos não pode reagir às mudanças da própria camada do modo dev, senão re-renderiza a cada quadro. Checagem manual na Task 8 (CPU parada com o modo ligado e o mouse imóvel).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/apps/web/lib/modo-dev/nucleo.ts` | Tipos, erros, validação, `cadeiaDeComponentes`, `seletorDoElemento`, `textoVisivel`, `resumoEmTexto`, `interpretarArgumentos` |
| `src/apps/web/lib/modo-dev/nucleo-validacao.test.ts` | Testes de validação |
| `src/apps/web/lib/modo-dev/nucleo-cadeia.test.ts` | Testes da cadeia de componentes |
| `src/apps/web/lib/modo-dev/nucleo-seletor.test.ts` | Testes de seletor e texto visível (jsdom) |
| `src/apps/web/lib/modo-dev/nucleo-resumo.test.ts` | Testes de resumo e argumentos do script |
| `src/apps/web/lib/modo-dev/armazenamento.ts` | Leitura/gravação atômica, numeração, recortes, `decodificarPng` |
| `src/apps/web/lib/modo-dev/armazenamento.test.ts` | Testes em pasta temporária |
| `src/apps/web/lib/modo-dev/rota.ts` | Instância única do armazenamento + bloqueio fora de dev |
| `src/apps/web/app/api/dev/comentarios/route.ts` | GET, POST |
| `src/apps/web/app/api/dev/comentarios/[id]/route.ts` | PATCH, DELETE |
| `src/apps/web/app/api/dev/comentarios/route.test.ts` | Testes das rotas |
| `src/apps/web/scripts/dev-comentarios.ts` | Script de terminal |
| `src/apps/web/scripts/dev-comentarios.test.ts` | Teste do script rodando no Node puro |
| `src/apps/web/components/modo-dev/carregador.tsx` | `dynamic(..., { ssr: false })` |
| `src/apps/web/components/modo-dev/modo-dev.tsx` | Botão, atalhos, overlay, caixa, pinos, lista |
| `src/apps/web/app/layout.tsx` | Renderiza o carregador só em dev |
| `src/apps/web/vitest.config.ts` | Alias `@/` para os testes de rota |
| `src/apps/web/tsconfig.json` | `allowImportingTsExtensions` |
| `src/apps/web/package.json`, `src/package.json` | Dependências e script `dev:comentarios` |
| `.gitignore`, `CLAUDE.md` | Pasta de dados; aviso sobre a skill |
| `.claude/skills/dev-comentarios/SKILL.md` | Roteiro do agente |

---

### Task 1: Base do núcleo e validação da entrada

**Files:**
- Create: `src/apps/web/lib/modo-dev/nucleo.ts`
- Create: `src/apps/web/lib/modo-dev/nucleo-validacao.test.ts`
- Create: `src/apps/web/vitest.config.ts`
- Modify: `src/apps/web/tsconfig.json` (`compilerOptions`)
- Modify: `src/apps/web/package.json` (devDependencies, via npm)

**Interfaces:**
- Produces (em `nucleo.ts`): constantes `LIMITE_COMENTARIO = 2000`, `LIMITE_TEXTO = 300`, `LIMITE_CADEIA = 8`, `LIMITE_PNG_BYTES = 5 * 1024 * 1024`; tipos `Caixa`, `NovoComentario`, `ComentarioDev`, `ArquivoComentarios`; classes `ErroValidacaoDev` (`codigo: "entrada_invalida"`, `status: 400`) e `ErroComentarioNaoEncontrado` (`codigo: "nao_encontrado"`, `status: 404`); `validarNovo(entrada: unknown): NovoComentario`; `validarEdicao(entrada: unknown): string`.

- [ ] **Step 1: Instalar dependências de desenvolvimento**

Run (em `src/`): `npm install -D -w web modern-screenshot@^4.7.0 jsdom@^30.1.2 vitest@^5.0.2`
Expected: `src/apps/web/package.json` ganha as três em `devDependencies`; `package-lock.json` atualizado.

> `modern-screenshot` é importado só por import dinâmico dentro do modo dev; ficar em devDependencies não afeta o build, porque o Next empacota o que é importado, não o que está em `dependencies`.

- [ ] **Step 2: Permitir imports com `.ts` e criar a config do vitest**

Em `src/apps/web/tsconfig.json`, dentro de `compilerOptions`, antes de `"paths"`:

```json
    "allowImportingTsExtensions": true,
```

Criar `src/apps/web/vitest.config.ts`:

```ts
import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Mesmo atalho "@/" do tsconfig, para testar rotas que importam lib/http.
  resolve: { alias: [{ find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` }] },
  test: { exclude: ["node_modules/**", ".next/**"] },
})
```

Run: `npm test -w web`
Expected: PASS em todos os testes já existentes em `lib/*.test.ts` (a config nova não pode quebrar nenhum).

- [ ] **Step 3: Escrever o teste de validação (falhando)**

Criar `src/apps/web/lib/modo-dev/nucleo-validacao.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ErroValidacaoDev, validarEdicao, validarNovo } from "./nucleo.ts"

const valido = {
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa", "AreaDeTrabalho"],
  seletor: "#trilha > div:nth-of-type(2)",
  tag: "div",
  texto: "Diagnóstico",
  caixa: { x: 10, y: 20, largura: 300, altura: 40, larguraTela: 1440, alturaTela: 900 },
  comentario: "  Aumentar o espaço.  ",
}

function erroDe(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error("esperava um erro")
}

describe("validarNovo", () => {
  it("aceita um comentário válido e apara o texto do comentário", () => {
    expect(validarNovo(valido)).toEqual({ ...valido, comentario: "Aumentar o espaço." })
  })

  it("descarta campos extras, como o png", () => {
    expect(validarNovo({ ...valido, png: "abc", outro: 1 })).toEqual({ ...valido, comentario: "Aumentar o espaço." })
  })

  it("aceita componente null e cadeia vazia", () => {
    expect(validarNovo({ ...valido, componente: null, cadeia: [] })).toMatchObject({ componente: null, cadeia: [] })
  })

  it("recusa comentário vazio ou só com espaços", () => {
    expect(() => validarNovo({ ...valido, comentario: "   " })).toThrow("O comentário está vazio.")
  })

  it("aceita exatamente 2000 caracteres e recusa 2001", () => {
    expect(validarNovo({ ...valido, comentario: "a".repeat(2000) }).comentario).toHaveLength(2000)
    expect(() => validarNovo({ ...valido, comentario: "a".repeat(2001) })).toThrow(/2000 caracteres/)
  })

  it("recusa campos fora do formato", () => {
    const ruins = [
      { pagina: "prospects" },
      { pagina: 3 },
      { componente: 3 },
      { cadeia: "PainelEtapa" },
      { cadeia: [1] },
      { cadeia: Array(9).fill("A") },
      { seletor: "" },
      { tag: "" },
      { texto: "a".repeat(301) },
      { caixa: { x: 1 } },
      { caixa: { ...valido.caixa, y: Number.NaN } },
      { comentario: 5 },
    ]
    for (const ruim of ruins) {
      expect(() => validarNovo({ ...valido, ...ruim }), JSON.stringify(ruim)).toThrow(ErroValidacaoDev)
    }
  })

  it("recusa corpo que não é objeto", () => {
    for (const corpo of [null, "x", [], 3]) expect(() => validarNovo(corpo)).toThrow(ErroValidacaoDev)
  })

  it("o erro tem a forma de erro de domínio (400), que lib/http.ts converte sozinho", () => {
    expect(erroDe(() => validarNovo(null))).toMatchObject({ codigo: "entrada_invalida", status: 400 })
  })
})

describe("validarEdicao", () => {
  it("devolve o comentário aparado", () => {
    expect(validarEdicao({ comentario: " Novo texto " })).toBe("Novo texto")
  })

  it("recusa vazio, longo demais e corpo inválido", () => {
    expect(() => validarEdicao({ comentario: "" })).toThrow(ErroValidacaoDev)
    expect(() => validarEdicao({ comentario: "a".repeat(2001) })).toThrow(ErroValidacaoDev)
    expect(() => validarEdicao(null)).toThrow(ErroValidacaoDev)
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -w web -- lib/modo-dev/nucleo-validacao`
Expected: FAIL — não encontra `./nucleo.ts`.

- [ ] **Step 5: Implementar o começo de `nucleo.ts`**

Criar `src/apps/web/lib/modo-dev/nucleo.ts`:

```ts
// Núcleo do modo dev de comentários: tipos, validação e funções puras.
// Roda no navegador, no next dev e no Node puro (script de terminal): só imports relativos com .ts,
// nada de @/ ou @workspace/*, e nenhuma sintaxe TypeScript que o Node não saiba apagar.

export const LIMITE_COMENTARIO = 2000
export const LIMITE_TEXTO = 300
export const LIMITE_CADEIA = 8
export const LIMITE_PNG_BYTES = 5 * 1024 * 1024

export interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
  larguraTela: number
  alturaTela: number
}

/** O que a interface envia ao criar; o servidor completa id, número, datas e captura. */
export interface NovoComentario {
  pagina: string
  componente: string | null
  cadeia: string[]
  seletor: string
  tag: string
  texto: string
  caixa: Caixa
  comentario: string
}

export interface ComentarioDev extends NovoComentario {
  id: string
  numero: number
  criadoEm: string
  editadoEm: string | null
  captura: string | null
}

export interface ArquivoComentarios {
  versao: 1
  proximoNumero: number
  comentarios: ComentarioDev[]
}

/** Mesma forma de ErroDominio (codigo + status): respostaDeErro de lib/http.ts responde 400 sozinho. */
export class ErroValidacaoDev extends Error {
  readonly codigo = "entrada_invalida"
  readonly status = 400
}

export class ErroComentarioNaoEncontrado extends Error {
  readonly codigo = "nao_encontrado"
  readonly status = 404
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function lerComentario(valor: unknown): string {
  if (typeof valor !== "string") throw new ErroValidacaoDev("O comentário precisa ser um texto.")
  const comentario = valor.trim()
  if (!comentario) throw new ErroValidacaoDev("O comentário está vazio.")
  if (comentario.length > LIMITE_COMENTARIO) {
    throw new ErroValidacaoDev(`O comentário passa de ${LIMITE_COMENTARIO} caracteres (${comentario.length}).`)
  }
  return comentario
}

const CAMPOS_CAIXA = ["x", "y", "largura", "altura", "larguraTela", "alturaTela"] as const

function lerCaixa(valor: unknown): Caixa {
  if (!ehObjeto(valor) || !CAMPOS_CAIXA.every((campo) => typeof valor[campo] === "number" && Number.isFinite(valor[campo]))) {
    throw new ErroValidacaoDev("Campo caixa deve ter x, y, largura, altura, larguraTela e alturaTela numéricos.")
  }
  return {
    x: valor.x as number,
    y: valor.y as number,
    largura: valor.largura as number,
    altura: valor.altura as number,
    larguraTela: valor.larguraTela as number,
    alturaTela: valor.alturaTela as number,
  }
}

export function validarNovo(entrada: unknown): NovoComentario {
  if (!ehObjeto(entrada)) throw new ErroValidacaoDev("Corpo da requisição inválido.")
  const { pagina, componente, cadeia, seletor, tag, texto } = entrada
  if (typeof pagina !== "string" || !pagina.startsWith("/")) {
    throw new ErroValidacaoDev("Campo pagina deve ser um caminho começando com /.")
  }
  if (componente !== null && typeof componente !== "string") {
    throw new ErroValidacaoDev("Campo componente deve ser texto ou null.")
  }
  if (!Array.isArray(cadeia) || cadeia.length > LIMITE_CADEIA || !cadeia.every((nome) => typeof nome === "string")) {
    throw new ErroValidacaoDev(`Campo cadeia deve ser uma lista de até ${LIMITE_CADEIA} nomes.`)
  }
  if (typeof seletor !== "string" || !seletor.trim()) throw new ErroValidacaoDev("Campo seletor é obrigatório.")
  if (typeof tag !== "string" || !tag) throw new ErroValidacaoDev("Campo tag é obrigatório.")
  if (typeof texto !== "string" || texto.length > LIMITE_TEXTO) {
    throw new ErroValidacaoDev(`Campo texto deve ser um texto de até ${LIMITE_TEXTO} caracteres.`)
  }
  return {
    pagina,
    componente: componente as string | null,
    cadeia: cadeia as string[],
    seletor,
    tag,
    texto,
    caixa: lerCaixa(entrada.caixa),
    comentario: lerComentario(entrada.comentario),
  }
}

export function validarEdicao(entrada: unknown): string {
  if (!ehObjeto(entrada)) throw new ErroValidacaoDev("Corpo da requisição inválido.")
  return lerComentario(entrada.comentario)
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -w web -- lib/modo-dev/nucleo-validacao`
Expected: PASS (10 testes).

- [ ] **Step 7: Typecheck e commit**

Run: `npm run typecheck -w web`
Expected: sem erros.

```bash
git add src/apps/web/lib/modo-dev src/apps/web/vitest.config.ts src/apps/web/tsconfig.json src/apps/web/package.json src/package-lock.json
git commit -m "feat(web): núcleo do modo dev com validação da entrada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cadeia de componentes a partir do fiber

**Files:**
- Modify: `src/apps/web/lib/modo-dev/nucleo.ts` (acrescentar ao fim)
- Create: `src/apps/web/lib/modo-dev/nucleo-cadeia.test.ts`

**Interfaces:**
- Consumes: `LIMITE_CADEIA` (Task 1).
- Produces: `cadeiaDeComponentes(no: object): string[]`; `nomeIgnorado(nome: string): boolean`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/lib/modo-dev/nucleo-cadeia.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { cadeiaDeComponentes, nomeIgnorado } from "./nucleo.ts"

function componente(nome: string): () => null {
  const fn = () => null
  Object.defineProperty(fn, "name", { value: nome })
  return fn
}

/** Monta um nó DOM falso com fibers encadeados; `tipos` vai do mais interno (o host) para fora. */
function noComFiber(tipos: unknown[]): object {
  let fiber: { type: unknown; return: unknown } | null = null
  for (const tipo of [...tipos].reverse()) fiber = { type: tipo, return: fiber }
  return { __reactFiber$teste: fiber }
}

describe("cadeiaDeComponentes", () => {
  it("sobe do nó até a raiz, do mais interno para fora, pulando elementos host", () => {
    const no = noComFiber(["div", componente("CardEntregavel"), "section", componente("PainelEtapa"), componente("AreaDeTrabalho")])
    expect(cadeiaDeComponentes(no)).toEqual(["CardEntregavel", "PainelEtapa", "AreaDeTrabalho"])
  })

  it("ignora internos do Next/React, primitivos e genéricos de packages/ui", () => {
    const no = noComFiber([
      "button",
      componente("Button"),
      componente("Slot"),
      componente("Primitive.button"),
      componente("CardProspect"),
      componente("ThemeProvider"),
      componente("ErrorBoundary"),
      componente("_Anonimo"),
      componente("InnerLayoutRouter"),
      componente("GradeProspects"),
    ])
    expect(cadeiaDeComponentes(no)).toEqual(["CardProspect", "GradeProspects"])
  })

  it("não ignora componentes do app que começam com nome genérico", () => {
    for (const nome of ["CardEntregavel", "CardProspect", "DialogoNovoProspect", "IconeStatus"]) {
      expect(nomeIgnorado(nome), nome).toBe(false)
    }
  })

  it("usa displayName e desembrulha memo e forwardRef", () => {
    const comDisplay = Object.assign(componente("x"), { displayName: "Chamado" })
    const memo = { $$typeof: Symbol.for("react.memo"), type: componente("ListaMemo") }
    const comRef = { $$typeof: Symbol.for("react.forward_ref"), render: componente("CampoRef") }
    expect(cadeiaDeComponentes(noComFiber(["div", comDisplay, memo, comRef]))).toEqual(["Chamado", "ListaMemo", "CampoRef"])
  })

  it("contexto e funções anônimas não viram nome", () => {
    const contexto = { $$typeof: Symbol.for("react.context"), _currentValue: null }
    expect(cadeiaDeComponentes(noComFiber(["span", contexto, () => null, componente("Painel")]))).toEqual(["Painel"])
  })

  it("não repete nomes consecutivos", () => {
    expect(cadeiaDeComponentes(noComFiber(["div", componente("A"), componente("A"), componente("B")]))).toEqual(["A", "B"])
  })

  it("para em 8 nomes", () => {
    const tipos = ["div", ...Array.from({ length: 12 }, (_, i) => componente(`Comp${i}`))]
    expect(cadeiaDeComponentes(noComFiber(tipos))).toEqual(["Comp0", "Comp1", "Comp2", "Comp3", "Comp4", "Comp5", "Comp6", "Comp7"])
  })

  it("procura o fiber no ancestral quando o nó não tem", () => {
    const pai = noComFiber(["div", componente("Painel")])
    expect(cadeiaDeComponentes({ parentElement: pai })).toEqual(["Painel"])
  })

  it("nó sem fiber dá lista vazia", () => {
    expect(cadeiaDeComponentes({})).toEqual([])
  })

  it("todo componente de packages/ui está na lista de ignorados", () => {
    const pasta = path.resolve(import.meta.dirname, "../../../../packages/ui/src/components")
    const nomes = new Set<string>()
    for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith(".tsx"))) {
      const fonte = readFileSync(path.join(pasta, arquivo), "utf-8")
      for (const m of fonte.matchAll(/^(?:export )?(?:function|const) ([A-Z][A-Za-z]+)/gm)) nomes.add(m[1]!)
    }
    expect(nomes.size).toBeGreaterThan(20)
    for (const nome of nomes) expect(nomeIgnorado(nome), nome).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/modo-dev/nucleo-cadeia`
Expected: FAIL — `cadeiaDeComponentes` não exportado.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/apps/web/lib/modo-dev/nucleo.ts`:

```ts
// --- Cadeia de componentes (fiber do React, só existe com nomes legíveis em desenvolvimento) ---

/** Componentes genéricos de packages/ui: o ajuste quase sempre é no componente do app que os usa. */
const GENERICOS_UI = new Set([
  "Alert", "AlertAction", "AlertDescription", "AlertTitle",
  "AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription",
  "AlertDialogFooter", "AlertDialogHeader", "AlertDialogMedia", "AlertDialogOverlay", "AlertDialogPortal",
  "AlertDialogTitle", "AlertDialogTrigger",
  "Attachment", "AttachmentAction", "AttachmentActions", "AttachmentContent", "AttachmentDescription",
  "AttachmentGroup", "AttachmentMedia", "AttachmentTitle", "AttachmentTrigger",
  "Badge",
  "Bubble", "BubbleContent", "BubbleGroup", "BubbleReactions",
  "Button",
  "Card", "CardAction", "CardContent", "CardDescription", "CardFooter", "CardHeader", "CardTitle",
  "ChainOfThought", "ChainOfThoughtContent", "ChainOfThoughtHeader", "ChainOfThoughtStep",
  "Dialog", "DialogClose", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader",
  "DialogOverlay", "DialogPortal", "DialogTitle", "DialogTrigger",
  "DropdownMenu", "DropdownMenuCheckboxItem", "DropdownMenuContent", "DropdownMenuGroup", "DropdownMenuItem",
  "DropdownMenuLabel", "DropdownMenuPortal", "DropdownMenuRadioGroup", "DropdownMenuRadioItem",
  "DropdownMenuSeparator", "DropdownMenuShortcut", "DropdownMenuSub", "DropdownMenuSubContent",
  "DropdownMenuSubTrigger", "DropdownMenuTrigger",
  "Empty", "EmptyContent", "EmptyDescription", "EmptyHeader", "EmptyMedia", "EmptyTitle",
  "Field", "FieldContent", "FieldDescription", "FieldError", "FieldGroup", "FieldLabel", "FieldLegend",
  "FieldSeparator", "FieldSet", "FieldTitle",
  "Input", "Label",
  "Marker", "MarkerContent", "MarkerIcon",
  "Message", "MessageAvatar", "MessageContent", "MessageFooter", "MessageGroup", "MessageHeader",
  "MessageScroller", "MessageScrollerButton", "MessageScrollerContent", "MessageScrollerItem",
  "MessageScrollerProvider", "MessageScrollerViewport",
  "Progress", "ProgressIndicator", "ProgressLabel", "ProgressTrack", "ProgressValue",
  "Question", "QuestionDescription", "QuestionInput", "QuestionOption", "QuestionOptions", "QuestionPrompt",
  "ResizableHandle", "ResizablePanel", "ResizablePanelGroup",
  "Separator", "Skeleton", "Spinner", "Textarea", "Toaster",
])

/** Internos do React/Next e primitivos de Radix/Base UI. Se aparecer outro no teste manual, acrescente aqui. */
const INTERNOS = new Set([
  "Suspense", "Fragment", "StrictMode", "Profiler", "Activity",
  "Root", "ServerRoot", "AppRouter", "HotReload", "Head", "HistoryUpdater", "RuntimeStyles",
  "InnerLayoutRouter", "OuterLayoutRouter", "RenderFromTemplateContext",
  "ScrollAndFocusHandler", "InnerScrollAndFocusHandler", "LoadingBoundary",
  "ClientPageRoot", "ClientSegmentRoot", "SegmentViewNode", "MetadataOutlet", "ViewportOutlet",
  "Slot", "Slottable", "Presence", "Portal", "FocusScope", "DismissableLayer",
])
const PREFIXOS_INTERNOS = ["_", "Primitive", "Radix"]
const SUFIXOS_INTERNOS = ["Boundary", "Provider", "Router", "Context", "Handler"]

export function nomeIgnorado(nome: string): boolean {
  return (
    GENERICOS_UI.has(nome) ||
    INTERNOS.has(nome) ||
    PREFIXOS_INTERNOS.some((prefixo) => nome.startsWith(prefixo)) ||
    SUFIXOS_INTERNOS.some((sufixo) => nome.endsWith(sufixo))
  )
}

interface FiberParcial {
  type?: unknown
  return?: FiberParcial | null
}

function nomeDoTipo(tipo: unknown): string | null {
  if (typeof tipo === "function") {
    const fn = tipo as { displayName?: unknown; name?: unknown }
    const nome = typeof fn.displayName === "string" && fn.displayName ? fn.displayName : fn.name
    return typeof nome === "string" && nome ? nome : null
  }
  if (typeof tipo === "object" && tipo !== null) {
    // memo guarda o componente em `type`; forwardRef, em `render`. Contexto e lazy não têm nenhum dos dois.
    const embrulho = tipo as { displayName?: unknown; render?: unknown; type?: unknown }
    if (typeof embrulho.displayName === "string" && embrulho.displayName) return embrulho.displayName
    return nomeDoTipo(embrulho.render) ?? nomeDoTipo(embrulho.type)
  }
  return null
}

function fiberDoNo(no: object): FiberParcial | undefined {
  for (let atual: object | null = no; atual; atual = (atual as { parentElement?: object | null }).parentElement ?? null) {
    const chave = Object.keys(atual).find((k) => k.startsWith("__reactFiber$"))
    if (chave) return (atual as Record<string, unknown>)[chave] as FiberParcial | undefined
  }
  return undefined
}

/** Nomes dos componentes do mais interno para o externo, até 8, sem internos e genéricos. */
export function cadeiaDeComponentes(no: object): string[] {
  const cadeia: string[] = []
  let fiber = fiberDoNo(no)
  for (let passos = 0; fiber && cadeia.length < LIMITE_CADEIA && passos < 1000; passos++) {
    const nome = nomeDoTipo(fiber.type)
    if (nome && !nomeIgnorado(nome) && cadeia.at(-1) !== nome) cadeia.push(nome)
    fiber = fiber.return ?? undefined
  }
  return cadeia
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/modo-dev/nucleo-cadeia`
Expected: PASS (10 testes). Se o último falhar, o nome que faltou aparece na mensagem: acrescente-o a `GENERICOS_UI`.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/modo-dev
git commit -m "feat(web): cadeia de componentes do modo dev pelo fiber do React

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seletor estável e texto visível

**Files:**
- Modify: `src/apps/web/lib/modo-dev/nucleo.ts` (acrescentar ao fim)
- Create: `src/apps/web/lib/modo-dev/nucleo-seletor.test.ts`

**Interfaces:**
- Consumes: `LIMITE_CADEIA`, `LIMITE_TEXTO` (Task 1).
- Produces: `seletorDoElemento(el: Element): string`; `textoVisivel(el: Element): string`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/lib/modo-dev/nucleo-seletor.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { seletorDoElemento, textoVisivel } from "./nucleo.ts"

beforeEach(() => {
  document.body.innerHTML = ""
})

function seletorQueReencontra(el: Element): string {
  const seletor = seletorDoElemento(el)
  expect(document.querySelector(seletor)).toBe(el)
  return seletor
}

describe("seletorDoElemento", () => {
  it("para no id estável mais próximo", () => {
    document.body.innerHTML = `<main><div id="trilha"><ul><li>a</li><li>b</li></ul></div></main>`
    expect(seletorQueReencontra(document.querySelectorAll("li")[1]!)).toBe("#trilha > ul:nth-of-type(1) > li:nth-of-type(2)")
  })

  it("não usa ids gerados pelo React, Radix ou Base UI", () => {
    document.body.innerHTML = `<section><div id="_r_1_"><p>x</p></div><div id="radix-_r_2_"><p>y</p></div><div id="base-ui-_r_3_"><p>z</p></div></section>`
    const ps = document.querySelectorAll("p")
    expect(seletorQueReencontra(ps[0]!)).toBe("body > section:nth-of-type(1) > div:nth-of-type(1) > p:nth-of-type(1)")
    expect(seletorQueReencontra(ps[1]!)).not.toContain("radix")
    expect(seletorQueReencontra(ps[2]!)).not.toContain("base-ui")
  })

  it("não usa id repetido no documento", () => {
    document.body.innerHTML = `<div id="x"><p>1</p></div><div id="x"><p>2</p></div>`
    expect(seletorQueReencontra(document.querySelectorAll("p")[1]!)).not.toContain("#x")
  })

  it("usa data-slot e aria-label quando não há id", () => {
    document.body.innerHTML = `<main><div data-slot="card"><button aria-label="Fechar painel">x</button></div></main>`
    expect(seletorQueReencontra(document.querySelector("button")!)).toBe(
      'body > main:nth-of-type(1) > div[data-slot="card"] > button[aria-label="Fechar painel"]',
    )
  })

  it("data-slot repetido entre irmãos ganha a posição", () => {
    document.body.innerHTML = `<main><div data-slot="card">a</div><div data-slot="card">b</div></main>`
    expect(seletorQueReencontra(document.querySelectorAll("div")[1]!)).toBe(
      'body > main:nth-of-type(1) > div[data-slot="card"]:nth-of-type(2)',
    )
  })

  it("escapa aspas e barras no valor do atributo", () => {
    document.body.innerHTML = `<main><button aria-label='Diz "oi" \\ tchau'>x</button></main>`
    seletorQueReencontra(document.querySelector("button")!)
  })

  it("sobe no máximo 8 níveis", () => {
    document.body.innerHTML = `${"<div>".repeat(12)}<span>fundo</span>${"</div>".repeat(12)}`
    const seletor = seletorQueReencontra(document.querySelector("span")!)
    expect(seletor.split(" > ")).toHaveLength(8)
    expect(seletor.startsWith("body")).toBe(false)
  })
})

describe("textoVisivel", () => {
  it("colapsa espaços e quebras de linha", () => {
    document.body.innerHTML = `<div>  Olá\n\n   mundo  </div>`
    expect(textoVisivel(document.querySelector("div")!)).toBe("Olá mundo")
  })

  it("corta em 300 caracteres", () => {
    document.body.innerHTML = `<div>${"a".repeat(400)}</div>`
    expect(textoVisivel(document.querySelector("div")!)).toHaveLength(300)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/modo-dev/nucleo-seletor`
Expected: FAIL — `seletorDoElemento` não exportado.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/apps/web/lib/modo-dev/nucleo.ts`:

```ts
// --- Seletor CSS estável e texto visível ---

const ID_SIMPLES = /^[A-Za-z][\w-]*$/
// useId do React (_r_1_, :r1:, «r1»), Radix e Base UI: mudam entre carregamentos.
const ID_GERADO = /^(_r_|:r|«r|radix-|base-ui-)/

function entreAspas(valor: string): string {
  return `"${valor.replace(/["\\]/g, "\\$&")}"`
}

function posicaoEntreIrmaos(el: Element): number {
  let posicao = 1
  for (let irmao = el.previousElementSibling; irmao; irmao = irmao.previousElementSibling) {
    if (irmao.tagName === el.tagName) posicao++
  }
  return posicao
}

function idEstavel(el: Element): string | null {
  const id = el.getAttribute("id")
  if (!id || !ID_SIMPLES.test(id) || ID_GERADO.test(id)) return null
  return el.ownerDocument.querySelectorAll(`#${id}`).length === 1 ? id : null
}

function parteDoNivel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  for (const atributo of ["data-slot", "aria-label"]) {
    const valor = el.getAttribute(atributo)
    if (!valor) continue
    const base = `${tag}[${atributo}=${entreAspas(valor)}]`
    const iguais = el.parentElement
      ? Array.from(el.parentElement.children).filter((i) => i.tagName === el.tagName && i.getAttribute(atributo) === valor)
      : [el]
    return iguais.length > 1 ? `${base}:nth-of-type(${posicaoEntreIrmaos(el)})` : base
  }
  return `${tag}:nth-of-type(${posicaoEntreIrmaos(el)})`
}

/** id estável → data-slot → aria-label → tag:nth-of-type, subindo até 8 níveis. */
export function seletorDoElemento(el: Element): string {
  const partes: string[] = []
  let atual: Element | null = el
  while (atual && atual.tagName !== "BODY" && atual.tagName !== "HTML" && partes.length < LIMITE_CADEIA) {
    const id = idEstavel(atual)
    if (id) {
      partes.unshift(`#${id}`)
      return partes.join(" > ")
    }
    partes.unshift(parteDoNivel(atual))
    atual = atual.parentElement
  }
  if (atual?.tagName === "BODY") partes.unshift("body")
  return partes.join(" > ")
}

export function textoVisivel(el: Element): string {
  const bruto = (el as { innerText?: string }).innerText ?? el.textContent ?? ""
  return bruto.replace(/\s+/g, " ").trim().slice(0, LIMITE_TEXTO)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/modo-dev/nucleo-seletor`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/modo-dev
git commit -m "feat(web): seletor estável e texto visível do modo dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Resumo em texto e argumentos do script

**Files:**
- Modify: `src/apps/web/lib/modo-dev/nucleo.ts` (acrescentar ao fim)
- Create: `src/apps/web/lib/modo-dev/nucleo-resumo.test.ts`

**Interfaces:**
- Consumes: `ComentarioDev`, `ErroValidacaoDev` (Task 1).
- Produces: `resumoEmTexto(comentarios: ComentarioDev[], pasta: string): string`; `type Comando = { acao: "listar" } | { acao: "limpar"; numeros: number[] | null }`; `interpretarArgumentos(args: string[]): Comando`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/lib/modo-dev/nucleo-resumo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type ComentarioDev, ErroValidacaoDev, interpretarArgumentos, resumoEmTexto } from "./nucleo.ts"

const base: ComentarioDev = {
  id: "a",
  numero: 1,
  criadoEm: "2026-10-13T12:00:00.000Z",
  editadoEm: null,
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa", "AreaDeTrabalho"],
  seletor: "#trilha > div:nth-of-type(2)",
  tag: "div",
  texto: "Diagnóstico",
  caixa: { x: 10, y: 20, largura: 300, altura: 40, larguraTela: 1440, alturaTela: 900 },
  captura: "capturas/a.png",
  comentario: "Aumentar o espaço.",
}

describe("resumoEmTexto", () => {
  it("lista vazia", () => {
    expect(resumoEmTexto([], "/repo/.dev-comentarios")).toBe("Nenhum comentário aberto.")
  })

  it("agrupa por página, ordena por número e mostra o caminho absoluto do recorte", () => {
    const comentarios: ComentarioDev[] = [
      { ...base, id: "c", numero: 3, pagina: "/", componente: "GradeProspects", cadeia: ["GradeProspects"], texto: "", captura: null, comentario: "Linha 1\nLinha 2" },
      base,
      { ...base, id: "b", numero: 2, componente: null, cadeia: [], captura: null },
    ]
    expect(resumoEmTexto(comentarios, "/repo/.dev-comentarios")).toBe(
      [
        "3 comentários abertos em /repo/.dev-comentarios",
        "",
        "## /prospects/acme",
        "#1 · PainelEtapa ← AreaDeTrabalho",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        '   texto: "Diagnóstico"',
        "   recorte: /repo/.dev-comentarios/capturas/a.png",
        "   pedido: Aumentar o espaço.",
        "#2 · (componente não identificado)",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        '   texto: "Diagnóstico"',
        "   recorte: (sem recorte)",
        "   pedido: Aumentar o espaço.",
        "",
        "## /",
        "#3 · GradeProspects",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        "   recorte: (sem recorte)",
        "   pedido: Linha 1",
        "           Linha 2",
      ].join("\n"),
    )
  })

  it("usa o singular com um comentário", () => {
    expect(resumoEmTexto([base], "/p").split("\n")[0]).toBe("1 comentário aberto em /p")
  })
})

describe("interpretarArgumentos", () => {
  it("sem argumentos lista", () => {
    expect(interpretarArgumentos([])).toEqual({ acao: "listar" })
  })

  it("--limpar sozinho apaga tudo", () => {
    expect(interpretarArgumentos(["--limpar"])).toEqual({ acao: "limpar", numeros: null })
  })

  it("--limpar com números, com ou sem espaço depois da vírgula, sem repetidos", () => {
    expect(interpretarArgumentos(["--limpar", "3,5"])).toEqual({ acao: "limpar", numeros: [3, 5] })
    expect(interpretarArgumentos(["--limpar", "3,", "5", "3"])).toEqual({ acao: "limpar", numeros: [3, 5] })
  })

  it("recusa números inválidos e argumentos desconhecidos", () => {
    expect(() => interpretarArgumentos(["--limpar", "3,x"])).toThrow(ErroValidacaoDev)
    expect(() => interpretarArgumentos(["--limpar", "0"])).toThrow(ErroValidacaoDev)
    expect(() => interpretarArgumentos(["--apagar"])).toThrow(ErroValidacaoDev)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/modo-dev/nucleo-resumo`
Expected: FAIL — `resumoEmTexto` não exportado.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/apps/web/lib/modo-dev/nucleo.ts`:

```ts
// --- Resumo para o terminal e argumentos do script ---

const RECUO_PEDIDO = " ".repeat("   pedido: ".length)

/** `pasta` é o caminho absoluto de .dev-comentarios; os recortes saem como caminho absoluto. */
export function resumoEmTexto(comentarios: ComentarioDev[], pasta: string): string {
  if (comentarios.length === 0) return "Nenhum comentário aberto."
  const porPagina = new Map<string, ComentarioDev[]>()
  for (const c of [...comentarios].sort((a, b) => a.numero - b.numero)) {
    porPagina.set(c.pagina, [...(porPagina.get(c.pagina) ?? []), c])
  }
  const total = comentarios.length
  const linhas = [`${total} ${total === 1 ? "comentário aberto" : "comentários abertos"} em ${pasta}`]
  for (const [pagina, lista] of porPagina) {
    linhas.push("", `## ${pagina}`)
    for (const c of lista) {
      linhas.push(`#${c.numero} · ${c.cadeia.length ? c.cadeia.join(" ← ") : "(componente não identificado)"}`)
      linhas.push(`   elemento: <${c.tag}> ${c.caixa.largura}×${c.caixa.altura}, tela ${c.caixa.larguraTela}×${c.caixa.alturaTela}`)
      linhas.push(`   seletor: ${c.seletor}`)
      if (c.texto) linhas.push(`   texto: "${c.texto}"`)
      linhas.push(`   recorte: ${c.captura ? `${pasta}/${c.captura}` : "(sem recorte)"}`)
      linhas.push(`   pedido: ${c.comentario.split("\n").join(`\n${RECUO_PEDIDO}`)}`)
    }
  }
  return linhas.join("\n")
}

export type Comando = { acao: "listar" } | { acao: "limpar"; numeros: number[] | null }

export function interpretarArgumentos(args: string[]): Comando {
  if (args.length === 0) return { acao: "listar" }
  if (args[0] !== "--limpar") {
    throw new ErroValidacaoDev(`Argumento não reconhecido: ${args.join(" ")}. Use --limpar ou --limpar 3,5.`)
  }
  const lista = args.slice(1).join(",")
  if (!lista) return { acao: "limpar", numeros: null }
  const numeros = lista.split(",").map((p) => p.trim()).filter(Boolean).map(Number)
  if (numeros.length === 0 || !numeros.every((n) => Number.isInteger(n) && n > 0)) {
    throw new ErroValidacaoDev(`Números inválidos em --limpar: ${args.slice(1).join(" ")}. Use, por exemplo, --limpar 3,5.`)
  }
  return { acao: "limpar", numeros: [...new Set(numeros)] }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/modo-dev/nucleo-resumo`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/modo-dev
git commit -m "feat(web): resumo em texto e argumentos do script do modo dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Armazenamento em arquivo

**Files:**
- Create: `src/apps/web/lib/modo-dev/armazenamento.ts`
- Create: `src/apps/web/lib/modo-dev/armazenamento.test.ts`

**Interfaces:**
- Consumes: `ArquivoComentarios`, `ComentarioDev`, `NovoComentario`, `ErroValidacaoDev`, `ErroComentarioNaoEncontrado`, `LIMITE_PNG_BYTES` (Task 1).
- Produces:
  - `decodificarPng(base64: string): Buffer`
  - `interface ResultadoLimpeza { apagados: number[]; inexistentes: number[] }`
  - `interface ArmazenamentoDev { pasta: string; listar(pagina?: string): Promise<ComentarioDev[]>; criar(novo: NovoComentario, png: Buffer | null): Promise<ComentarioDev>; editar(id: string, comentario: string): Promise<ComentarioDev>; apagar(id: string): Promise<void>; limpar(numeros?: number[] | null): Promise<ResultadoLimpeza> }`
  - `criarArmazenamentoDev(pasta: string): ArmazenamentoDev`

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/lib/modo-dev/armazenamento.test.ts`:

```ts
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { type ArmazenamentoDev, criarArmazenamentoDev, decodificarPng } from "./armazenamento.ts"
import { ErroValidacaoDev, type NovoComentario } from "./nucleo.ts"

const ASSINATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG = Buffer.from([...ASSINATURA, 1, 2, 3])

function novo(pagina = "/", comentario = "Ajustar"): NovoComentario {
  return {
    pagina,
    componente: "Painel",
    cadeia: ["Painel"],
    seletor: "main",
    tag: "main",
    texto: "",
    caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
    comentario,
  }
}

let pasta: string
let armazenamento: ArmazenamentoDev

beforeEach(async () => {
  pasta = path.join(await mkdtemp(path.join(os.tmpdir(), "modo-dev-")), ".dev-comentarios")
  armazenamento = criarArmazenamentoDev(pasta)
})

afterEach(async () => {
  await rm(path.dirname(pasta), { recursive: true, force: true })
})

describe("armazenamento do modo dev", () => {
  it("pasta inexistente conta como lista vazia", async () => {
    expect(await armazenamento.listar()).toEqual([])
  })

  it("numera em sequência e grava o recorte", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    const b = await armazenamento.criar(novo(), null)
    expect([a.numero, b.numero]).toEqual([1, 2])
    expect(a.captura).toBe(`capturas/${a.id}.png`)
    expect(await readFile(path.join(pasta, a.captura!))).toEqual(PNG)
    expect(b.captura).toBeNull()
    expect(a.editadoEm).toBeNull()
    const arquivo = JSON.parse(await readFile(path.join(pasta, "comentarios.json"), "utf-8"))
    expect(arquivo).toMatchObject({ versao: 1, proximoNumero: 3 })
  })

  it("não reaproveita número depois de apagar", async () => {
    await armazenamento.criar(novo(), null)
    const b = await armazenamento.criar(novo(), null)
    await armazenamento.apagar(b.id)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(3)
  })

  it("editar troca o texto e marca editadoEm", async () => {
    const a = await armazenamento.criar(novo(), null)
    const editado = await armazenamento.editar(a.id, "Outro texto")
    expect(editado).toMatchObject({ id: a.id, numero: 1, comentario: "Outro texto" })
    expect(editado.editadoEm).not.toBeNull()
    expect((await armazenamento.listar())[0]!.comentario).toBe("Outro texto")
  })

  it("editar e apagar id inexistente dão 404", async () => {
    await expect(armazenamento.editar("nada", "x")).rejects.toMatchObject({ status: 404 })
    await expect(armazenamento.apagar("nada")).rejects.toMatchObject({ status: 404 })
  })

  it("apagar remove o recorte", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    await armazenamento.apagar(a.id)
    expect(existsSync(path.join(pasta, a.captura!))).toBe(false)
    expect(await armazenamento.listar()).toEqual([])
  })

  it("listar filtra por página e ordena por número", async () => {
    await armazenamento.criar(novo("/a"), null)
    await armazenamento.criar(novo("/b"), null)
    await armazenamento.criar(novo("/a"), null)
    expect((await armazenamento.listar("/a")).map((c) => c.numero)).toEqual([1, 3])
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([1, 2, 3])
  })

  it("limpar sem números zera tudo, apaga os recortes e volta a contar do 1", async () => {
    await armazenamento.criar(novo(), PNG)
    await armazenamento.criar(novo(), null)
    expect(await armazenamento.limpar()).toEqual({ apagados: [1, 2], inexistentes: [] })
    expect(existsSync(path.join(pasta, "capturas"))).toBe(false)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(1)
  })

  it("limpar por números apaga só esses, com recortes, e informa os inexistentes", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    await armazenamento.criar(novo(), null)
    await armazenamento.criar(novo(), null)
    expect(await armazenamento.limpar([3, 1, 9])).toEqual({ apagados: [1, 3], inexistentes: [9] })
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([2])
    expect(existsSync(path.join(pasta, a.captura!))).toBe(false)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(4)
  })

  it("JSON corrompido conta como lista vazia e é recriado na próxima escrita", async () => {
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "comentarios.json"), "{oops")
    expect(await armazenamento.listar()).toEqual([])
    expect((await armazenamento.criar(novo(), null)).numero).toBe(1)
  })

  it("a gravação não deixa arquivo temporário", async () => {
    await armazenamento.criar(novo(), PNG)
    expect((await readdir(pasta)).sort()).toEqual(["capturas", "comentarios.json"])
  })

  it("criações simultâneas não perdem comentário nem repetem número", async () => {
    const criados = await Promise.all(Array.from({ length: 5 }, () => armazenamento.criar(novo(), null)))
    expect(criados.map((c) => c.numero).sort()).toEqual([1, 2, 3, 4, 5])
    expect(await armazenamento.listar()).toHaveLength(5)
  })
})

describe("decodificarPng", () => {
  it("aceita base64 puro ou como data URL", () => {
    const base64 = PNG.toString("base64")
    expect(decodificarPng(base64)).toEqual(PNG)
    expect(decodificarPng(`data:image/png;base64,${base64}`)).toEqual(PNG)
  })

  it("recusa o que não é PNG", () => {
    expect(() => decodificarPng(Buffer.from("GIF89a....").toString("base64"))).toThrow(ErroValidacaoDev)
    expect(() => decodificarPng("")).toThrow(ErroValidacaoDev)
  })

  it("recusa acima de 5 MB", () => {
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1)
    grande.set(ASSINATURA)
    expect(() => decodificarPng(grande.toString("base64"))).toThrow(/5 MB/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/modo-dev/armazenamento`
Expected: FAIL — não encontra `./armazenamento.ts`.

- [ ] **Step 3: Implementar**

Criar `src/apps/web/lib/modo-dev/armazenamento.ts`:

```ts
// Comentários do modo dev em arquivo: comentarios.json + capturas/<id>.png, numa pasta injetada.
// Usado pelas rotas (next dev) e pelo script de terminal (Node puro): só imports relativos com .ts.
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  type ArquivoComentarios,
  type ComentarioDev,
  ErroComentarioNaoEncontrado,
  ErroValidacaoDev,
  LIMITE_PNG_BYTES,
  type NovoComentario,
} from "./nucleo.ts"

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function decodificarPng(base64: string): Buffer {
  const limpo = base64.replace(/^data:image\/png;base64,/, "")
  // Checa o tamanho antes de decodificar, para não alocar um buffer enorme à toa.
  if (limpo.length > Math.ceil(LIMITE_PNG_BYTES / 3) * 4 + 4) throw new ErroValidacaoDev("O recorte passa de 5 MB.")
  const bytes = Buffer.from(limpo, "base64")
  if (bytes.length > LIMITE_PNG_BYTES) throw new ErroValidacaoDev("O recorte passa de 5 MB.")
  if (!ASSINATURA_PNG.every((byte, i) => bytes[i] === byte)) throw new ErroValidacaoDev("O recorte não é um PNG válido.")
  return bytes
}

export interface ResultadoLimpeza {
  apagados: number[]
  inexistentes: number[]
}

export interface ArmazenamentoDev {
  pasta: string
  listar(pagina?: string): Promise<ComentarioDev[]>
  criar(novo: NovoComentario, png: Buffer | null): Promise<ComentarioDev>
  editar(id: string, comentario: string): Promise<ComentarioDev>
  apagar(id: string): Promise<void>
  /** Sem números: apaga tudo e o próximo comentário volta a ser o #1. Com números: só esses. */
  limpar(numeros?: number[] | null): Promise<ResultadoLimpeza>
}

const vazio = (): ArquivoComentarios => ({ versao: 1, proximoNumero: 1, comentarios: [] })
const crescente = (a: number, b: number) => a - b

export function criarArmazenamentoDev(pasta: string): ArmazenamentoDev {
  const arquivo = path.join(pasta, "comentarios.json")
  const pastaCapturas = path.join(pasta, "capturas")
  let fila: Promise<unknown> = Promise.resolve()

  // Uma escrita por vez: dois salvamentos seguidos não podem ler o mesmo proximoNumero.
  function emSerie<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa, tarefa)
    fila = resultado.catch(() => undefined)
    return resultado
  }

  async function ler(): Promise<ArquivoComentarios> {
    try {
      const dados = JSON.parse(await readFile(arquivo, "utf-8")) as Partial<ArquivoComentarios> | null
      if (!dados || !Array.isArray(dados.comentarios) || !Number.isInteger(dados.proximoNumero)) return vazio()
      return { versao: 1, proximoNumero: dados.proximoNumero as number, comentarios: dados.comentarios }
    } catch {
      return vazio()
    }
  }

  async function gravar(dados: ArquivoComentarios): Promise<void> {
    await mkdir(pasta, { recursive: true })
    const temporario = `${arquivo}.${process.pid}.tmp`
    await writeFile(temporario, `${JSON.stringify(dados, null, 2)}\n`)
    await rename(temporario, arquivo)
  }

  async function apagarCaptura(comentario: ComentarioDev): Promise<void> {
    if (comentario.captura) await rm(path.join(pasta, comentario.captura), { force: true })
  }

  function buscar(dados: ArquivoComentarios, id: string): ComentarioDev {
    const comentario = dados.comentarios.find((c) => c.id === id)
    if (!comentario) throw new ErroComentarioNaoEncontrado(`Comentário ${id} não encontrado.`)
    return comentario
  }

  return {
    pasta,

    async listar(pagina) {
      const { comentarios } = await ler()
      return comentarios.filter((c) => pagina === undefined || c.pagina === pagina).sort((a, b) => a.numero - b.numero)
    },

    criar: (novo, png) =>
      emSerie(async () => {
        const dados = await ler()
        const id = randomUUID()
        let captura: string | null = null
        if (png) {
          await mkdir(pastaCapturas, { recursive: true })
          await writeFile(path.join(pastaCapturas, `${id}.png`), png)
          captura = `capturas/${id}.png`
        }
        const comentario: ComentarioDev = {
          id,
          numero: dados.proximoNumero,
          criadoEm: new Date().toISOString(),
          editadoEm: null,
          ...novo,
          captura,
        }
        await gravar({ ...dados, proximoNumero: dados.proximoNumero + 1, comentarios: [...dados.comentarios, comentario] })
        return comentario
      }),

    editar: (id, texto) =>
      emSerie(async () => {
        const dados = await ler()
        const editado = { ...buscar(dados, id), comentario: texto, editadoEm: new Date().toISOString() }
        await gravar({ ...dados, comentarios: dados.comentarios.map((c) => (c.id === id ? editado : c)) })
        return editado
      }),

    apagar: (id) =>
      emSerie(async () => {
        const dados = await ler()
        const comentario = buscar(dados, id)
        await gravar({ ...dados, comentarios: dados.comentarios.filter((c) => c.id !== id) })
        await apagarCaptura(comentario)
      }),

    limpar: (numeros) =>
      emSerie(async () => {
        const dados = await ler()
        if (!numeros) {
          await gravar(vazio())
          await rm(pastaCapturas, { recursive: true, force: true })
          return { apagados: dados.comentarios.map((c) => c.numero).sort(crescente), inexistentes: [] }
        }
        const pedidos = new Set(numeros)
        const apagados = dados.comentarios.filter((c) => pedidos.has(c.numero))
        const existentes = new Set(apagados.map((c) => c.numero))
        await gravar({ ...dados, comentarios: dados.comentarios.filter((c) => !pedidos.has(c.numero)) })
        await Promise.all(apagados.map(apagarCaptura))
        return {
          apagados: [...existentes].sort(crescente),
          inexistentes: [...pedidos].filter((n) => !existentes.has(n)).sort(crescente),
        }
      }),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/modo-dev/armazenamento`
Expected: PASS (15 testes).

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/modo-dev
git commit -m "feat(web): armazenamento em arquivo dos comentários do modo dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Rotas de API só em desenvolvimento

**Files:**
- Create: `src/apps/web/lib/modo-dev/rota.ts`
- Create: `src/apps/web/app/api/dev/comentarios/route.ts`
- Create: `src/apps/web/app/api/dev/comentarios/[id]/route.ts`
- Create: `src/apps/web/app/api/dev/comentarios/route.test.ts`

**Interfaces:**
- Consumes: `criarArmazenamentoDev`, `decodificarPng`, `ArmazenamentoDev` (Task 5); `validarNovo`, `validarEdicao`, `ErroValidacaoDev` (Task 1); `json`, `lerJson`, `respostaDeErro` de `src/apps/web/lib/http.ts` (já existem).
- Produces: `armazenamentoDev(): ArmazenamentoDev`; `foraDoDesenvolvimento(): Response | null`. HTTP:
  - `GET /api/dev/comentarios[?pagina=/x]` → `200 { comentarios: ComentarioDev[] }`
  - `POST /api/dev/comentarios` com `NovoComentario & { png?: string | null }` → `201 { comentario }`
  - `PATCH /api/dev/comentarios/:id` com `{ comentario }` → `200 { comentario }`
  - `DELETE /api/dev/comentarios/:id` → `200 { ok: true }`
  - erros: `400|404 { erro, codigo }`; fora de dev, `404 { erro: "Não encontrado." }`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/app/api/dev/comentarios/route.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DELETE, PATCH } from "./[id]/route"
import { GET, POST } from "./route"

const URL_BASE = "http://127.0.0.1:3000/api/dev/comentarios"
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64")
const valido = {
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa"],
  seletor: "main",
  tag: "main",
  texto: "",
  caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
  comentario: "Ajustar",
}

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "modo-dev-rota-"))
  vi.stubEnv("PLANEJAMENTO_ROOT", raiz)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(raiz, { recursive: true, force: true })
})

const contexto = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (corpo: unknown) => POST(new Request(URL_BASE, { method: "POST", body: JSON.stringify(corpo) }))
const patch = (id: string, corpo: unknown) =>
  PATCH(new Request(`${URL_BASE}/${id}`, { method: "PATCH", body: JSON.stringify(corpo) }), contexto(id))
const apagar = (id: string) => DELETE(new Request(`${URL_BASE}/${id}`, { method: "DELETE" }), contexto(id))

describe("fora de desenvolvimento", () => {
  it("todas as rotas respondem 404 em produção", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const respostas = [await GET(new Request(URL_BASE)), await post(valido), await patch("x", { comentario: "a" }), await apagar("x")]
    for (const r of respostas) expect(r.status).toBe(404)
  })
})

describe("em desenvolvimento", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
  })

  it("cria com recorte, lista por página, edita e apaga", async () => {
    const criado = await post({ ...valido, png: PNG_BASE64 })
    expect(criado.status).toBe(201)
    const { comentario } = (await criado.json()) as { comentario: { id: string; numero: number; captura: string } }
    expect(comentario).toMatchObject({ numero: 1, captura: `capturas/${comentario.id}.png` })

    const daPagina = await (await GET(new Request(`${URL_BASE}?pagina=/prospects/acme`))).json()
    const deOutra = await (await GET(new Request(`${URL_BASE}?pagina=/outra`))).json()
    expect(daPagina.comentarios).toHaveLength(1)
    expect(deOutra.comentarios).toHaveLength(0)

    const editado = await patch(comentario.id, { comentario: "Novo" })
    expect(editado.status).toBe(200)
    expect((await editado.json()).comentario.comentario).toBe("Novo")

    expect((await apagar(comentario.id)).status).toBe(200)
    expect((await (await GET(new Request(URL_BASE))).json()).comentarios).toHaveLength(0)
  })

  it("comentário vazio responde 400 com a mensagem", async () => {
    const r = await post({ ...valido, comentario: "  " })
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ erro: "O comentário está vazio.", codigo: "entrada_invalida" })
  })

  it("comentário acima de 2000 caracteres responde 400", async () => {
    expect((await post({ ...valido, comentario: "a".repeat(2001) })).status).toBe(400)
  })

  it("png que não é PNG ou de tipo errado responde 400", async () => {
    expect((await post({ ...valido, png: Buffer.from("nao e png").toString("base64") })).status).toBe(400)
    expect((await post({ ...valido, png: 123 })).status).toBe(400)
  })

  it("corpo que não é JSON responde 400", async () => {
    expect((await POST(new Request(URL_BASE, { method: "POST", body: "{" }))).status).toBe(400)
  })

  it("id inexistente responde 404 com mensagem", async () => {
    const r = await apagar("nada")
    expect(r.status).toBe(404)
    expect((await r.json()).erro).toContain("não encontrado")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- app/api/dev`
Expected: FAIL — não encontra `./route`.

- [ ] **Step 3: Implementar o apoio das rotas**

Criar `src/apps/web/lib/modo-dev/rota.ts`:

```ts
import path from "node:path"
import { type ArmazenamentoDev, criarArmazenamentoDev } from "./armazenamento.ts"

const registro = globalThis as unknown as { __modoDev?: ArmazenamentoDev }

/** Pasta .dev-comentarios na raiz do repositório, pelo mesmo critério de lib/servidor.ts. */
export function armazenamentoDev(): ArmazenamentoDev {
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  const pasta = path.join(raiz, ".dev-comentarios")
  let atual = registro.__modoDev
  // Uma instância por pasta, para a fila de escrita valer entre requisições.
  if (atual?.pasta !== pasta) {
    atual = criarArmazenamentoDev(pasta)
    registro.__modoDev = atual
  }
  return atual
}

/** As rotas do modo dev só existem no next dev; fora dele respondem como rota inexistente. */
export function foraDoDesenvolvimento(): Response | null {
  return process.env.NODE_ENV === "development" ? null : Response.json({ erro: "Não encontrado." }, { status: 404 })
}
```

- [ ] **Step 4: Implementar as rotas**

Criar `src/apps/web/app/api/dev/comentarios/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { decodificarPng } from "@/lib/modo-dev/armazenamento"
import { ErroValidacaoDev, validarNovo } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const pagina = new URL(req.url).searchParams.get("pagina") ?? undefined
    return json({ comentarios: await armazenamentoDev().listar(pagina) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const corpo = await lerJson<Record<string, unknown>>(req)
    const novo = validarNovo(corpo)
    const { png } = corpo
    if (png !== undefined && png !== null && typeof png !== "string") {
      throw new ErroValidacaoDev("Campo png deve ser texto em base64 ou null.")
    }
    const bytes = png ? decodificarPng(png) : null
    return json({ comentario: await armazenamentoDev().criar(novo, bytes) }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

Criar `src/apps/web/app/api/dev/comentarios/[id]/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { validarEdicao } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export async function PATCH(req: Request, ctx: RouteContext<"/api/dev/comentarios/[id]">) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const { id } = await ctx.params
    const comentario = validarEdicao(await lerJson(req))
    return json({ comentario: await armazenamentoDev().editar(id, comentario) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/dev/comentarios/[id]">) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const { id } = await ctx.params
    await armazenamentoDev().apagar(id)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w web -- app/api/dev`
Expected: PASS (7 testes). Se o corpo não-JSON der 500 em vez de 400, confira que `lerJson` vem de `@/lib/http` (ele converte em `ErroEntrada`).

- [ ] **Step 6: Typecheck, lint e commit**

Run: `npm run typecheck -w web && npm run lint -w web`
Expected: sem erros (o `next typegen` gera o tipo `RouteContext<"/api/dev/comentarios/[id]">`).

```bash
git add src/apps/web/lib/modo-dev/rota.ts src/apps/web/app/api/dev
git commit -m "feat(web): rotas do modo dev, 404 fora do next dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Script de terminal

**Files:**
- Create: `src/apps/web/scripts/dev-comentarios.ts`
- Create: `src/apps/web/scripts/dev-comentarios.test.ts`
- Modify: `src/package.json` (`scripts`)
- Modify: `.gitignore` (raiz do repositório)

**Interfaces:**
- Consumes: `criarArmazenamentoDev` (Task 5); `resumoEmTexto`, `interpretarArgumentos`, `ErroValidacaoDev` (Tasks 1 e 4).
- Produces: `npm run dev:comentarios [-- --limpar [3,5]]` em `src/`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/scripts/dev-comentarios.test.ts`:

```ts
import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { criarArmazenamentoDev } from "../lib/modo-dev/armazenamento.ts"
import type { NovoComentario } from "../lib/modo-dev/nucleo.ts"

const exec = promisify(execFile)
const SCRIPT = path.resolve(import.meta.dirname, "dev-comentarios.ts")
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const novo: NovoComentario = {
  pagina: "/",
  componente: "GradeProspects",
  cadeia: ["GradeProspects"],
  seletor: "main",
  tag: "main",
  texto: "",
  caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
  comentario: "Ajustar",
}

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "modo-dev-script-"))
})

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

// Roda no Node puro, como o desenvolvedor roda: pega import sem .ts ou tipo sem `type`.
async function rodar(...args: string[]): Promise<string> {
  const { stdout } = await exec(process.execPath, [SCRIPT, ...args], { env: { ...process.env, PLANEJAMENTO_ROOT: raiz } })
  return stdout
}

describe("npm run dev:comentarios", () => {
  it("sem comentários avisa que não há nenhum", async () => {
    expect(await rodar()).toBe("Nenhum comentário aberto.\n")
  })

  it("lista com o caminho absoluto do recorte", async () => {
    const pasta = path.join(raiz, ".dev-comentarios")
    const c = await criarArmazenamentoDev(pasta).criar(novo, PNG)
    const saida = await rodar()
    expect(saida).toContain("#1 · GradeProspects")
    expect(saida).toContain(`recorte: ${pasta}/capturas/${c.id}.png`)
  })

  it("--limpar com números apaga só esses e avisa os inexistentes", async () => {
    const armazenamento = criarArmazenamentoDev(path.join(raiz, ".dev-comentarios"))
    await armazenamento.criar(novo, null)
    await armazenamento.criar(novo, null)
    expect(await rodar("--limpar", "1,9")).toBe("Apagados: #1.\nNão existiam: #9.\n")
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([2])
  })

  it("--limpar sem números apaga tudo", async () => {
    await criarArmazenamentoDev(path.join(raiz, ".dev-comentarios")).criar(novo, null)
    expect(await rodar("--limpar")).toBe("Todos os comentários foram apagados (1).\n")
    expect(await rodar("--limpar")).toBe("Nada para apagar.\n")
  })

  it("argumento inválido sai com código 1 e mensagem", async () => {
    await expect(rodar("--limpar", "x")).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("Números inválidos") })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- scripts/dev-comentarios`
Expected: FAIL — o Node não encontra `dev-comentarios.ts`.

- [ ] **Step 3: Implementar o script**

Criar `src/apps/web/scripts/dev-comentarios.ts`:

```ts
// Lista e limpa os comentários do modo dev. Roda no Node puro (sem build). Em src/:
//   npm run dev:comentarios                    → resumo em texto
//   npm run dev:comentarios -- --limpar        → apaga todos
//   npm run dev:comentarios -- --limpar 3,5    → apaga os números indicados
import path from "node:path"
import { criarArmazenamentoDev } from "../lib/modo-dev/armazenamento.ts"
import { ErroValidacaoDev, interpretarArgumentos, resumoEmTexto } from "../lib/modo-dev/nucleo.ts"

const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
const armazenamento = criarArmazenamentoDev(path.join(raiz, ".dev-comentarios"))
const numerados = (numeros: number[]) => numeros.map((n) => `#${n}`).join(", ")

try {
  const comando = interpretarArgumentos(process.argv.slice(2))
  if (comando.acao === "listar") {
    console.log(resumoEmTexto(await armazenamento.listar(), armazenamento.pasta))
  } else if (comando.numeros === null) {
    const { apagados } = await armazenamento.limpar()
    console.log(apagados.length ? `Todos os comentários foram apagados (${apagados.length}).` : "Nada para apagar.")
  } else {
    const { apagados, inexistentes } = await armazenamento.limpar(comando.numeros)
    console.log(apagados.length ? `Apagados: ${numerados(apagados)}.` : "Nenhum dos números existia.")
    if (inexistentes.length) console.log(`Não existiam: ${numerados(inexistentes)}.`)
  }
} catch (e) {
  if (!(e instanceof ErroValidacaoDev)) throw e
  console.error(e.message)
  process.exitCode = 1
}
```

Em `src/package.json`, dentro de `"scripts"`, depois de `"test"`:

```json
    "test": "turbo test",
    "dev:comentarios": "node apps/web/scripts/dev-comentarios.ts"
```

No `.gitignore` da raiz do repositório, no fim do arquivo:

```
# Modo dev de comentários (ferramenta local de desenvolvimento da interface)
/.dev-comentarios/
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- scripts/dev-comentarios`
Expected: PASS (5 testes).

Run (em `src/`): `npm run dev:comentarios`
Expected: imprime `Nenhum comentário aberto.` (ou o resumo, se já houver dados), sem aviso de erro de import.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/scripts src/package.json .gitignore
git commit -m "feat(web): script dev:comentarios para listar e limpar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Interface do modo dev

**Files:**
- Create: `src/apps/web/components/modo-dev/carregador.tsx`
- Create: `src/apps/web/components/modo-dev/modo-dev.tsx`
- Modify: `src/apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `cadeiaDeComponentes`, `seletorDoElemento`, `textoVisivel`, `type ComentarioDev` (Tasks 1–3); rotas da Task 6; `toast` de `sonner` (o `<Toaster>` já está no layout).
- Produces: `CarregadorModoDev` (componente sem props); `ModoDev` (componente sem props).

Sem teste automatizado (precisa de navegador): a verificação é o roteiro manual do Step 5.

- [ ] **Step 1: Carregador**

Criar `src/apps/web/components/modo-dev/carregador.tsx`:

```tsx
"use client"

import dynamic from "next/dynamic"

// O layout só renderiza isto no next dev. O componente usa window e localStorage: nada de SSR.
export const CarregadorModoDev = dynamic(() => import("./modo-dev").then((m) => m.ModoDev), { ssr: false })
```

- [ ] **Step 2: Componente do modo dev**

Criar `src/apps/web/components/modo-dev/modo-dev.tsx`:

```tsx
"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cadeiaDeComponentes, type ComentarioDev, seletorDoElemento, textoVisivel } from "@/lib/modo-dev/nucleo"

const CHAVE_ATIVO = "modo-dev:ativo"
const LARGURA_CAIXA = 320
const ALTURA_CAIXA = 190
const EVENTOS_BLOQUEADOS = ["click", "dblclick", "auxclick", "contextmenu", "pointerdown", "pointerup", "mousedown", "mouseup", "submit"]

interface Alvo {
  el: Element | null
  cadeia: string[]
  editando: ComentarioDev | null
}

interface Destaque {
  rect: DOMRect
  cadeia: string[]
  tag: string
}

function lerAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE_ATIVO) === "1"
  } catch {
    return false
  }
}

function gravarAtivo(ativo: boolean) {
  try {
    localStorage.setItem(CHAVE_ATIVO, ativo ? "1" : "0")
  } catch {
    // armazenamento indisponível: o modo só não fica lembrado
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json" } })
  const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
  if (!resposta.ok) throw new Error(corpo.erro ?? `O servidor respondeu ${resposta.status}.`)
  return corpo as T
}

async function capturar(el: Element): Promise<string | null> {
  try {
    const { width, height } = el.getBoundingClientRect()
    const maiorLado = Math.max(width, height)
    if (!maiorLado) return null
    const { domToPng } = await import("modern-screenshot")
    const dataUrl = await domToPng(el, {
      scale: Math.min(1, 1600 / maiorLado),
      filter: (no) => !(no instanceof Element && no.hasAttribute("data-modo-dev")),
    })
    return dataUrl.replace(/^data:image\/png;base64,/, "")
  } catch {
    return null
  }
}

/** Elemento do comentário na tela atual; escondido (aba fechada, display:none) conta como não encontrado. */
function elementoVisivel(seletor: string): Element | null {
  try {
    const el = document.querySelector(seletor)
    if (!el) return null
    const { width, height } = el.getBoundingClientRect()
    return width || height ? el : null
  } catch {
    return null
  }
}

function contornoDe(rect: DOMRect) {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function etiquetaDe(rect: DOMRect) {
  return { left: Math.max(4, rect.left), top: rect.top >= 24 ? rect.top - 22 : rect.bottom + 4 }
}

function posicaoDaCaixa(rect: DOMRect | null) {
  const margem = 12
  if (!rect) return { left: 16, top: Math.max(margem, window.innerHeight - ALTURA_CAIXA - 80) }
  let left = rect.right + margem
  if (left + LARGURA_CAIXA > window.innerWidth - margem) left = rect.left - LARGURA_CAIXA - margem
  if (left < margem) left = Math.min(Math.max(margem, rect.left), window.innerWidth - LARGURA_CAIXA - margem)
  const top = Math.min(Math.max(margem, rect.top), window.innerHeight - ALTURA_CAIXA - margem)
  return { left, top }
}

function resumoDaCadeia(cadeia: string[], tag: string) {
  return cadeia.slice(0, 3).join(" ← ") || `<${tag}>`
}

export function ModoDev() {
  const pagina = usePathname()
  const camadaRef = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(lerAtivo)
  const [comentarios, setComentarios] = useState<ComentarioDev[]>([])
  const [destaque, setDestaque] = useState<Destaque | null>(null)
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [texto, setTexto] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [todasPaginas, setTodasPaginas] = useState(false)
  const [, setQuadro] = useState(0)

  // Os listeners de documento leem o estado por refs, para não serem recriados a cada tecla.
  const ativoRef = useRef(ativo)
  const alvoRef = useRef(alvo)
  const textoRef = useRef(texto)
  useEffect(() => {
    ativoRef.current = ativo
    alvoRef.current = alvo
    textoRef.current = texto
  }, [ativo, alvo, texto])

  const recarregar = useCallback(async () => {
    try {
      const { comentarios } = await chamar<{ comentarios: ComentarioDev[] }>("/api/dev/comentarios")
      setComentarios(comentarios)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os comentários do modo dev.")
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar, pagina])

  const fecharCaixa = useCallback(() => {
    setAlvo(null)
    setTexto("")
  }, [])

  const definirAtivo = useCallback((valor: boolean) => {
    setAtivo(valor)
    gravarAtivo(valor)
    setDestaque(null)
    if (!valor) {
      setAlvo(null)
      setTexto("")
    }
  }, [])

  const fixar = useCallback((el: Element) => {
    // Com texto digitado, um clique fora não troca o alvo nem perde o rascunho.
    if (alvoRef.current && textoRef.current.trim()) return
    setDestaque(null)
    setAlvo({ el, cadeia: cadeiaDeComponentes(el), editando: null })
    setTexto("")
  }, [])

  // Atalhos: Ctrl/⌘+Shift+D liga e desliga; Esc fecha a caixa e, sem caixa, sai do modo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault()
        definirAtivo(!ativoRef.current)
        return
      }
      if (e.key !== "Escape") return
      if (alvoRef.current) {
        e.preventDefault()
        e.stopPropagation()
        fecharCaixa()
      } else if (ativoRef.current) {
        e.preventDefault()
        e.stopPropagation()
        definirAtivo(false)
      }
    }
    document.addEventListener("keydown", aoTeclar, true)
    return () => document.removeEventListener("keydown", aoTeclar, true)
  }, [definirAtivo, fecharCaixa])

  // Modo ativo: destaca o elemento sob o cursor e bloqueia cliques e envios do site.
  useEffect(() => {
    if (!ativo) return
    const naCamada = (alvoEvento: EventTarget | null) => alvoEvento instanceof Node && !!camadaRef.current?.contains(alvoEvento)
    const doSite = (alvoEvento: EventTarget | null): alvoEvento is Element =>
      alvoEvento instanceof Element && alvoEvento !== document.body && alvoEvento !== document.documentElement

    const aoMover = (e: PointerEvent) => {
      if (alvoRef.current) return
      if (naCamada(e.target) || !doSite(e.target)) {
        setDestaque(null)
        return
      }
      const el = e.target
      setDestaque({ rect: el.getBoundingClientRect(), cadeia: cadeiaDeComponentes(el), tag: el.tagName.toLowerCase() })
    }
    const bloquear = (e: Event) => {
      if (naCamada(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      // detail 0 = clique gerado por teclado (Enter num botão focado): bloqueia, mas não fixa.
      if (e.type === "click" && (e as MouseEvent).detail > 0 && doSite(e.target)) fixar(e.target)
    }

    document.addEventListener("pointermove", aoMover, true)
    for (const tipo of EVENTOS_BLOQUEADOS) document.addEventListener(tipo, bloquear, true)
    return () => {
      document.removeEventListener("pointermove", aoMover, true)
      for (const tipo of EVENTOS_BLOQUEADOS) document.removeEventListener(tipo, bloquear, true)
    }
  }, [ativo, fixar])

  // Pinos e contorno acompanham rolagem, redimensionamento e mudanças do site (nunca as da própria camada).
  useEffect(() => {
    if (!ativo) return
    let pedido = 0
    const agendar = () => {
      cancelAnimationFrame(pedido)
      pedido = requestAnimationFrame(() => setQuadro((n) => n + 1))
    }
    const observador = new MutationObserver((mudancas) => {
      if (mudancas.some((m) => !camadaRef.current?.contains(m.target))) agendar()
    })
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    window.addEventListener("scroll", agendar, true)
    window.addEventListener("resize", agendar)
    return () => {
      cancelAnimationFrame(pedido)
      observador.disconnect()
      window.removeEventListener("scroll", agendar, true)
      window.removeEventListener("resize", agendar)
    }
  }, [ativo])

  function editar(comentario: ComentarioDev) {
    const el = comentario.pagina === pagina ? elementoVisivel(comentario.seletor) : null
    setDestaque(null)
    setAlvo({ el, cadeia: comentario.cadeia, editando: comentario })
    setTexto(comentario.comentario)
  }

  async function apagar(comentario: ComentarioDev) {
    try {
      await chamar(`/api/dev/comentarios/${comentario.id}`, { method: "DELETE" })
      if (alvo?.editando?.id === comentario.id) fecharCaixa()
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar o comentário.")
    }
  }

  async function salvar() {
    if (!alvo || salvando) return
    const comentario = texto.trim()
    if (!comentario) {
      toast.error("Escreva o ajuste antes de salvar.")
      return
    }
    setSalvando(true)
    try {
      if (alvo.editando) {
        await chamar(`/api/dev/comentarios/${alvo.editando.id}`, { method: "PATCH", body: JSON.stringify({ comentario }) })
      } else if (alvo.el) {
        const el = alvo.el
        const rect = el.getBoundingClientRect()
        const png = await capturar(el)
        await chamar("/api/dev/comentarios", {
          method: "POST",
          body: JSON.stringify({
            pagina: window.location.pathname,
            componente: alvo.cadeia[0] ?? null,
            cadeia: alvo.cadeia,
            seletor: seletorDoElemento(el),
            tag: el.tagName.toLowerCase(),
            texto: textoVisivel(el),
            caixa: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              largura: Math.round(rect.width),
              altura: Math.round(rect.height),
              larguraTela: window.innerWidth,
              alturaTela: window.innerHeight,
            },
            comentario,
            png,
          }),
        })
      }
      fecharCaixa()
      await recarregar()
    } catch (e) {
      // O texto fica na caixa para tentar de novo.
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o comentário.")
    } finally {
      setSalvando(false)
    }
  }

  const daPagina = comentarios.filter((c) => c.pagina === pagina)
  const naLista = todasPaginas ? comentarios : daPagina
  const rectAlvo = alvo?.el?.isConnected ? alvo.el.getBoundingClientRect() : null

  return (
    <div ref={camadaRef} data-modo-dev="" className="pointer-events-none fixed inset-0 font-sans text-xs" style={{ zIndex: 2147483647 }}>
      {ativo && destaque && !alvo && (
        <>
          <div className="absolute rounded-sm border-2 border-orange-500 bg-orange-500/10" style={contornoDe(destaque.rect)} />
          <div className="absolute rounded bg-orange-500 px-1.5 py-0.5 whitespace-nowrap text-white shadow" style={etiquetaDe(destaque.rect)}>
            {resumoDaCadeia(destaque.cadeia, destaque.tag)} · {Math.round(destaque.rect.width)}×{Math.round(destaque.rect.height)}
          </div>
        </>
      )}

      {alvo && rectAlvo && <div className="absolute rounded-sm border-2 border-sky-500 bg-sky-500/10" style={contornoDe(rectAlvo)} />}

      {ativo &&
        daPagina.map((c) => {
          const el = elementoVisivel(c.seletor)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return (
            <button
              key={c.id}
              type="button"
              title={c.comentario}
              onClick={() => editar(c)}
              className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-full bg-orange-500 font-semibold text-white shadow ring-2 ring-white"
              style={{ left: r.right - 10, top: r.top - 10 }}
            >
              {c.numero}
            </button>
          )
        })}

      {alvo && (
        <div
          className="pointer-events-auto absolute flex flex-col gap-2 rounded-lg border bg-background p-3 text-foreground shadow-xl"
          style={{ ...posicaoDaCaixa(rectAlvo), width: LARGURA_CAIXA }}
        >
          <div className="truncate text-muted-foreground">
            {alvo.editando ? `Editando #${alvo.editando.numero} · ` : ""}
            {resumoDaCadeia(alvo.cadeia, alvo.el?.tagName.toLowerCase() ?? alvo.editando?.tag ?? "?")}
          </div>
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void salvar()
              }
            }}
            maxLength={2000}
            rows={4}
            placeholder="O que ajustar neste bloco?"
            className="w-full resize-none rounded border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">⌘/Ctrl+Enter salva · Esc cancela</span>
            <div className="flex gap-1">
              <button type="button" onClick={fecharCaixa} className="rounded px-2 py-1 hover:bg-muted">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvar()}
                className="rounded bg-orange-500 px-2 py-1 font-medium text-white disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {listaAberta && (
        <div className="pointer-events-auto absolute bottom-14 left-4 flex max-h-[50vh] w-[360px] flex-col rounded-lg border bg-background text-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <span className="font-medium">Comentários {todasPaginas ? "de todas as páginas" : "desta página"}</span>
            <label className="flex items-center gap-1 text-muted-foreground">
              <input type="checkbox" checked={todasPaginas} onChange={(e) => setTodasPaginas(e.target.checked)} />
              todas as páginas
            </label>
          </div>
          <ul className="overflow-y-auto">
            {naLista.length === 0 && <li className="p-3 text-muted-foreground">Nenhum comentário.</li>}
            {naLista.map((c) => {
              const naoEncontrado = c.pagina === pagina && !elementoVisivel(c.seletor)
              return (
                <li key={c.id} className="border-b p-2 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">#{c.numero}</span>
                    <span className="truncate text-muted-foreground">{c.componente ?? `<${c.tag}>`}</span>
                    {naoEncontrado && <span className="shrink-0 rounded bg-amber-100 px-1 text-amber-900">elemento não encontrado</span>}
                  </div>
                  {todasPaginas && <div className="truncate text-muted-foreground">{c.pagina}</div>}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{c.comentario}</p>
                  <div className="mt-1 flex gap-3">
                    <button type="button" onClick={() => editar(c)} className="underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => void apagar(c)} className="text-red-600 underline">
                      Apagar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-4 left-4 flex gap-1">
        <button
          type="button"
          onClick={() => definirAtivo(!ativo)}
          title="Modo dev (Ctrl/⌘ + Shift + D)"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold shadow-lg ${ativo ? "bg-orange-500 text-white" : "bg-zinc-900 text-white"}`}
        >
          Dev
          {daPagina.length > 0 && <span className="rounded-full bg-white px-1.5 text-zinc-900">{daPagina.length}</span>}
        </button>
        <button
          type="button"
          onClick={() => setListaAberta((v) => !v)}
          className="rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white shadow-lg"
        >
          Lista
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Ligar no layout só em desenvolvimento**

Em `src/apps/web/app/layout.tsx`, trocar a função `RootLayout` por:

```tsx
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Modo dev de comentários: só no next dev. Em produção a condição vira false no build e o import some.
  const ModoDev =
    process.env.NODE_ENV === "development" ? (await import("@/components/modo-dev/carregador")).CarregadorModoDev : null
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}>
      <body>
        <ThemeProvider>
          {children}
          <VerificacaoSistema />
          <Toaster richColors />
          {ModoDev && <ModoDev />}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Typecheck, lint e testes**

Run (em `src/`): `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; todos os testes passam. Se o lint reclamar de `react-hooks/set-state-in-effect` ou `react-hooks/refs`, ajuste mantendo o comportamento (as escritas em ref já ficam dentro de `useEffect`; `useState(lerAtivo)` é seguro porque o componente nunca renderiza no servidor).

- [ ] **Step 5: Verificação manual no navegador**

Run (em `src/`): `npm run dev`, abrir `http://127.0.0.1:3000`.

Conferir, nesta ordem:
1. O botão "Dev" aparece no canto inferior esquerdo. Ctrl/⌘ + Shift + D liga (botão laranja) e desliga.
2. Com o modo ligado, o mouse sobre um card de prospect mostra contorno laranja e etiqueta como `CardProspect ← GradeProspects · 280×120`. Se aparecer algum nome interno do Next/React na etiqueta, acrescente-o a `INTERNOS` em `nucleo.ts` (Task 2) e rode os testes de novo.
3. Clicar no card **não** navega; abre a caixa ao lado. Escrever "teste 1" e apertar Ctrl/⌘ + Enter: aparece o pino "1" no canto superior direito do card e o botão mostra "1".
4. Comentar um segundo bloco ("teste 2"). Recarregar a página: o modo continua ligado e os dois pinos voltam ao lugar.
5. **Review Focus 5:** com o modo ligado e o mouse parado, abrir o monitor de desempenho do navegador. A CPU fica parada, sem re-renderização contínua.
6. **Review Focus 3:** abrir a caixa num bloco novo, escrever e apertar Ctrl/⌘ + Enter duas vezes rápido. Sai um comentário só (a trava `salvando`).
7. "Lista" mostra os dois. Editar o #1 muda o texto. Marcar "todas as páginas" e abrir um prospect: os comentários da home aparecem com a página, e "Editar" abre a caixa sem contorno.
8. Numa aba da área de trabalho, comentar um bloco, trocar de aba: o comentário aparece na lista como "elemento não encontrado", sem pino.
9. Parar o `next dev` e tentar salvar: aparece um toast de erro e o texto continua na caixa.
10. Em `src/`: `npm run dev:comentarios`. O resumo mostra os comentários com o caminho absoluto dos PNGs; abrir um PNG e conferir que é o bloco comentado, sem contorno nem pino.
11. `npm run dev:comentarios -- --limpar` e recarregar: nenhum pino.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web/components/modo-dev src/apps/web/app/layout.tsx
git commit -m "feat(web): interface do modo dev de comentários

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Garantir que nada vai para produção

**Files:**
- Modify (só se o Step 2 falhar): `src/apps/web/next.config.ts`; Create: `src/apps/web/components/modo-dev/vazio.tsx`

**Interfaces:**
- Consumes: layout e componentes da Task 8; rotas da Task 6.

- [ ] **Step 1: Build de produção**

Run (em `src/`): `npm run build -w web`
Expected: build conclui sem erro.

- [ ] **Step 2: Procurar o código do modo dev no bundle**

Run (em `src/apps/web/`): `grep -rlE "data-modo-dev|elemento não encontrado|modo-dev:ativo" .next/static; echo "saida: $?"`
Expected: nenhum arquivo listado e `saida: 1` (o grep não achou nada).

Se aparecer algum arquivo, aplicar a alternativa e repetir os Steps 1 e 2:

Criar `src/apps/web/components/modo-dev/vazio.tsx`:

```tsx
// Substitui o carregador do modo dev no build de produção (ver next.config.ts).
export function CarregadorModoDev() {
  return null
}
```

Em `src/apps/web/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  // `trash` chama um binário do macOS pelo caminho do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["trash"],
  // Modo dev de comentários: no build de produção o carregador vira um componente vazio.
  ...(process.env.NODE_ENV === "production"
    ? { turbopack: { resolveAlias: { "@/components/modo-dev/carregador": "./components/modo-dev/vazio.tsx" } } }
    : {}),
}
```

- [ ] **Step 3: A rota responde 404 no servidor de produção**

Run (em `src/apps/web/`, em background): `npx next start --hostname 127.0.0.1 -p 3999`
Depois: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3999/api/dev/comentarios`
Expected: `404`. Encerrar o servidor da porta 3999.

- [ ] **Step 4: Commit (só se a alternativa do Step 2 foi aplicada)**

```bash
git add src/apps/web/next.config.ts src/apps/web/components/modo-dev/vazio.tsx
git commit -m "fix(web): modo dev fora do bundle de produção

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Se nenhum arquivo mudou, registrar no relatório da tarefa: "build verificado, nada do modo dev em .next/static, rota 404 em produção".

---

### Task 10: Skill do agente e aviso no CLAUDE.md

**Files:**
- Create: `.claude/skills/dev-comentarios/SKILL.md`
- Modify: `CLAUDE.md` (raiz, fim do arquivo)

**Interfaces:**
- Consumes: `npm run dev:comentarios` (Task 7), formato do resumo (Task 4).

- [ ] **Step 1: Escrever a skill**

Criar `.claude/skills/dev-comentarios/SKILL.md`:

````markdown
---
name: dev-comentarios
description: Executa os ajustes de interface que o desenvolvedor marcou na tela com o modo dev de comentários (pinos numerados no app web em src/apps/web) e apaga os resolvidos. Use quando o desenvolvedor pedir para ler ou resolver os comentários do modo dev, fazer os ajustes marcados na tela, ou citar .dev-comentarios. Ferramenta de desenvolvimento da interface; não é etapa do planejamento (01→09).
---

# Comentários do modo dev

O desenvolvedor roda o app (`npm run dev` em `src/`), liga o modo dev (botão "Dev" no canto inferior esquerdo ou Ctrl/⌘ + Shift + D), aponta blocos da tela e escreve ajustes. Cada comentário fica em `.dev-comentarios/` na raiz do repositório, com página, cadeia de componentes, seletor CSS, texto visível e um recorte PNG.

Seu trabalho: executar os ajustes e deixar a lista só com o que ficou pendente.

Isto não é uma etapa do planejamento estratégico. Não se aplicam `regras-de-validacao.md`, checkpoints nem o handoff da Regra 6.

## 1. Ler

Em `src/`, rode:

```bash
npm run dev:comentarios
```

Abra cada PNG da linha `recorte:` com a ferramenta Read, para ver o que o desenvolvedor viu. Comentário sem recorte: use o texto visível e o seletor.

## 2. Localizar

- O primeiro nome depois de `#N ·` é o componente mais próximo do bloco. Ache o arquivo:
  `grep -rn "function NomeDoComponente" src/apps/web --include=*.tsx`
- Confirme com o resto da cadeia (quem renderiza quem), o `seletor` (`data-slot`, `aria-label`, ids) e o `texto` visível.
- "(componente não identificado)": procure pelo texto visível (`grep -rn "trecho do texto" src/apps/web`) e pela página (`src/apps/web/app/<página>/page.tsx`).
- Os componentes genéricos de `src/packages/ui` (Button, Card, Dialog…) ficam fora da cadeia de propósito: o ajuste quase sempre é no componente do app que os usa. Só mexa em `packages/ui` se o pedido for sobre o componente genérico no app inteiro.

## 3. Planejar

Agrupe por página e escreva para o desenvolvedor uma linha por comentário: número, arquivo e o que muda.

Pergunte antes de executar só quando o pedido for ambíguo (dá para entender de dois jeitos) ou mudar regra de negócio (fluxo das etapas, validações, dados gravados). Ajustes visuais e de texto seguem direto.

## 4. Executar e verificar

- Siga os padrões do projeto: Tailwind, componentes de `@workspace/ui`, nomes e textos em português.
- Em `src/`, rode `npm run typecheck`, `npm run lint` e `npm test`. Corrija o que quebrar antes de seguir.
- Faça um commit por grupo de ajustes (normalmente um por página), no padrão do repositório. Exemplo: `fix(web): espaçamento do painel da etapa (modo dev #1, #3)`.

## 5. Limpar

Logo depois de verificar e commitar, apague **sem perguntar** os comentários resolvidos:

```bash
npm run dev:comentarios -- --limpar 1,3
```

Se algum ficou pendente, nunca use `--limpar` sem números. No fim, diga quais ficaram e por quê, e peça para o desenvolvedor recarregar a página e conferir os ajustes.
````

- [ ] **Step 2: Aviso no CLAUDE.md**

No fim de `CLAUDE.md` (raiz), acrescentar:

```markdown

## Ferramenta de desenvolvimento da interface

A skill `dev-comentarios` executa os ajustes de interface marcados com o modo dev
do app web (`.dev-comentarios/`, `npm run dev:comentarios` em `src/`). Ela não
faz parte da sequência 01→09 e não segue os rituais de checagem do planejamento.
```

- [ ] **Step 3: Conferir que a skill é reconhecida**

Run: `head -5 .claude/skills/dev-comentarios/SKILL.md`
Expected: frontmatter com `name: dev-comentarios` e `description:` numa linha só.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/dev-comentarios/SKILL.md CLAUDE.md
git commit -m "docs: skill dev-comentarios com o roteiro do agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] Em `src/`: `npm run typecheck && npm run lint && npm test` — tudo verde.
- [ ] `git status` limpo; `.dev-comentarios/` não aparece (está no `.gitignore`).
- [ ] Critérios de sucesso da spec, um a um: pino numerado com `next dev` (Task 8, Step 5); comentário com página, componente, cadeia, texto e recorte (Task 8, Step 5, item 10); nada no bundle e 404 em produção (Task 9); script lista e limpa (Task 7).
