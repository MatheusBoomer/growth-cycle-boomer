import { beforeEach, describe, expect, it, vi } from "vitest"

const usuarioDaRequisicao = vi.hoisted(() => vi.fn())
const listarProspects = vi.hoisted(() => vi.fn())
const servidor = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn())
const grade = vi.hoisted(() => vi.fn(() => null))

vi.mock("@/lib/sessao", () => ({ usuarioDaRequisicao }))
vi.mock("@/lib/servidor", () => ({ servidor }))
// Como no Next, redirect não retorna: interrompe a renderização lançando.
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/home/grade-prospects", () => ({ GradeProspects: grade }))

const { default: Pagina } = await import("./page")

class Redirecionou extends Error {}

beforeEach(() => {
  for (const m of [usuarioDaRequisicao, listarProspects, servidor, redirect, grade]) m.mockReset()
  servidor.mockReturnValue({ servico: { listarProspects }, usuarios: null, catalogo: { etapas: [{ id: "01", rotuloStatus: "01 · Preparação" }] } })
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

  it("entrega à grade os prospects, as etapas e o mapa de fotos (vazio sem usuários na nuvem)", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br" })
    const lista = [{ slug: "iszi" }]
    listarProspects.mockResolvedValue(lista)
    const elemento = (await Pagina()) as { type: unknown; props: Record<string, unknown> }
    expect(elemento.type).toBe(grade)
    expect(elemento.props).toEqual({ prospects: lista, etapas: [{ id: "01", rotulo: "01 · Preparação" }], avatares: {} })
  })

  it("passa as fotos dos donos quando há usuários na nuvem", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br" })
    listarProspects.mockResolvedValue([])
    servidor.mockReturnValue({
      servico: { listarProspects },
      usuarios: { avatares: async () => new Map([["ana@boomer.com.br", "https://lh3.googleusercontent.com/a/x"]]) },
      catalogo: { etapas: [] },
    })
    const elemento = (await Pagina()) as { props: Record<string, unknown> }
    expect(elemento.props.avatares).toEqual({ "ana@boomer.com.br": "https://lh3.googleusercontent.com/a/x" })
  })

  it("no modo off (usuário com e-mail nulo) lista os prospects", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: null })
    listarProspects.mockResolvedValue([])
    await Pagina()
    expect(redirect).not.toHaveBeenCalled()
    expect(listarProspects).toHaveBeenCalledOnce()
  })
})
