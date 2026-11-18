// Zoom do modal de gráfico e tabela. 1 = imagem ajustada à área do modal; os outros níveis são relativos a ele.

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4
export const NIVEIS_ZOOM: readonly number[] = [ZOOM_MIN, 0.75, 1, 1.25, 1.5, 2, 3, ZOOM_MAX]

export function limitarZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/** Próximo nível na direção pedida a partir de qualquer zoom (a pinça deixa o zoom entre dois níveis). */
export function proximoZoom(atual: number, direcao: 1 | -1): number {
  const folga = 0.001
  if (direcao === 1) return NIVEIS_ZOOM.find((n) => n > atual + folga) ?? ZOOM_MAX
  return [...NIVEIS_ZOOM].reverse().find((n) => n < atual - folga) ?? ZOOM_MIN
}

/**
 * Largura em px da imagem ajustada à área (zoom 1): cabe inteira na largura e na altura, sem passar do tamanho
 * real da imagem, como o `object-contain` com `max-w-full max-h-full` de antes. Desconta 2px da borda.
 */
export function larguraAjustada(area: { w: number; h: number }, imagem: { w: number; h: number }): number {
  if (imagem.w <= 0 || imagem.h <= 0) return Math.max(0, area.w - 2)
  const proporcao = imagem.w / imagem.h
  return Math.max(0, Math.min(area.w - 2, (area.h - 2) * proporcao, imagem.w))
}
