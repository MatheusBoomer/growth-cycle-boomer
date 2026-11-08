/** Formatos de exibição de custo e duração. Sem I/O. */

const FORMATO_USD = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** `9.8` vira `US$ 9,80`. */
export function formatarUsd(v: number): string {
  return `US$ ${FORMATO_USD.format(v)}`
}

/** `11520` vira `3h12`, `2700` vira `45 min`, de 1 a 59 s vira `< 1 min` e 0 vira `0 min`. */
export function formatarDuracao(segundos: number): string {
  if (segundos <= 0) return "0 min"
  if (segundos < 60) return "< 1 min"
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  return `${horas}h${String(minutos % 60).padStart(2, "0")}`
}
