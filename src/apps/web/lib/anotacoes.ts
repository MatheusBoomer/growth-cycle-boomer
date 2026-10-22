// Marcações do analista sobre um gráfico ou tabela no pedido de ajuste: formas e números numerados,
// cada um com a sua descrição. Coordenadas em % da imagem (0 a 100), para valerem em qualquer tamanho de tela.

export type FormaMarca = "retangulo" | "circulo" | "numero"

export interface Marca {
  id: string
  forma: FormaMarca
  x: number
  y: number
  w: number
  h: number
  texto: string
}

export interface Ponto {
  x: number
  y: number
}

export const ROTULO_FORMA: Record<FormaMarca, string> = { retangulo: "Retângulo", circulo: "Círculo", numero: "Número" }

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

function ondeEstaMarca(m: Marca): string {
  const faixa = (de: number, ate: number) => `${Math.round(de)}–${Math.round(ate)}%`
  if (m.forma === "numero") return `ponto a ${Math.round(m.x)}% da largura e ${Math.round(m.y)}% da altura, de cima para baixo`
  return `área de ${faixa(m.x, m.x + m.w)} da largura e ${faixa(m.y, m.y + m.h)} da altura, de cima para baixo`
}

export function podeEnviar(geral: string, marcas: Marca[]): boolean {
  return !!geral.trim() || marcas.some((m) => m.texto.trim())
}

/** Texto do pedido: ajustes gerais e, para cada número da imagem, o que mudar ali. */
export function textoDoPedido(geral: string, marcas: Marca[]): string {
  const linhas: string[] = []
  if (geral.trim()) linhas.push(marcas.length ? `Ajuste geral: ${geral.trim()}` : geral.trim())
  if (marcas.length) {
    if (linhas.length) linhas.push("")
    linhas.push("Marcações numeradas na imagem anotada:")
    marcas.forEach((m, i) => {
      const o = m.texto.trim() || "(sem descrição: confira a área marcada)"
      linhas.push(`${i + 1}. ${ROTULO_FORMA[m.forma]} em ${ondeEstaMarca(m)}: ${o}`)
    })
  }
  return linhas.join("\n").trim()
}
