import { entregavelVisivel, TIPOS_VISUALIZADOR } from "@workspace/core/entregaveis"
import { etapaDaConversa } from "@workspace/core/validacao-cliente"
import type { Entregavel, EtapaId, TipoEntregavel } from "@workspace/core/tipos"

/**
 * Entregáveis cujo card aparece na conversa da etapa. Um da 03 proposto a partir da conversa da 04
 * (`etapa: "03"`, `etapaConversa: "04"`) pertence à conversa da 04.
 */
export function entregaveisDaConversa(entregaveis: Entregavel[], etapa: EtapaId): Entregavel[] {
  return entregaveis.filter((e) => etapaDaConversa(e) === etapa)
}

/**
 * O visualizador lateral guarda a etapa DONA do arquivo (é com ela que se acha o entregável). Ele fica aberto na
 * conversa onde o card do entregável aparece, que pode ser outra etapa (03 refeita a partir da 04).
 * Sem entregável achado, vale a etapa guardada.
 */
export function visualizadorAbertoNaConversa(
  entregaveis: Entregavel[],
  visualizador: { etapa: EtapaId; nomeFinal: string; tipos?: TipoEntregavel[] } | null,
  etapaDaTela: EtapaId,
): boolean {
  if (visualizador === null) return false
  const achado = entregavelVisivel(entregaveis, visualizador.etapa, visualizador.nomeFinal, visualizador.tipos ?? TIPOS_VISUALIZADOR)
  return achado ? etapaDaConversa(achado) === etapaDaTela : visualizador.etapa === etapaDaTela
}
