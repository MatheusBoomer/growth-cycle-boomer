import { describe, expect, it } from "vitest"
import { PARAMETROS_DITHERED, SHADER_FRAGMENTO, paletaDithered } from "./dithered"

describe("fundo dithered B sutil", () => {
  it("paleta do escuro", () => expect(paletaDithered("dark")).toEqual(["#0a0a0b", "#120b07", "#4a1f08", "#9a420e"]))

  it("paleta do pérola", () => expect(paletaDithered("light")).toEqual(["#f7f6f3", "#f2e9e0", "#ead2bd", "#dba57c"]))

  it("calibragem escolhida pelo usuário: 4 tons, pixel fino, intensidade sutil", () =>
    expect(PARAMETROS_DITHERED).toEqual({ tons: 4, pixel: 2, intensidade: 0.6, velocidade: 0.6 }))

  it("o shader é GLSL ES 3.00 com a retícula de Bayer", () => {
    expect(SHADER_FRAGMENTO).toContain("#version 300 es")
    expect(SHADER_FRAGMENTO).toContain("float bay(")
  })
})
