import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pastaConfigClaude, servidor } from "./servidor"

// loadEnvConfig guarda um retrato do process.env na primeira chamada e o restaura nas seguintes, o que desfaz o
// valor que cada teste define. O que se testa aqui é a escolha do modo, não a leitura do .env.
vi.mock("@next/env", () => ({ loadEnvConfig: () => ({}) }))

const VARIAVEIS = ["PLANEJAMENTO_ROOT", "PLANEJAMENTO_DADOS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const

describe("servidor(): modo de dados supabase", () => {
  let raizTemporaria: string
  const antes = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const v of VARIAVEIS) antes.set(v, process.env[v])
    delete (globalThis as { __planejamento?: unknown }).__planejamento
    raizTemporaria = mkdtempSync(path.join(os.tmpdir(), "servidor-teste-"))
    process.env.PLANEJAMENTO_ROOT = raizTemporaria
    process.env.PLANEJAMENTO_DADOS = "supabase"
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    for (const v of VARIAVEIS) {
      if (antes.get(v) === undefined) delete process.env[v]
      else process.env[v] = antes.get(v)
    }
    delete (globalThis as { __planejamento?: unknown }).__planejamento
    rmSync(raizTemporaria, { recursive: true, force: true })
  })

  it("sem SUPABASE_URL e chave de serviço, falha com a mensagem exata", () => {
    expect(() => servidor()).toThrow(
      "PLANEJAMENTO_DADOS=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env da raiz.",
    )
  })

  it("valor inválido falha com a mensagem exata, sem criar nada", () => {
    process.env.PLANEJAMENTO_DADOS = "supabse"
    expect(() => servidor()).toThrow('PLANEJAMENTO_DADOS inválido: "supabse" (use fs ou supabase).')
    expect((globalThis as { __planejamento?: unknown }).__planejamento).toBeUndefined()
  })

  it("maiúscula não vale: Supabase é inválido", () => {
    process.env.PLANEJAMENTO_DADOS = "Supabase"
    expect(() => servidor()).toThrow('PLANEJAMENTO_DADOS inválido: "Supabase" (use fs ou supabase).')
  })

  it('"supabase " com espaço vale como supabase (chega à checagem das variáveis)', () => {
    process.env.PLANEJAMENTO_DADOS = "supabase "
    expect(() => servidor()).toThrow("PLANEJAMENTO_DADOS=supabase exige SUPABASE_URL")
  })
})

describe("pastaConfigClaude", () => {
  it("CLAUDE_CONFIG_DIR vazio (linha vazia no .env) cai no padrão ~/.claude", () => {
    expect(pastaConfigClaude("")).toBe(path.join(os.homedir(), ".claude"))
    expect(pastaConfigClaude("   ")).toBe(path.join(os.homedir(), ".claude"))
  })

  it("ausente cai no padrão ~/.claude", () => {
    expect(pastaConfigClaude(undefined)).toBe(path.join(os.homedir(), ".claude"))
  })

  it("valor definido é respeitado", () => {
    expect(pastaConfigClaude("/srv/claude")).toBe("/srv/claude")
  })
})
