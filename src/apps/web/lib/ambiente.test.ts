import path from "node:path"
import { loadEnvConfig } from "@next/env"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// O @next/env é falso para todos os testes (vitest.setup.ts); aqui só se conferem as chamadas.
const carregar = vi.mocked(loadEnvConfig)
const registro = globalThis as { __planejamentoAmbiente?: unknown }

describe("lib/ambiente", () => {
  beforeEach(() => {
    delete registro.__planejamentoAmbiente
    carregar.mockClear()
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete registro.__planejamentoAmbiente
  })

  it("carrega o .env da raiz (três níveis acima do app) ao ser importado, como o servidor() fazia", async () => {
    vi.stubEnv("PLANEJAMENTO_ROOT", undefined)
    vi.stubEnv("NODE_ENV", "development")
    await import("./ambiente")
    expect(carregar).toHaveBeenCalledTimes(1)
    expect(carregar).toHaveBeenCalledWith(path.resolve(process.cwd(), "../../.."), true, undefined, true)
  })

  it("usa PLANEJAMENTO_ROOT quando definida, e em produção não liga o modo dev", async () => {
    vi.stubEnv("PLANEJAMENTO_ROOT", "/raiz/do/projeto")
    vi.stubEnv("NODE_ENV", "production")
    const { raizDoProjeto } = await import("./ambiente")
    expect(carregar).toHaveBeenCalledWith("/raiz/do/projeto", false, undefined, true)
    expect(raizDoProjeto()).toBe("/raiz/do/projeto")
  })

  it("o valor do .env vence o que já veio do terminal (ex.: uma chave antiga exportada no ~/.zshrc)", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-antiga-do-terminal")
    vi.stubEnv("SO_DO_TERMINAL", "fica")
    carregar.mockReturnValueOnce({
      combinedEnv: {},
      parsedEnv: undefined,
      loadedEnvFiles: [{ path: ".env", contents: "", env: { SUPABASE_SERVICE_ROLE_KEY: "chave-do-env" } }],
    })
    await import("./ambiente")
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe("chave-do-env")
    expect(process.env.SO_DO_TERMINAL).toBe("fica")
  })

  it("é idempotente: importar de novo (outro pacote do Next) ou chamar carregarAmbiente não carrega outra vez", async () => {
    const { carregarAmbiente } = await import("./ambiente")
    carregarAmbiente()
    carregarAmbiente()
    vi.resetModules()
    await import("./ambiente")
    expect(carregar).toHaveBeenCalledTimes(1)
  })
})
