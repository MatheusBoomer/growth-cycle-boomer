import { describe, expect, it } from "vitest"
import { caixaDoArrasto, caixaDoNumero } from "./anotacoes"

describe("caixaDoArrasto", () => {
  it("normaliza o arrasto em qualquer direção", () => {
    expect(caixaDoArrasto({ x: 50, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 40, h: 40 })
  })

  it("prende a caixa dentro da imagem", () => {
    expect(caixaDoArrasto({ x: -5, y: 90 }, { x: 40, y: 130 })).toEqual({ x: 0, y: 90, w: 40, h: 10 })
  })

  it("descarta arrasto pequeno demais", () => {
    expect(caixaDoArrasto({ x: 10, y: 10 }, { x: 10.5, y: 40 })).toBeNull()
  })
})

describe("caixaDoNumero", () => {
  it("vira um ponto dentro da imagem", () => {
    expect(caixaDoNumero({ x: 33.333, y: 120 })).toEqual({ x: 33.33, y: 100, w: 0, h: 0 })
  })
})

describe("numerosDaEtiqueta", () => {
  it("um número, uma faixa ou nada", async () => {
    const { numerosDaEtiqueta } = await import("./anotacoes")
    expect(numerosDaEtiqueta(3, 1)).toBe("3")
    expect(numerosDaEtiqueta(1, 2)).toBe("1-2")
    expect(numerosDaEtiqueta(1, 0)).toBeUndefined()
  })
})
