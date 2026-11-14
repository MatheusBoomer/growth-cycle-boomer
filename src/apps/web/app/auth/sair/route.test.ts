import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const signOut = vi.fn()
const createServerClient = vi.fn()
type Opcoes = { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }
let aoSair: ((opcoes: Opcoes) => void) | null = null
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: [string, string, Opcoes]) => {
    createServerClient(...args)
    return {
      auth: {
        signOut: async (...a: unknown[]) => {
          aoSair?.(args[2])
          return signOut(...a)
        },
      },
    }
  },
}))

const { POST } = await import("./route")

function req(headers: Record<string, string> = {}) {
  const host = headers.host ?? "127.0.0.1:3000"
  return new NextRequest(`http://${host}/auth/sair`, { method: "POST", headers: { host, ...headers } })
}

describe("POST /auth/sair", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    signOut.mockReset()
    createServerClient.mockClear()
    aoSair = null
    signOut.mockResolvedValue({ error: null })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("chama signOut só da sessão atual e redireciona para /login com 303", async () => {
    const r = await POST(req())
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" })
    expect(r.status).toBe(303)
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login")
  })

  it("grava na resposta os cookies de limpeza", async () => {
    aoSair = (opcoes) => opcoes.cookies.setAll([{ name: "sb-x-auth-token", value: "", options: { path: "/", maxAge: 0 } }], {})
    const r = await POST(req())
    expect(r.cookies.get("sb-x-auth-token")?.value).toBe("")
  })

  it("signOut que falha ainda leva ao /login", async () => {
    signOut.mockRejectedValue(new Error("rede"))
    const r = await POST(req())
    expect(r.status).toBe(303)
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login")
  })

  it("atrás do balanceador, usa o host público", async () => {
    const r = await POST(req({ host: "localhost:8080", "x-forwarded-host": "planejamento.exemplo.com.br", "x-forwarded-proto": "https" }))
    expect(r.headers.get("location")).toBe("https://planejamento.exemplo.com.br/login")
  })

  it("modo off (local): volta para a tela de login sem tocar no Supabase", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "")
    const r = await POST(req())
    expect(r.status).toBe(303)
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login")
    expect(createServerClient).not.toHaveBeenCalled()
  })
})
