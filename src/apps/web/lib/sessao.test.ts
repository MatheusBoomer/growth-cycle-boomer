import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErroEntrada, ErroNaoAutenticado, ErroNaoEncontrado, ErroSemPermissao } from "@workspace/core/erros"

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

// Só o que a sessão usa do servidor: o repositório de usuários (null = modo sem Supabase) e o serviço.
const registrarAcesso = vi.fn()
const prospectVisivel = vi.fn()
const estadoDoServidor: { usuarios: { registrarAcesso: typeof registrarAcesso } | null } = { usuarios: { registrarAcesso } }
vi.mock("@/lib/servidor", () => ({
  servidor: () => ({ usuarios: estadoDoServidor.usuarios, servico: { prospectVisivel } }),
}))

const { clienteSupabaseDoServidor, configuracaoSupabase, exigirAcessoAoProspect, exigirAdmin, exigirUsuario, usuarioDaRequisicao, usuarioDeClaims } = await import("./sessao")

const DOMINIOS = ["boomer.com.br", "gestaoboomer.com"]

const GOOGLE = { provider: "google", providers: ["google"] }

describe("usuarioDeClaims", () => {
  it("aceita conta Google com e-mail verificado em user_metadata e devolve em minúsculas", () => {
    const claims = { email: "Ana.Silva@Boomer.com.br", app_metadata: GOOGLE, user_metadata: { email_verified: true } }
    expect(usuarioDeClaims(claims, DOMINIOS)).toEqual({ email: "ana.silva@boomer.com.br" })
  })

  it("e-mail com espaço nas pontas é recusado antes de normalizar (emailPermitido não tolera espaço)", () => {
    expect(usuarioDeClaims({ email: "  Ana@Boomer.com.br ", app_metadata: GOOGLE }, DOMINIOS)).toBeNull()
  })

  it("aceita conta Google com e-mail verificado no topo das claims", () => {
    expect(usuarioDeClaims({ email: "a@gestaoboomer.com", app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toEqual({ email: "a@gestaoboomer.com" })
  })

  it("com o Google como provedor, indicador de verificado ausente é aceito", () => {
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: GOOGLE }, DOMINIOS)).toEqual({ email: "a@boomer.com.br" })
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: GOOGLE, user_metadata: {} }, DOMINIOS)).toEqual({ email: "a@boomer.com.br" })
  })

  it("aceita o Google por provider ou por providers, inclusive junto de email", () => {
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: { provider: "google" } }, DOMINIOS)).not.toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: { providers: ["google"] } }, DOMINIOS)).not.toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: { provider: "email", providers: ["email", "google"] } }, DOMINIOS)).not.toBeNull()
  })

  it("ATAQUE: conta de e-mail/senha com user_metadata.email_verified forjado como true é recusada", () => {
    const forjado = { email: "ana@boomer.com.br", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { email_verified: true } }
    expect(usuarioDeClaims(forjado, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...forjado, email_verified: true }, DOMINIOS)).toBeNull()
  })

  it("recusa app_metadata ausente, que não é objeto ou sem o Google", () => {
    const base = { email: "a@boomer.com.br", user_metadata: { email_verified: true }, email_verified: true }
    expect(usuarioDeClaims(base, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: null }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: "google" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: ["google"] }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: {} }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: { providers: "google" } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: { providers: [] } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: { providers: ["email", "github"] } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, app_metadata: { provider: "Google", providers: ["GOOGLE"] } }, DOMINIOS)).toBeNull()
  })

  it("recusa sem email, com email que não é texto ou vazio", () => {
    expect(usuarioDeClaims({ app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: 42, app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: ["a@boomer.com.br"], app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "", app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toBeNull()
  })

  it("recusa indicador de verificado presente que não seja o booleano true, mesmo com o Google", () => {
    const base = { email: "a@boomer.com.br", app_metadata: GOOGLE }
    expect(usuarioDeClaims({ ...base, email_verified: false }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, user_metadata: { email_verified: false } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, email_verified: "true" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, email_verified: "false" }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, user_metadata: { email_verified: 1 } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, user_metadata: { email_verified: null } }, DOMINIOS)).toBeNull()
  })

  it("um false explícito vence um true em outro lugar", () => {
    const base = { email: "a@boomer.com.br", app_metadata: GOOGLE }
    expect(usuarioDeClaims({ ...base, email_verified: true, user_metadata: { email_verified: false } }, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ ...base, email_verified: false, user_metadata: { email_verified: true } }, DOMINIOS)).toBeNull()
  })

  it("recusa domínio de fora, inclusive parecido", () => {
    for (const email of ["a@gmail.com", "a@boomer.com", "a@gestaoboomer.com.br", "a@sub.boomer.com.br", "a@boomer.com.br.evil.com"]) {
      expect(usuarioDeClaims({ email, app_metadata: GOOGLE, email_verified: true }, DOMINIOS)).toBeNull()
    }
  })

  it("recusa null, formas estranhas e user_metadata que não é objeto", () => {
    expect(usuarioDeClaims(null, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims(undefined, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims("a@boomer.com.br", DOMINIOS)).toBeNull()
    expect(usuarioDeClaims(["x"], DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({}, DOMINIOS)).toBeNull()
    expect(usuarioDeClaims({ email: "a@boomer.com.br", app_metadata: GOOGLE, user_metadata: "x" }, DOMINIOS)).toBeNull()
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

describe("clienteSupabaseDoServidor: atributos dos cookies", () => {
  const env = { SUPABASE_URL: "https://projeto.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste" }
  const armazem = { getAll: () => [], setAll: () => {} }
  const cookieOptions = () => (createServerClient.mock.calls.at(-1) as unknown as [string, string, { cookieOptions: Record<string, unknown> }])[2].cookieOptions

  it("requisição http: httpOnly, lax, path / e sem Secure", () => {
    clienteSupabaseDoServidor(armazem, false, env)
    expect(cookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: false })
  })

  it("requisição https: os mesmos atributos e Secure", () => {
    clienteSupabaseDoServidor(armazem, true, env)
    expect(cookieOptions()).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: true })
  })
})

describe("usuarioDaRequisicao e exigirUsuario", () => {
  beforeEach(() => {
    getClaims.mockReset()
    createServerClient.mockClear()
    registrarAcesso.mockReset()
    prospectVisivel.mockReset()
    estadoDoServidor.usuarios = { registrarAcesso }
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
    vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "")
  })
  afterEach(() => vi.unstubAllEnvs())

  describe("modo off", () => {
    beforeEach(() => vi.stubEnv("PLANEJAMENTO_AUTH", ""))

    it("devolve admin sem e-mail, sem criar cliente, consultar o Supabase nem registrar acesso", async () => {
      expect(await usuarioDaRequisicao()).toEqual({ email: null, papel: "admin" })
      expect(await exigirUsuario()).toEqual({ email: null, papel: "admin" })
      expect(await exigirAdmin()).toEqual({ email: null, papel: "admin" })
      expect(createServerClient).not.toHaveBeenCalled()
      expect(getClaims).not.toHaveBeenCalled()
      expect(registrarAcesso).not.toHaveBeenCalled()
    })

    it("não exige variáveis do Supabase", async () => {
      vi.stubEnv("SUPABASE_URL", "")
      vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "")
      expect(await usuarioDaRequisicao()).toEqual({ email: null, papel: "admin" })
    })
  })

  describe("modo google", () => {
    beforeEach(() => vi.stubEnv("PLANEJAMENTO_AUTH", "google"))

    it("cria o cliente com url, chave publicável e os cookies da requisição", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, user_metadata: { email_verified: true } } }, error: null })
      registrarAcesso.mockResolvedValue("usuario")
      expect(await usuarioDaRequisicao()).toEqual({ email: "ana@boomer.com.br", papel: "usuario" })
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
      getClaims.mockResolvedValueOnce({ data: { claims: { email: "x@gmail.com", app_metadata: GOOGLE, email_verified: true } }, error: null })
      await expect(exigirUsuario()).rejects.toBeInstanceOf(ErroNaoAutenticado)
    })

    it("conta que não é do Google (e-mail forjado em user_metadata) conta como não autenticado", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { email_verified: true } } }, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
    })

    it("respeita PLANEJAMENTO_DOMINIOS_PERMITIDOS", async () => {
      vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "outra.com")
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
    })

    it("registra o acesso com o e-mail normalizado e devolve o papel que o repositório disser", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "Ana@Boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
      registrarAcesso.mockResolvedValue("admin")
      expect(await usuarioDaRequisicao()).toEqual({ email: "ana@boomer.com.br", papel: "admin" })
      expect(registrarAcesso).toHaveBeenCalledWith("ana@boomer.com.br")
    })

    it("sem repositório de usuários (modo fs), sessão válida vale como admin", async () => {
      estadoDoServidor.usuarios = null
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
      expect(await usuarioDaRequisicao()).toEqual({ email: "ana@boomer.com.br", papel: "admin" })
    })

    it("sem sessão válida não registra acesso", async () => {
      getClaims.mockResolvedValue({ data: null, error: null })
      expect(await usuarioDaRequisicao()).toBeNull()
      expect(registrarAcesso).not.toHaveBeenCalled()
    })

    it("falha ao registrar acesso sobe o erro: nunca vira null nem admin", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
      registrarAcesso.mockRejectedValue(new Error("banco fora do ar"))
      await expect(usuarioDaRequisicao()).rejects.toThrow("banco fora do ar")
      await expect(exigirUsuario()).rejects.toThrow("banco fora do ar")
    })

    it("exigirAdmin: usuário comum recebe ErroSemPermissao; admin passa; sem sessão é 401", async () => {
      getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
      registrarAcesso.mockResolvedValue("usuario")
      await expect(exigirAdmin()).rejects.toBeInstanceOf(ErroSemPermissao)
      registrarAcesso.mockResolvedValue("admin")
      expect(await exigirAdmin()).toEqual({ email: "ana@boomer.com.br", papel: "admin" })
      getClaims.mockResolvedValue({ data: null, error: null })
      await expect(exigirAdmin()).rejects.toBeInstanceOf(ErroNaoAutenticado)
    })

    describe("exigirAcessoAoProspect", () => {
      beforeEach(() => {
        getClaims.mockResolvedValue({ data: { claims: { email: "ana@boomer.com.br", app_metadata: GOOGLE, email_verified: true } }, error: null })
        registrarAcesso.mockResolvedValue("usuario")
      })

      it("sem sessão é 401 e nem consulta o prospect", async () => {
        getClaims.mockResolvedValue({ data: null, error: null })
        await expect(exigirAcessoAoProspect(Promise.resolve({ slug: "x" }))).rejects.toBeInstanceOf(ErroNaoAutenticado)
        expect(prospectVisivel).not.toHaveBeenCalled()
      })

      it("prospect não visível: 404 com a mensagem padrão", async () => {
        prospectVisivel.mockResolvedValue(false)
        const erro = await exigirAcessoAoProspect(Promise.resolve({ slug: "x" })).catch((e) => e)
        expect(erro).toBeInstanceOf(ErroNaoEncontrado)
        expect(erro.message).toBe("Projeto não encontrado.")
        expect(prospectVisivel).toHaveBeenCalledWith({ email: "ana@boomer.com.br", papel: "usuario" }, "x")
      })

      it("slug malformado (ErroEntrada) vira o mesmo 404", async () => {
        prospectVisivel.mockRejectedValue(new ErroEntrada("Slug inválido."))
        const erro = await exigirAcessoAoProspect(Promise.resolve({ slug: "../x" })).catch((e) => e)
        expect(erro).toBeInstanceOf(ErroNaoEncontrado)
        expect(erro.message).toBe("Projeto não encontrado.")
      })

      it("outros erros do serviço sobem como estão", async () => {
        prospectVisivel.mockRejectedValue(new Error("banco fora do ar"))
        await expect(exigirAcessoAoProspect(Promise.resolve({ slug: "x" }))).rejects.toThrow("banco fora do ar")
      })

      it("prospect visível: devolve o usuário", async () => {
        prospectVisivel.mockResolvedValue(true)
        expect(await exigirAcessoAoProspect(Promise.resolve({ slug: "x" }))).toEqual({ email: "ana@boomer.com.br", papel: "usuario" })
      })
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
