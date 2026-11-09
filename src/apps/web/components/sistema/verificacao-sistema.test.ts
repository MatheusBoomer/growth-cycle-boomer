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
    fetchFalso.mockResolvedValue(Response.json({ claude: { instalado: true, logado: true, metodo: "claude.ai" }, python: { ok: true }, previa: true }))
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

  describe("na nuvem (executor sdk)", () => {
    const base = { claude: { instalado: false, versao: null, logado: false, metodo: null, plano: null }, python: { ok: true }, previa: true, executor: "sdk", nuvem: true }

    it("sem a chave da API mostra o aviso e não pede para instalar o Claude Code", async () => {
      caminho = "/"
      fetchFalso.mockResolvedValue(Response.json({ ...base, chaveApi: false }))
      const { desmontar } = await montar()
      const texto = document.body.textContent ?? ""
      expect(texto).toContain("Falta configurar esta máquina")
      expect(texto).toContain("Falta a chave da API do agente (ANTHROPIC_API_KEY).")
      expect(texto).not.toContain("Instale o Claude Code")
      expect(texto).not.toContain("claude auth login")
      await desmontar()
    })

    it("com a chave não bloqueia, mesmo sem Claude Code", async () => {
      caminho = "/"
      fetchFalso.mockResolvedValue(Response.json({ ...base, chaveApi: true }))
      const { desmontar } = await montar()
      expect(document.body.textContent ?? "").not.toContain("Falta configurar esta máquina")
      await desmontar()
    })

    it("ffmpeg e Apify não são mais verificados: mesmo ausentes na resposta, nenhum aviso de benchmark", async () => {
      caminho = "/"
      fetchFalso.mockResolvedValue(Response.json({ ...base, chaveApi: true, ffmpeg: false, apify: false }))
      const { desmontar } = await montar()
      const texto = document.body.textContent ?? ""
      expect(texto).not.toContain("benchmark")
      expect(texto).not.toContain("ffmpeg")
      expect(texto).not.toContain("APIFY_TOKEN")
      await desmontar()
    })
  })

  describe("no modo local (executor cli)", () => {
    it("sem Claude Code pede para instalar e bloqueia, como antes", async () => {
      caminho = "/"
      fetchFalso.mockResolvedValue(
        Response.json({ claude: { instalado: false, versao: null, logado: false, metodo: null, plano: null }, python: { ok: true }, previa: true, executor: "cli", nuvem: false, chaveApi: false }),
      )
      const { desmontar } = await montar()
      const texto = document.body.textContent ?? ""
      expect(texto).toContain("Instale o Claude Code")
      expect(texto).not.toContain("ANTHROPIC_API_KEY")
      await desmontar()
    })
  })
})
