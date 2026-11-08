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

/** Um aviso de presença: o navegador de uma pessoa avisando, a cada 30 s, que a tela está aberta numa etapa. */
export interface LinhaPresenca {
  slug: string
  email: string
  etapa: EtapaId
  em: string
  visivel: boolean
  segundosSemInteracao: number
}

/** Limites, em minutos: sem interação por `ociosoMin` vira ocioso; ocioso por `descarteMin` seguidos vira descartado. */
export interface Limites {
  ociosoMin: number
  descarteMin: number
}

export type Categoria = "agente" | "ativo" | "ocioso" | "descartado"

/** Um bloco de 30 s, alinhado ao relógio, de uma pessoa numa etapa de um projeto. */
export interface BlocoClassificado {
  slug: string
  email: string
  etapa: EtapaId
  bloco: number
  categoria: Categoria
}

export interface TempoSegundos {
  agente: number
  ativo: number
  ocioso: number
  descartado: number
}
