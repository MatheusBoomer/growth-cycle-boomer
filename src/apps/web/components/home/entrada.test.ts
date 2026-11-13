// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }))

const { Entrada } = await import("./entrada")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let raiz: HTMLDivElement
let r: Root

function movimentoReduzido(reduzido: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduzido }) as unknown as typeof window.matchMedia
}

async function montar(emAndamento: number) {
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
  await act(async () => r.render(createElement(Entrada, { emAndamento })))
}

beforeEach(() => {
  vi.useFakeTimers()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement["getContext"]
  movimentoReduzido(false)
  document.cookie = "gc-boas-vindas=1; path=/"
})

afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("Entrada", () => {
  it("mostra Growth Cycle e o total em andamento", async () => {
    await montar(8)
    expect(raiz.textContent).toContain("Growth")
    expect(raiz.textContent).toContain("Cycle")
    expect(raiz.textContent).toContain("8 projetos em andamento")
  })

  it("no singular, 1 projeto em andamento", async () => {
    await montar(1)
    expect(raiz.textContent).toContain("1 projeto em andamento")
  })

  it("apaga o cookie de boas-vindas ao montar", async () => {
    await montar(3)
    expect(document.cookie).not.toContain("gc-boas-vindas=1")
  })

  it("some sozinha depois de 3 s", async () => {
    await montar(3)
    await act(async () => vi.advanceTimersByTime(2400))
    await act(async () => vi.advanceTimersByTime(600))
    expect(raiz.textContent).toBe("")
  })

  it("Esc pula", async () => {
    await montar(3)
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
    await act(async () => vi.advanceTimersByTime(600))
    expect(raiz.textContent).toBe("")
  })

  it("com movimento reduzido não aparece, mas apaga o cookie", async () => {
    movimentoReduzido(true)
    await montar(3)
    expect(raiz.textContent).toBe("")
    expect(document.cookie).not.toContain("gc-boas-vindas=1")
  })
})
