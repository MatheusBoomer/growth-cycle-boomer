// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import type { ExecutorDoAmbiente } from "@workspace/core/sistema"
import { UsoAssinaturaBarra } from "./uso-assinatura"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar(executor: ExecutorDoAmbiente | null) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  const painel = createElement(UsoAssinaturaBarra)
  await act(async () => {
    r.render(executor ? createElement(ProvedorConta, { email: null, ambiente: { executor, nuvem: executor === "sdk" }, children: painel }) : painel)
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

describe("UsoAssinaturaBarra", () => {
  const fetchFalso = vi.fn()
  beforeEach(() => {
    fetchFalso.mockReset()
    fetchFalso.mockResolvedValue(Response.json({ uso: null }))
    vi.stubGlobal("fetch", fetchFalso)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("com o executor sdk não renderiza nem busca /api/uso", async () => {
    const { raiz, desmontar } = await montar("sdk")
    expect(raiz.textContent).toBe("")
    expect(fetchFalso).not.toHaveBeenCalled()
    await desmontar()
  })

  it("com o executor demo também não", async () => {
    const { raiz, desmontar } = await montar("demo")
    expect(raiz.textContent).toBe("")
    expect(fetchFalso).not.toHaveBeenCalled()
    await desmontar()
  })

  it("com o executor cli busca /api/uso e mostra o painel", async () => {
    const { raiz, desmontar } = await montar("cli")
    expect(fetchFalso).toHaveBeenCalledWith("/api/uso", { cache: "no-store" })
    expect(raiz.textContent).toContain("Uso do Claude")
    await desmontar()
  })

  it("fora de um provedor (padrão cli) segue como antes", async () => {
    const { raiz, desmontar } = await montar(null)
    expect(fetchFalso).toHaveBeenCalled()
    expect(raiz.textContent).toContain("Uso do Claude")
    await desmontar()
  })
})
