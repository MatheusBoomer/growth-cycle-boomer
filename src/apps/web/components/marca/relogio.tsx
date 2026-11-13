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

/** Pílula com a hora de São Paulo na barra do topo. O `min-w` segura o espaço enquanto a hora não chega. */
export function Relogio() {
  const hora = useHoraSaoPaulo()
  return (
    <span
      title="Horário de São Paulo"
      aria-label={hora ? `Horário de São Paulo: ${hora}` : undefined}
      className="text-muted-foreground border-border inline-flex h-7 min-w-14 items-center justify-center rounded-full border bg-background/60 px-2.5 backdrop-blur-xl font-mono text-[11px] tabular-nums max-lg:hidden"
    >
      {hora}
    </span>
  )
}
