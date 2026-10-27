import { describe, expect, it } from "vitest"
import { origemDoRedirecionamento, requisicaoEhHttps } from "./origem-publica"

const PUBLICO = { PLANEJAMENTO_APP_URL: "https://planejamento.exemplo.com.br" }

function cab(host: string | null, extra: Record<string, string> = {}) {
  const h = new Headers(extra)
  if (host) h.set("host", host)
  return h
}

describe("origemDoRedirecionamento", () => {
  it("local sem balanceador: usa o Host e o protocolo da requisição (127.0.0.1 não vira localhost)", () => {
    expect(origemDoRedirecionamento(cab("127.0.0.1:3000"), {}, "http:")).toBe("http://127.0.0.1:3000")
    expect(origemDoRedirecionamento(cab("localhost:3000"), PUBLICO, "http:")).toBe("http://localhost:3000")
  })

  it("atrás do balanceador: usa x-forwarded-host e x-forwarded-proto quando o host é o público", () => {
    const h = cab("127.0.0.1:8080", { "x-forwarded-host": "planejamento.exemplo.com.br", "x-forwarded-proto": "https" })
    expect(origemDoRedirecionamento(h, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
  })

  it("host público sem x-forwarded-proto herda o protocolo de PLANEJAMENTO_APP_URL", () => {
    const h = cab("127.0.0.1:8080", { "x-forwarded-host": "planejamento.exemplo.com.br" })
    expect(origemDoRedirecionamento(h, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
  })

  it("x-forwarded-host de outro site cai na origem pública (nunca vira open redirect)", () => {
    for (const falso of ["evil.com", "planejamento.exemplo.com.br.evil.com", "evil.com/planejamento.exemplo.com.br", "user@evil.com", "127.0.0.1.evil.com", "127.0.0.1:3000/x", "localhost:3000?a=b", "localhost:abc"]) {
      const h = cab("127.0.0.1:3000", { "x-forwarded-host": falso, "x-forwarded-proto": "https" })
      expect(origemDoRedirecionamento(h, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
    }
  })

  it("só a primeira entrada de uma lista em x-forwarded-host conta", () => {
    const bom = cab("127.0.0.1:3000", { "x-forwarded-host": "planejamento.exemplo.com.br, evil.com" })
    expect(origemDoRedirecionamento(bom, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
    const ruim = cab("127.0.0.1:3000", { "x-forwarded-host": "evil.com, planejamento.exemplo.com.br" })
    expect(origemDoRedirecionamento(ruim, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
  })

  it("protocolo fora de http/https é ignorado", () => {
    const h = cab("127.0.0.1:3000", { "x-forwarded-proto": "javascript" })
    expect(origemDoRedirecionamento(h, PUBLICO, "http:")).toBe("http://127.0.0.1:3000")
    const h2 = cab("planejamento.exemplo.com.br", { "x-forwarded-proto": "ftp" })
    expect(origemDoRedirecionamento(h2, PUBLICO, "http:")).toBe("https://planejamento.exemplo.com.br")
  })

  it("Host que não é local nem o público cai na origem pública", () => {
    expect(origemDoRedirecionamento(cab("evil.com"), PUBLICO, "https:")).toBe("https://planejamento.exemplo.com.br")
  })

  it("sem PLANEJAMENTO_APP_URL e sem host aceitável, cai no endereço local padrão", () => {
    expect(origemDoRedirecionamento(cab("evil.com"), { PORT: "4000" }, "http:")).toBe("http://127.0.0.1:4000")
    expect(origemDoRedirecionamento(cab(null), {}, "http:")).toBe("http://127.0.0.1:3000")
  })

  it("PLANEJAMENTO_APP_URL inválida vale como ausente", () => {
    expect(origemDoRedirecionamento(cab("evil.com"), { PLANEJAMENTO_APP_URL: "nao e url" }, "http:")).toBe("http://127.0.0.1:3000")
  })
})

describe("requisicaoEhHttps", () => {
  it("x-forwarded-proto manda; sem ele vale o protocolo da requisição", () => {
    expect(requisicaoEhHttps(cab("x", { "x-forwarded-proto": "https" }), "http:")).toBe(true)
    expect(requisicaoEhHttps(cab("x", { "x-forwarded-proto": "HTTPS, http" }), "http:")).toBe(true)
    expect(requisicaoEhHttps(cab("x", { "x-forwarded-proto": "http" }), "https:")).toBe(false)
    expect(requisicaoEhHttps(cab("x"), "https:")).toBe(true)
    expect(requisicaoEhHttps(cab("x"), "http:")).toBe(false)
  })

  it("valor fora de http/https é ignorado", () => {
    expect(requisicaoEhHttps(cab("x", { "x-forwarded-proto": "ftp" }), "http:")).toBe(false)
    expect(requisicaoEhHttps(cab("x", { "x-forwarded-proto": "ftp" }), "https:")).toBe(true)
  })

  it("não depende de PLANEJAMENTO_APP_URL: http local continua http", () => {
    expect(requisicaoEhHttps(cab("127.0.0.1:3000"), "http:")).toBe(false)
  })
})
