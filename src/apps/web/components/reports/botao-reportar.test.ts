// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A captura demora: o teste segura a promessa para ver o estado "capturando".
let soltar: (v: string) => void = () => {}
const domToPng = vi.fn((_el: unknown, _op: { filter?: (n: Node) => boolean }) => new Promise<string>((r) => (soltar = r)))
vi.mock("modern-screenshot", () => ({ domToPng }))
vi.mock("./dialogo-report", () => ({ DialogoReport: ({ aberto }: { aberto: boolean }) => (aberto ? createElement("div", { "data-dialogo": true }) : null) }))

const { BotaoReportar } = await import("./botao-reportar")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  domToPng.mockClear()
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof window.requestAnimationFrame
})
afterEach(() => {
  document.body.innerHTML = ""
})

async function montar() {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  await act(async () => createRoot(raiz).render(createElement(BotaoReportar)))
  return { raiz, botao: () => raiz.querySelector<HTMLButtonElement>("[data-reportar]")! }
}

describe("BotaoReportar: retorno enquanto tira o print", () => {
  it("o clique mostra 'Capturando…' na hora, marca ocupado e um segundo clique não tira outro print", async () => {
    const { raiz, botao } = await montar()
    await act(async () => {
      botao().click()
      botao().click()
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(botao().textContent).toContain("Capturando")
    expect(botao().getAttribute("aria-busy")).toBe("true")
    expect(domToPng).toHaveBeenCalledTimes(1)
    await act(async () => {
      soltar("data:image/png;base64,AA")
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(raiz.querySelector("[data-dialogo]")).not.toBeNull()
    expect(botao().textContent).toContain("Reportar")
  })

  it("o próprio botão (com o giro) não sai no print", async () => {
    const { botao } = await montar()
    await act(async () => {
      botao().click()
      await new Promise((r) => setTimeout(r, 60))
    })
    const filtro = domToPng.mock.calls[0]![1].filter!
    expect(filtro(botao())).toBe(false)
    expect(filtro(document.body)).toBe(true)
    await act(async () => soltar(""))
  })
})
