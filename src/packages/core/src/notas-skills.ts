/**
 * Nota de melhoria de uma skill, regra ou subagente do catálogo, e o texto de exportação das notas abertas.
 * Sem imports de `node:`, porque componentes de cliente importam este módulo.
 */
import { nomeCurto } from "./autenticacao"

export interface NotaSkill {
  id: number
  /** Id do item do catálogo (ex.: `etapa:03`). */
  item: string
  texto: string
  autor: string
  criadaEm: string
  resolvidaEm: string | null
  resolvidaPor: string | null
}

export const LIMITE_TEXTO_NOTA = 2000

const SEM_NOTAS = "Nenhuma nota aberta."

function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
}

/**
 * Notas abertas agrupadas por item, na ordem de `itens` (`## <título>` e uma linha `- <texto> (<autor>, <dd/mm>)` por
 * nota, na ordem recebida). Notas resolvidas e de itens fora de `itens` ficam de fora.
 */
export function textoNotasAbertas(notas: NotaSkill[], itens: Array<{ id: string; titulo: string }>): string {
  const blocos: string[] = []
  for (const item of itens) {
    const abertas = notas.filter((n) => n.item === item.id && n.resolvidaEm === null)
    if (abertas.length === 0) continue
    const linhas = abertas.map((n) => `- ${n.texto} (${nomeCurto(n.autor)}, ${diaMes(n.criadaEm)})`)
    blocos.push(`## ${item.titulo}\n${linhas.join("\n")}`)
  }
  return blocos.length === 0 ? SEM_NOTAS : blocos.join("\n\n")
}
