import { afterEach, describe, expect, it, vi } from "vitest"
import { ErroSemPermissao } from "@workspace/core/erros"

const mundo = vi.hoisted(() => ({ servidor: null as unknown, admin: true }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))
vi.mock("@/lib/sessao", () => ({
  exigirAdmin: async () => {
    if (!mundo.admin) throw new ErroSemPermissao()
    return { email: "chefe@boomer.com.br", papel: "admin" }
  },
}))
const { GET } = await import("./resumo/route")

const ETAPAS = { etapas: Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1).padStart(2, "0") })) }
const listarReports = vi.fn(async (_f: unknown) => [{ id: 1 }, { id: 2 }, { id: 3 }])

function nuvem(sobrescrever: Record<string, unknown> = {}) {
  mundo.servidor = {
    catalogo: ETAPAS,
    usuarios: { listar: async () => [{ papel: "admin" }, { papel: "admin" }, { papel: "usuario" }] },
    servico: { contagemNotasAbertas: async () => ({ "etapa:03": 2, "etapa:05": 3 }), listarReports },
    ...sobrescrever,
  }
}

afterEach(() => {
  mundo.admin = true
  vi.restoreAllMocks()
})

describe("GET /api/admin/resumo", () => {
  it("conta pessoas, admins, etapas, notas e reports que pedem atenção", async () => {
    nuvem()
    const r = await GET()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ pessoas: 3, admins: 2, etapas: 9, notasAbertas: 5, reportsAbertos: 3 })
    expect(listarReports).toHaveBeenCalledWith({ status: ["aberto", "em_andamento"] })
  })

  it("sem a nuvem (modo fs) só as etapas aparecem", async () => {
    nuvem({ usuarios: null })
    expect(await (await GET()).json()).toEqual({ pessoas: null, admins: null, etapas: 9, notasAbertas: null, reportsAbertos: null })
  })

  it("uma leitura que falha vira null sem derrubar as outras", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    nuvem({ usuarios: { listar: async () => Promise.reject(new Error("fora do ar")) } })
    expect(await (await GET()).json()).toMatchObject({ pessoas: null, admins: null, reportsAbertos: 3 })
  })

  it("quem não é admin recebe 403", async () => {
    nuvem()
    mundo.admin = false
    expect((await GET()).status).toBe(403)
  })
})
