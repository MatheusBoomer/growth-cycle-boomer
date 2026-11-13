// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const trocar = vi.fn()
vi.mock("@/lib/transicao-tema", () => ({ trocarTemaComCirculo: trocar, aplicarTemaJa: vi.fn() }))

const { ThemeProvider } = await import("./theme-provider")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia
  const raiz = document.createElement("div")
  document.body.append(raiz)
  await act(async () => createRoot(raiz).render(createElement(ThemeProvider, null, createElement("input", { id: "campo" }))))
})

afterEach(() => {
  document.body.innerHTML = ""
  trocar.mockClear()
})

describe("atalho D do tema", () => {
  it("a tecla D troca o tema com o círculo saindo do centro da janela", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }))
    expect(trocar).toHaveBeenCalledTimes(1)
    expect(trocar.mock.calls[0]![0]).toEqual({ x: 500, y: 400 })
  })

  it("a tecla D dentro de um campo de texto não troca o tema", () => {
    document.getElementById("campo")!.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }))
    expect(trocar).not.toHaveBeenCalled()
  })
})
