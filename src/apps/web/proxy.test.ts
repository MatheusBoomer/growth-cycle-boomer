import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getClaims = vi.fn()
let aoConsultar: ((opcoes: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => void) | null = null
const createServerClient = vi.fn((_url: string, _chave: string, opcoes: never) => ({
  auth: {
    getClaims: async () => {
      aoConsultar?.(opcoes)
      return getClaims()
    },
  },
}))
vi.mock("@supabase/ssr", () => ({ createServerClient: (...args: [string, string, never]) => createServerClient(...args) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))

const { proxy, config } = await import("./proxy")

const SESSAO_BOA = { data: { claims: { email: "ana@boomer.com.br", app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { email_verified: true } } }, error: null }

function req(caminho: string, opcoes: { metodo?: string; host?: string; headers?: Record<string, string> } = {}) {
  const host = opcoes.host ?? "127.0.0.1:3000"
  return new NextRequest(`http://${host}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: { host, ...opcoes.headers },
  })
}

describe("proxy no modo off", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "")
    getClaims.mockReset()
    createServerClient.mockClear()
    aoConsultar = null
  })
  afterEach(() => vi.unstubAllEnvs())

  it("deixa passar página e API com host local, sem tocar no Supabase", async () => {
    for (const caminho of ["/", "/prospects/a", "/api/prospects"]) {
      const r = await proxy(req(caminho))
      expect(r.status).toBe(200)
      expect(r.headers.get("x-middleware-next")).toBe("1")
    }
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("não exige variáveis do Supabase no modo off", async () => {
    vi.stubEnv("SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "")
    expect((await proxy(req("/"))).status).toBe(200)
  })

  it("recusa host de fora com 403 origem_recusada, também em página", async () => {
    for (const caminho of ["/", "/api/prospects"]) {
      const r = await proxy(req(caminho, { host: "evil.com" }))
      expect(r.status).toBe(403)
      expect(await r.json()).toEqual({ erro: "Requisição recusada: só a própria interface local pode chamar esta API.", codigo: "origem_recusada" })
    }
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("recusa escrita com Origin de outro site", async () => {
    const r = await proxy(req("/api/x", { metodo: "POST", headers: { origin: "http://evil.com" } }))
    expect(r.status).toBe(403)
  })

  it("valor inválido de PLANEJAMENTO_AUTH lança erro", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "OFF")
    await expect(proxy(req("/"))).rejects.toThrow('PLANEJAMENTO_AUTH inválido: "OFF" (use off ou google).')
  })
})

describe("proxy no modo google", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
    vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com")
    getClaims.mockReset()
    createServerClient.mockClear()
    aoConsultar = null
  })
  afterEach(() => vi.unstubAllEnvs())

  it("página sem sessão redireciona para /login?proximo=", async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const r = await proxy(req("/prospects/a?x=1"))
    expect(r.status).toBe(307)
    const destino = new URL(r.headers.get("location")!)
    expect(destino.pathname).toBe("/login")
    expect(destino.searchParams.get("proximo")).toBe("/prospects/a?x=1")
    expect(destino.host).toBe("127.0.0.1:3000")
  })

  it("o redirecionamento usa o protocolo encaminhado e o host público", async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const r = await proxy(req("/", { host: "planejamento.exemplo.com", headers: { "x-forwarded-proto": "https" } }))
    expect(new URL(r.headers.get("location")!).origin).toBe("https://planejamento.exemplo.com")
  })

  it("API sem sessão responde 401 JSON nao_autenticado", async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const r = await proxy(req("/api/prospects"))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ erro: "Você precisa entrar para continuar.", codigo: "nao_autenticado" })
  })

  it("sessão boa deixa passar", async () => {
    getClaims.mockResolvedValue(SESSAO_BOA)
    const r = await proxy(req("/prospects/a"))
    expect(r.status).toBe(200)
    expect(r.headers.get("x-middleware-next")).toBe("1")
  })

  it("sessão de domínio de fora ou que não é do Google conta como sem sessão", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { email: "x@gmail.com", app_metadata: { provider: "google" }, email_verified: true } }, error: null })
    expect((await proxy(req("/api/prospects"))).status).toBe(401)
    getClaims.mockResolvedValueOnce({ data: { claims: { email: "ana@boomer.com.br", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { email_verified: true } } }, error: null })
    expect((await proxy(req("/"))).status).toBe(307)
  })

  it("erro ou exceção do getClaims contam como sem sessão", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: new Error("jwt inválido") })
    expect((await proxy(req("/api/prospects"))).status).toBe(401)
    getClaims.mockRejectedValueOnce(new Error("rede"))
    expect((await proxy(req("/api/prospects"))).status).toBe(401)
  })

  it("host de fora responde 403 origem_recusada sem consultar o Supabase", async () => {
    const r = await proxy(req("/api/prospects", { host: "evil.com" }))
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ erro: "Requisição recusada: só a própria interface local pode chamar esta API.", codigo: "origem_recusada" })
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("aceita o host público de PLANEJAMENTO_APP_URL", async () => {
    getClaims.mockResolvedValue(SESSAO_BOA)
    expect((await proxy(req("/", { host: "planejamento.exemplo.com" }))).status).toBe(200)
  })

  it("rotas livres passam sem sessão e sem consultar o Supabase", async () => {
    for (const caminho of ["/login", "/auth/entrar", "/auth/callback?code=x", "/api/interno/mcp"]) {
      const r = await proxy(req(caminho))
      expect(r.status).toBe(200)
    }
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it("/api/interno pelo host público é recusado", async () => {
    const r = await proxy(req("/api/interno/mcp", { host: "planejamento.exemplo.com" }))
    expect(r.status).toBe(403)
  })

  it("cookies renovados vão para a requisição e para a resposta, com os cabeçalhos de cache", async () => {
    getClaims.mockResolvedValue(SESSAO_BOA)
    aoConsultar = (opcoes) =>
      opcoes.cookies.setAll([{ name: "sb-x-auth-token", value: "novo", options: { path: "/", httpOnly: true } }], {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
      })
    const entrada = req("/prospects/a")
    const r = await proxy(entrada)
    expect(entrada.cookies.get("sb-x-auth-token")?.value).toBe("novo")
    expect(r.cookies.get("sb-x-auth-token")?.value).toBe("novo")
    expect(r.headers.get("cache-control")).toContain("no-store")
    expect(r.headers.get("x-middleware-override-headers")).toContain("cookie")
  })

  it("a renovação grava cookies httpOnly e lax; Secure só quando a requisição é https", async () => {
    getClaims.mockResolvedValue(SESSAO_BOA)
    const opcoesDe = () => (createServerClient.mock.calls.at(-1) as unknown as [string, string, { cookieOptions: Record<string, unknown> }])[2].cookieOptions
    await proxy(req("/prospects/a"))
    expect(opcoesDe()).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: false })
    await proxy(req("/prospects/a", { headers: { "x-forwarded-proto": "https" } }))
    expect(opcoesDe()).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: true })
  })

  it("cookies renovados também vão na resposta de redirecionamento e na de 401", async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    aoConsultar = (opcoes) =>
      opcoes.cookies.setAll([{ name: "sb-x-auth-token", value: "", options: { path: "/", maxAge: 0 } }], { "Cache-Control": "private, no-store" })
    const pagina = await proxy(req("/"))
    expect(pagina.status).toBe(307)
    expect(pagina.cookies.get("sb-x-auth-token")).toBeDefined()
    expect(pagina.headers.get("cache-control")).toContain("no-store")
    const api = await proxy(req("/api/x"))
    expect(api.status).toBe(401)
    expect(api.cookies.get("sb-x-auth-token")).toBeDefined()
  })

  it("SUPABASE_URL só de espaços derruba o proxy (app fora do ar, não aberto)", async () => {
    vi.stubEnv("SUPABASE_URL", "   ")
    await expect(proxy(req("/prospects/a"))).rejects.toThrow("SUPABASE_URL")
  })
})

describe("matcher do proxy", () => {
  const padrao = (config.matcher as string[])[0]!
  // Converte o padrão do Next (path-to-regexp) no regex equivalente, só para testar a exclusão.
  const re = new RegExp(`^${padrao.replace(/^\/\(/, "/(")}$`)

  it("cobre páginas e APIs", () => {
    for (const caminho of ["/", "/login", "/prospects/a", "/api/prospects", "/api/interno/x", "/auth/callback", "/api/grafico.png"]) {
      expect(re.test(caminho), caminho).toBe(true)
    }
  })

  it("exclui estáticos do Next, favicon e imagens comuns", () => {
    for (const caminho of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/logo.png", "/a/b.svg", "/foto.jpg", "/foto.jpeg", "/x.gif", "/x.webp"]) {
      expect(re.test(caminho), caminho).toBe(false)
    }
  })
})
