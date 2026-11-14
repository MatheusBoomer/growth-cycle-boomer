// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/projetos/verdeluz" }))
const { AbasAdmin } = await import("./abas-admin")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ""
})

describe("AbasAdmin", () => {
  it("abas em pílula; em sub-rota a aba mãe fica marcada", async () => {
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(AbasAdmin)))
    const atual = raiz.querySelector('[aria-current="page"]')!
    expect(atual.textContent).toBe("Projetos")
    expect(atual.className).toContain("rounded-full")
    expect(raiz.querySelector("nav")!.className).toContain("rounded-full")
    await act(async () => r.unmount())
  })
})
