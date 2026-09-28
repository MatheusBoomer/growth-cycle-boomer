"use client"

import type { EstadoInsumo, EtapaId, InsumoCatalogo } from "@workspace/core/tipos"

export interface PropsCardInsumo {
  slug: string
  etapa: EtapaId
  insumo: InsumoCatalogo
  obrigatorio: boolean
  estadoInsumo: EstadoInsumo | null
  temModelo: boolean
}

export function CardInsumo({ insumo, estadoInsumo }: PropsCardInsumo) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      {insumo.nome} — {estadoInsumo?.status ?? "pendente"}
    </div>
  )
}
