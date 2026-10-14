import { describe, expect, it } from "vitest"
import { CONFIG_TEMA, proximoTema } from "./tema"

describe("tema", () => {
  it("abre no escuro, sem seguir o sistema, com chave própria", () => {
    expect(CONFIG_TEMA).toEqual({ defaultTheme: "dark", enableSystem: false, themes: ["dark", "light"], storageKey: "tema-boomer" })
  })

  it("alterna entre escuro e claro", () => {
    expect(proximoTema("dark")).toBe("light")
    expect(proximoTema("light")).toBe("dark")
  })

  it("antes de saber o tema (undefined), trata como escuro", () => {
    expect(proximoTema(undefined)).toBe("light")
  })
})
