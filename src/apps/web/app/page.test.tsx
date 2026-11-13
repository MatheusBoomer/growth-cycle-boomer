import { beforeEach, describe, expect, it, vi } from "vitest"

const usuarioDaRequisicao = vi.hoisted(() => vi.fn())
const listarProspects = vi.hoisted(() => vi.fn())
const servidor = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn())
const grade = vi.hoisted(() => vi.fn(() => null))
const entrada = vi.hoisted(() => vi.fn(() => null))
const cookiesDaRequisicao = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/sessao", () => ({ usuarioDaRequisicao }))
vi.mock("@/lib/servidor", () => ({ servidor }))
// Como no Next, redirect não retorna: interrompe a renderização lançando.
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/components/home/grade-prospects", () => ({ GradeProspects: grade }))
vi.mock("@/components/home/entrada", () => ({ Entrada: entrada }))
vi.mock("next/headers", () => ({ cookies: async () => cookiesDaRequisicao }))

const { default: Pagina } = await import("./page")

class Redirecionou extends Error {}

beforeEach(() => {
  for (const m of [usuarioDaRequisicao, listarProspects, servidor, redirect, grade, entrada, cookiesDaRequisicao.get]) m.mockReset()
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

  describe("entrada logo depois do login", () => {
    const lista = [
      { slug: "a", etapaAtual: "04" },
      { slug: "b", etapaAtual: null },
      { slug: "c", etapaAtual: "01" },
    ]
    type No = { type: unknown; props: { children?: No[] } & Record<string, unknown> }

    it("com o cookie de boas-vindas monta a entrada com o total em andamento", async () => {
      usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br" })
      listarProspects.mockResolvedValue(lista)
      cookiesDaRequisicao.get.mockImplementation((nome: string) => (nome === "gc-boas-vindas" ? { name: nome, value: "1" } : undefined))
      const elemento = (await Pagina()) as No
      const filhos = elemento.props.children ?? []
      expect(filhos.map((f) => f.type)).toEqual([grade, entrada])
      expect(filhos[1]!.props).toEqual({ emAndamento: 2 })
    })

    it("sem o cookie não monta a entrada", async () => {
      usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br" })
      listarProspects.mockResolvedValue(lista)
      const elemento = (await Pagina()) as No
      expect(elemento.type).toBe(grade)
    })
  })

  describe("fotos dos donos", () => {
    const FOTOS = new Map([
      ["ana@boomer.com.br", "https://lh3.googleusercontent.com/a/ana"],
      ["bia@boomer.com.br", "https://lh3.googleusercontent.com/a/bia"],
      // Tem foto mas não é dono de nenhum prospect listado: não pode chegar ao navegador.
      ["estranho@boomer.com.br", "https://lh3.googleusercontent.com/a/estranho"],
    ])
    const avataresDoRepositorio = vi.fn(async () => FOTOS)

    beforeEach(() => {
      avataresDoRepositorio.mockClear()
      listarProspects.mockResolvedValue([{ slug: "iszi", dono: "Ana@Boomer.com.br" }, { slug: "ilha", dono: "ana@boomer.com.br" }, { slug: "sem", dono: null }])
      servidor.mockReturnValue({ servico: { listarProspects }, usuarios: { avatares: avataresDoRepositorio }, catalogo: { etapas: [] } })
    })

    it("admin recebe só as fotos de quem é dono dos prospects listados", async () => {
      usuarioDaRequisicao.mockResolvedValue({ email: "adm@boomer.com.br", papel: "admin" })
      const elemento = (await Pagina()) as { props: Record<string, unknown> }
      expect(elemento.props.avatares).toEqual({ "ana@boomer.com.br": "https://lh3.googleusercontent.com/a/ana" })
      expect(JSON.stringify(elemento.props)).not.toContain("estranho")
      expect(JSON.stringify(elemento.props)).not.toContain("bia@")
    })

    it("usuário comum recebe {} e a lista de fotos nem é consultada", async () => {
      usuarioDaRequisicao.mockResolvedValue({ email: "ana@boomer.com.br", papel: "usuario" })
      const elemento = (await Pagina()) as { props: Record<string, unknown> }
      expect(elemento.props.avatares).toEqual({})
      expect(avataresDoRepositorio).not.toHaveBeenCalled()
    })
  })

  it("no modo off (usuário com e-mail nulo) lista os prospects", async () => {
    usuarioDaRequisicao.mockResolvedValue({ email: null })
    listarProspects.mockResolvedValue([])
    await Pagina()
    expect(redirect).not.toHaveBeenCalled()
    expect(listarProspects).toHaveBeenCalledOnce()
  })
})
