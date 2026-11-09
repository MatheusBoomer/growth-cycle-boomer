/** Peças que os componentes do painel e o `painel-projetos.tsx` compartilham (este reexporta, para quem já importava de lá). */

import { createContext, useContext } from "react"
import type { EtapaId } from "@workspace/core/tipos"

export interface EtapaRotulada {
  id: EtapaId
  rotulo: string
  /** Fase da etapa no catálogo (`etapas.json`); dá a ordem e a cor das fases nos gráficos. */
  fase?: string
}

/**
 * Etapas do catálogo para os gráficos do painel (título de cada etapa e ordem das fases), sem mudar as props deles.
 * Vazio (padrão) faz os gráficos caírem nos rótulos curtos e na ordem fixa das fases.
 */
export const EtapasPainelContext = createContext<readonly EtapaRotulada[]>([])

export function useEtapasPainel(): readonly EtapaRotulada[] {
  return useContext(EtapasPainelContext)
}

/** Chave do custo sem modelo registrado (`CHAVE_OUTROS` do core), em português para a tela. */
export function rotuloModelo(modelo: string): string {
  return modelo === "outros" ? "Sem modelo registrado" : modelo
}

export function MarcaEstimado() {
  return <span className="text-muted-foreground ml-1 text-xs font-normal">estimado</span>
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "Sem atividade"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "Sem atividade" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** Texto do estado vazio, o mesmo no painel e nos gráficos. */
export const TEXTO_SEM_USO = "Ainda não há uso registrado neste período"
