import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const exchangeCodeForSession = vi.fn()
const getClaims = vi.fn()
const signOut = vi.fn()
const createServerClient = vi.fn()
type Opcoes = { cookies: { getAll: () => unknown; setAll: (c: unknown[], h: Record<string, string>) => void } }
let aoTrocar: ((opcoes: Opcoes) => void) | null = null
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: [string, string, Opcoes]) => {
    createServerClient(...args)
    return {
      auth: {
        exchangeCodeForSession: async (...a: unknown[]) => {
          aoTrocar?.(args[2])
          return exchangeCodeForSession(...a)
        },
        getClaims: (...a: unknown[]) => getClaims(...a),
        signOut: (...a: unknown[]) => signOut(...a),
      },
    }
  },
}))

// Só o que o callback usa do servidor: o repositório de usuários (null = modo sem Supabase).
const registrarAvatar = vi.fn()
const registrarAcesso = vi.fn()
type Usuarios = { registrarAvatar: typeof registrarAvatar; registrarAcesso: typeof registrarAcesso }
const estadoDoServidor: { usuarios: Usuarios | null } = { usuarios: { registrarAvatar, registrarAcesso } }
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ usuarios: estadoDoServidor.usuarios }) }))

const { GET } = await import("./route")

const claimsDe = (email: string, extra: Record<string, unknown> = {}) => ({
  data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { email_verified: true }, ...extra } },
  error: null,
})

const proximoCookie = (valor: string) => ({ cookie: `planejamento-proximo=${encodeURIComponent(valor)}` })

