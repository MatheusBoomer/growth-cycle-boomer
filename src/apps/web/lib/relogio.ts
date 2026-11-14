const FORMATO = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

/** Hora de São Paulo no formato HH:MM, para o relógio da barra do topo. */
export function horaEmSaoPaulo(d: Date): string {
  return FORMATO.format(d)
}
