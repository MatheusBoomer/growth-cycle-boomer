"use client"

import { useEffect, useState } from "react"

const DURACAO = 900

/**
 * Número que conta de 0 até o valor ao aparecer (efeito do Number Ticker da Magic UI, feito à mão).
 * Com movimento reduzido mostra o valor direto.
 */
export function NumeroAnimado({ valor, className }: { valor: number; className?: string }) {
  const [atual, setAtual] = useState(0)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAtual(valor)
      return
    }
    let inicio: number | null = null
    let id = 0
    const passo = (t: number) => {
      inicio ??= t
      const k = Math.max(0, Math.min(1, (t - inicio) / DURACAO))
      setAtual(Math.round(valor * (1 - (1 - k) ** 3)))
      if (k < 1) id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [valor])

  return <span className={className}>{atual}</span>
}
