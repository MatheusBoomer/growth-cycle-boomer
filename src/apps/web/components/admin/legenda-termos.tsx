"use client"

import { useId, type ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

/** O que cada termo do tempo significa; espelha a classificação de `metricas/tempo.ts`. O tempo útil é agente mais ativo. */
export const TERMOS = {
  agente: "Tempo em que o agente estava rodando um turno. Conta como tempo útil.",
  ativo: "Tempo em que a aba estava visível e houve interação recente da pessoa. Conta como tempo útil, junto com o do agente.",
  ocioso: "Tempo com o projeto aberto, mas com a aba escondida ou sem interação por 5 minutos (padrão).",
  descartado: "Tempo ocioso além dos primeiros 15 minutos seguidos (padrão): a pessoa provavelmente saiu.",
} as const

export type IdTermo = keyof typeof TERMOS

/**
 * Rótulo com o significado do termo num tooltip, aberto com o mouse ou pelo foco (o rótulo recebe foco pelo teclado e
 * pelo toque). O significado também fica ligado ao rótulo por `aria-describedby`, num texto escondido, para o leitor
 * de tela anunciar a explicação mesmo com o tooltip fechado.
 */
export function Termo({ id, children }: { id: IdTermo; children: ReactNode }) {
  const idExplicacao = useId()
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<span tabIndex={0} aria-describedby={idExplicacao} className="decoration-muted-foreground/60 cursor-help underline decoration-dotted underline-offset-4" />}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent>{TERMOS[id]}</TooltipContent>
      </Tooltip>
      <span id={idExplicacao} hidden>
        {TERMOS[id]}
      </span>
    </>
  )
}
