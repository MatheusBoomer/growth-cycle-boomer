import { beforeEach, describe, expect, it, vi } from "vitest"

const exigirUsuario = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirUsuario }))

const servico = vi.hoisted(() => ({ respostaEstado: vi.fn() }))
const turnos = vi.hoisted(() => ({ ativo: vi.fn(), ativoPor: vi.fn() }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ servico, turnos }) }))

const { GET } = await import("./route")

const chamar = () => GET(new Request("http://127.0.0.1:3000/api/prospects/iszi/estado"), { params: Promise.resolve({ slug: "iszi" }) } as never)

beforeEach(() => {
  for (const m of [exigirUsuario, servico.respostaEstado, turnos.ativo, turnos.ativoPor]) m.mockReset()
  exigirUsuario.mockResolvedValue({ email: "bia.lima@boomer.com.br" })
  servico.respostaEstado.mockImplementation(async (_slug, turnoAtivo, turnoPor) => ({ turnoAtivo, turnoPor }))
})

describe("GET /api/prospects/[slug]/estado", () => {
  it("devolve turnoPor com o e-mail de quem está com o turno ativo", async () => {
    turnos.ativo.mockReturnValue("01")
    turnos.ativoPor.mockReturnValue("ana.silva@boomer.com.br")
    const resposta = await chamar()
    expect(servico.respostaEstado).toHaveBeenCalledWith("iszi", "01", "ana.silva@boomer.com.br")
    expect(await resposta.json()).toEqual({ turnoAtivo: "01", turnoPor: "ana.silva@boomer.com.br" })
  })

  it("sem turno (ou sem autor) turnoPor vem null", async () => {
    turnos.ativo.mockReturnValue(null)
    turnos.ativoPor.mockReturnValue(null)
    expect(await (await chamar()).json()).toEqual({ turnoAtivo: null, turnoPor: null })
  })
})
