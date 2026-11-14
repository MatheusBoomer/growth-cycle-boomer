// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Validação dos 13 fluxogramas do catálogo de skills: o parser do Mermaid (roda no jsdom) e, além dele, a validação
// estrutural, que também confere a convenção de checkpoint e a ausência de travessão, coisas que o parser não vê.

const RAIZ = path.resolve(import.meta.dirname, "../../../..")

const FLUXOS = [
  ".claude/skills/_shared/fluxo-geral.mmd",
  ".claude/skills/01-preparacao-de-contexto/fluxo.mmd",
  ".claude/skills/02-contextualizacao-estrategica/fluxo.mmd",
  ".claude/skills/03-diagnostico-performance/fluxo.mmd",
  ".claude/skills/04-unidade-economica/fluxo.mmd",
  ".claude/skills/05-solucoes/fluxo.mmd",
  ".claude/skills/06-metas-e-cenarios/fluxo.mmd",
  ".claude/skills/07-midia-paga/fluxo.mmd",
  ".claude/skills/08-plano-de-acao/fluxo.mmd",
  ".claude/skills/09-apresentacao-final/fluxo.mmd",
  ".claude/skills/10-revisao-pos-apresentacao/fluxo.mmd",
  ".claude/agents/analista-dados.fluxo.mmd",
  ".claude/agents/pesquisador-benchmark.fluxo.mmd",
]

const TRAVESSAO = "\u2014"

const CLASSDEFS = [
  "classDef checkpoint fill:#fff1e6,stroke:#e8803a,color:#7a3d0c",
  "classDef subagente fill:#e8f0fd,stroke:#1f4fa8,color:#173a7a",
  "classDef entrega fill:#e6f6ec,stroke:#16743b,color:#0f4f28",
]

