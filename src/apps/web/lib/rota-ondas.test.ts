import { describe, expect, it } from "vitest"
import { rotaUsaOndas } from "./rota-ondas"

describe("rotaUsaOndas", () => {
  it.each(["/", "/login", "/login/", "/prospects/iszi", "/prospects/iszi/", "/prospects/iszi/etapa-03"])("%s usa ondas", (caminho) => {
    expect(rotaUsaOndas(caminho)).toBe(true)
  })

  it.each(["/admin", "/admin/skills", "/adminx", "/prospects", "/prospects/", "/api/x", "/auth/entrar", "/loginx", ""])(
    "%s não usa ondas",
    (caminho) => {
      expect(rotaUsaOndas(caminho)).toBe(false)
    },
  )
})
