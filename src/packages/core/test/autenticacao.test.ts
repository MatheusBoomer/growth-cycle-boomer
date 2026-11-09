import { describe, expect, it } from "vitest"
import {
  avatarDeClaims,
  avatarSeguro,
  caminhoProximoSeguro,
  decidirAcesso,
  dominiosPermitidos,
  emailPermitido,
  modoDeAutenticacao,
  nomeCurto,
  type EntradaAcesso,
} from "../src/autenticacao"
import { ErroNaoAutenticado, ehErroDominio } from "../src/erros"
import { origemDeEscritaPermitida } from "../src/seguranca"

describe("modoDeAutenticacao", () => {
  it("vazio, ausente e off (com espaços) são off", () => {
    expect(modoDeAutenticacao({})).toBe("off")
    expect(modoDeAutenticacao({ PLANEJAMENTO_AUTH: "" })).toBe("off")
    expect(modoDeAutenticacao({ PLANEJAMENTO_AUTH: "off" })).toBe("off")
    expect(modoDeAutenticacao({ PLANEJAMENTO_AUTH: " off " })).toBe("off")
    expect(modoDeAutenticacao({ PLANEJAMENTO_AUTH: "   " })).toBe("off")
  })

  it("compara exato: OFF e Google são inválidos", () => {
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "OFF" })).toThrow('PLANEJAMENTO_AUTH inválido: "OFF" (use off ou google).')
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "Google" })).toThrow('PLANEJAMENTO_AUTH inválido: "Google" (use off ou google).')
  })

  it("valor desconhecido dá o erro de valor inválido", () => {
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "goggle" })).toThrow('PLANEJAMENTO_AUTH inválido: "goggle" (use off ou google).')
  })

  it("google com as duas variáveis do Supabase é google (aparando espaços do valor)", () => {
    const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" }
    expect(modoDeAutenticacao({ ...env, PLANEJAMENTO_AUTH: "google" })).toBe("google")
    expect(modoDeAutenticacao({ ...env, PLANEJAMENTO_AUTH: " google " })).toBe("google")
  })

  it("google sem variável do Supabase nomeia a que falta", () => {
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "google", SUPABASE_PUBLISHABLE_KEY: "k" })).toThrow(
      "PLANEJAMENTO_AUTH=google exige SUPABASE_URL no .env da raiz.",
    )
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "google", SUPABASE_URL: "https://x" })).toThrow(
      "PLANEJAMENTO_AUTH=google exige SUPABASE_PUBLISHABLE_KEY no .env da raiz.",
    )
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "google", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "k" })).toThrow(
      "PLANEJAMENTO_AUTH=google exige SUPABASE_URL no .env da raiz.",
    )
    expect(() => modoDeAutenticacao({ PLANEJAMENTO_AUTH: "google" })).toThrow("exige SUPABASE_URL")
  })
})

describe("dominiosPermitidos", () => {
  it("ausente ou vazio dá o padrão", () => {
    expect(dominiosPermitidos(undefined)).toEqual(["boomer.com.br", "gestaoboomer.com"])
    expect(dominiosPermitidos("")).toEqual(["boomer.com.br", "gestaoboomer.com"])
    expect(dominiosPermitidos("  , ")).toEqual(["boomer.com.br", "gestaoboomer.com"])
  })

  it("apara, baixa a caixa e descarta itens vazios", () => {
    expect(dominiosPermitidos(" Boomer.com.br , ,x.com ")).toEqual(["boomer.com.br", "x.com"])
  })
})

