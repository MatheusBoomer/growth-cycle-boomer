// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fraseDoPasso, type PassoDeAtividade } from "@/lib/frases-do-agente"
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

  it("ao vivo: fechado por padrão, com a frase amigável do passo atual", async () => {
    await montar(DOIS, true)
    expect(cabecalho().textContent).toContain(fraseDoPasso(DOIS[1] as PassoDeAtividade, 1))
    expect(cabecalho().textContent).not.toContain("scripts/ltv.py")
    expect(cabecalho().textContent).not.toContain("clientes/x/")
    expect(cabecalho().getAttribute("aria-expanded")).toBe("false")
    expect(raiz.querySelectorAll("li")).toHaveLength(0)
  })

  it("abrir é escolha do analista: ao vivo abre no clique, com a frase e o texto técnico só no tooltip", async () => {
    await montar(DOIS, true)
    await act(async () => (cabecalho() as HTMLElement).click())
    const itens = [...raiz.querySelectorAll("li")]
    expect(itens).toHaveLength(2)
    expect(itens[0]!.textContent).toContain(fraseDoPasso(DOIS[0] as PassoDeAtividade, 0))
    expect(itens[0]!.textContent).not.toContain("base.xlsx")
    expect(itens[0]!.querySelector("[title]")?.getAttribute("title")).toBe("clientes/x/dados/base.xlsx")
  })

  it("nada abre nem fecha sozinho quando o agente começa ou termina", async () => {
    await montar(DOIS, true)
    await act(async () => (cabecalho() as HTMLElement).click())
    await act(async () => r.render(createElement(ThoughtLine, { itens: DOIS, slug: "x", aoVivo: false })))
    expect(cabecalho().getAttribute("aria-expanded")).toBe("true")
    await act(async () => (cabecalho() as HTMLElement).click())
    await act(async () => r.render(createElement(ThoughtLine, { itens: DOIS, slug: "x", aoVivo: true })))
    expect(cabecalho().getAttribute("aria-expanded")).toBe("false")
  })

  it("controlado pelo pai: mostra o estado recebido e avisa o clique sem mudar sozinho", async () => {
    const aoMudarAberto = vi.fn()
    raiz = document.createElement("div")
    document.body.append(raiz)
    r = createRoot(raiz)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    await act(async () => r.render(createElement(ThoughtLine, { itens: DOIS, slug: "x", aoVivo: false, aberto: true, aoMudarAberto })))
    expect(cabecalho().getAttribute("aria-expanded")).toBe("true")
    expect(raiz.querySelectorAll("li")).toHaveLength(2)
    await act(async () => (cabecalho() as HTMLElement).click())
    expect(aoMudarAberto).toHaveBeenCalledWith(false)
    expect(cabecalho().getAttribute("aria-expanded")).toBe("true")
  })

  it("ao vivo sem nenhum passo ainda: 'Pensando…'", async () => {
    await montar([], true)
    expect(cabecalho().textContent).toContain("Pensando…")
  })

  it("fala intermediária do agente continua aparecendo como texto da fala", async () => {
    const fala: EventoProcesso = { tipo: "texto_agente", texto: "Estou conferindo qual Python tem pandas.", em: "2026-11-12T10:00:00.000Z" }
    await montar([fala], true)
    expect(cabecalho().textContent).toContain("Estou conferindo qual Python tem pandas.")
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