function req(caminho: string, headers: Record<string, string> = {}) {
  const host = headers.host ?? "127.0.0.1:3000"
  return new NextRequest(`http://${host}${caminho}`, { headers: { host, ...headers } })
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com.br")
    vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "")
    for (const f of [exchangeCodeForSession, getClaims, signOut, createServerClient]) f.mockReset()
    aoTrocar = null
    registrarAvatar.mockReset()
    registrarAvatar.mockResolvedValue(undefined)
    registrarAcesso.mockReset()
    registrarAcesso.mockResolvedValue("usuario")
    estadoDoServidor.usuarios = { registrarAvatar, registrarAcesso }
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null })
    signOut.mockResolvedValue({ error: null })
    getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br"))
  })
  afterEach(() => vi.unstubAllEnvs())

  it("sem code vai para /login?erro=falha, sem trocar nada", async () => {
    const r = await GET(req("/auth/callback"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("o provedor devolveu error (ex.: access_denied) vai para ?erro=falha", async () => {
    const r = await GET(req("/auth/callback?error=access_denied&code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it.each(["ana@boomer.com.br", "Ana@GestaoBoomer.com"])("com code e e-mail %s troca o código e vai para o proximo seguro", async (email) => {
    getClaims.mockResolvedValue(claimsDe(email))
    const r = await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a?etapa=03")))
    expect(exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("abc")
    expect(signOut).not.toHaveBeenCalled()
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a?etapa=03")
  })

  it("sem proximo vai para /", async () => {
    const r = await GET(req("/auth/callback?code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
  })

  it("proximo malicioso vai para / (revalidado aqui)", async () => {
    for (const ruim of ["//evil.com", "http://evil.com", "/\\evil.com", "evil.com", "/\t/evil.com"]) {
      const r = await GET(req("/auth/callback?code=abc", proximoCookie(ruim)))
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
    }
  })

  it("proximo duplamente codificado não é decodificado de novo (%2F%2Fevil.com fica sem barra inicial e cai em /)", async () => {
    const r = await GET(req("/auth/callback?code=abc", proximoCookie("%2F%2Fevil.com")))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
  })

  it("cookie forjado com valor malicioso (cru, sem passar por /auth/entrar) cai em /", async () => {
    for (const cru of ["//evil.com", "%2F%2Fevil.com", "http://evil.com", "/\\evil.com", "evil.com"]) {
      const r = await GET(req("/auth/callback?code=abc", { cookie: `planejamento-proximo=${cru}` }))
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
    }
  })

  it("o proximo da query não vale mais, só o do cookie", async () => {
    const r = await GET(req("/auth/callback?code=abc&proximo=%2Fprospects%2Fa"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
  })

  describe("cookie de boas-vindas (entrada só logo depois do login)", () => {
    type ComCookies = Response & { cookies: { get: (n: string) => unknown } }
    it("no sucesso grava o cookie de boas-vindas", async () => {
      const r = (await GET(req("/auth/callback?code=abc"))) as ComCookies
      expect(r.cookies.get("gc-boas-vindas")).toMatchObject({ value: "1", maxAge: 120, path: "/", sameSite: "lax", httpOnly: false })
    })

    it("atrás do proxy em https, o cookie de boas-vindas é secure como os da sessão", async () => {
      const r = (await GET(req("/auth/callback?code=abc", { "x-forwarded-proto": "https" }))) as ComCookies
      expect(r.cookies.get("gc-boas-vindas")).toMatchObject({ secure: true })
    })

    it("em erro=dominio e erro=falha não grava", async () => {
      getClaims.mockResolvedValueOnce(claimsDe("ana@gmail.com"))
      expect(((await GET(req("/auth/callback?code=abc"))) as ComCookies).cookies.get("gc-boas-vindas")).toBeUndefined()
      expect(((await GET(req("/auth/callback"))) as ComCookies).cookies.get("gc-boas-vindas")).toBeUndefined()
      exchangeCodeForSession.mockRejectedValueOnce(new Error("rede"))
      expect(((await GET(req("/auth/callback?code=abc"))) as ComCookies).cookies.get("gc-boas-vindas")).toBeUndefined()
    })
  })

  describe("o cookie planejamento-proximo é apagado em toda saída", () => {
    const apagado = (r: Response & { cookies: { get: (n: string) => unknown } }) =>
      expect(r.cookies.get("planejamento-proximo")).toMatchObject({ value: "", maxAge: 0, path: "/auth", httpOnly: true, sameSite: "lax" })

    it("no sucesso", async () => {
      apagado(await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a"))))
    })

    it("em erro=dominio", async () => {
      getClaims.mockResolvedValue(claimsDe("ana@gmail.com"))
      apagado(await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a"))))
    })

    it("em erro=falha: sem code, erro do provedor, troca com erro, claims com erro e exceção", async () => {
      apagado(await GET(req("/auth/callback", proximoCookie("/a"))))
      apagado(await GET(req("/auth/callback?error=access_denied&code=abc", proximoCookie("/a"))))
      exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("x") })
      apagado(await GET(req("/auth/callback?code=abc", proximoCookie("/a"))))
      getClaims.mockResolvedValueOnce({ data: null, error: new Error("jwks") })
      apagado(await GET(req("/auth/callback?code=abc", proximoCookie("/a"))))
      exchangeCodeForSession.mockRejectedValueOnce(new Error("rede"))
      apagado(await GET(req("/auth/callback?code=abc", proximoCookie("/a"))))
    })

    it("mesmo sem o cookie na requisição", async () => {
      apagado(await GET(req("/auth/callback?code=abc")))
    })
  })

  it("e-mail @gmail.com: signOut e /login?erro=dominio", async () => {
    getClaims.mockResolvedValue(claimsDe("ana@gmail.com"))
    const r = await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a")))
    expect(signOut).toHaveBeenCalledOnce()
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
  })

  it("domínios parecidos são recusados", async () => {
    for (const email of ["a@gestaoboomer.com.br", "a@boomer.com", "a@sub.boomer.com.br"]) {
      signOut.mockClear()
      getClaims.mockResolvedValue(claimsDe(email))
      const r = await GET(req("/auth/callback?code=abc"))
      expect(signOut).toHaveBeenCalledOnce()
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
    }
  })

  it("domínio certo mas sem prova de Google em app_metadata: signOut e ?erro=dominio", async () => {
    getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { app_metadata: { provider: "email", providers: ["email"] } }))
    const r = await GET(req("/auth/callback?code=abc"))
    expect(signOut).toHaveBeenCalledOnce()
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
  })

  it("e-mail_verified false: signOut e ?erro=dominio", async () => {
    getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { email_verified: false }))
    const r = await GET(req("/auth/callback?code=abc"))
    expect(signOut).toHaveBeenCalledOnce()
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
  })

  it("troca do código falha: ?erro=falha, sem consultar claims", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error("code invalid") })
    const r = await GET(req("/auth/callback?code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
    expect(getClaims).not.toHaveBeenCalled()
  })

  it("exceção na troca do código: ?erro=falha", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("rede"))
    const r = await GET(req("/auth/callback?code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
  })

  it("getClaims com erro: encerra a sessão e vai para ?erro=falha", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("jwks") })
    const r = await GET(req("/auth/callback?code=abc"))
    expect(signOut).toHaveBeenCalledOnce()
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=falha")
  })

  it("signOut que falha não impede o redirecionamento de recusa", async () => {
    getClaims.mockResolvedValue(claimsDe("ana@gmail.com"))
    signOut.mockRejectedValue(new Error("rede"))
    const r = await GET(req("/auth/callback?code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/login?erro=dominio")
  })

  it("atrás do balanceador, redireciona para o host público e não para localhost", async () => {
    const r = await GET(
      req("/auth/callback?code=abc", {
        ...proximoCookie("/prospects/a"),
        host: "localhost:8080",
        "x-forwarded-host": "planejamento.exemplo.com.br",
        "x-forwarded-proto": "https",
      }),
    )
    expect(r.headers.get("location")).toBe("https://planejamento.exemplo.com.br/prospects/a")
  })

  it("x-forwarded-host forjado não vira open redirect", async () => {
    const r = await GET(req("/auth/callback?code=abc", { "x-forwarded-host": "evil.com", "x-forwarded-proto": "https" }))
    expect(r.headers.get("location")).toBe("https://planejamento.exemplo.com.br/")
  })

  it("também no erro: o redirecionamento de /login usa o host público", async () => {
    const r = await GET(req("/auth/callback", { host: "localhost:8080", "x-forwarded-host": "planejamento.exemplo.com.br", "x-forwarded-proto": "https" }))
    expect(r.headers.get("location")).toBe("https://planejamento.exemplo.com.br/login?erro=falha")
  })

  it("lê os cookies da requisição e grava na resposta os que o Supabase manda gravar", async () => {
    aoTrocar = (opcoes) => {
      expect(opcoes.cookies.getAll()).toEqual([{ name: "sb-x-auth-token-code-verifier", value: "v" }])
      opcoes.cookies.setAll([{ name: "sb-x-auth-token", value: "tok", options: { path: "/", maxAge: 400 } }], { "cache-control": "private, no-store" })
    }
    const r = await GET(req("/auth/callback?code=abc", { cookie: "sb-x-auth-token-code-verifier=v" }))
    expect(r.cookies.get("sb-x-auth-token")?.value).toBe("tok")
    expect(r.headers.get("cache-control")).toBe("private, no-store")
  })

  it("modo off: não há login, vai para / sem tocar no Supabase", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "off")
    const r = await GET(req("/auth/callback?code=abc"))
    expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
    expect(createServerClient).not.toHaveBeenCalled()
  })

  describe("foto do Google", () => {
    const FOTO = "https://lh3.googleusercontent.com/a/abc=s96-c"

    it("foto válida em user_metadata: grava uma vez, com o e-mail normalizado", async () => {
      getClaims.mockResolvedValue(claimsDe("Ana@Boomer.com.br", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      const r = await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a")))
      expect(registrarAvatar).toHaveBeenCalledExactlyOnceWith("ana@boomer.com.br", FOTO)
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a")
    })

    it("foto inválida ou ausente: não grava e o login segue", async () => {
      getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { user_metadata: { email_verified: true, avatar_url: "https://evil.com/x.png" } }))
      const r = await GET(req("/auth/callback?code=abc"))
      expect(registrarAvatar).not.toHaveBeenCalled()
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
      getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br"))
      await GET(req("/auth/callback?code=abc"))
      expect(registrarAvatar).not.toHaveBeenCalled()
    })

    it("se registrarAvatar lançar, o login continua redirecionando normalmente", async () => {
      registrarAvatar.mockRejectedValue(new Error("banco fora"))
      const erro = vi.spyOn(console, "error").mockImplementation(() => {})
      getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      const r = await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a")))
      expect(registrarAvatar).toHaveBeenCalledOnce()
      expect(signOut).not.toHaveBeenCalled()
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a")
      erro.mockRestore()
    })

    it("primeiro login com foto válida: registrarAcesso roda antes de registrarAvatar, ambos com o e-mail normalizado", async () => {
      getClaims.mockResolvedValue(claimsDe("Ana@Boomer.com.br", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      await GET(req("/auth/callback?code=abc"))
      expect(registrarAcesso).toHaveBeenCalledExactlyOnceWith("ana@boomer.com.br")
      expect(registrarAvatar).toHaveBeenCalledExactlyOnceWith("ana@boomer.com.br", FOTO)
      expect(registrarAcesso.mock.invocationCallOrder[0]!).toBeLessThan(registrarAvatar.mock.invocationCallOrder[0]!)
    })

    it("sem foto válida, registrarAcesso roda mesmo assim e registrarAvatar não", async () => {
      await GET(req("/auth/callback?code=abc"))
      expect(registrarAcesso).toHaveBeenCalledExactlyOnceWith("ana@boomer.com.br")
      expect(registrarAvatar).not.toHaveBeenCalled()
    })

    it("se registrarAcesso lançar, o login continua redirecionando normalmente", async () => {
      registrarAcesso.mockRejectedValue(new Error("banco fora"))
      const erro = vi.spyOn(console, "error").mockImplementation(() => {})
      getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      const r = await GET(req("/auth/callback?code=abc", proximoCookie("/prospects/a")))
      expect(signOut).not.toHaveBeenCalled()
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/prospects/a")
      erro.mockRestore()
    })

    it("modo disco (usuarios null): não grava e o login segue", async () => {
      estadoDoServidor.usuarios = null
      getClaims.mockResolvedValue(claimsDe("ana@boomer.com.br", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      const r = await GET(req("/auth/callback?code=abc"))
      expect(registrarAvatar).not.toHaveBeenCalled()
      expect(registrarAcesso).not.toHaveBeenCalled()
      expect(r.headers.get("location")).toBe("http://127.0.0.1:3000/")
    })

    it("login recusado (domínio) não grava foto", async () => {
      getClaims.mockResolvedValue(claimsDe("ana@gmail.com", { user_metadata: { email_verified: true, avatar_url: FOTO } }))
      await GET(req("/auth/callback?code=abc"))
      expect(registrarAvatar).not.toHaveBeenCalled()
      expect(registrarAcesso).not.toHaveBeenCalled()
    })
  })
})