describe("emailPermitido (domínios padrão)", () => {
  const dominios = dominiosPermitidos(undefined)

  it("aceita o domínio exato, sem diferenciar caixa", () => {
    expect(emailPermitido("ana@boomer.com.br", dominios)).toBe(true)
    expect(emailPermitido("ANA@GestaoBoomer.com", dominios)).toBe(true)
  })

  it.each([
    "x@boomer.com.br.evil.com",
    "x@evilboomer.com.br",
    "x@gestaoboomer.com.br",
    "x@boomer.com",
    "x@sub.boomer.com.br",
    "a@b@boomer.com.br",
    "@boomer.com.br",
    "x@",
    "",
    "boomer.com.br",
    " ana@boomer.com.br",
    "ana @boomer.com.br",
    "ana@boomer.com.br ",
    "ana@boomer.com.br\n",
    "ana@boomer.com.br,x@evil.com",
  ])("recusa %j", (email) => {
    expect(emailPermitido(email, dominios)).toBe(false)
  })

  it("recusa null e undefined", () => {
    expect(emailPermitido(null, dominios)).toBe(false)
    expect(emailPermitido(undefined, dominios)).toBe(false)
  })

  it("respeita a lista recebida", () => {
    expect(emailPermitido("a@x.com", ["x.com"])).toBe(true)
    expect(emailPermitido("a@boomer.com.br", ["x.com"])).toBe(false)
    expect(emailPermitido("a@boomer.com.br", [])).toBe(false)
  })
})

describe("nomeCurto", () => {
  it("monta o nome a partir da parte local do e-mail", () => {
    expect(nomeCurto("ana.silva@boomer.com.br")).toBe("Ana Silva")
    expect(nomeCurto("joao_pedro-souza@gestaoboomer.com")).toBe("Joao Pedro Souza")
    expect(nomeCurto("x@y.com")).toBe("X")
    expect(nomeCurto("ANA.SILVA@boomer.com.br")).toBe("Ana Silva")
    expect(nomeCurto("ana..silva@boomer.com.br")).toBe("Ana Silva")
  })
})

describe("avatarSeguro", () => {
  it("aceita só https em googleusercontent.com (ou subdomínio)", () => {
    expect(avatarSeguro("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe("https://lh3.googleusercontent.com/a/abc=s96-c")
    expect(avatarSeguro("https://googleusercontent.com/x")).toBe("https://googleusercontent.com/x")
  })

  it.each([
    "http://lh3.googleusercontent.com/a/abc",
    "https://evil.com/x.png",
    "https://googleusercontent.com.evil.com/x",
    "https://evilgoogleusercontent.com/x",
    "https://user@evil.com/x",
    "javascript:alert(1)",
    "",
    "nao é url",
    `https://lh3.googleusercontent.com/${"a".repeat(600)}`,
  ])("recusa %s", (url) => {
    expect(avatarSeguro(url)).toBeNull()
  })

  it("recusa o que não é string", () => {
    for (const v of [42, null, undefined, {}, ["https://lh3.googleusercontent.com/a"]]) expect(avatarSeguro(v)).toBeNull()
  })
})

describe("avatarDeClaims", () => {
  const foto = "https://lh3.googleusercontent.com/a/abc=s96-c"
  const outra = "https://lh3.googleusercontent.com/a/outra"

  it("prefere avatar_url a picture", () => {
    expect(avatarDeClaims({ user_metadata: { avatar_url: foto, picture: outra } })).toBe(foto)
  })

  it("usa picture quando avatar_url falta ou é inválido", () => {
    expect(avatarDeClaims({ user_metadata: { picture: outra } })).toBe(outra)
    expect(avatarDeClaims({ user_metadata: { avatar_url: "https://evil.com/x", picture: outra } })).toBe(outra)
  })

  it("devolve null sem user_metadata ou sem foto válida", () => {
    expect(avatarDeClaims({})).toBeNull()
    expect(avatarDeClaims({ user_metadata: null })).toBeNull()
    expect(avatarDeClaims({ user_metadata: "x" })).toBeNull()
    expect(avatarDeClaims({ user_metadata: { avatar_url: "https://evil.com/x" } })).toBeNull()
  })
})

describe("caminhoProximoSeguro", () => {
  it("mantém caminho relativo, com query", () => {
    expect(caminhoProximoSeguro("/prospects/a?x=1")).toBe("/prospects/a?x=1")
    expect(caminhoProximoSeguro("/")).toBe("/")
  })

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\t/evil.com",
    "http://evil.com",
    "https://evil.com/x",
    "javascript:alert(1)",
    "evil",
    "",
    "/\t/evil.com",
    "/\n/evil.com",
    "/a\r\nSet-Cookie: x=1",
    "/a\r\n",
    "/a\0b",
    "/ok\\..\\x",
    "///evil.com",
  ])("devolve / para %j", (proximo) => {
    expect(caminhoProximoSeguro(proximo)).toBe("/")
  })

  it("devolve / para null e undefined", () => {
    expect(caminhoProximoSeguro(undefined)).toBe("/")
    expect(caminhoProximoSeguro(null)).toBe("/")
  })
})

