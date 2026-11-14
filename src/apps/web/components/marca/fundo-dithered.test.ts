// @vitest-environment jsdom
import { StrictMode, act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }))

const { FundoDithered } = await import("./fundo-dithered")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  // Navegador sem WebGL2: getContext devolve null.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement["getContext"]
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ""
})

describe("FundoDithered", () => {
  it("sem WebGL2 monta sem lançar e deixa um canvas decorativo, fora do caminho do mouse", async () => {
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(FundoDithered, { centroLimpo: true })))
    const canvas = raiz.querySelector("canvas")!
    expect(canvas.getAttribute("aria-hidden")).toBe("true")
    expect(canvas.getAttribute("class")).toContain("pointer-events-none")
    await act(async () => r.unmount())
  })

  it("remontar (modo estrito do React) não mata o contexto WebGL do canvas", async () => {
    const perder = vi.fn()
    // GL falso: qualquer método é um vi.fn; o programa liga e a extensão de perda de contexto é espionada.
    const gl = new Proxy({} as Record<string | symbol, unknown>, {
      get(alvo, nome) {
        if (nome === "getProgramParameter") return () => true
        if (nome === "getExtension") return () => ({ loseContext: perder })
        if (typeof nome === "string" && /^[A-Z_]+$/.test(nome)) return 0
        return (alvo[nome] ??= vi.fn())
      },
    })
    HTMLCanvasElement.prototype.getContext = vi.fn(() => gl) as unknown as HTMLCanvasElement["getContext"]
    window.IntersectionObserver = class { observe() {} disconnect() {} } as unknown as typeof IntersectionObserver
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(StrictMode, null, createElement(FundoDithered))))
    expect(perder).not.toHaveBeenCalled()
    await act(async () => r.unmount())
  })
})
