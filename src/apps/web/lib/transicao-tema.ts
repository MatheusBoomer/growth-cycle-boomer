import { flushSync } from "react-dom"

type DocumentoComTransicao = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }

/**
 * Troca de tema com o tema novo se espalhando em círculo a partir de `origem` (efeito do Animated Theme Toggler da
 * Magic UI, feito à mão porque o componente deles mexe na classe `dark` direto e brigaria com o next-themes).
 * Sem View Transitions ou com movimento reduzido, só aplica.
 */
export function trocarTemaComCirculo(origem: { x: number; y: number }, aplicar: () => void): void {
  const doc = document as DocumentoComTransicao
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  if (!doc.startViewTransition || reduzido) {
    aplicar()
    return
  }
  const raio = Math.hypot(Math.max(origem.x, window.innerWidth - origem.x), Math.max(origem.y, window.innerHeight - origem.y))
  const centro = `at ${origem.x}px ${origem.y}px`
  doc
    .startViewTransition(() => flushSync(aplicar))
    .ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px ${centro})`, `circle(${raio}px ${centro})`] },
        { duration: 650, easing: "cubic-bezier(.6,.1,.2,1)", pseudoElement: "::view-transition-new(root)" },
      )
    })
    .catch(() => {})
}

/** Aplica o tema já na classe do `<html>` (o next-themes só aplica num efeito, tarde demais para a foto da transição) e avisa o next-themes. */
export function aplicarTemaJa(novo: "dark" | "light", setTheme: (tema: string) => void): void {
  document.documentElement.classList.toggle("dark", novo === "dark")
  setTheme(novo)
}

/**
 * Inverte o tema que está no `<html>` agora, lido na hora de aplicar. Ler o `resolvedTheme` no clique perdia o segundo
 * de dois cliques rápidos: o next-themes ainda não tinha atualizado e os dois cliques pediam o mesmo tema.
 */
export function alternarTemaJa(setTheme: (tema: string) => void): void {
  aplicarTemaJa(document.documentElement.classList.contains("dark") ? "light" : "dark", setTheme)
}
