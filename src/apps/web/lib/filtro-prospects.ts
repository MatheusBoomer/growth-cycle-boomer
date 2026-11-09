import type { EtapaId, ResumoProspect } from "@workspace/core/tipos"
import { ORDEM_ETAPAS } from "@workspace/core/tipos"
import { normalizarEmail } from "@workspace/core/papeis"

export interface FiltroProspects {
  busca: string
  /** E-mails dos donos aceitos; vazio = todos. "Meus" na tela é `[email]`. */
  donos: string[]
  /** Etapas atuais aceitas; vazio = todas. */
  etapas: EtapaId[]
  /** Só quem tem aprovação pendente. */
  soPendentes: boolean
  /** E-mail de quem está usando a tela; não filtra sozinho (a tela o usa para montar `donos`). */
  email: string | null
}

export type Ordem = "atividade" | "nome" | "etapa"

/** Minúsculas e sem acento, para comparar nomes sem ligar para a grafia. */
function simplificar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** Filtros da home: busca por nome, dono, etapa e pendência. Puro, para testar sem tela. */
export function filtrarProspects(lista: ResumoProspect[], { busca, donos, etapas, soPendentes }: FiltroProspects): ResumoProspect[] {
  const termo = simplificar(busca.trim())
  const donosAceitos = new Set(donos.map(normalizarEmail))
  const etapasAceitas = new Set<EtapaId>(etapas)
  return lista.filter((p) => {
    if (!simplificar(p.nome).includes(termo)) return false
    if (donosAceitos.size > 0 && (p.dono === null || !donosAceitos.has(normalizarEmail(p.dono)))) return false
    if (etapasAceitas.size > 0 && (p.etapaAtual === null || !etapasAceitas.has(p.etapaAtual))) return false
    if (soPendentes && p.pendencias <= 0) return false
    return true
  })
}

/** Posição da etapa atual na ordem do fluxo; concluído (sem etapa atual) vai para o fim. */
function posicaoDaEtapa(p: ResumoProspect): number {
  return p.etapaAtual === null ? ORDEM_ETAPAS.length : ORDEM_ETAPAS.indexOf(p.etapaAtual)
}

/** Ordena sem alterar a entrada; `Array.sort` é estável, então empates mantêm a ordem recebida. */
export function ordenarProspects(lista: ResumoProspect[], ordem: Ordem): ResumoProspect[] {
  const copia = [...lista]
  switch (ordem) {
    case "nome":
      return copia.sort((a, b) => simplificar(a.nome).localeCompare(simplificar(b.nome), "pt-BR"))
    case "etapa":
      return copia.sort((a, b) => posicaoDaEtapa(a) - posicaoDaEtapa(b))
    case "atividade":
      return copia.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  }
}

/** Concluído = sem etapa atual. Mantém a ordem recebida dentro de cada grupo. */
export function separarPorSituacao(lista: ResumoProspect[]): { emAndamento: ResumoProspect[]; concluidos: ResumoProspect[] } {
  return {
    emAndamento: lista.filter((p) => p.etapaAtual !== null),
    concluidos: lista.filter((p) => p.etapaAtual === null),
  }
}
