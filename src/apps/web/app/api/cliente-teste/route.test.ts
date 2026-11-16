import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErroProspectExistente } from "@workspace/core/erros"

const exigirAdmin = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirAdmin }))

const servico = vi.hoisted(() => ({ criarClienteTeste: vi.fn() }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ servico }) }))

const { POST } = await import("./route")

const chamar = (corpo: unknown) =>
  POST(new Request("http://127.0.0.1:3000/api/cliente-teste", { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }))

beforeEach(() => {
  exigirAdmin.mockReset()
  servico.criarClienteTeste.mockReset()
  exigirAdmin.mockResolvedValue({ email: "bia.lima@boomer.com.br" })
  servico.criarClienteTeste.mockResolvedValue("verdeluz-teste")
})

describe("POST /api/cliente-teste", () => {
  it("cria o cliente de teste do modelo Verdeluz na etapa pedida, com quem criou", async () => {
    const resposta = await chamar({ etapa: "03" })
    expect(resposta.status).toBe(201)
    expect(await resposta.json()).toEqual({ slug: "verdeluz-teste" })
    expect(servico.criarClienteTeste).toHaveBeenCalledWith("verdeluz", "03", "bia.lima@boomer.com.br", false)
  })

  it("com ensaio true, cria o cliente em modo ensaiado", async () => {
    const resposta = await chamar({ etapa: "03", ensaio: true })
    expect(resposta.status).toBe(201)
    expect(servico.criarClienteTeste).toHaveBeenCalledWith("verdeluz", "03", "bia.lima@boomer.com.br", true)
  })

  it("recusa ensaio que não seja booleano sem criar nada", async () => {
    for (const ensaio of ["sim", 1, null]) {
      const resposta = await chamar({ etapa: "03", ensaio })
      expect(resposta.status).toBe(400)
    }
    expect(servico.criarClienteTeste).not.toHaveBeenCalled()
  })

  it("recusa etapa desconhecida sem criar nada", async () => {
    const resposta = await chamar({ etapa: "99" })
    expect(resposta.status).toBe(400)
    expect(servico.criarClienteTeste).not.toHaveBeenCalled()
  })

  it("se o cliente de teste já existe, devolve o slug dele para o app oferecer abrir", async () => {
    servico.criarClienteTeste.mockRejectedValue(new ErroProspectExistente("verdeluz-teste"))
    const resposta = await chamar({ etapa: "03" })
    expect(resposta.status).toBe(409)
    const corpo = await resposta.json()
    expect(corpo.codigo).toBe("prospect_existente")
    expect(JSON.stringify(corpo)).toContain("verdeluz-teste")
  })
})
