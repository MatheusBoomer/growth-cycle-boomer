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
