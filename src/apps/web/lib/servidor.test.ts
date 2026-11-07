import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pastaConfigClaude, servidor } from "./servidor"

const configsDeTurnos = vi.hoisted(() => [] as { urlApp: string }[])
// Só o que interessa: com o que o MCP é avisado. O resto do servidor() monta em pasta temporária.
vi.mock("@workspace/core/servico-turnos", () => ({
  ServicoTurnos: class {
    constructor(opcoes: { config: { urlApp: string } }) {
      configsDeTurnos.push(opcoes.config)
    }
  },
}))
vi.mock("@workspace/core/catalogo", () => ({ carregarCatalogo: () => ({}) }))

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

describe("servidor(): repositório de usuários", () => {
  const registro = globalThis as { __planejamento?: unknown; __planejamentoNuvem?: unknown }
  let raizTemporaria: string

  beforeEach(() => {
    delete registro.__planejamento
    delete registro.__planejamentoNuvem
    raizTemporaria = mkdtempSync(path.join(os.tmpdir(), "servidor-teste-"))
    vi.stubEnv("PLANEJAMENTO_ROOT", raizTemporaria)
    vi.stubEnv("PLANEJAMENTO_DADOS", "supabase")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste")
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    delete registro.__planejamento
    delete registro.__planejamentoNuvem
    rmSync(raizTemporaria, { recursive: true, force: true })
  })

  it("modo fs: sem repositório (null)", () => {
    vi.stubEnv("PLANEJAMENTO_DADOS", "fs")
    expect(servidor().usuarios).toBeNull()
  })

  it("modo supabase: sempre há repositório", () => {
    expect(servidor().usuarios).not.toBeNull()
    expect(typeof servidor().usuarios?.registrarAcesso).toBe("function")
  })

  it("modo supabase com nuvem em cache de versão antiga (sem usuarios): completa o repositório, nunca null", () => {
    registro.__planejamentoNuvem = { armazenamento: {}, memoria: {} }
    const usuarios = servidor().usuarios
    expect(usuarios).not.toBeNull()
    expect(typeof usuarios?.registrarAcesso).toBe("function")
  })

  it("modo supabase com servidor em cache de versão antiga (sem usuarios): completa o repositório, nunca null", () => {
    const atual = servidor()
    delete (atual as { usuarios?: unknown }).usuarios
    delete registro.__planejamentoNuvem
    const usuarios = servidor().usuarios
    expect(usuarios).not.toBeNull()
    expect(typeof usuarios?.registrarAcesso).toBe("function")
  })
})

describe("servidor(): endereço do app que o MCP chama", () => {
  const nomes = ["PLANEJAMENTO_ROOT", "PLANEJAMENTO_DADOS", "PLANEJAMENTO_APP_URL", "PLANEJAMENTO_URL_INTERNA", "PORT"] as const
  let raizTemporaria: string

  beforeEach(() => {
    delete (globalThis as { __planejamento?: unknown }).__planejamento
    configsDeTurnos.length = 0
    raizTemporaria = mkdtempSync(path.join(os.tmpdir(), "servidor-teste-"))
    vi.stubEnv("PLANEJAMENTO_ROOT", raizTemporaria)
    for (const n of nomes.slice(1)) vi.stubEnv(n, "")
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    delete (globalThis as { __planejamento?: unknown }).__planejamento
    rmSync(raizTemporaria, { recursive: true, force: true })
  })

  it("usa PLANEJAMENTO_URL_INTERNA quando definida, mesmo com PLANEJAMENTO_APP_URL pública", () => {
    vi.stubEnv("PLANEJAMENTO_URL_INTERNA", "http://127.0.0.1:8080")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    servidor()
    expect(configsDeTurnos[0]?.urlApp).toBe("http://127.0.0.1:8080")
  })

  it("sem ela, usa o endereço local na porta do app, ignorando PLANEJAMENTO_APP_URL", () => {
    vi.stubEnv("PORT", "4100")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    servidor()
    expect(configsDeTurnos[0]?.urlApp).toBe("http://127.0.0.1:4100")
  })

  it("sem PORT, a porta é 3000", () => {
    vi.stubEnv("PORT", undefined as unknown as string)
    delete process.env.PORT
    servidor()
    expect(configsDeTurnos[0]?.urlApp).toBe("http://127.0.0.1:3000")
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
