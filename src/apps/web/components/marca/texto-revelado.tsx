import type { CSSProperties, ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Texto em que uma faixa de cor (laranja, âmbar, azul) varre da esquerda para a direita e assenta na cor base.
 * Efeito do Dia Text Reveal da Magic UI, feito em CSS (classe `texto-revelado` no globals.css), sem dependência.
 */
export function TextoRevelado({
  children,
  atraso = 0,
  corBase,
  className,
}: {
  children: ReactNode
  /** Segundos até a faixa começar a andar. */
  atraso?: number
  /** Cor em que o texto assenta (padrão: a cor do texto em volta). */
  corBase?: string
  className?: string
}) {
  const estilo = { "--atraso": `${atraso}s`, ...(corBase ? { "--cor-base": corBase } : {}) } as CSSProperties
  return (
    <span className={cn("texto-revelado", className)} style={estilo}>
      {children}
    </span>
  )
}
