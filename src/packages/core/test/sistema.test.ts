import { describe, expect, it } from "vitest"
import { chaveApiConfigurada, dadosNaNuvem, executorDoAmbiente, tokenApifyConfigurado } from "../src/sistema"

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

describe("executorDoAmbiente", () => {
  it.each([
    [{}, "cli"],
    [{ PLANEJAMENTO_EXECUTOR: "" }, "cli"],
    [{ PLANEJAMENTO_EXECUTOR: "   " }, "cli"],
    [{ PLANEJAMENTO_EXECUTOR: "sdk" }, "sdk"],
    [{ PLANEJAMENTO_EXECUTOR: " sdk " }, "sdk"],
    [{ PLANEJAMENTO_EXECUTOR: "demo" }, "demo"],
    [{ PLANEJAMENTO_EXECUTOR: "SDK" }, "cli"],
    [{ PLANEJAMENTO_EXECUTOR: "qualquer" }, "cli"],
  ] as const)("%j vira %s", (env, esperado) => {
    expect(executorDoAmbiente(env)).toBe(esperado)
  })
})

describe("chaveApiConfigurada", () => {
  it("é verdadeira só com ANTHROPIC_API_KEY não vazia", () => {
    expect(chaveApiConfigurada({ ANTHROPIC_API_KEY: "sk-ant-x" })).toBe(true)
    expect(chaveApiConfigurada({ ANTHROPIC_API_KEY: "" })).toBe(false)
    expect(chaveApiConfigurada({ ANTHROPIC_API_KEY: "   " })).toBe(false)
    expect(chaveApiConfigurada({})).toBe(false)
  })
})

describe("dadosNaNuvem", () => {
  it("é verdadeira só com PLANEJAMENTO_DADOS=supabase (aparado)", () => {
    expect(dadosNaNuvem({ PLANEJAMENTO_DADOS: "supabase" })).toBe(true)
    expect(dadosNaNuvem({ PLANEJAMENTO_DADOS: " supabase " })).toBe(true)
    expect(dadosNaNuvem({ PLANEJAMENTO_DADOS: "fs" })).toBe(false)
    expect(dadosNaNuvem({ PLANEJAMENTO_DADOS: "" })).toBe(false)
    expect(dadosNaNuvem({})).toBe(false)
  })
})
