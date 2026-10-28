// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import { TrilhaEtapas } from "./trilha-etapas"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const catalogo = { etapas: [{ id: "01", numero: "01", titulo: "Preparação" }] } as never
const estado = { prospect: { nome: "Iszi" }, etapas: { "01": { status: "pronta" } } } as never

async function montar(nuvem: boolean) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  const trilha = createElement(TrilhaEtapas, {
    catalogo,
    estado,
    selecionada: "01" as never,
    aoSelecionar: () => {},
    bibliotecaAberta: false,
    totalBiblioteca: 0,
    aoAbrirBiblioteca: () => {},
  })
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: null, ambiente: { executor: nuvem ? "sdk" : "cli", nuvem }, children: trilha }))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

describe("TrilhaEtapas", () => {
  const fetchFalso = vi.fn()
  beforeEach(() => {
    fetchFalso.mockReset()
    fetchFalso.mockResolvedValue(Response.json({ uso: null }))
    vi.stubGlobal("fetch", fetchFalso)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("no modo local mostra o painel de uso da assinatura", async () => {
    const { raiz, desmontar } = await montar(false)
    expect(raiz.textContent).toContain("Uso do Claude")
    await desmontar()
  })

  it("na nuvem não mostra o painel de uso nem busca /api/uso", async () => {
    const { raiz, desmontar } = await montar(true)
    expect(raiz.textContent).not.toContain("Uso do Claude")
    expect(fetchFalso).not.toHaveBeenCalled()
    expect(raiz.textContent).toContain("Biblioteca")
    await desmontar()
  })
})
