import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoEhTeste, ErroSemPermissao } from "@workspace/core/erros"

const exigirAdmin = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirAdmin }))

const servico = vi.hoisted(() => ({ avancarEnsaio: vi.fn(), gatilhoEnsaio: vi.fn() }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ servico }) }))

const { GET, POST } = await import("./route")

const URL_BASE = "http://127.0.0.1:3000/api/prospects/verdeluz-teste/teste/ensaio"
const ctx = { params: Promise.resolve({ slug: "verdeluz-teste" }) } as never

const postar = (corpo: unknown) =>
  POST(new Request(URL_BASE, { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }), ctx)

beforeEach(() => {
  exigirAdmin.mockReset()
  servico.avancarEnsaio.mockReset()
  servico.gatilhoEnsaio.mockReset()
  exigirAdmin.mockResolvedValue({ email: "bia.lima@boomer.com.br" })
  servico.avancarEnsaio.mockResolvedValue(undefined)
})

describe("POST /api/prospects/[slug]/teste/ensaio", () => {
  it("avança o ensaio da etapa pedida, com quem pediu", async () => {
    const resposta = await postar({ etapa: "03" })
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ ok: true })
    expect(servico.avancarEnsaio).toHaveBeenCalledWith("verdeluz-teste", "03", "bia.lima@boomer.com.br")
  })

  it("prospect sem ensaio devolve 409", async () => {
    servico.avancarEnsaio.mockRejectedValue(new ErroNaoEhTeste())
    const resposta = await postar({ etapa: "03" })
    expect(resposta.status).toBe(409)
  })

  it("usuário que não é admin recebe 403 e nada avança", async () => {
    exigirAdmin.mockRejectedValue(new ErroSemPermissao())
    const resposta = await postar({ etapa: "03" })
    expect(resposta.status).toBe(403)
    expect(servico.avancarEnsaio).not.toHaveBeenCalled()
  })

  it("sem etapa devolve 400", async () => {
    const resposta = await postar({})
    expect(resposta.status).toBe(400)
    expect(servico.avancarEnsaio).not.toHaveBeenCalled()
  })
})

describe("GET /api/prospects/[slug]/teste/ensaio", () => {
  it("devolve o gatilho do trecho atual da etapa", async () => {
    servico.gatilhoEnsaio.mockResolvedValue({ gatilho: "mensagem", textoPreenchido: "Segue a planilha." })
    const resposta = await GET(new Request(`${URL_BASE}?etapa=03`), ctx)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ gatilho: "mensagem", textoPreenchido: "Segue a planilha." })
    expect(servico.gatilhoEnsaio).toHaveBeenCalledWith("verdeluz-teste", "03")
  })

  it("roteiro acabado devolve null", async () => {
    servico.gatilhoEnsaio.mockResolvedValue(null)
    const resposta = await GET(new Request(`${URL_BASE}?etapa=03`), ctx)
    expect(await resposta.json()).toBeNull()
  })

  it("usuário que não é admin recebe 403", async () => {
    exigirAdmin.mockRejectedValue(new ErroSemPermissao())
    const resposta = await GET(new Request(`${URL_BASE}?etapa=03`), ctx)
    expect(resposta.status).toBe(403)
    expect(servico.gatilhoEnsaio).not.toHaveBeenCalled()
  })
})
