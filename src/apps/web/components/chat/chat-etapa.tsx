"use client"

import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

export function ChatEtapa({ eventos, delta }: PropsChatEtapa) {
  return (
    <pre className="min-h-0 flex-1 overflow-auto p-4 text-xs">
      {JSON.stringify(eventos, null, 2)}
      {delta}
    </pre>
  )
}
