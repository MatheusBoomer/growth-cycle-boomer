import path from "node:path"

/** Linha curta mostrada no chat ("Lendo dados/historico-mensal.xlsx"). null = não mostrar. */
export function descreverAtividade(nome: string, entrada: unknown, raiz: string): { nome: string; detalhe: string } | null {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>
  const rel = (p: unknown) => (typeof p === "string" ? (path.isAbsolute(p) ? path.relative(raiz, p) : p) : "")
  if (nome.startsWith("mcp__planejamento__") || nome === "TodoWrite") return null
  if (nome === "Skill") return { nome, detalhe: `Usando a skill ${String(e.skill ?? e.command ?? "")}`.trim() }
  if (nome === "Agent" || nome === "Task") return { nome, detalhe: `Acionando o subagente ${String(e.subagent_type ?? "")}`.trim() }
  if (nome === "Read") return { nome, detalhe: `Lendo ${rel(e.file_path)}` }
  if (nome === "Write" || nome === "Edit" || nome === "MultiEdit") return { nome, detalhe: `Escrevendo ${rel(e.file_path)}` }
  if (nome === "Bash") return { nome, detalhe: `Rodando: ${String(e.command ?? "").slice(0, 80)}` }
  if (nome === "Glob" || nome === "Grep") return { nome, detalhe: "Procurando arquivos" }
  if (nome.startsWith("mcp__firecrawl") || nome === "WebSearch" || nome === "WebFetch") return { nome, detalhe: "Pesquisando na web" }
  if (nome.includes("Canva")) return { nome, detalhe: "Trabalhando no Canva" }
  return { nome, detalhe: nome }
}
