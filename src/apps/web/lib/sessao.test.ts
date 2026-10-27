import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoAutenticado } from "@workspace/core/erros"

const getClaims = vi.fn()
const createServerClient = vi.fn()
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    createServerClient(...args)
    return { auth: { getClaims } }
  },
}))

const cookieStore = { getAll: vi.fn(() => [{ name: "sb-x-auth-token", value: "abc" }]), set: vi.fn() }
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }))

const { configuracaoSupabase, exigirUsuario, usuarioDaRequisicao, usuarioDeClaims } = await import("./sessao")

const DOMINIOS = ["boomer.com.br", "gestaoboomer.com"]

describe("usuarioDeClaims", () => {
  it("aceita e-mail verificado em user_metadata e devolve em minúsculas", () => {
    const claims = { email: "Ana.Silva@Boomer.com.br", user_metadata: { email_verified: true } }
    expect(usuarioDeClaims(claims, DOMINIOS)).toEqual({ email: "ana.silva@boomer.com.br" })
  })

  it("aceita e-mail verificado no topo das claims", () => {
    expect(usuarioDeClaims({ email: "a@gestaoboomer.com", email_verified: true }, DOMINIOS)).toEqual({ email: "a@gestaoboomer.com" })
  })

  it("recusa sem email, com email que não é texto ou vazio", () => {
    expect(usuarioDeClaims({ email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: 42, email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: ["a@boomer.com.br"], email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "", email_verified: true }, DOMINIOS)).toBeNull()
  })

  it("recusa e-mail não verificado, ausente ou que não é booleano verdadeiro", () => {
    expect(usuarioDeClaims({ email: "a@boomer.com.br" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", email_verified: false }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", user_metadata: { email_verified: false } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", user_metadata: {} }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", email_verified: "true" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", user_metadata: { email_verified: 1 } }, DOMINIOS)).toBeNull()
  })

  it("um false explícito vence um true em outro lugar", () => {
    expect(usuarioDeClaims({ email: "a@boomer.com.br", email_verified: true, user_metadata: { email_verified: false } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", email_verified: false, user_metadata: { email_verified: true } }, DOMINIOS)).toBeNull()
  })

  it("recusa domínio de fora, inclusive parecido", () => {
    for (const email of ["a@gmail.com", "a@boomer.com", "a@gestaoboomer.com.br", "a@sub.boomer.com.br", "a@boomer.com.br.evil.com"]) {
      expect(usuarioDeClaims({ email, email_verified: true }, DOMINIOS)).toBeNull()
    }
  })

  it("recusa null, formas estranhas e user_metadata que não é objeto", () => {
    expect(usuarioDeClaims(null, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims(undefined, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims("a@boomer.com.br", DOMINIOS)).toBeNull()
    expect(usuarioDeClaims(["x"], DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({}, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", user_metadata: "x" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", user_metadata: null }, DOMINIOS)).toBeNull()
  })
})

describe("configuracaoSupabase", () => {
  it("devolve url e chave aparadas", () => {
    expect(configuracaoSupabase({ SUPABASE_URL: " https://x.supabase.co ", SUPABASE_PUBLISHABLE_KEY: " sb_publishable_x " })).toEqual({
      url: "https://x.supabase.co",
      chave: "sb_publishable_x",
    })
  })

  it("trata variável só de espaços como ausente, com a mensagem do core", () => {
    expect(() => configuracaoSupabase({ SUPABASE_URL: "   ", SUPABASE_PUBLISHABLE_KEY: "k" })).toThrow("PLANEJAMENTO_AUTH=google exige SUPABASE_URL no .env da raiz.")
    expect(() => configuracaoSupabase({ SUPABASE_URL: "https://x", SUPABASE_PUBLISHABLE_KEY: " \t" })).toThrow("PLANEJAMENTO_AUTH=google exige SUPABASE_PUBLISHABLE_KEY no .env da raiz.")
    expect(() => configuracaoSupabase({})).toThrow("SUPABASE_URL")
  })
})

describe("usuarioDaRequisicao e exigirUsuario", () => {
  beforeEach(() => {
    getClaims.mockReset()
    createServerClient.mockClear()
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
    vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "")
  })
  afterEach(() => vi.unstubAllEnvs())

  describe("modo off", () => {
    beforeEach(() => vi.stubEnv("PLANEJAMENTO_AUTH", ""))

    it("devolve { email: null } sem criar cliente nem consultar o Supabase", async () => {
      expect(await usuarioDaRequisicao()).toEqual({ email: null })
      expect(await exigirUsuario()).toEqual({ email: null })
      expect(createServerClient).not.toHaveBeenCalled()
      expect(getClaims).not.toHaveBeenCalled()
    })

    it("não exige variáveis do Supabase", async () => {
      vi.stubEnv("SUPABASE_URL", "")
      vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "")
      expect(await usuarioDaRequisicao()).toEqual({ email: null })
    })
  })

  describe("modo google", () => {
    beforeEach(() => vi.stubEnv("PLANEJAMENTO_AUTH", "google"))

    it("cria o cliente com url, chave publicável e os cookies da requisição", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", user_metadata: { email_verified: true } } }, error: null })
      expect(await usuarioDaRequisicao()).toEqual({ email: "ana@boomer.com.br" })
      const [url, chave, opcoes] = createServerClient.mock.calls[0] as [string, string, { cookies: { getAll: () => unknown } }]
      expect(url).toBe("https://projeto.supabase.co")
      expect(chave).toBe("sb_publishable_teste")
      expect(opcoes.cookies.getAll()).toEqual([{ name: "sb-x-auth-token", value: "abc" }])
    })

    it("sem sessão devolve null e exigirUsuario lança ErroNaoAutenticado", async () => {
      getClaims.mockResolvedValue({ data: null, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
      await expect(exigirUsuario()).rejects.toBeInstanceOf(ErroNaoAutenticado)
    })

    it("erro do getClaims, exceção ou domínio de fora contam como não autenticado", async () => {
      getClaims.mockResolvedValueOnce({ data: null, error: new Error("jwt inválido") })
      expect(await usuarioDaRequisicao()).toBeNull()
      getClaims.mockRejectedValueOnce(new Error("rede"))
      expect(await usuarioDaRequisicao()).toBeNull()
      getClaims.mockResolvedValueOnce({ data: { claims: { email: "x@gmail.com", email_verified: true } }, error: null })
      await expect(exigirUsuario()).rejects.toBeInstanceOf(ErroNaoAutenticado)
    })

    it("e-mail não verificado conta como não autenticado", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br" } }, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
    })

    it("respeita PLANEJAMENTO_DOMINIOS_PERMITIDOS", async () => {
      vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "outra.com")
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", email_verified: true } }, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
    })

    it("falha cedo se faltar a variável do Supabase", async () => {
      vi.stubEnv("SUPABASE_URL", "  ")
      await expect(usuarioDaRequisicao()).rejects.toThrow("SUPABASE_URL")
    })
  })

  it("valor inválido de PLANEJAMENTO_AUTH lança erro", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "Google")
    await expect(usuarioDaRequisicao()).rejects.toThrow('PLANEJAMENTO_AUTH inválido: "Google" (use off ou google).')
  })
})
