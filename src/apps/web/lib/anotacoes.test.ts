import { describe, expect, it } from "vitest"
import { caixaDoArrasto, caixaDoNumero, type Marca, podeEnviar, textoDoPedido } from "./anotacoes"

const marca = (m: Partial<Marca>): Marca => ({ id: "a", forma: "retangulo", x: 10, y: 20, w: 30, h: 40, texto: "", ...m })

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

describe("podeEnviar", () => {
  it("exige texto geral ou ao menos uma marcação descrita", () => {
    expect(podeEnviar("", [])).toBe(false)
    expect(podeEnviar("  ", [marca({ texto: " " })])).toBe(false)
    expect(podeEnviar("trocar para barras", [])).toBe(true)
    expect(podeEnviar("", [marca({ texto: "mudar o título" })])).toBe(true)
  })
})

describe("textoDoPedido", () => {
  it("sem marcações devolve só o texto geral", () => {
    expect(textoDoPedido("  trocar para barras ", [])).toBe("trocar para barras")
  })

  it("numera as marcações na ordem e descreve a posição", () => {
    const texto = textoDoPedido("", [
      marca({ forma: "numero", x: 12.4, y: 88.6, w: 0, h: 0, texto: "Eixo X em meses por extenso" }),
      marca({ forma: "circulo", texto: "Destacar este pico" }),
    ])
    expect(texto).toBe(
      [
        "Marcações numeradas na imagem anotada:",
        "1. Número em ponto a 12% da largura e 89% da altura, de cima para baixo: Eixo X em meses por extenso",
        "2. Círculo em área de 10–40% da largura e 20–60% da altura, de cima para baixo: Destacar este pico",
      ].join("\n"),
    )
  })

  it("junta o ajuste geral e avisa quando a marcação não tem descrição", () => {
    const texto = textoDoPedido("trocar as cores", [marca({})])
    expect(texto.split("\n")[0]).toBe("Ajuste geral: trocar as cores")
    expect(texto).toContain("1. Retângulo em área de 10–40% da largura")
    expect(texto).toContain("(sem descrição: confira a área marcada)")
  })
})
