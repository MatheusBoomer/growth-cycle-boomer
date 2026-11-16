import type { EtapaId } from "@workspace/core/tipos"
import type { GatilhoEnsaio } from "./api"

/** Identifica o trecho já preenchido na caixa: etapa mais o texto gravado. */
export const chaveDoTrecho = (etapa: EtapaId, texto: string): string => `${etapa}:${texto}`

/**
 * Texto que o compositor do ensaio deve pôr na caixa, ou `null` para deixá-la como está.
 * Só preenche com o cliente em ensaio, sem turno ativo, caixa vazia e um trecho de mensagem ou ajuste
 * que ainda não foi preenchido (assim o que o analista apagou não volta).
 */
export function textoParaPreencher(p: {
  ensaio: boolean
  semTurno: boolean
  textoAtual: string
  etapa: EtapaId
  gatilho: GatilhoEnsaio | null
  jaPreenchido: string | null
}): string | null {
  if (!p.ensaio || !p.semTurno || p.textoAtual.trim() !== "" || !p.gatilho) return null
  if (p.gatilho.gatilho !== "mensagem" && p.gatilho.gatilho !== "ajuste") return null
  const texto = p.gatilho.textoPreenchido
  if (!texto) return null
  return p.jaPreenchido === chaveDoTrecho(p.etapa, texto) ? null : texto
}
