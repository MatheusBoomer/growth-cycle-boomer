// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let caminho = "/"
vi.mock("next/navigation", () => ({ usePathname: () => caminho }))

const { VerificacaoSistema } = await import("./verificacao-sistema")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar() {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(VerificacaoSistema))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

describe("VerificacaoSistema", () => {
  const fetchFalso = vi.fn()
  beforeEach(() => {
    fetchFalso.mockReset()
    vi.stubGlobal("fetch", fetchFalso)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("em /login não chama /api/sistema", async () => {
    caminho = "/login"
    const { desmontar } = await montar()
    expect(fetchFalso).not.toHaveBeenCalled()
    await desmontar()
  })

  it("fora do login chama /api/sistema", async () => {
    caminho = "/"
    fetchFalso.mockResolvedValue(Response.json({ claude: { instalado: true, logado: true, metodo: "claude.ai" }, python: { ok: true }, ffmpeg: true, apify: true, previa: true }))
    const { desmontar } = await montar()
    expect(fetchFalso).toHaveBeenCalledOnce()
    await desmontar()
  })

  it("um 401 não vira 'sistema com problema' (nenhum diálogo, nenhum erro)", async () => {
    caminho = "/"
    fetchFalso.mockResolvedValue(Response.json({ erro: "Você precisa entrar para continuar.", codigo: "nao_autenticado" }, { status: 401 }))
    const { raiz, desmontar } = await montar()
    expect(raiz.textContent).toBe("")
    expect(document.body.textContent).not.toContain("Falta configurar esta máquina")
    await desmontar()
  })
})
