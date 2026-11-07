import type { EtapaId } from "../tipos"

/** Uma linha de uso de IA: um turno do agente numa etapa de um projeto. */
export interface LinhaUso {
  slug: string
  etapa: EtapaId
  autor: string | null
  /** Conversa (sessão do SDK) do turno. Nulo nas linhas antigas, anteriores ao custo por turno. */
  sessao: string | null
  /** Custo acumulado da conversa até o fim deste turno, como o SDK reporta. */
  custoUsd: number | null
  /** Custo do turno em si, derivado do acumulado. */
  custoTurnoUsd: number | null
  /** Custo do turno por modelo. */
  modelos: Record<string, number> | null
  inicio: string
  fim: string
}

export interface CustoEtapa {
  usd: number
  /** Verdadeiro quando há linhas antigas, cujo custo foi estimado pelo maior acumulado. */
  estimado: boolean
  turnos: number
  modelos: Record<string, number>
}

/** Custo acumulado de uma conversa, total e por modelo. */
export interface Acumulado {
  custoUsd: number | null
  modelos: Record<string, number> | null
}
