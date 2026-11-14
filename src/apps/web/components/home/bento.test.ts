// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Bento } from "./bento"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const p = (slug: string, extra: Partial<ResumoProspect> = {}): ResumoProspect => ({
  slug,
  nome: `Nome ${slug}`,
  etapaAtual: "04",
  rotuloEtapaAtual: "04 · Unidade econômica",
  concluidas: 3,
  totalEtapas: 9,
  pendencias: 0,
  teste: false,
  dono: null,
  atualizadoEm: "2026-11-10T10:00:00Z",
  ...extra,
})

let raiz: HTMLDivElement
let r: Root

async function montar(prospects: ResumoProspect[], aoFiltrarPendentes = vi.fn()) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
  await act(async () => r.render(createElement(Bento, { prospects, aoFiltrarPendentes })))
  return aoFiltrarPendentes
}

afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
})

const cartaoAprovacoes = () => raiz.querySelector("[data-slot=aprovacoes]")!

describe("Bento", () => {
  it("'Continue de onde parou' mostra o mais recente, a etapa e o link para abrir", async () => {
    await montar([p("a", { atualizadoEm: "2026-11-01T10:00:00Z" }), p("b", { atualizadoEm: "2026-11-12T10:00:00Z" })])
    expect(raiz.textContent).toContain("Continue de onde parou")
    expect(raiz.textContent).toContain("Nome b")
    expect(raiz.textContent).toContain("Etapa 04")
    expect(raiz.textContent).toContain("Unidade econômica")
    expect([...raiz.querySelectorAll("a")].find((a) => a.textContent?.includes("Abrir etapa"))?.getAttribute("href")).toBe("/prospects/b")
  })

  it("etapa sem número (Apresentação final) mostra só o nome, sem 'Etapa' solto", async () => {
    await montar([p("a", { etapaAtual: "final", rotuloEtapaAtual: "Apresentação final" })])
    expect(raiz.textContent).toContain("Apresentação final")
    expect(raiz.textContent).not.toContain("Etapa")
  })

  it("sem nenhum em andamento, mostra o vazio", async () => {
    await montar([p("a", { etapaAtual: null })])
    expect(raiz.textContent).toContain("Nenhum projeto em andamento")
  })

  it("números de em andamento e concluídos", async () => {
    await montar([p("a"), p("b"), p("c", { etapaAtual: null })])
    const numeros = [...raiz.querySelectorAll("[data-slot=numero]")].map((n) => n.textContent)
    expect(numeros).toEqual(["2em andamento", "1concluídos"])
  })

  it("uma aprovação: o card laranja leva ao prospect", async () => {
    await montar([p("a", { pendencias: 1 })])
    expect(cartaoAprovacoes().textContent).toContain("1 aprovação esperando você · Nome a")
    expect(cartaoAprovacoes().closest("a")?.getAttribute("href") ?? cartaoAprovacoes().getAttribute("href")).toBe("/prospects/a")
  })

  it("aprovações em vários prospects: o card laranja aplica o filtro de pendentes", async () => {
    const filtrar = await montar([p("a", { pendencias: 2 }), p("b", { pendencias: 1 })])
    expect(cartaoAprovacoes().textContent).toContain("3 aprovações esperando você · 2 projetos")
    await act(async () => (cartaoAprovacoes() as HTMLElement).click())
    expect(filtrar).toHaveBeenCalledOnce()
  })

  it("sem aprovações, o card fica neutro e não leva a lugar nenhum", async () => {
    await montar([p("a")])
    expect(cartaoAprovacoes().textContent).toContain("Nenhuma aprovação esperando")
    expect(cartaoAprovacoes().tagName).toBe("DIV")
  })
})
