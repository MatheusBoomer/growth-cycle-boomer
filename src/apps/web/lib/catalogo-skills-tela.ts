import { nomeCurto } from "@workspace/core/autenticacao"
import { GRUPOS_SKILL, type GrupoSkill } from "@workspace/core/catalogo-skills-tipos"
import type { NotaSkill } from "@workspace/core/notas-skills"
import { ErroApi, type ItemSkill } from "./api"

/** Itens agrupados na ordem de `GRUPOS_SKILL`, mantendo a ordem recebida dentro de cada grupo. Grupo vazio não aparece. */
export function agruparPorGrupo(itens: ItemSkill[]): Array<{ grupo: GrupoSkill; itens: ItemSkill[] }> {
  return GRUPOS_SKILL.map((grupo) => ({ grupo, itens: itens.filter((i) => i.grupo === grupo) })).filter((g) => g.itens.length > 0)
}

export function rotuloResolvidas(quantidade: number): string {
  return `Resolvidas (${quantidade})`
}

/** Abertas das mais novas às mais antigas (por criação); resolvidas das resolvidas há menos tempo às há mais tempo. */
export function separarNotas(notas: NotaSkill[]): { abertas: NotaSkill[]; resolvidas: NotaSkill[] } {
  const mais = (a: string, b: string) => Date.parse(b) - Date.parse(a)
  const abertas = notas.filter((n) => n.resolvidaEm === null).sort((a, b) => mais(a.criadaEm, b.criadaEm))
  const resolvidas = notas.filter((n) => n.resolvidaEm !== null).sort((a, b) => mais(a.resolvidaEm!, b.resolvidaEm!))
  return { abertas, resolvidas }
}

/** `Ana Silva · 07/11`: autor e dia/mês de criação, no fuso de São Paulo. */
export function rotuloAutorEData(nota: NotaSkill): string {
  const data = new Date(nota.criadaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
  return `${nomeCurto(nota.autor)} · ${data}`
}

const FRONTMATTER = /^---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)\s*/

/** Tira o bloco YAML (`---` ... `---`) do começo do texto dos subagentes. Sem bloco fechado, devolve o texto como veio. */
export function semFrontmatter(texto: string): string {
  return texto.replace(FRONTMATTER, "")
}

/** Texto que as rotas de notas devolvem (400) no modo fs, onde só existe o repositório de arquivos. */
export const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

export function ehErroSemNuvem(e: unknown): boolean {
  return e instanceof ErroApi && e.status === 400 && e.message === MSG_SEM_NUVEM
}
