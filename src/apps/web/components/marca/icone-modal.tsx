import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

const TONS = {
  acao: "border border-border bg-muted text-link-acao",
  aviso: "bg-aviso-fundo text-aviso",
  perigo: "bg-perigo-fundo text-destructive",
} as const

/** Ícone quadrado de 40 px no cabeçalho dos modais (protótipo 8-modais.html): laranja para ação, âmbar para aviso, vermelho para perigo. */
export function IconeModal({ tom, children }: { tom: keyof typeof TONS; children: ReactNode }) {
  return (
    <div
      data-slot="icone-modal"
      aria-hidden
      className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-[19px]", TONS[tom])}
    >
      {children}
    </div>
  )
}

/** Faixa de aviso dentro do corpo do modal (ex.: o que se perde ao reposicionar ou reabrir). */
export function CaixaAviso({ tom = "aviso", children }: { tom?: "aviso" | "perigo"; children: ReactNode }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-2.5 rounded-[14px] px-3.5 py-3 text-[13px] leading-normal",
        tom === "aviso" ? "bg-aviso-fundo text-aviso" : "bg-perigo-fundo text-destructive",
      )}
    >
      <span aria-hidden>⚠︎</span>
      <span>{children}</span>
    </div>
  )
}
