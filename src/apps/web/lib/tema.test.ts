import { describe, expect, it } from "vitest"
import { CONFIG_TEMA } from "./tema"

describe("tema", () => {
  it("abre no escuro, sem seguir o sistema, com chave própria", () => {
    expect(CONFIG_TEMA).toEqual({ defaultTheme: "dark", enableSystem: false, themes: ["dark", "light"], storageKey: "tema-boomer" })
  })

})
