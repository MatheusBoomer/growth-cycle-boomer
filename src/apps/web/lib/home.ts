import type { ResumoProspect } from "@workspace/core/tipos"

const instante = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? -Infinity : t
}

/** "Continue de onde parou": o prospect em andamento (com etapa atual) mexido por último; null se não houver. */
export function continuarDeOndeParou(lista: ResumoProspect[]): ResumoProspect | null {
  let melhor: ResumoProspect | null = null
  for (const p of lista) {
    if (p.etapaAtual === null) continue
    if (melhor === null || instante(p.atualizadoEm) > instante(melhor.atualizadoEm)) melhor = p
  }
  return melhor
}

/** Números do bento: em andamento e concluídos (pela etapa atual) e as aprovações esperando, somadas. */
export function numerosDaHome(lista: ResumoProspect[]): { emAndamento: number; concluidos: number; aprovacoes: number; comAprovacao: ResumoProspect[] } {
  const comAprovacao = lista.filter((p) => p.pendencias > 0)
  const emAndamento = lista.filter((p) => p.etapaAtual !== null).length
  return {
    emAndamento,
    concluidos: lista.length - emAndamento,
    aprovacoes: comAprovacao.reduce((soma, p) => soma + p.pendencias, 0),
    comAprovacao,
  }
}

/** "04 · Unidade econômica" → número e título; rótulo sem número ("Apresentação final") fica só com o título. */
export function partesDoRotulo(rotulo: string): { numero: string | null; titulo: string } {
  const m = /^(\d+)\s*·\s*(.+)$/.exec(rotulo.trim())
  return m ? { numero: m[1]!, titulo: m[2]! } : { numero: null, titulo: rotulo.trim() }
}
