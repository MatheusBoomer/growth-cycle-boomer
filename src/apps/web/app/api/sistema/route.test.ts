import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoAutenticado } from "@workspace/core/erros"

const exigirAdmin = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirAdmin }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ raiz: "/nao/existe/mesmo" }) }))

// Registra cada comando chamado; `falham` lista os comandos que "não existem" na máquina do teste.
const chamadas = vi.hoisted(() => [] as string[])
const falham = vi.hoisted(() => new Set<string>())
vi.mock("node:child_process", () => ({
  execFile: (cmd: string, args: string[], _opcoes: unknown, cb: (e: Error | null, r?: { stdout: string; stderr: string }) => void) => {
    chamadas.push(cmd)
    if (falham.has(cmd)) cb(new Error("ENOENT"))
    else if (cmd === "claude" && args[0] === "auth") cb(null, { stdout: '{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"max"}', stderr: "" })
    else cb(null, { stdout: "ok", stderr: "" })
  },
}))

const { GET } = await import("./route")

const VARIAVEIS = ["PLANEJAMENTO_EXECUTOR", "PLANEJAMENTO_DADOS", "ANTHROPIC_API_KEY", "APIFY_TOKEN"] as const
const antes = new Map<string, string | undefined>()
const plataformaOriginal = Object.getOwnPropertyDescriptor(process, "platform")!

function plataforma(valor: string) {
  Object.defineProperty(process, "platform", { value: valor })
}

beforeEach(() => {
  for (const v of VARIAVEIS) {
    antes.set(v, process.env[v])
    delete process.env[v]
  }
  chamadas.length = 0
  falham.clear()
  exigirAdmin.mockReset()
  exigirAdmin.mockResolvedValue({ email: "ana.silva@boomer.com.br" })
})

afterEach(() => {
  for (const v of VARIAVEIS) {
    if (antes.get(v) === undefined) delete process.env[v]
    else process.env[v] = antes.get(v)
  }
  Object.defineProperty(process, "platform", plataformaOriginal)
})

describe("GET /api/sistema com o executor sdk (nuvem)", () => {
  beforeEach(() => {
    process.env.PLANEJAMENTO_EXECUTOR = "sdk"
    process.env.PLANEJAMENTO_DADOS = "supabase"
  })

  it("não executa claude --version nem claude auth status", async () => {
    await GET()
    expect(chamadas).not.toContain("claude")
  })

  it("devolve executor, nuvem e chaveApi sem expor o valor da chave", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-segredo"
    const corpo = await (await GET()).json()
    expect(corpo).toMatchObject({ executor: "sdk", nuvem: true, chaveApi: true })
    expect(JSON.stringify(corpo)).not.toContain("sk-ant-segredo")
  })

  it("sem chave, chaveApi é false", async () => {
    expect((await (await GET()).json()).chaveApi).toBe(false)
  })

  it("a prévia só tenta o soffice do macOS quando a plataforma é darwin", async () => {
    falham.add("soffice")
    plataforma("linux")
    expect((await (await GET()).json()).previa).toBe(false)
    expect(chamadas).not.toContain("/Applications/LibreOffice.app/Contents/MacOS/soffice")
    chamadas.length = 0
    plataforma("darwin")
    expect((await (await GET()).json()).previa).toBe(true)
    expect(chamadas).toContain("/Applications/LibreOffice.app/Contents/MacOS/soffice")
  })
})

describe("GET /api/sistema com o executor cli (local)", () => {
  it("segue verificando o Claude Code e responde como antes, mais os campos novos", async () => {
    const corpo = await (await GET()).json()
    expect(chamadas).toContain("claude")
    expect(corpo.claude).toEqual({ instalado: true, versao: "ok", logado: true, metodo: "claude.ai", plano: "max" })
    expect(corpo).toMatchObject({ executor: "cli", nuvem: false, chaveApi: false })
  })

  it("exige usuário", async () => {
    exigirAdmin.mockRejectedValue(new ErroNaoAutenticado())
    const resposta = await GET()
    expect(resposta.status).toBe(401)
    expect(chamadas).toEqual([])
  })
})
