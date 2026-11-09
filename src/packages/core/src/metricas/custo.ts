import { normalizarEmail } from "../papeis"
import type { EtapaId } from "../tipos"
import type { Acumulado, CustoEtapa, LinhaUso } from "./tipos"

function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000
}

/**
 * O acumulado do SDK vale para a conversa inteira. O custo do turno é a diferença
 * para o acumulado do turno anterior da mesma conversa. Se o acumulado caiu, a
 * conversa recomeçou a contagem e o turno vale o valor atual.
 */
function diferenca(atual: number, anterior: number | null | undefined): number {
  if (anterior == null || atual < anterior) return arredondar(atual)
  return arredondar(atual - anterior)
}

export function custoDoTurno(
  atual: Acumulado,
  anterior: Acumulado | null,
): { custoTurnoUsd: number | null; modelos: Record<string, number> | null } {
  const custoTurnoUsd = atual.custoUsd == null ? null : diferenca(atual.custoUsd, anterior?.custoUsd)
  let modelos: Record<string, number> | null = null
  if (atual.modelos) {
    modelos = {}
    for (const [modelo, valor] of Object.entries(atual.modelos)) {
      modelos[modelo] = diferenca(valor, anterior?.modelos?.[modelo])
    }
  }
  return { custoTurnoUsd, modelos }
}

/**
 * Linha do custo por turno: tem sessão ou custo do turno. Só a que não tem nenhum dos dois é antiga, de antes do custo
 * por turno, e vale pelo acumulado estimado. (Um turno novo sem sessão ainda traz o custo do turno.)
 */
function ehLinhaNova(u: LinhaUso): boolean {
  return u.sessao != null || u.custoTurnoUsd != null
}

export function custoPorEtapa(usos: LinhaUso[]): Map<EtapaId, CustoEtapa> {
  const novos = new Map<EtapaId, CustoEtapa>()
  const maxAntigo = new Map<EtapaId, number>()

  for (const u of usos) {
    let etapa = novos.get(u.etapa)
    if (!etapa) {
      etapa = { usd: 0, estimado: false, turnos: 0, modelos: {} }
      novos.set(u.etapa, etapa)
    }
    etapa.turnos += 1
    if (ehLinhaNova(u)) {
      etapa.usd += u.custoTurnoUsd ?? 0
      for (const [modelo, valor] of Object.entries(u.modelos ?? {})) {
        etapa.modelos[modelo] = (etapa.modelos[modelo] ?? 0) + valor
      }
    } else {
      etapa.estimado = true
      maxAntigo.set(u.etapa, Math.max(maxAntigo.get(u.etapa) ?? 0, u.custoUsd ?? 0))
    }
  }

  for (const [id, etapa] of novos) {
    etapa.usd = arredondar(etapa.usd + (maxAntigo.get(id) ?? 0))
    for (const [modelo, valor] of Object.entries(etapa.modelos)) etapa.modelos[modelo] = arredondar(valor)
  }
  return novos
}

export function custoPorPessoa(usos: LinhaUso[]): Map<string, number> {
  const porPessoa = new Map<string, number>()
  for (const u of usos) {
    if (!ehLinhaNova(u) || !u.autor) continue
    const email = normalizarEmail(u.autor)
    porPessoa.set(email, arredondar((porPessoa.get(email) ?? 0) + (u.custoTurnoUsd ?? 0)))
  }
  return porPessoa
}

/** Um custo com data: um turno novo, ou o grupo de linhas antigas de um projeto e etapa. */
export interface CustoDatado {
  slug: string
  etapa: string
  autor: string | null
  /** Instante (ISO) em que o custo conta: o fim do turno, ou o maior fim do grupo antigo. */
  quando: string
  usd: number
  modelos: Record<string, number>
  estimado: boolean
}

function depoisDe(candidato: string, atual: string): boolean {
  const ms = Date.parse(candidato)
  const atualMs = Date.parse(atual)
  return !Number.isNaN(ms) && (Number.isNaN(atualMs) || ms > atualMs)
}

/**
 * Custos datados, para séries no tempo. Cada linha nova vira uma entrada no seu `fim`. As linhas antigas de um mesmo
 * (projeto, etapa) viram uma só, estimada, no maior `fim` do grupo, com o maior acumulado e os modelos dessa linha.
 * Para cada (projeto, etapa), a soma de `usd` bate com `custoPorEtapa`.
 */
export function custosPorTurno(usos: LinhaUso[]): CustoDatado[] {
  const novos: CustoDatado[] = []
  const antigos = new Map<string, CustoDatado>()

  for (const u of usos) {
    if (ehLinhaNova(u)) {
      novos.push({
        slug: u.slug,
        etapa: u.etapa,
        autor: u.autor,
        quando: u.fim,
        usd: u.custoTurnoUsd ?? 0,
        modelos: { ...(u.modelos ?? {}) },
        estimado: false,
      })
      continue
    }
    const chave = JSON.stringify([u.slug, u.etapa])
    const custo = u.custoUsd ?? 0
    const grupo = antigos.get(chave)
    if (!grupo) {
      antigos.set(chave, {
        slug: u.slug,
        etapa: u.etapa,
        autor: u.autor,
        quando: u.fim,
        usd: custo,
        modelos: { ...(u.modelos ?? {}) },
        estimado: true,
      })
      continue
    }
    if (depoisDe(u.fim, grupo.quando)) grupo.quando = u.fim
    if (custo > grupo.usd) {
      grupo.usd = custo
      grupo.autor = u.autor
      grupo.modelos = { ...(u.modelos ?? {}) }
    }
  }
  return [...novos, ...antigos.values()]
}
