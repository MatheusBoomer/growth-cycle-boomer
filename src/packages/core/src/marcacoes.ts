import { ErroEntrada } from "./erros"

// Marcações do analista sobre um gráfico ou tabela no pedido de ajuste: formas e números numerados.
// Coordenadas em % da imagem (0 a 100), para valerem em qualquer tamanho de tela.

export type FormaMarca = "retangulo" | "circulo" | "numero"

export interface MarcaAjuste {
  forma: FormaMarca
  x: number
  y: number
  w: number
  h: number
}

export const ROTULO_FORMA: Record<FormaMarca, string> = { retangulo: "Retângulo", circulo: "Círculo", numero: "Número" }

function ondeEstaMarca(m: MarcaAjuste): string {
  const faixa = (de: number, ate: number) => `${Math.round(de)}–${Math.round(ate)}%`
  if (m.forma === "numero") return `ponto a ${Math.round(m.x)}% da largura e ${Math.round(m.y)}% da altura, de cima para baixo`
  return `área de ${faixa(m.x, m.x + m.w)} da largura e ${faixa(m.y, m.y + m.h)} da altura, de cima para baixo`
}

/** Uma linha por marca, numerada a partir de `primeiroNumero` (a numeração segue contínua entre referências). */
export function descreverMarcacoes(marcas: MarcaAjuste[], primeiroNumero: number): string[] {
  return marcas.map((m, i) => `${primeiroNumero + i}. ${ROTULO_FORMA[m.forma]} em ${ondeEstaMarca(m)}`)
}

/** Faixa de números de uma referência, para a etiqueta: "marcação 3", "marcações 3 a 4" ou "" sem marcações. */
export function faixaDeMarcacoes(primeiro: number, quantidade: number): string {
  if (quantidade <= 0) return ""
  return quantidade === 1 ? `marcação ${primeiro}` : `marcações ${primeiro} a ${primeiro + quantidade - 1}`
}

const FORMAS = new Set<string>(["retangulo", "circulo", "numero"])
const MAX_MARCACOES = 30

/** Lê as marcações de um pedido vindo do navegador; ausente vira lista vazia. */
export function lerMarcas(entrada: unknown): MarcaAjuste[] {
  if (entrada === undefined || entrada === null) return []
  if (!Array.isArray(entrada)) throw new ErroEntrada("As marcações devem vir em uma lista.")
  if (entrada.length > MAX_MARCACOES) throw new ErroEntrada(`Use no máximo ${MAX_MARCACOES} marcações por gráfico.`)
  return entrada.map((bruta, i) => {
    const m = (bruta && typeof bruta === "object" ? bruta : {}) as Record<string, unknown>
    if (typeof m.forma !== "string" || !FORMAS.has(m.forma)) throw new ErroEntrada(`A marcação ${i + 1} tem uma forma desconhecida.`)
    const numero = (campo: string): number => {
      const v = m[campo]
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) throw new ErroEntrada(`A marcação ${i + 1} tem posição inválida.`)
      return v
    }
    return { forma: m.forma as FormaMarca, x: numero("x"), y: numero("y"), w: numero("w"), h: numero("h") }
  })
}
