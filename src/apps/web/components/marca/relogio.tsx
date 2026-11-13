"use client"

import { useEffect, useState } from "react"
import { horaEmSaoPaulo } from "@/lib/relogio"

/** Pílula com a hora de São Paulo. Vazia no servidor (evita diferença na hidratação) e preenchida no primeiro efeito. */
export function Relogio() {
  const [hora, setHora] = useState<string | null>(null)
  useEffect(() => {
    const atualizar = () => setHora(horaEmSaoPaulo(new Date()))
    atualizar()
    const id = setInterval(atualizar, 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span
      title="Horário de São Paulo"
      className="text-muted-foreground border-border inline-flex h-7 min-w-14 items-center justify-center rounded-full border px-2.5 font-mono text-[11px] tabular-nums max-sm:hidden"
    >
      {hora}
    </span>
  )
}