/** Nó declarado com rótulo: `id[...]`, `id{...}`, `id(...)`, `id([...])` etc. */
const DECLARACAO = /\b([A-Za-z0-9_]+)\s*(\[\[|\[\(|\[\/|\[|\(\[|\(\(|\(|\{\{|\{|>)/g

/** Rótulos entre colchetes ou chaves; cada um precisa começar e terminar com aspas. */
const ROTULO = /\b[A-Za-z0-9_]+\s*(?:\[([^\]]*)\]|\{([^}]*)\})/g

function semComentarios(codigo: string): string[] {
  return codigo
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("%%"))
}

function validar(codigo: string): string[] {
  const erros: string[] = []
  const linhas = semComentarios(codigo)
  if (linhas[0] !== "flowchart TD") erros.push("a primeira linha não é flowchart TD")
  for (const c of CLASSDEFS) if (!codigo.includes(c)) erros.push(`falta ${c}`)
  if (codigo.includes(TRAVESSAO)) erros.push("tem travessão")

  const declarados = new Set<string>()
  const usados = new Set<string>()
  for (const linha of linhas) {
    if (/^(flowchart|classDef|class|style|linkStyle|subgraph|end\b|direction)/.test(linha)) {
      const sg = /^subgraph\s+([A-Za-z0-9_]+)/.exec(linha)
      if (sg) declarados.add(sg[1]!)
      continue
    }
    // Tira os textos entre aspas (rótulos de nó e de aresta) antes de procurar ids.
    const semTexto = linha.replace(/"[^"]*"/g, '""')
    for (const m of linha.matchAll(ROTULO)) {
      const rotulo = (m[1] ?? m[2] ?? "").trim()
      if (!/^"[^"]*"$/.test(rotulo)) erros.push(`rótulo sem aspas: ${m[0]}`)
    }
    for (const m of semTexto.matchAll(DECLARACAO)) declarados.add(m[1]!)
    if (semTexto.includes("--")) {
      const partes = semTexto.split(/-->|-\.->|==>|---/)
      for (const parte of partes) {
        const limpa = parte.replace(/\|""\|/g, "").replace(/:::\w+/g, "").trim()
        const id = /^([A-Za-z0-9_]+)/.exec(limpa)?.[1]
        if (id) usados.add(id)
      }
    }
  }
  for (const id of usados) if (!declarados.has(id)) erros.push(`id sem rótulo: ${id}`)
  return erros
}


/** Nós com a classe `checkpoint`, por `class a,b checkpoint` ou `id:::checkpoint`. */
function comClasseCheckpoint(linhas: string[]): Set<string> {
  const ids = new Set<string>()
  for (const l of linhas) {
    const m = /^class\s+([A-Za-z0-9_,\s]+?)\s+checkpoint$/.exec(l)
    if (m) for (const id of m[1]!.split(",")) ids.add(id.trim())
    for (const n of l.matchAll(/\b([A-Za-z0-9_]+)(?:\[[^\]]*\]|\{[^}]*\})?:::checkpoint\b/g)) ids.add(n[1]!)
  }
  return ids
}

/** Erros da convenção de checkpoint: só o losango "Analista aprova?" é laranja, com saídas sim e não, ajustar. */
function validarCheckpoints(codigo: string): string[] {
  const erros: string[] = []
  const linhas = semComentarios(codigo)
  const aprova = new Set<string>()
  const losangos = new Set<string>()
  for (const l of linhas) {
    for (const m of l.matchAll(/\b([A-Za-z0-9_]+)\s*\{"([^"]*)"\}/g)) {
      losangos.add(m[1]!)
      if (m[2] === "Analista aprova?") aprova.add(m[1]!)
    }
  }
  const classe = comClasseCheckpoint(linhas)
  for (const id of aprova) {
    if (!classe.has(id)) erros.push(`${id}: Analista aprova? sem classe checkpoint`)
    const saidas = linhas
      .map((l) => new RegExp(`^${id}\\s*-->\\|"([^"]*)"\\|`).exec(l)?.[1])
      .filter((x): x is string => x !== undefined)
      .sort()
    if (JSON.stringify(saidas) !== JSON.stringify(["não, ajustar", "sim"]))
      erros.push(`${id}: saídas ${JSON.stringify(saidas)}`)
  }
  for (const id of classe) if (!losangos.has(id)) erros.push(`${id}: classe checkpoint fora de decisão`)
  return erros
}

describe("fluxogramas do catálogo de skills", () => {
  it.each(FLUXOS)("%s é aceito pelo parser do Mermaid", async (arquivo) => {
    const { default: mermaid } = await import("mermaid")
    const codigo = readFileSync(path.join(RAIZ, arquivo), "utf8")
    await expect(mermaid.parse(codigo)).resolves.toMatchObject({ diagramType: "flowchart-v2" })
  })

  it("o parser do Mermaid recusa sintaxe quebrada", async () => {
    const { default: mermaid } = await import("mermaid")
    await expect(mermaid.parse('flowchart TD\nA["sem fecha --> ')).rejects.toThrow()
  })

  it.each(FLUXOS)("%s passa na validação estrutural", (arquivo) => {
    const codigo = readFileSync(path.join(RAIZ, arquivo), "utf8")
    expect(validar(codigo)).toEqual([])
  })

  it.each(FLUXOS)("%s segue a convenção de checkpoint", (arquivo) => {
    const codigo = readFileSync(path.join(RAIZ, arquivo), "utf8")
    expect(validarCheckpoints(codigo)).toEqual([])
  })

  it("a convenção de checkpoint pega saída errada, classe faltando e classe em retângulo", () => {
    const ruim = [
      "flowchart TD",
      'A["passo"] --> C{"Analista aprova?"}',
      'C -->|"sim, com prioridade"| B["próximo"]',
      'C -->|"não, ajustar"| A',
      'N["nota"]',
      "class N checkpoint",
      ...CLASSDEFS,
    ].join("\n")
    expect(validarCheckpoints(ruim)).toEqual([
      "C: Analista aprova? sem classe checkpoint",
      'C: saídas ["não, ajustar","sim, com prioridade"]',
      "N: classe checkpoint fora de decisão",
    ])
  })

  it("o validador pega rótulo sem aspas, id sem rótulo e travessão", () => {
    const ruim = ["flowchart TD", "A[Sem aspas] --> B", `C["ok ${TRAVESSAO} não"]`, ...CLASSDEFS].join("\n")
    const erros = validar(ruim)
    expect(erros).toContain("rótulo sem aspas: A[Sem aspas]")
    expect(erros).toContain("id sem rótulo: B")
    expect(erros).toContain("tem travessão")
  })

  it("o validador aceita acento, parênteses e barra dentro das aspas", () => {
    const bom = ["flowchart TD", 'A["Curva ABC (A/B/C) · ação"] -->|"sim"| B{"Analista aprova?"}', ...CLASSDEFS].join("\n")
    expect(validar(bom)).toEqual([])
  })
})
