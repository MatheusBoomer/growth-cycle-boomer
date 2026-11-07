import type { EtapaId } from "@workspace/core/tipos"
import type { CorpoPresenca } from "./api"

/** A rota rejeita `segundosSemInteracao` acima de 24 h; uma aba esquecida aberta por dias continua avisando. */
const LIMITE_SEGUNDOS = 86_400

export interface MedidorPresenca {
  registrarInteracao(): void
  corpo(etapa: EtapaId, visivel: boolean): CorpoPresenca
}

/** Guarda o horário da última interação e monta o corpo do aviso de presença. Puro: o relógio vem de fora. */
export function criarMedidorPresenca(agora: () => number): MedidorPresenca {
  let ultima = agora()
  return {
    registrarInteracao() {
      ultima = agora()
    },
    corpo(etapa, visivel) {
      const segundos = Math.floor((agora() - ultima) / 1000)
      return { etapa, visivel, segundosSemInteracao: Math.min(LIMITE_SEGUNDOS, Math.max(0, segundos)) }
    },
  }
}
