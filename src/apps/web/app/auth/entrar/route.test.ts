import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const signInWithOAuth = vi.fn()
const createServerClient = vi.fn()
let aoEntrar: ((opcoes: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => void) | null = null
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: [string, string, { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }]) => {
    createServerClient(...args)
    return {
      auth: {
        signInWithOAuth: async (...a: unknown[]) => {
          aoEntrar?.(args[2])
          return signInWithOAuth(...a)
        },
      },
    }
  },
}))

const { GET } = await import("./route")

function req(caminho: string, headers: Record<string, string> = {}) {
  const host = headers.host ?? "127.0.0.1:3000"
  return new NextRequest(`http://${host}${caminho}`, { headers: { host, ...headers } })
}

describe("GET /auth/entrar", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    signInWithOAuth.mockReset()
    createServerClient.mockClear()
    aoEntrar = null
    signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth?x=1", provider: "google" }, error: null })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("chama signInWithOAuth com google, redirectTo no endereço público e sem hd, e redireciona para a url devolvida", async () => {
    const r = await GET(req("/auth/entrar?proximo=%2Fprospects%2Fa"))
    expect(signInWithOAuth).toHaveBeenCalledOnce()
    const arg = signInWithOAuth.mock.calls[0]![0] as { provider: string; options: { redirectTo: string; queryParams?: Record<string, string> } }
    expect(arg.provider).toBe("google")
    expect(arg.options.redirectTo).toBe("https://planejamento.exemplo.com.br/auth/callback?proximo=%2Fprospects%2Fa")
    expect(arg.options.queryParams?.hd).toBeUndefined()
    expect(JSON.stringify(arg)).not.toContain("hd")
    expect(r.status).toBe(307)
    expect(r.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/auth?x=1")
  })

  it("sem proximo, o destino do callback é /", async () => {
    await GET(req("/auth/entrar"))
    const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } }
    expect(arg.options.redirectTo).toBe("https://planejamento.exemplo.com.br/auth/callback?proximo=%2F")
  })

  it("proximo malicioso vira / no redirectTo", async () => {
    for (const ruim of ["//evil.com", "http://evil.com", "/\\evil.com", "%2F%2Fevil.com", "evil.com"]) {
      signInWithOAuth.mockClear()
      await GET(req(`/auth/entrar?proximo=${encodeURIComponent(ruim)}`))
      const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } }
      expect(arg.options.redirectTo).toBe("https://planejamento.exemplo.com.br/auth/callback?proximo=%2F")
    }
  })

  it("proximo com query é codificado uma vez só", async () => {
    await GET(req(`/auth/entrar?proximo=${encodeURIComponent("/prospects/a?etapa=03&x=1")}`))
    const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } }
    const url = new URL(arg.options.redirectTo)
    expect(url.searchParams.get("proximo")).toBe("/prospects/a?etapa=03&x=1")
  })

  it("grava os cookies do PKCE na resposta", async () => {
    aoEntrar = (opcoes) => opcoes.cookies.setAll([{ name: "sb-x-auth-token-code-verifier", value: "v", options: { path: "/", maxAge: 600 } }], { "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0" })
    const r = await GET(req("/auth/entrar"))
    expect(r.cookies.get("sb-x-auth-token-code-verifier")?.value).toBe("v")
    expect(r.headers.get("cache-control")).toContain("no-store")
  })

  it("erro do Supabase redireciona para /login?erro=falha", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null, provider: "google" }, error: new Error("fora do ar") })
    const r = await GET(req("/auth/entrar"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
  })

  it("exceção ao chamar o Supabase também vira ?erro=falha", async () => {
    signInWithOAuth.mockRejectedValue(new Error("rede"))
    const r = await GET(req("/auth/entrar"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
  })

  it("url devolvida que não é http(s) vira ?erro=falha", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: "javascript:alert(1)", provider: "google" }, error: null })
    const r = await GET(req("/auth/entrar"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
  })

  it("sem PLANEJAMENTO_APP_URL, o redirectTo usa a origem local da requisição", async () => {
    vi.stubEnv("PLANEJAMENTO_APP_URL", "")
    await GET(req("/auth/entrar"))
    const arg = signInWithOAuth.mock.calls[0]![0] as { options: { redirectTo: string } }
    expect(arg.options.redirectTo).toBe("http://127.0.0.1:3000/auth/callback?proximo=%2F")
  })

  it("modo off: não há login, vai para / sem tocar no Supabase", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "")
    const r = await GET(req("/auth/entrar"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
    expect(createServerClient).not.toHaveBeenCalled()
  })
})
