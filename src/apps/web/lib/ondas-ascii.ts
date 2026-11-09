/**
 * Núcleo puro do fundo de ondas ASCII: o campo de intensidade de cada célula, as paletas por tema, o fator do
 * degradê e o dimensionamento da grade. Não conhece React nem canvas; o componente só desenha o que sai daqui.
 */

export const RAMPA: readonly string[] = [" ", ".", ":", "-", "=", "+", "*", "#", "@"]

export type Celula = { intensidade: number; caractere: string; laranja: boolean }
export type TemaOndas = "claro" | "escuro"
export type Rgb = readonly [number, number, number]
export type Paleta = { azul: Rgb; laranja: Rgb; opacidadeMax: number }

/** Claro: o azul e o laranja da Boomer, discretos para não brigar com o texto. Escuro: luminosos, como no vídeo de referência. */
export const PALETAS: Record<TemaOndas, Paleta> = {
  claro: { azul: [57, 135, 229], laranja: [235, 97, 10], opacidadeMax: 0.35 },
  escuro: { azul: [84, 178, 255], laranja: [255, 138, 61], opacidadeMax: 0.85 },
}

/** Limiar do segundo ruído lento; calibrado para o laranja ocupar cerca de 10–15% das células visíveis. */
const LIMIAR_LARANJA = 0.62

const limitar = (v: number) => Math.min(1, Math.max(0, v))

export function caractereDaIntensidade(intensidade: number): string {
  return RAMPA[Math.round(limitar(intensidade) * (RAMPA.length - 1))]!
}

/**
 * `t` em segundos. Listras verticais (uma fase por coluna) que viajam da esquerda para a direita, com a massa mais
 * densa à esquerda e cobrindo a altura toda. Todo termo que depende de x e t tem a forma `k·x − w·t`, ou seja,
 * avança para +x; nenhum anda para a esquerda.
 */
export function celulaOnda(coluna: number, linha: number, t: number, colunas: number, linhas: number): Celula {
  const x = coluna / Math.max(colunas, 1)
  const y = linha / Math.max(linhas, 1)

  // A fase de cada coluna é deslocada por ondas lentas que também avançam para a direita: é isso que faz as listras ondularem.
  const deslocamento =
    1.7 * Math.sin(y * 3.2 + x * 2.4 - t * 0.5) + 1.1 * Math.sin(x * 4.1 - t * 0.45) + 0.6 * Math.sin((x - y) * 6 - t * 0.9)
  const listra = 0.5 + 0.5 * Math.sin(coluna * 1.15 - t * 1.6 + deslocamento)

  // A massa nasce à esquerda e se espalha pela altura inteira; o centro anda de leve, como o brilho da referência.
  const dx = (x - (0.22 + 0.04 * Math.sin(t * 0.2))) / 0.55
  const dy = (y - (0.5 + 0.05 * Math.cos(t * 0.17))) / 1.1
  const miolo = Math.exp(-(dx * dx + dy * dy))

  const intensidade = limitar(miolo * (0.2 + 0.8 * listra ** 1.4))
  const ruido = Math.sin(x * 11 + y * 4 + t * 0.35) * Math.sin(y * 9 - x * 5 - t * 0.28)
  return { intensidade, caractere: caractereDaIntensidade(intensidade), laranja: ruido > LIMIAR_LARANJA }
}

/** 1 no começo (borda esquerda da janela), 0 no fim (direita). O degradê visual é um mask CSS; isto só decide quais colunas valem desenhar. */
export function fatorDeDegrade(posicao: number, total: number): number {
  if (total <= 0) return 0
  return limitar(1 - posicao / total)
}

const TETO_CELULAS = 20000

export function dimensionarGrade(largura: number, altura: number): { celulaL: number; celulaA: number; colunas: number; linhas: number } {
  let celulaL = largura >= 768 ? 10 : 14
  let celulaA = largura >= 768 ? 18 : 24
  if (largura <= 0 || altura <= 0) return { celulaL, celulaA, colunas: 0, linhas: 0 }
  let colunas = Math.ceil(largura / celulaL)
  let linhas = Math.ceil(altura / celulaA)
  // Telas enormes crescem a célula (mesma proporção) até a grade caber no orçamento de ~30 fps.
  while (colunas * linhas > TETO_CELULAS) {
    celulaL *= 1.05
    celulaA *= 1.05
    colunas = Math.ceil(largura / celulaL)
    linhas = Math.ceil(altura / celulaA)
  }
  return { celulaL, celulaA, colunas, linhas }
}
