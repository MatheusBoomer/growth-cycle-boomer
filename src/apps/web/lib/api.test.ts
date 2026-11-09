import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, ErroApi } from "./api"

function respostaJson(corpo: unknown, status: number) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })
}

describe("api: sessão expirada", () => {
  const assign = vi.fn()
  const fetchFalso = vi.fn()
  const janela = (pathname: string, search = "") => vi.stubGlobal("window", { location: { pathname, search, assign } })

  beforeEach(() => {
    assign.mockReset()
    fetchFalso.mockReset()
    vi.stubGlobal("fetch", fetchFalso)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("401 nao_autenticado leva o navegador a /login?proximo=<caminho atual> e ainda lança o erro", async () => {
    janela("/prospects/acme", "?etapa=03")
    fetchFalso.mockResolvedValue(respostaJson({ erro: "Você precisa entrar para continuar.", codigo: "nao_autenticado" }, 401))
    const falha = await api.listarArquivos("acme").catch((e: unknown) => e)
    expect(falha).toBeInstanceOf(ErroApi)
    expect((falha as ErroApi).status).toBe(401)
    expect((falha as ErroApi).message).toBe("Você precisa entrar para continuar.")
    expect(assign).toHaveBeenCalledExactlyOnceWith("/login?proximo=%2Fprospects%2Facme%3Fetapa%3D03")
  })

  it("já em /login, não redireciona de novo", async () => {
    janela("/login")
    fetchFalso.mockResolvedValue(respostaJson({ erro: "x", codigo: "nao_autenticado" }, 401))
    await api.listarArquivos("acme").catch(() => undefined)
    expect(assign).not.toHaveBeenCalled()
  })

  it("outros erros não redirecionam", async () => {
    janela("/prospects/acme")
    fetchFalso.mockResolvedValue(respostaJson({ erro: "Sem acesso", codigo: "origem_recusada" }, 403))
    await api.listarArquivos("acme").catch(() => undefined)
    fetchFalso.mockResolvedValue(respostaJson({ erro: "Erro", codigo: "erro_interno" }, 500))
    await api.listarArquivos("acme").catch(() => undefined)
    expect(assign).not.toHaveBeenCalled()
  })

  it("resposta de sucesso segue devolvendo o corpo", async () => {
    janela("/")
    fetchFalso.mockResolvedValue(respostaJson({ arquivos: [] }, 200))
    await expect(api.listarArquivos("acme")).resolves.toEqual({ arquivos: [] })
    expect(assign).not.toHaveBeenCalled()
  })

  it("painelMetricas chama /api/admin/painel com os parâmetros e sem cache", async () => {
    janela("/")
    fetchFalso.mockResolvedValue(respostaJson({ painel: {}, opcoes: {}, avatares: {} }, 200))
    await api.painelMetricas(new URLSearchParams("periodo=7d&testes=1"))
    expect(fetchFalso).toHaveBeenCalledExactlyOnceWith("/api/admin/painel?periodo=7d&testes=1", expect.objectContaining({ cache: "no-store" }))
  })
})
