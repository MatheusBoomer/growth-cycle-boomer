// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NumeroAnimado } from "./numero-animado"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// rAF controlado: cada quadro avança o relógio que o teste manda.
let quadros: FrameRequestCallback[] = []
let raiz: HTMLDivElement
let r: Root
const reduzido = (sim: boolean) => (window.matchMedia = vi.fn().mockReturnValue({ matches: sim }) as unknown as typeof window.matchMedia)
const quadro = (t: number) => act(async () => quadros.splice(0).forEach((f) => f(t)))

beforeEach(async () => {
  quadros = []
  window.requestAnimationFrame = ((f: FrameRequestCallback) => quadros.push(f)) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = vi.fn()
  reduzido(false)
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
})

afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
})

describe("NumeroAnimado", () => {
  it("conta de 0 até o valor em 900 ms", async () => {
    await act(async () => r.render(createElement(NumeroAnimado, { valor: 8 })))
    expect(raiz.textContent).toBe("0")
    await quadro(1000)
    await quadro(1450)
    const meio = Number(raiz.textContent)
    expect(meio).toBeGreaterThan(0)
    expect(meio).toBeLessThan(8)
    await quadro(1900)
    expect(raiz.textContent).toBe("8")
  })

  it("com movimento reduzido já mostra o valor", async () => {
    reduzido(true)
    await act(async () => r.render(createElement(NumeroAnimado, { valor: 8 })))
    expect(raiz.textContent).toBe("8")
  })
})
