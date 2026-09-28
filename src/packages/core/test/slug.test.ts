import { describe, expect, it } from "vitest"
import { normalizarSlug } from "../src/slug"

describe("normalizarSlug", () => {
  it.each([
    ["Iszi Cosméticos", "iszi-cosmeticos"],
    ["  Adda  ", "adda"],
    ["Sottile & Jalecos", "sottile-jalecos"],
    ["Ção--Teste", "cao-teste"],
    ["Loja 123!", "loja-123"],
    ["Marca_Nova  Brasil", "marca-nova-brasil"],
    ["!!!", ""],
    ["🚀", ""],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarSlug(entrada)).toBe(esperado)
  })
})
