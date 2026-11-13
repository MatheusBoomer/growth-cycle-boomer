// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EventoProcesso } from "@/lib/passos"
import { duracaoLegivel, ThoughtLine } from "./thought-line"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const passo = (detalhe: string, em: string): EventoProcesso => ({ tipo: "atividade", nome: "Read", detalhe, em })
const DOIS = [passo("clientes/x/dados/base.xlsx", "2026-11-12T10:00:00.000Z"), passo("clientes/x/scripts/ltv.py", "2026-11-12T10:00:04.400Z")]

let raiz: HTMLDivElement
let r: Root
async function montar(itens: EventoProcesso[], aoVivo: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
  await act(async () => r.render(createElement(ThoughtLine, { itens, slug: "x", aoVivo })))
}
afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
})
const cabecalho = () => raiz.querySelector("button[aria-expanded]")!

describe("ThoughtLine", () => {
  it("encerrado: 'Pensou por 4,4 s' e os passos recolhidos", async () => {
    await montar(DOIS, false)
    expect(cabecalho().textContent).toContain("Pensou por 4,4 s")
    expect(cabecalho().getAttribute("aria-expanded")).toBe("false")
  })

  it("sem horário confiável: 'Processo · N passos', nunca NaN", async () => {
    await montar([passo("a", "lixo"), passo("b", "lixo")], false)
    expect(cabecalho().textContent).toContain("Processo · 2 passos")
    expect(raiz.textContent).not.toContain("NaN")
  })

  it("ao vivo: mostra o passo atual (sem a pasta do prospect) e os passos abertos", async () => {
    await montar(DOIS, true)
    expect(cabecalho().textContent).toContain("scripts/ltv.py")
    expect(cabecalho().textContent).not.toContain("clientes/x/")
    expect(cabecalho().getAttribute("aria-expanded")).toBe("true")
    expect(raiz.querySelectorAll("li")).toHaveLength(2)
  })

  it("clicar no cabeçalho abre e fecha os passos", async () => {
    await montar(DOIS, false)
    await act(async () => (cabecalho() as HTMLElement).click())
    expect(cabecalho().getAttribute("aria-expanded")).toBe("true")
    expect(raiz.querySelectorAll("li")).toHaveLength(2)
  })
})

describe("duracaoLegivel", () => {
  it("segundos com uma casa até um minuto; depois minutos e segundos inteiros", () => {
    expect(duracaoLegivel(4.25)).toBe("4,3 s")
    expect(duracaoLegivel(59.94)).toBe("59,9 s")
    expect(duracaoLegivel(60)).toBe("1 min")
    expect(duracaoLegivel(754.3)).toBe("12 min 34 s")
    expect(duracaoLegivel(3725)).toBe("1 h 2 min")
  })
})
