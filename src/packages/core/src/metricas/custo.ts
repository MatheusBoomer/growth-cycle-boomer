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
    if (u.sessao) {
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
    if (!u.sessao || !u.autor) continue
    const email = normalizarEmail(u.autor)
    porPessoa.set(email, arredondar((porPessoa.get(email) ?? 0) + (u.custoTurnoUsd ?? 0)))
  }
  return porPessoa
}
