/**
 * Tipos do catálogo de skills. Sem imports de `node:`, porque componentes de cliente importam este módulo.
 */

export type GrupoSkill = "Processo" | "Etapas" | "Subagentes" | "Regras compartilhadas"

/** Grupos na ordem em que aparecem no catálogo. */
export const GRUPOS_SKILL: readonly GrupoSkill[] = ["Processo", "Etapas", "Subagentes", "Regras compartilhadas"]

export interface ItemCatalogo {
  id: string
  grupo: GrupoSkill
  titulo: string
  resumo: string
  /** Verdadeiro quando a entrada tem caminho de fluxo, mesmo que o arquivo esteja ausente. */
  temFluxo: boolean
}

export interface ConteudoItem extends ItemCatalogo {
  texto: string | null
  fluxo: string | null
}

export const ID_VISAO_GERAL = "visao-geral"

export const SUBAGENTES_DO_CATALOGO = ["analista-dados", "pesquisador-benchmark"] as const

export const REGRAS_DO_CATALOGO = [
  { id: "regra:padrao-visual", arquivo: "padrao-visual", titulo: "Padrão visual" },
  { id: "regra:regras-de-validacao", arquivo: "regras-de-validacao", titulo: "Regras de validação" },
  { id: "regra:repertorio-solucoes", arquivo: "repertorio-solucoes", titulo: "Repertório de soluções" },
] as const
