import { describe, expect, it } from "vitest"
import { politicaDeConteudoArquivo, requisicaoLocalPermitida } from "../src/seguranca"

const base = { metodo: "POST", host: "127.0.0.1:3000", origin: null, secFetchSite: null }

describe("requisicaoLocalPermitida", () => {
  it("aceita a própria interface (same-origin) e ferramentas locais sem Origin (servidor MCP, node)", () => {
    expect(requisicaoLocalPermitida({ ...base, origin: "http://127.0.0.1:3000", secFetchSite: "same-origin" })).toBe(true)
    expect(requisicaoLocalPermitida(base)).toBe(true)
    expect(requisicaoLocalPermitida({ ...base, host: "localhost:3000", origin: "http://localhost:3000" })).toBe(true)
  })

  it("recusa POST vindo de outro site, mesmo com text/plain (sem preflight)", () => {
    expect(requisicaoLocalPermitida({ ...base, origin: "https://site-qualquer.com", secFetchSite: "cross-site" })).toBe(false)
    expect(requisicaoLocalPermitida({ ...base, origin: "https://site-qualquer.com" })).toBe(false)
    expect(requisicaoLocalPermitida({ ...base, secFetchSite: "same-site" })).toBe(false)
  })

  it("recusa Host que não é local (DNS rebinding), inclusive em GET", () => {
    expect(requisicaoLocalPermitida({ ...base, metodo: "GET", host: "evil.example:3000" })).toBe(false)
    expect(requisicaoLocalPermitida({ ...base, host: null })).toBe(false)
  })

  it("GET de outra origem passa (o navegador já não deixa ler a resposta)", () => {
    expect(requisicaoLocalPermitida({ ...base, metodo: "GET", origin: "https://x.com", secFetchSite: "cross-site" })).toBe(true)
  })
})

describe("arquivos servidos pela interface", () => {
  it("HTML gerado pelo agente abre em sandbox, fora da origem do app", () => {
    expect(politicaDeConteudoArquivo(".html")).toBe("sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox")
    expect(politicaDeConteudoArquivo(".HTML")).toBe("sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox")
  })
  it("demais tipos não mudam", () => {
    expect(politicaDeConteudoArquivo(".png")).toBeNull()
    expect(politicaDeConteudoArquivo(".md")).toBeNull()
  })
})
