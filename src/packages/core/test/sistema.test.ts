import { describe, expect, it } from "vitest"
import { tokenApifyConfigurado } from "../src/sistema"

describe("token da Apify", () => {
  it("aceita o token do ambiente", () => {
    expect(tokenApifyConfigurado({ APIFY_TOKEN: "abc" }, null)).toBe(true)
  })
  it("aceita o token do .env, com ou sem aspas", () => {
    expect(tokenApifyConfigurado({}, "OUTRA=1\nAPIFY_TOKEN=abc\n")).toBe(true)
    expect(tokenApifyConfigurado({}, 'APIFY_TOKEN="abc"')).toBe(true)
  })
  it("recusa vazio, só espaços ou ausente", () => {
    expect(tokenApifyConfigurado({ APIFY_TOKEN: "  " }, "APIFY_TOKEN=")).toBe(false)
    expect(tokenApifyConfigurado({}, null)).toBe(false)
    expect(tokenApifyConfigurado({}, "# APIFY_TOKEN=abc")).toBe(false)
  })
})
