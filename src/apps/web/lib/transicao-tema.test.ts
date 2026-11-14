// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { alternarTemaJa, trocarTemaComCirculo } from "./transicao-tema"

type Transicao = ((cb: () => void) => { ready: Promise<void> }) | undefined

function definirTransicao(fn: Transicao) {
  Object.defineProperty(document, "startViewTransition", { configurable: true, writable: true, value: fn })
}

function movimentoReduzido(reduzido: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduzido }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
  movimentoReduzido(false)
})

afterEach(() => {
  definirTransicao(undefined)
  vi.restoreAllMocks()
})

describe("trocarTemaComCirculo", () => {
  it("sem View Transitions, aplica direto", () => {
    const aplicar = vi.fn()
    trocarTemaComCirculo({ x: 10, y: 10 }, aplicar)
    expect(aplicar).toHaveBeenCalledTimes(1)
  })

  it("com movimento reduzido, aplica direto e não anima", () => {
    movimentoReduzido(true)
    const transicao = vi.fn()
    definirTransicao(transicao)
    const aplicar = vi.fn()
    trocarTemaComCirculo({ x: 10, y: 10 }, aplicar)
    expect(aplicar).toHaveBeenCalledTimes(1)
    expect(transicao).not.toHaveBeenCalled()
  })

  it("com View Transitions, aplica dentro da transição e anima o círculo a partir da origem", async () => {
    definirTransicao((cb) => {
      cb()
      return { ready: Promise.resolve() }
    })
    const animar = vi.fn()
    document.documentElement.animate = animar as unknown as typeof document.documentElement.animate
    const aplicar = vi.fn()

    trocarTemaComCirculo({ x: 100, y: 50 }, aplicar)
    await Promise.resolve()
    await Promise.resolve()

    expect(aplicar).toHaveBeenCalledTimes(1)
    expect(animar).toHaveBeenCalledTimes(1)
    const [quadros, opcoes] = animar.mock.calls[0]!
    expect(quadros.clipPath[0]).toBe("circle(0px at 100px 50px)")
    // Raio até o canto mais longe: hypot(900, 750) ≈ 1171,5
    expect(quadros.clipPath[1]).toMatch(/^circle\(1171\.\d+px at 100px 50px\)$/)
    expect(opcoes).toMatchObject({ duration: 650, pseudoElement: "::view-transition-new(root)" })
  })
})

describe("alternarTemaJa", () => {
  it("dois cliques seguidos voltam ao tema de partida, mesmo antes do next-themes atualizar", () => {
    document.documentElement.classList.remove("dark")
    const setTheme = vi.fn()
    alternarTemaJa(setTheme)
    alternarTemaJa(setTheme)
    expect(setTheme.mock.calls).toEqual([["dark"], ["light"]])
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
