import { beforeEach, describe, expect, it, vi } from "vitest"

const usuarioDaRequisicao = vi.hoisted(() => vi.fn())
const listarProspects = vi.hoisted(() => vi.fn())
const servidor = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sessao", () => ({ usuarioDaRequisicao }))
vi.mock("@/lib/servidor", () => ({ servidor }))
// Como no Next, redirect não retorna: interrompe a renderização lançando.
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/home/grade-prospects", () => ({ GradeProspects: () => null }))

const { default: Pagina } = await import("./page")

class Redirecionou extends Error {}

beforeEach(() => {
  for (const m of [usuarioDaRequisicao, listarProspects, servidor, redirect]) m.mockReset()
  servidor.mockReturnValue({ servico: { listarProspects }, catalogo: { etapas: [{ id: "01", rotuloStatus: "01 · Preparação" }] } })
  redirect.mockImplementation((destino: string) => {
    throw Object.assign(new Redirecionou(destino), { destino })
  })
})

describe("página inicial", () => {
  it("sem usuário manda para /login e não lê nenhum prospect", async () => {
    usuarioDaRequisicao.mockResolvedValue(null)
    await expect(Pagina()).rejects.toMatchObject({ destino: "/login" })
    expect(servidor).not.toHaveBeenCalled()
    expect(listarProspects).not.toHaveBeenCalled()
  })

  it("com usuário lista os prospects", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br" })
    listarProspects.mockResolvedValue([])
    await Pagina()
    expect(redirect).not.toHaveBeenCalled()
    expect(listarProspects).toHaveBeenCalledOnce()
  })

  it("no modo off (usuário com e-mail nulo) lista os prospects", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: null })
    listarProspects.mockResolvedValue([])
    await Pagina()
    expect(redirect).not.toHaveBeenCalled()
    expect(listarProspects).toHaveBeenCalledOnce()
  })
})