const local = "127.0.0.1:3000"
const publico = "planejamento.boomer.com.br"

function entrada(parcial: Partial<EntradaAcesso>): EntradaAcesso {
  return {
    modo: "google",
    metodo: "GET",
    caminho: "/",
    host: publico,
    origin: null,
    secFetchSite: null,
    hostPublico: publico,
    autenticado: false,
    ...parcial,
  }
}

describe("decidirAcesso, modo off", () => {
  const off = { modo: "off" as const, hostPublico: null }

  it("host local passa", () => {
    expect(decidirAcesso(entrada({ ...off, host: local }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ ...off, host: "localhost:3000", caminho: "/api/prospects" }))).toEqual({ tipo: "passar" })
  })

  it("host de fora é recusado, inclusive para página", () => {
    expect(decidirAcesso(entrada({ ...off, host: "app.exemplo.com" }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...off, host: "app.exemplo.com", caminho: "/api/x" }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...off, host: null }))).toEqual({ tipo: "recusar" })
  })

  it("POST com Origin de outro host é recusado", () => {
    expect(decidirAcesso(entrada({ ...off, host: local, metodo: "POST", origin: "https://evil.com" }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...off, host: local, metodo: "POST", origin: "http://127.0.0.1:3000" }))).toEqual({ tipo: "passar" })
  })

  it("não pede login nem com hostPublico definido", () => {
    expect(decidirAcesso(entrada({ modo: "off", host: publico }))).toEqual({ tipo: "recusar" })
  })
})

