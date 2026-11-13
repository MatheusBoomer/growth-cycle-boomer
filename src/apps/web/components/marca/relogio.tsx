"use client"

import { useEffect, useState } from "react"
import { horaEmSaoPaulo } from "@/lib/relogio"

/** Hora de São Paulo (HH:MM), atualizada a cada 30 s. Nula no servidor e até o primeiro efeito (evita diferença na hidratação). */
export function useHoraSaoPaulo(): string | null {
  const [hora, setHora] = useState<string | null>(null)
  useEffect(() => {
    const atualizar = () => setHora(horaEmSaoPaulo(new Date()))
    atualizar()
    const id = setInterval(atualizar, 30_000)
    return () => clearInterval(id)
  }, [])
  return hora
}

/** Pílula com a hora de São Paulo na barra do topo. O `min-w` segura o espaço enquanto a hora não chega. */
export function Relogio() {
  const hora = useHoraSaoPaulo()
  return (
    <span
      title="Horário de São Paulo"
      className="text-muted-foreground border-border inline-flex h-7 min-w-14 items-center justify-center rounded-full border bg-background/60 px-2.5 backdrop-blur-xl font-mono text-[11px] tabular-nums max-lg:hidden"
    >
      {hora}
    </span>
  )
}
