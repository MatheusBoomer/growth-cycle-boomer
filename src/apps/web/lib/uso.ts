import type { UsoAssinatura } from "@workspace/core/uso-assinatura"

export interface LinhaUso {
  rotulo: string
  percentual: number
  nivel: "ok" | "alerta" | "critico"
  /** Quando renova, já formatado ("14:00" ou "sáb. 14:00"). */
  renova: string | null
  /** A janela já renovou depois da última resposta do agente: o uso real voltou a zero. */
  renovada: boolean
}

const ROTULOS: Record<string, string> = {
  five_hour: "Sessão (5 h)",
  seven_day: "Semana",
  seven_day_opus: "Semana (Opus)",
  seven_day_sonnet: "Semana (Sonnet)",
}
const ORDEM = ["five_hour", "seven_day", "seven_day_opus", "seven_day_sonnet"]

function quando(resetsAt: number, agora: number): string {
  const d = new Date(resetsAt * 1000)
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return d.toDateString() === new Date(agora).toDateString() ? hora : `${d.toLocaleDateString("pt-BR", { weekday: "short" })} ${hora}`
}

/** Uso da assinatura em linhas para a barra: % por janela, nível de alerta e quando renova. */
export function resumoUso(uso: UsoAssinatura | null, agora: number): LinhaUso[] {
  if (!uso) return []
  return [...uso.janelas]
    .sort((a, b) => (ORDEM.indexOf(a.janela) + 1 || 99) - (ORDEM.indexOf(b.janela) + 1 || 99))
    .map((j) => {
      const renovada = j.resetsAt !== null && j.resetsAt * 1000 <= agora
      const percentual = renovada ? 0 : Math.min(100, Math.round(j.utilizacao * 100))
      return {
        rotulo: ROTULOS[j.janela] ?? j.janela,
        percentual,
        nivel: percentual >= 95 ? "critico" : percentual >= 75 ? "alerta" : "ok",
        renova: j.resetsAt !== null && !renovada ? quando(j.resetsAt, agora) : null,
        renovada,
      }
    })
}
