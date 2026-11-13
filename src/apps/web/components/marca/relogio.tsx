"use client"

import { useEffect, useState } from "react"
import { horaEmSaoPaulo } from "@/lib/relogio"

/**
 * Hora de São Paulo (HH:MM), trocada na virada de cada minuto (não a cada 30 s, que atrasava até meio minuto). Nula no
 * servidor e até o primeiro efeito (evita diferença na hidratação).
 */
export function useHoraSaoPaulo(): string | null {
  const [hora, setHora] = useState<string | null>(null)
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    const atualizar = () => {
      const agora = new Date()
      setHora(horaEmSaoPaulo(agora))
      // Próxima virada de minuto, com 50 ms de folga para não cair ainda no minuto velho.
      id = setTimeout(atualizar, 60_000 - (agora.getTime() % 60_000) + 50)
    }
    atualizar()
    return () => clearTimeout(id)
  }, [])
  return hora
}
