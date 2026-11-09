import { describe, expect, it } from "vitest"
import { chaveApiConfigurada, dadosNaNuvem, executorDoAmbiente } from "../src/sistema"

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
