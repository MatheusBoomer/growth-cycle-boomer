import { readFileSync } from "node:fs"
import path from "node:path"
import type { DefinicaoAgente } from "./tipos"

/**
 * Lê `.claude/agents/<nome>.md` e devolve a definição no formato do `agents` do SDK.
 * O cabeçalho YAML só precisa das chaves de uma linha `description:` e `tools:`;
 * o corpo do arquivo (sem o cabeçalho) é o prompt do subagente.
 */
export function lerDefinicaoSubagente(raiz: string, nome: string): DefinicaoAgente {
  const arquivo = `${nome}.md`
  const texto = readFileSync(path.join(raiz, ".claude", "agents", arquivo), "utf8").replace(/\r\n/g, "\n")
  const achado = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto)
  if (!achado) throw new Error(`${arquivo}: falta o cabeçalho entre "---"`)
  const cabecalho = achado[1] ?? ""
  const corpo = achado[2] ?? ""

  const chave = (nomeChave: string): string => {
    const linha = new RegExp(`^${nomeChave}:[ \\t]*(.*)$`, "m").exec(cabecalho)
    return (linha?.[1] ?? "").trim()
  }
  const description = chave("description")
  if (!description) throw new Error(`${arquivo}: falta "description" no cabeçalho`)
  const tools = chave("tools")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "")
  if (tools.length === 0) throw new Error(`${arquivo}: falta "tools" no cabeçalho`)

  return { description, prompt: corpo.trim(), tools }
}
