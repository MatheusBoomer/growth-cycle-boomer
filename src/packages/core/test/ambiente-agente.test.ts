import { describe, expect, it } from "vitest"
import { ambienteDoAgente } from "../src/executor/ambiente-agente"

const PERMITIDAS = {
  PATH: "/usr/bin",
  HOME: "/data/home",
  LANG: "pt_BR.UTF-8",
  LC_ALL: "pt_BR.UTF-8",
  ANTHROPIC_API_KEY: "chave-anthropic",
  CLAUDE_CONFIG_DIR: "/data/claude",
  APIFY_TOKEN: "token-apify",
  FIRECRAWL_API_KEY: "chave-firecrawl",
  VIRTUAL_ENV: "/app/.venv",
  HTTPS_PROXY: "http://proxy:3128",
  https_proxy: "http://proxy:3128",
}

const BLOQUEADAS = {
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  SUPABASE_PUBLISHABLE_KEY: "publicavel",
  SUPABASE_TESTE_URL: "https://teste.supabase.co",
  PLANEJAMENTO_AUTH: "google",
  PLANEJAMENTO_APP_URL: "https://app.exemplo.com",
  AWS_SECRET_ACCESS_KEY: "segredo-aws",
  DATABASE_URL: "postgres://x",
}

describe("ambienteDoAgente", () => {
  it("deixa passar só a lista de permissão, com os mesmos valores", () => {
    expect(ambienteDoAgente({ ...PERMITIDAS, ...BLOQUEADAS })).toEqual(PERMITIDAS)
  })

  it("cobre os prefixos e nomes da lista (LC_*, PYTHON*, TZ, TMPDIR, SSL_CERT_FILE, proxies)", () => {
    const env = {
      LC_CTYPE: "UTF-8",
      PYTHONPATH: "/app/scripts",
      PYTHONUNBUFFERED: "1",
      TZ: "America/Sao_Paulo",
      TMPDIR: "/tmp",
      SSL_CERT_FILE: "/etc/ssl/cert.pem",
      NO_PROXY: "localhost",
      no_proxy: "localhost",
      HTTP_PROXY: "http://p",
      http_proxy: "http://p",
    }
    expect(ambienteDoAgente({ ...env, SUPABASE_URL: "x" })).toEqual(env)
  })

  it("nome parecido, mas fora da lista, não passa", () => {
    const env = { SUPABASE_X: "1", xANTHROPIC_API_KEY: "2", MY_PATH: "3", PATH: "/usr/bin" }
    expect(ambienteDoAgente(env)).toEqual({ PATH: "/usr/bin" })
  })

  it("valor undefined não vira chave", () => {
    const resultado = ambienteDoAgente({ PATH: "/usr/bin", HOME: undefined, LANG: undefined })
    expect(Object.keys(resultado)).toEqual(["PATH"])
  })

  it("não altera o objeto de entrada", () => {
    const entrada = { ...PERMITIDAS, ...BLOQUEADAS }
    const copia = { ...entrada }
    const resultado = ambienteDoAgente(entrada)
    expect(entrada).toEqual(copia)
    expect(resultado).not.toBe(entrada)
  })
})