describe("decidirAcesso, modo google", () => {
  it("página sem sessão vai para o login com o destino", () => {
    expect(decidirAcesso(entrada({ caminho: "/prospects/a" }))).toEqual({ tipo: "login", proximo: "/prospects/a" })
    expect(decidirAcesso(entrada({ caminho: "/prospects/a?x=1" }))).toEqual({ tipo: "login", proximo: "/prospects/a?x=1" })
  })

  it("destino inseguro do login vira /", () => {
    expect(decidirAcesso(entrada({ caminho: "//evil.com" }))).toEqual({ tipo: "login", proximo: "/" })
  })

  it("API sem sessão é nao_autenticado; com sessão passa", () => {
    expect(decidirAcesso(entrada({ caminho: "/api/prospects" }))).toEqual({ tipo: "nao_autenticado" })
    expect(decidirAcesso(entrada({ caminho: "/api" }))).toEqual({ tipo: "nao_autenticado" })
    expect(decidirAcesso(entrada({ caminho: "/api/prospects", autenticado: true }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/prospects/a", autenticado: true }))).toEqual({ tipo: "passar" })
  })

  it("Host que só começa com o público ou com um host local é recusado", () => {
    for (const host of ["planejamento.boomer.com.br.evil.com", "127.0.0.1.evil.com", "evilplanejamento.boomer.com.br", "localhost.evil.com:3000", "outro.com", ""]) {
      expect(decidirAcesso(entrada({ host, autenticado: true }))).toEqual({ tipo: "recusar" })
      expect(decidirAcesso(entrada({ host, caminho: "/login" }))).toEqual({ tipo: "recusar" })
    }
    expect(decidirAcesso(entrada({ host: null, autenticado: true }))).toEqual({ tipo: "recusar" })
  })

  it("sem hostPublico só o host local é aceito", () => {
    expect(decidirAcesso(entrada({ hostPublico: null, host: publico, autenticado: true }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ hostPublico: null, host: local, autenticado: true }))).toEqual({ tipo: "passar" })
  })

  it("host local é sempre aceito (o desenvolvedor testa o login no Mac)", () => {
    expect(decidirAcesso(entrada({ host: local, caminho: "/prospects/a" }))).toEqual({ tipo: "login", proximo: "/prospects/a" })
    expect(decidirAcesso(entrada({ host: "localhost:3000", autenticado: true }))).toEqual({ tipo: "passar" })
  })

  it("POST de outra origem é recusado mesmo autenticado, na API ou em rota livre", () => {
    const post = { metodo: "POST", origin: "https://evil.com", autenticado: true }
    expect(decidirAcesso(entrada({ ...post, caminho: "/api/prospects" }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...post, caminho: "/auth/sair" }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...post, caminho: "/api/prospects", secFetchSite: "cross-site", origin: null }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ ...post, host: local, caminho: "/api/interno/x" }))).toEqual({ tipo: "recusar" })
  })

  it("POST da própria origem passa autenticado e é nao_autenticado sem sessão", () => {
    const post = { metodo: "POST", origin: `https://${publico}`, secFetchSite: "same-origin", caminho: "/api/prospects" }
    expect(decidirAcesso(entrada({ ...post, autenticado: true }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada(post))).toEqual({ tipo: "nao_autenticado" })
    expect(decidirAcesso(entrada({ ...post, origin: null, secFetchSite: null, autenticado: true }))).toEqual({ tipo: "passar" })
  })

  it("/login e /auth/ passam sem sessão", () => {
    expect(decidirAcesso(entrada({ caminho: "/login" }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/login?erro=dominio" }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/auth/callback?code=abc" }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/auth/entrar", metodo: "POST", origin: `https://${publico}` }))).toEqual({ tipo: "passar" })
  })

  it("rotas parecidas com as livres não são livres", () => {
    for (const caminho of ["/loginx", "/login/x", "/authx/y", "/auth", "/api/auth/x", "/x/login", "/api/internoX/y", "/api/interno"]) {
      expect(decidirAcesso(entrada({ caminho, host: local }))).not.toEqual({ tipo: "passar" })
    }
  })

  it("caminhos com ponto, barra invertida ou codificação não escapam para rota livre", () => {
    for (const caminho of [
      "/auth/../api/prospects",
      "/auth/./x/../../api/prospects",
      "/auth/%2e%2e/api/prospects",
      "/auth/%2E%2E/api/prospects",
      "/auth/..%2fapi/prospects",
      "/auth/..\\api/prospects",
      "/login/../api/prospects",
      "/api/interno/../prospects",
      "/api/interno/%2e%2e/prospects",
    ]) {
      const d = decidirAcesso(entrada({ caminho, host: local }))
      expect(d.tipo, caminho).not.toBe("passar")
    }
  })

  it("/api/interno passa só com host local, nunca pelo host público", () => {
    expect(decidirAcesso(entrada({ caminho: "/api/interno/ferramentas", host: local }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/api/interno/ferramentas", host: local, metodo: "POST" }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ caminho: "/api/interno/ferramentas", host: publico }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ caminho: "/api/interno/ferramentas", host: publico, autenticado: true }))).toEqual({ tipo: "recusar" })
    expect(decidirAcesso(entrada({ caminho: "/api/interno/ferramentas?x=1", host: publico, metodo: "POST" }))).toEqual({ tipo: "recusar" })
  })

  it("compara o host público sem diferenciar caixa", () => {
    expect(decidirAcesso(entrada({ host: "Planejamento.Boomer.com.br", autenticado: true }))).toEqual({ tipo: "passar" })
  })
})

describe("decidirAcesso, rota de saúde (/api/saude)", () => {
  const hosts = ["healthcheck.railway.app", "127.0.0.1:3000", "evil.example.com"]
  const modos = ["off", "google"] as const

  it("GET e HEAD passam para qualquer host e qualquer modo, sem sessão", () => {
    for (const modo of modos) {
      for (const host of hosts) {
        for (const metodo of ["GET", "HEAD"]) {
          const e = entrada({ modo, host, metodo, caminho: "/api/saude", hostPublico: modo === "google" ? publico : null })
          expect(decidirAcesso(e), `${modo} ${host} ${metodo}`).toEqual({ tipo: "passar" })
        }
      }
    }
  })

  it("passa também sem Host e com query", () => {
    expect(decidirAcesso(entrada({ host: null, caminho: "/api/saude" }))).toEqual({ tipo: "passar" })
    expect(decidirAcesso(entrada({ modo: "off", hostPublico: null, host: null, caminho: "/api/saude?x=1" }))).toEqual({ tipo: "passar" })
  })

  it("outro método é recusado, em qualquer host e modo", () => {
    for (const modo of modos) {
      for (const host of hosts) {
        for (const metodo of ["POST", "DELETE", "PUT", "PATCH", "OPTIONS"]) {
          const e = entrada({ modo, host, metodo, caminho: "/api/saude", hostPublico: modo === "google" ? publico : null, autenticado: true })
          expect(decidirAcesso(e), `${modo} ${host} ${metodo}`).toEqual({ tipo: "recusar" })
        }
      }
    }
  })

  it("caminhos parecidos seguem a regra normal: host de fora é recusado, sem sessão é nao_autenticado", () => {
    for (const caminho of ["/api/saude/x", "/api/saudex", "/API/saude", "/api/saude/../prospects", "/api/saude/", "/api/saude%2f", "/x/api/saude"]) {
      expect(decidirAcesso(entrada({ caminho, host: "evil.example.com" })), caminho).toEqual({ tipo: "recusar" })
      expect(decidirAcesso(entrada({ caminho, host: "evil.example.com", modo: "off", hostPublico: null })), caminho).toEqual({ tipo: "recusar" })
    }
    for (const caminho of ["/api/saude/x", "/api/saudex", "/api/saude/../prospects", "/api/saude/", "/api/saude%2f"]) {
      expect(decidirAcesso(entrada({ caminho })), caminho).toEqual({ tipo: "nao_autenticado" })
    }
    expect(decidirAcesso(entrada({ caminho: "/API/saude" }))).toEqual({ tipo: "login", proximo: "/API/saude" })
    expect(decidirAcesso(entrada({ caminho: "/x/api/saude" }))).toEqual({ tipo: "login", proximo: "/x/api/saude" })
    expect(decidirAcesso(entrada({ caminho: "/api/saudex", autenticado: true }))).toEqual({ tipo: "passar" })
  })
})

describe("origemDeEscritaPermitida", () => {
  const base = { metodo: "POST", host: publico, origin: null, secFetchSite: null }
  it("leitura sempre passa; escrita só da mesma origem ou sem Origin", () => {
    expect(origemDeEscritaPermitida({ ...base, metodo: "GET", origin: "https://x.com" })).toBe(true)
    expect(origemDeEscritaPermitida({ ...base, origin: `https://${publico}` })).toBe(true)
    expect(origemDeEscritaPermitida(base)).toBe(true)
    expect(origemDeEscritaPermitida({ ...base, origin: "https://x.com" })).toBe(false)
    expect(origemDeEscritaPermitida({ ...base, origin: "null" })).toBe(false)
    expect(origemDeEscritaPermitida({ ...base, secFetchSite: "same-site" })).toBe(false)
  })
})

describe("ErroNaoAutenticado", () => {
  it("é 401 com a mensagem combinada", () => {
    const e = new ErroNaoAutenticado()
    expect(e.message).toBe("Você precisa entrar para continuar.")
    expect(e.status).toBe(401)
    expect(e.codigo).toBe("nao_autenticado")
    expect(ehErroDominio(e)).toBe(true)
  })
})
