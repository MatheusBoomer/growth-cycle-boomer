import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Aqui NÃO há mock do @supabase/ssr: o fluxo roda com a biblioteca de verdade e só a rede (fetch) é falsa.
// Cobre o que o cliente falso dos outros testes não enxerga: a remoção do cookie de sessão no signOut e os
// atributos dos cookies que a biblioteca gera.
const { GET: entrar } = await import("./entrar/route")
const { GET: callback } = await import("./callback/route")
const { POST: sair } = await import("./sair/route")

const base64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")

function sessaoDe(email: string) {
  const agora = Math.floor(Date.now() / 1000)
  const usuario = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { email_verified: true },
    created_at: "2026-01-01T00:00:00Z",
  }
  // HS256 sem kid: o getClaims confere o token perguntando ao servidor (getUser), que aqui é o fetch falso.
  const token = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ ...usuario, sub: usuario.id, iss: "https://projeto.supabase.co/auth/v1", exp: agora + 3600, iat: agora, session_id: "s1" })}.assinatura`
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: agora + 3600, refresh_token: "refresh-1", user: usuario }
}

function stubRede(email: string) {
  const sessao = sessaoDe(email)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entrada: string | URL | Request) => {
      const url = String(entrada instanceof Request ? entrada.url : entrada)
      if (url.includes("/auth/v1/token")) return Response.json(sessao)
      if (url.includes("/auth/v1/user")) return Response.json(sessao.user)
      if (url.includes("/auth/v1/logout")) return new Response(null, { status: 204 })
      return Response.json({ error: `inesperado: ${url}` }, { status: 500 })
    }),
  )
}

function req(caminho: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}, metodo = "GET") {
  const host = "127.0.0.1:3000"
  const cookie = Object.entries(cookies)
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join("; ")
  return new NextRequest(`http://${host}${caminho}`, { method: metodo, headers: { host, ...(cookie ? { cookie } : {}), ...headers } })
}

/** Faz /auth/entrar de verdade e devolve os cookies que o navegador mandaria de volta no callback. */
async function cookiesDoNavegadorAposEntrar(headers: Record<string, string> = {}, proximo = "/prospects/a") {
  const r = await entrar(req(`/auth/entrar?proximo=${encodeURIComponent(proximo)}`, {}, headers))
  expect(r.status).toBe(307)
  return { resposta: r, cookies: Object.fromEntries(r.cookies.getAll().map((c) => [c.name, c.value])) }
}

const ehSessao = (nome: string) => nome.startsWith("sb-projeto-auth-token") && !nome.includes("code-verifier")

describe("fluxo de login com @supabase/ssr de verdade", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("conta de outro domínio: o cookie de sessão sai APAGADO na resposta de ?erro=dominio", async () => {
    stubRede("ana@gmail.com")
    const { cookies } = await cookiesDoNavegadorAposEntrar()
    const r = await callback(req("/auth/callback?code=codigo-do-google", cookies))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
    const sessao = r.cookies.getAll().filter((c) => ehSessao(c.name))
    expect(sessao.length).toBeGreaterThan(0)
    for (const c of sessao) {
      expect(c.value).toBe("")
      expect(c.maxAge).toBe(0)
    }
    // O destino guardado também é descartado.
    expect(r.cookies.get("planejamento-proximo")).toMatchObject({ value: "", maxAge: 0 })
  })

  it("conta da Boomer: o cookie de sessão sai VIVO e o destino é o do cookie planejamento-proximo", async () => {
    stubRede("ana@boomer.com.br")
    const { cookies } = await cookiesDoNavegadorAposEntrar()
    expect(cookies["planejamento-proximo"]).toBe("/prospects/a")
    const r = await callback(req("/auth/callback?code=codigo-do-google", cookies))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a")
    const sessao = r.cookies.getAll().filter((c) => ehSessao(c.name))
    expect(sessao.length).toBeGreaterThan(0)
    for (const c of sessao) expect(c.value).not.toBe("")
    expect(r.cookies.get("planejamento-proximo")).toMatchObject({ value: "", maxAge: 0 })
  })

  it("o cookie de proximo gravado por /auth/entrar volta intacto pelo transporte (query e & no valor)", async () => {
    stubRede("ana@boomer.com.br")
    const { cookies } = await cookiesDoNavegadorAposEntrar({}, "/prospects/a?etapa=03&x=1")
    const r = await callback(req("/auth/callback?code=c", cookies))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a?etapa=03&x=1")
  })

  describe("atributos dos cookies de sessão e do PKCE", () => {
    it("http: httpOnly, SameSite=Lax, path /, sem Secure (nem no verificador do PKCE nem na sessão)", async () => {
      stubRede("ana@boomer.com.br")
      const { resposta, cookies } = await cookiesDoNavegadorAposEntrar()
      const verificador = resposta.cookies.getAll().find((c) => c.name.includes("code-verifier"))
      expect(verificador).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" })
      expect(verificador?.secure).toBeFalsy()
      const r = await callback(req("/auth/callback?code=c", cookies))
      for (const c of r.cookies.getAll().filter((c) => ehSessao(c.name))) {
        expect(c).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" })
        expect(c.secure).toBeFalsy()
      }
    })

    it("https (x-forwarded-proto): os mesmos atributos e Secure", async () => {
      stubRede("ana@boomer.com.br")
      const https = { "x-forwarded-proto": "https" }
      const { resposta, cookies } = await cookiesDoNavegadorAposEntrar(https)
      const verificador = resposta.cookies.getAll().find((c) => c.name.includes("code-verifier"))
      expect(verificador).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: true })
      const r = await callback(req("/auth/callback?code=c", cookies, https))
      const sessao = r.cookies.getAll().filter((c) => ehSessao(c.name))
      expect(sessao.length).toBeGreaterThan(0)
      for (const c of sessao) expect(c).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: true })
    })

    it("PLANEJAMENTO_APP_URL https não torna Secure um cookie de requisição http local", async () => {
      stubRede("ana@boomer.com.br")
      const { cookies } = await cookiesDoNavegadorAposEntrar()
      const r = await callback(req("/auth/callback?code=c", cookies))
      for (const c of r.cookies.getAll().filter((c) => ehSessao(c.name))) expect(c.secure).toBeFalsy()
    })
  })

  it("sair apaga o cookie de sessão", async () => {
    stubRede("ana@boomer.com.br")
    const { cookies } = await cookiesDoNavegadorAposEntrar()
    const logado = await callback(req("/auth/callback?code=c", cookies))
    const doNavegador = Object.fromEntries(logado.cookies.getAll().filter((c) => ehSessao(c.name)).map((c) => [c.name, c.value]))
    const r = await sair(req("/auth/sair", doNavegador, {}, "POST"))
    expect(r.status).toBe(303)
    const sessao = r.cookies.getAll().filter((c) => ehSessao(c.name))
    expect(sessao.length).toBeGreaterThan(0)
    for (const c of sessao) expect(c).toMatchObject({ value: "", maxAge: 0 })
  })
})
