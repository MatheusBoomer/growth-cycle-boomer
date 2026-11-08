import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Validação estrutural de reserva dos 13 fluxogramas do catálogo de skills.
// A Task 6 troca por `mermaid.parse` quando o `mermaid` estiver instalado no web.

const RAIZ = path.resolve(import.meta.dirname, "../../../..")

const FLUXOS = [
  ".claude/skills/_shared/fluxo-geral.mmd",
  ".claude/skills/01-preparacao-de-contexto/fluxo.mmd",
  ".claude/skills/02-contextualizacao-estrategica/fluxo.mmd",
  ".claude/skills/03-diagnostico-performance/fluxo.mmd",
  ".claude/skills/04-unidade-economica/fluxo.mmd",
  ".claude/skills/05-solucoes/fluxo.mmd",
  ".claude/skills/06-metas-e-cenarios/fluxo.mmd",
  ".claude/skills/07-briefing-e-benchmark/fluxo.mmd",
  ".claude/skills/08-midia-paga/fluxo.mmd",
  ".claude/skills/09-plano-de-acao/fluxo.mmd",
  ".claude/skills/10-apresentacao-final/fluxo.mmd",
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

describe("fluxogramas do catálogo de skills", () => {
  it.each(FLUXOS)("%s passa na validação estrutural", (arquivo) => {
    const codigo = readFileSync(path.join(RAIZ, arquivo), "utf8")
    expect(validar(codigo)).toEqual([])
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
