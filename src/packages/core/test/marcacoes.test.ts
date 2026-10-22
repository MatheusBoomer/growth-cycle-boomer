import { describe, expect, it } from "vitest"
import { ErroEntrada } from "../src/erros"
import { descreverMarcacoes, faixaDeMarcacoes, lerMarcas, type MarcaAjuste } from "../src/marcacoes"

const marca = (m: Partial<MarcaAjuste>): MarcaAjuste => ({ forma: "retangulo", x: 10, y: 20, w: 30, h: 40, ...m })

describe("descreverMarcacoes", () => {
  it("numera a partir do número dado e descreve a posição", () => {
    expect(descreverMarcacoes([marca({}), marca({ forma: "numero", x: 12.4, y: 88.6, w: 0, h: 0 })], 3)).toEqual([
      "3. Retângulo em área de 10–40% da largura e 20–60% da altura, de cima para baixo",
      "4. Número em ponto a 12% da largura e 89% da altura, de cima para baixo",
    ])
  })

  it("sem marcações não devolve linhas", () => {
    expect(descreverMarcacoes([], 1)).toEqual([])
  })
})

describe("faixaDeMarcacoes", () => {
  it("escreve a faixa de números da referência", () => {
    expect(faixaDeMarcacoes(3, 2)).toBe("marcações 3 a 4")
    expect(faixaDeMarcacoes(1, 1)).toBe("marcação 1")
    expect(faixaDeMarcacoes(1, 0)).toBe("")
  })
})

describe("lerMarcas", () => {
  it("aceita marcações válidas e ignora campos extras", () => {
    expect(lerMarcas([{ forma: "circulo", x: 1, y: 2, w: 3, h: 4, id: "x" }])).toEqual([{ forma: "circulo", x: 1, y: 2, w: 3, h: 4 }])
    expect(lerMarcas(undefined)).toEqual([])
  })

  it("recusa forma desconhecida, número fora de 0 a 100 e lista grande demais", () => {
    expect(() => lerMarcas([{ forma: "estrela", x: 1, y: 2, w: 3, h: 4 }])).toThrow(ErroEntrada)
    expect(() => lerMarcas([{ forma: "numero", x: 101, y: 2, w: 0, h: 0 }])).toThrow(ErroEntrada)
    expect(() => lerMarcas([{ forma: "numero", x: "1", y: 2, w: 0, h: 0 }])).toThrow(ErroEntrada)
    expect(() => lerMarcas(Array.from({ length: 31 }, () => ({ forma: "numero", x: 1, y: 1, w: 0, h: 0 })))).toThrow(ErroEntrada)
  })
})
