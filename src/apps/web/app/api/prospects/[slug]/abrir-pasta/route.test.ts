import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoAutenticado } from "@workspace/core/erros"

const exigirAcessoAoProspect = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirAcessoAoProspect }))

const armazenamento = vi.hoisted(() => ({ existe: vi.fn(), pastaProspect: vi.fn(), caminhoAbsoluto: vi.fn() }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ armazenamento }) }))

const execFile = vi.hoisted(() => vi.fn())
vi.mock("node:child_process", () => ({ execFile }))

const { POST } = await import("./route")

const chamar = (corpo?: unknown) =>
  POST(new Request("http://127.0.0.1:3000/api/prospects/iszi/abrir-pasta", { method: "POST", body: corpo ? JSON.stringify(corpo) : undefined }), {
    params: Promise.resolve({ slug: "iszi" }),
  } as never)

let dadosAntes: string | undefined
beforeEach(() => {
  dadosAntes = process.env.PLANEJAMENTO_DADOS
  for (const m of [exigirAcessoAoProspect, execFile, armazenamento.existe, armazenamento.pastaProspect, armazenamento.caminhoAbsoluto]) m.mockReset()
  exigirAcessoAoProspect.mockResolvedValue({ email: "ana.silva@boomer.com.br" })
  armazenamento.existe.mockResolvedValue(true)
  armazenamento.pastaProspect.mockReturnValue("/clientes/iszi")
  armazenamento.caminhoAbsoluto.mockImplementation((_s: string, c: string) => `/clientes/iszi/${c}`)
})
afterEach(() => {
  if (dadosAntes === undefined) delete process.env.PLANEJAMENTO_DADOS
  else process.env.PLANEJAMENTO_DADOS = dadosAntes
})

describe("POST /api/prospects/[slug]/abrir-pasta", () => {
  it("no modo fs abre a pasta, como antes", async () => {
    process.env.PLANEJAMENTO_DADOS = "fs"
    const resposta = await chamar()
    expect(resposta.status).toBe(200)
    expect(execFile).toHaveBeenCalledWith("open", ["/clientes/iszi"])
  })

  it("no modo fs, com caminho, mostra o arquivo selecionado", async () => {
    delete process.env.PLANEJAMENTO_DADOS
    await chamar({ caminho: "entrega/a.png" })
    expect(execFile).toHaveBeenCalledWith("open", ["-R", "/clientes/iszi/entrega/a.png"])
  })

  it("na nuvem responde 404 com a mensagem do modo local e não abre nada", async () => {
    process.env.PLANEJAMENTO_DADOS = "supabase"
    const resposta = await chamar()
    expect(resposta.status).toBe(404)
    expect((await resposta.json()).erro).toBe("Disponível só no modo local.")
    expect(execFile).not.toHaveBeenCalled()
  })

  it("exige usuário antes de qualquer coisa, também na nuvem", async () => {
    process.env.PLANEJAMENTO_DADOS = "supabase"
    exigirAcessoAoProspect.mockRejectedValue(new ErroNaoAutenticado())
    const resposta = await chamar()
    expect(resposta.status).toBe(401)
    expect(execFile).not.toHaveBeenCalled()
  })
})
