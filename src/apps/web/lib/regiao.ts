import type { Regiao } from "@workspace/core/comentarios"

export type Ponto = { x: number; y: number }

const r2 = (v: number) => Math.round(v * 100) / 100
const dentro = (v: number) => Math.min(100, Math.max(0, v))

/** Retângulo arrastado (pixels da tela) → região em % do slide. null para clique sem arraste (< 2%). */
export function regiaoDoArraste(a: Ponto, b: Ponto, caixa: { left: number; top: number; width: number; height: number }): Regiao | null {
  const px = (v: number) => dentro(((v - caixa.left) / caixa.width) * 100)
  const py = (v: number) => dentro(((v - caixa.top) / caixa.height) * 100)
  const [x1, x2, y1, y2] = [px(a.x), px(b.x), py(a.y), py(b.y)]
  const r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  if (r.w < 2 || r.h < 2) return null
  return { x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) }
}
