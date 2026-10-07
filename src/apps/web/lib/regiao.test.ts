import { describe, expect, it } from "vitest"
import { regiaoDoArraste } from "./regiao"

const caixa = { left: 100, top: 50, width: 1000, height: 562.5 }

describe("região arrastada sobre o slide", () => {
  it("converte o arraste em % do slide, em qualquer direção", () => {
    expect(regiaoDoArraste({ x: 700, y: 200 }, { x: 400, y: 100 }, caixa)).toEqual({ x: 30, y: 8.89, w: 30, h: 17.78 })
  })
  it("arraste que sai da imagem fica limitado às bordas", () => {
    expect(regiaoDoArraste({ x: 900, y: 500 }, { x: 2000, y: 900 }, caixa)).toEqual({ x: 80, y: 80, w: 20, h: 20 })
  })
  it("clique sem arrastar não vira região", () => {
    expect(regiaoDoArraste({ x: 500, y: 300 }, { x: 503, y: 302 }, caixa)).toBeNull()
  })
})
