import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { servidor } from "./servidor"

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
})
