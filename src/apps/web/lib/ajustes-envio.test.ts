import { describe, expect, it } from "vitest"
import { ErroEntrada } from "@workspace/core/erros"
import { lerAjustes, lerImagem } from "./ajustes-envio"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString("base64")

describe("lerImagem", () => {
  it("aceita PNG em base64, com ou sem prefixo de data URL", () => {
    expect(lerImagem(PNG)?.length).toBe(10)
    expect(lerImagem(`data:image/png;base64,${PNG}`)?.length).toBe(10)
    expect(lerImagem(undefined)).toBeUndefined()
  })

  it("recusa o que não é PNG e o que não é texto", () => {
    expect(() => lerImagem(Buffer.from("texto qualquer").toString("base64"))).toThrow(ErroEntrada)
    expect(() => lerImagem(123)).toThrow(ErroEntrada)
  })
})

describe("lerAjustes", () => {
  it("sem lista, devolve vazio", () => {
    expect(lerAjustes(undefined)).toEqual([])
  })

  it("lê id, marcações e imagem de cada ajuste", () => {
    const [a] = lerAjustes([{ entregavelId: "g1", marcas: [{ forma: "numero", x: 5, y: 6, w: 0, h: 0 }], imagem: PNG }])
    expect(a!.entregavelId).toBe("g1")
    expect(a!.marcas).toHaveLength(1)
    expect(a!.imagem?.length).toBe(10)
  })

  it("recusa ajuste sem id ou lista que não é lista", () => {
    expect(() => lerAjustes([{ marcas: [] }])).toThrow(ErroEntrada)
    expect(() => lerAjustes("x")).toThrow(ErroEntrada)
  })
})
