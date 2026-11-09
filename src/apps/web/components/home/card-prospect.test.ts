// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { ProvedorConta } from "@/components/marca/conta-contexto"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { CardProspect } = await import("./card-prospect")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const prospect = { slug: "iszi", nome: "Iszi", etapaAtual: "01", rotuloEtapaAtual: "Preparação", concluidas: 0, totalEtapas: 10, pendencias: 0, teste: false, atualizadoEm: "2026-10-27T10:00:00Z" } as unknown as ResumoProspect

async function menuAberto(nuvem: boolean) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: null, ambiente: { executor: nuvem ? "sdk" : "cli", nuvem }, children: createElement(CardProspect, { prospect }) }))
  })
  const gatilho = raiz.querySelector<HTMLElement>('[aria-label="Ações de Iszi"]')!
  await act(async () => {
    gatilho.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    gatilho.click()
  })
  return () => act(async () => r.unmount())
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("CardProspect: abrir pasta", () => {
  it("no modo local o menu tem 'Abrir pasta no Finder'", async () => {
    const desmontar = await menuAberto(false)
    expect(document.body.textContent).toContain("Abrir pasta no Finder")
    await desmontar()
  })

  it("na nuvem o item não aparece, e o resto do menu continua", async () => {
    const desmontar = await menuAberto(true)
    expect(document.body.textContent).not.toContain("Finder")
    expect(document.body.textContent).toContain("Excluir")
    await desmontar()
  })
})

async function renderizar(p: ResumoProspect, papel: "admin" | "usuario", fotoUrl?: string) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: "ana@boomer.com", papel, children: createElement(CardProspect, { prospect: p, fotoUrl }) }))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

describe("CardProspect: analista e etapa", () => {
  const comDono = { ...prospect, dono: "ana.souza@boomer.com", concluidas: 2, totalEtapas: 8, rotuloEtapaAtual: "03 · Diagnóstico de performance", etapaAtual: "03" } as unknown as ResumoProspect

  it("admin vê o analista (nome curto e iniciais) e o nome da etapa atual", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "admin")
    expect(raiz.textContent).toContain("Ana Souza")
    expect(raiz.textContent).toContain("AS")
    expect(raiz.textContent).toContain("03 · Diagnóstico de performance")
    await desmontar()
  })

  it("admin vê 'Sem dono' quando o prospect não tem dono", async () => {
    const { raiz, desmontar } = await renderizar({ ...comDono, dono: null } as ResumoProspect, "admin")
    expect(raiz.textContent).toContain("Sem dono")
    await desmontar()
  })

  it("usuário comum não vê a linha do analista, mas vê a etapa", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "usuario")
    expect(raiz.textContent).not.toContain("Ana Souza")
    expect(raiz.textContent).not.toContain("Sem dono")
    expect(raiz.textContent).toContain("03 · Diagnóstico de performance")
    await desmontar()
  })

  it("concluído mostra 'Concluído' no lugar do rótulo da etapa", async () => {
    const concluido = { ...comDono, etapaAtual: null, rotuloEtapaAtual: "Planejamento concluído", concluidas: 8 } as unknown as ResumoProspect
    const { raiz, desmontar } = await renderizar(concluido, "usuario")
    expect(raiz.textContent).toContain("Concluído")
    expect(raiz.textContent).not.toContain("Planejamento concluído")
    await desmontar()
  })

  it("mostra a barra de etapas, o contador e os selos de aprovação e teste", async () => {
    const { raiz, desmontar } = await renderizar({ ...comDono, pendencias: 2, teste: true } as ResumoProspect, "usuario")
    expect(raiz.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("2 de 8 etapas concluídas")
    expect(raiz.textContent).toContain("2 de 8 etapas")
    expect(raiz.textContent).toContain("2 aprovações pendentes")
    expect(raiz.textContent).toContain("Teste")
    await desmontar()
  })

  it("usa a foto do analista quando ela chega", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "admin", "https://lh3.googleusercontent.com/a/foto")
    expect(raiz.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer")
    await desmontar()
  })
})
