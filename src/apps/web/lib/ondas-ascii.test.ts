import { describe, expect, it } from "vitest"
import { PALETAS, RAMPA, caractereDaIntensidade, celulaOnda, dimensionarGrade, fatorDeDegrade } from "./ondas-ascii"

const TEMPOS = [0, 3.7, 120.5]

describe("celulaOnda", () => {
  it("é determinística", () => {
    expect(celulaOnda(12, 7, 3.7, 60, 30)).toEqual(celulaOnda(12, 7, 3.7, 60, 30))
  })

  it("intensidade em [0,1] e caractere pertence à RAMPA", () => {
    for (const t of TEMPOS)
      for (let c = 0; c < 60; c++)
        for (let l = 0; l < 30; l++) {
          const cel = celulaOnda(c, l, t, 60, 30)
          expect(cel.intensidade).toBeGreaterThanOrEqual(0)
          expect(cel.intensidade).toBeLessThanOrEqual(1)
          expect(RAMPA).toContain(cel.caractere)
        }
  })

  it("laranja fica entre 8% e 20% das células visíveis", () => {
    for (const t of [0, 5, 40]) {
      let visiveis = 0
      let laranjas = 0
      for (let c = 0; c < 80; c++)
        for (let l = 0; l < 40; l++) {
          const cel = celulaOnda(c, l, t, 80, 40)
          if (cel.caractere === " ") continue
          visiveis++
          if (cel.laranja) laranjas++
        }
      expect(visiveis).toBeGreaterThan(0)
      expect(laranjas / visiveis).toBeGreaterThanOrEqual(0.08)
      expect(laranjas / visiveis).toBeLessThanOrEqual(0.2)
    }
  })
})

describe("caractereDaIntensidade", () => {
  it("0 → ' ', 1 → '@', monotônica e limita fora de [0,1]", () => {
    expect(caractereDaIntensidade(0)).toBe(" ")
    expect(caractereDaIntensidade(1)).toBe("@")
    expect(caractereDaIntensidade(-3)).toBe(" ")
    expect(caractereDaIntensidade(9)).toBe("@")
    let anterior = 0
    for (let i = 0; i <= 100; i++) {
      const idx = RAMPA.indexOf(caractereDaIntensidade(i / 100))
      expect(idx).toBeGreaterThanOrEqual(anterior)
      anterior = idx
    }
  })

  it("a rampa é a do spec", () => {
    expect([...RAMPA]).toEqual([" ", ".", ":", "-", "=", "+", "*", "#", "@"])
  })
})

describe("PALETAS", () => {
  const soma = (c: readonly number[]) => c[0]! + c[1]! + c[2]!
  it("claro usa o azul e o laranja da Boomer; escuro é mais luminoso; opacidade clara ≤ 0.35 e menor que a escura", () => {
    expect([...PALETAS.claro.azul]).toEqual([57, 135, 229])
    expect([...PALETAS.claro.laranja]).toEqual([235, 97, 10])
    expect(soma(PALETAS.escuro.azul)).toBeGreaterThan(soma(PALETAS.claro.azul))
    expect(soma(PALETAS.escuro.laranja)).toBeGreaterThan(soma(PALETAS.claro.laranja))
    expect(PALETAS.claro.opacidadeMax).toBeLessThanOrEqual(0.35)
    expect(PALETAS.claro.opacidadeMax).toBeLessThan(PALETAS.escuro.opacidadeMax)
  })
})

describe("fatorDeDegrade", () => {
  it("vai de 1 no topo a 0 na base e não dá NaN sem linhas", () => {
    expect(fatorDeDegrade(0, 60)).toBe(1)
    expect(fatorDeDegrade(30, 60)).toBe(0.5)
    expect(fatorDeDegrade(60, 60)).toBe(0)
    expect(fatorDeDegrade(5, 0)).toBe(0)
  })
})

describe("dimensionarGrade", () => {
  it("desktop: (1440,900) → 10×18, 144 colunas, 50 linhas", () => {
    expect(dimensionarGrade(1440, 900)).toEqual({ celulaL: 10, celulaA: 18, colunas: 144, linhas: 50 })
  })

  it("celular: (390,844) → 14×24, 28 colunas, 36 linhas", () => {
    expect(dimensionarGrade(390, 844)).toEqual({ celulaL: 14, celulaA: 24, colunas: 28, linhas: 36 })
  })

  it("4K respeita o teto e a grade ainda cobre a janela", () => {
    const g = dimensionarGrade(3840, 2160)
    expect(g.colunas * g.linhas).toBeLessThanOrEqual(20000)
    expect(g.colunas * g.celulaL).toBeGreaterThanOrEqual(3840)
    expect(g.linhas * g.celulaA).toBeGreaterThanOrEqual(2160)
  })

  it("(0,0) → sem colunas nem linhas, sem NaN", () => {
    const g = dimensionarGrade(0, 0)
    expect(g.colunas).toBe(0)
    expect(g.linhas).toBe(0)
    expect(Number.isFinite(g.celulaL)).toBe(true)
    expect(Number.isFinite(g.celulaA)).toBe(true)
  })
})
