// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let tema: string | undefined = "light"
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: tema }) }))

const { FundoOndasAscii } = await import("./fundo-ondas-ascii")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Contexto 2D falso: guarda a cor vigente a cada fillText, que é o que o teste de tema precisa ver.
let estilos: string[]
let xs: number[]
let blurs: number[]
let sombras: string[]
let ctx: Record<string, unknown>
let fila: Map<number, FrameRequestCallback>
let proximoId: number
let raiz: Root | null = null
let oculto = false

function instalarAmbiente({ reduzido = false, largura = 1024, altura = 768, contexto = true } = {}) {
  estilos = []
  xs = []
  blurs = []
  sombras = []
  ctx = {
    fillStyle: "",
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textBaseline: "",
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillText: vi.fn((_ch: string, x: number) => {
      estilos.push(String(ctx.fillStyle))
      xs.push(x)
      blurs.push(Number(ctx.shadowBlur))
      sombras.push(String(ctx.shadowColor))
    }),
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => (contexto ? ctx : null)) as never)
  fila = new Map()
  proximoId = 0
  window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    fila.set(++proximoId, cb)
    return proximoId
  })
  window.cancelAnimationFrame = vi.fn((id: number) => void fila.delete(id))
  window.matchMedia = vi.fn((q: string) => ({ matches: reduzido && q.includes("reduce"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: largura })
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: altura })
  oculto = false
  Object.defineProperty(document, "hidden", { configurable: true, get: () => oculto })
}

async function montar() {
  const el = document.createElement("div")
  document.body.append(el)
  raiz = createRoot(el)
  await act(async () => raiz!.render(createElement(FundoOndasAscii)))
}

async function rerenderizar() {
  await act(async () => raiz!.render(createElement(FundoOndasAscii)))
}

/** Roda os quadros agendados, com o relógio em `ms`. */
async function quadro(ms: number) {
  const cbs = [...fila.values()]
  fila.clear()
  await act(async () => cbs.forEach((cb) => cb(ms)))
}

beforeEach(() => {
  tema = "light"
})

afterEach(async () => {
  if (raiz) await act(async () => raiz!.unmount())
  raiz = null
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("FundoOndasAscii", () => {
  it("sem getContext não renderiza canvas", async () => {
    instalarAmbiente({ contexto: false })
    await montar()
    expect(document.querySelector("canvas")).toBeNull()
  })

  it("renderiza canvas aria-hidden, sem pointer-events e com o degradê da esquerda para a direita", async () => {
    instalarAmbiente()
    await montar()
    const canvas = document.querySelector("canvas")!
    expect(canvas.getAttribute("aria-hidden")).toBe("true")
    expect(canvas.className).toContain("pointer-events-none")
    expect(canvas.className).toContain("mask-image:linear-gradient(to_right,#000,transparent)")
  })

  it("não desenha nas colunas que o degradê já escondeu e desenha por toda a largura útil", async () => {
    instalarAmbiente({ reduzido: true })
    await montar()
    expect(xs.length).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.96 * 1024)
    expect(Math.max(...xs)).toBeGreaterThan(0.5 * 1024)
  })

  it("reduced-motion: desenha um quadro e não agenda requestAnimationFrame", async () => {
    instalarAmbiente({ reduzido: true })
    await montar()
    expect(ctx.fillText).toHaveBeenCalled()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it("janela com tamanho 0: não desenha e não lança", async () => {
    instalarAmbiente({ largura: 0, altura: 0 })
    await montar()
    await quadro(1000)
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it("tema ainda não resolvido usa a paleta clara e não lança", async () => {
    tema = undefined
    instalarAmbiente({ reduzido: true })
    await montar()
    expect(estilos.length).toBeGreaterThan(0)
    expect(estilos.some((e) => e.includes("57, 135, 229"))).toBe(true)
  })

  it("trocar o tema reaproveita o loop e passa a usar a cor nova", async () => {
    instalarAmbiente()
    await montar()
    await quadro(1000)
    const agendados = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length
    tema = "dark"
    await rerenderizar()
    expect((window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length).toBe(agendados)
    estilos.length = 0
    await quadro(2000)
    expect(estilos.some((e) => e.includes("84, 178, 255"))).toBe(true)
    expect(estilos.some((e) => e.includes("57, 135, 229"))).toBe(false)
  })

  it("trocar o tema em reduced-motion redesenha o quadro estático", async () => {
    instalarAmbiente({ reduzido: true })
    await montar()
    estilos.length = 0
    tema = "dark"
    await rerenderizar()
    expect(estilos.some((e) => e.includes("84, 178, 255"))).toBe(true)
  })

  it("tema escuro: neon leve só nas faixas mais fortes, na cor do lote, e o brilho volta a 0 no fim do quadro", async () => {
    tema = "dark"
    instalarAmbiente({ reduzido: true })
    await montar()
    expect(blurs.some((b) => b > 0)).toBe(true)
    expect(blurs.some((b) => b === 0)).toBe(true)
    expect(sombras.some((s) => s.includes("84, 178, 255"))).toBe(true)
    expect(ctx.shadowBlur).toBe(0)
  })

  it("tema claro: nunca usa brilho", async () => {
    instalarAmbiente({ reduzido: true })
    await montar()
    expect(blurs.length).toBeGreaterThan(0)
    expect(blurs.every((b) => b === 0)).toBe(true)
  })

  it("desmontar chama cancelAnimationFrame com o id pendente", async () => {
    instalarAmbiente()
    await montar()
    await quadro(1000)
    const pendente = [...fila.keys()][0]!
    await act(async () => raiz!.unmount())
    raiz = null
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(pendente)
    expect(fila.size).toBe(0)
  })

  it("aba oculta pausa o loop e ao voltar ele retoma", async () => {
    instalarAmbiente()
    await montar()
    await quadro(1000)
    oculto = true
    await act(async () => void document.dispatchEvent(new Event("visibilitychange")))
    expect(fila.size).toBe(0)
    const antes = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length
    oculto = false
    await act(async () => void document.dispatchEvent(new Event("visibilitychange")))
    expect((window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length).toBe(antes + 1)
    expect(fila.size).toBe(1)
  })
})
