// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EscolhaEtapa } from "./escolha-etapa"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ""
})

const etapas = [
  { id: "01", rotulo: "01 · Preparação de contexto", fase: "Contexto" },
  { id: "02", rotulo: "02 · Contextualização", fase: "Contexto" },
  { id: "03", rotulo: "03 · Diagnóstico de performance", fase: "Diagnóstico" },
  { id: "final", rotulo: "Apresentação final", fase: "Apresentação" },
] as never

describe("EscolhaEtapa", () => {
  it("agrupa por fase, marca a escolhida e avisa a troca", async () => {
    const aoEscolher = vi.fn()
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(EscolhaEtapa, { etapas, valor: "03", aoEscolher, rotulo: "Etapa de partida" })))
    expect([...raiz.querySelectorAll("[data-fase]")].map((f) => f.textContent)).toEqual(["Contexto", "Diagnóstico", "Apresentação"])
    const marcada = raiz.querySelector('[role="radio"][aria-checked="true"]')!
    expect(marcada.textContent).toContain("Diagnóstico de performance")
    expect(raiz.querySelector('[role="radiogroup"]')!.getAttribute("aria-label")).toBe("Etapa de partida")
    const final = [...raiz.querySelectorAll('[role="radio"]')].find((b) => b.textContent?.includes("Apresentação final")) as HTMLElement
    await act(async () => final.click())
    expect(aoEscolher).toHaveBeenCalledWith("final")
    await act(async () => r.unmount())
  })
})
