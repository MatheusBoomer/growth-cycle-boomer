// Marcações do analista sobre um gráfico ou tabela no pedido de ajuste: formas e números numerados.
// O que mudar em cada número o analista escreve na mensagem do chat. Coordenadas em % da imagem (0 a 100), para valerem em qualquer tamanho de tela.

import type { FormaMarca, MarcaAjuste } from "@workspace/core/marcacoes"

export { descreverMarcacoes, faixaDeMarcacoes, ROTULO_FORMA } from "@workspace/core/marcacoes"
export type { FormaMarca }

/** Marca na tela: a mesma do pedido, com um id para a lista do editor. */
export interface Marca extends MarcaAjuste {
  id: string
}

export interface Ponto {
  x: number
  y: number
}

/** Arrasto menor que isto (em % da imagem) conta como clique perdido, não como forma. */
export const TAMANHO_MINIMO = 1.5

const limitar = (valor: number) => Math.min(100, Math.max(0, valor))
const arredondar = (valor: number) => Math.round(valor * 100) / 100

/** Caixa (em %) entre o ponto onde o arrasto começou e onde terminou, em qualquer direção; null se for pequena demais. */
export function caixaDoArrasto(inicio: Ponto, fim: Ponto): Pick<Marca, "x" | "y" | "w" | "h"> | null {
  const x1 = limitar(Math.min(inicio.x, fim.x))
  const y1 = limitar(Math.min(inicio.y, fim.y))
  const x2 = limitar(Math.max(inicio.x, fim.x))
  const y2 = limitar(Math.max(inicio.y, fim.y))
  if (x2 - x1 < TAMANHO_MINIMO || y2 - y1 < TAMANHO_MINIMO) return null
  return { x: arredondar(x1), y: arredondar(y1), w: arredondar(x2 - x1), h: arredondar(y2 - y1) }
}

/** O número é um ponto: caixa de tamanho zero no lugar do clique. */
export function caixaDoNumero(ponto: Ponto): Pick<Marca, "x" | "y" | "w" | "h"> {
  return { x: arredondar(limitar(ponto.x)), y: arredondar(limitar(ponto.y)), w: 0, h: 0 }
}
