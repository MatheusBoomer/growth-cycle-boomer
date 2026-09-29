"use client"

import { createContext, useContext } from "react"
import type { EtapaId } from "@workspace/core/tipos"

export interface ControleVisualizador {
  abrir: (etapa: EtapaId, nomeFinal: string) => void
}

export const ContextoVisualizador = createContext<ControleVisualizador>({ abrir: () => {} })

export function useVisualizador(): ControleVisualizador {
  return useContext(ContextoVisualizador)
}
