import type { Regiao } from "@workspace/core/comentarios"

export type Ponto = { x: number; y: number }
type Caixa = { left: number; top: number; width: number; height: number }

const r2 = (v: number) => Math.round(v * 100) / 100
const dentro = (v: number) => Math.min(100, Math.max(0, v))

/** Ponto da tela (pixels) → posição em % do slide, limitada às bordas. */
export function pontoNoSlide(p: Ponto, caixa: Caixa): Ponto {
  return { x: dentro(((p.x - caixa.left) / caixa.width) * 100), y: dentro(((p.y - caixa.top) / caixa.height) * 100) }
}

/** Retângulo entre dois pontos em % do slide. null para clique sem arraste (< 2%). */
export function regiaoEntre(a: Ponto, b: Ponto): Regiao | null {
  const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
  if (r.w < 2 || r.h < 2) return null
  return { x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) }
}

/** Retângulo arrastado (pixels da tela) → região em % do slide. */
export function regiaoDoArraste(a: Ponto, b: Ponto, caixa: Caixa): Regiao | null {
  return regiaoEntre(pontoNoSlide(a, caixa), pontoNoSlide(b, caixa))
}
