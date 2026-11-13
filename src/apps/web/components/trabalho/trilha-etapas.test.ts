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

describe("TrilhaEtapas: árvore por fase", () => {
  const catalogoFases = {
    etapas: [
      { id: "01", numero: "01", titulo: "Preparação de contexto", fase: "Contexto" },
      { id: "03", numero: "03", titulo: "Diagnóstico de performance", fase: "Diagnóstico" },
      { id: "04", numero: "04", titulo: "Unidade econômica", fase: "Diagnóstico" },
      { id: "05", numero: "05", titulo: "Soluções", fase: "Soluções e metas" },
    ],
  } as never
  const estadoFases = { prospect: { nome: "Iszi" }, etapas: { "01": { status: "concluida" }, "03": { status: "concluida" }, "04": { status: "em_andamento" }, "05": { status: "bloqueada" } } } as never

  async function montarFases() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ uso: null })))
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => {
      r.render(
        createElement(ProvedorConta, {
          email: null,
          ambiente: { executor: "sdk", nuvem: true },
          children: createElement(TrilhaEtapas, { catalogo: catalogoFases, estado: estadoFases, selecionada: "04" as never, aoSelecionar: () => {}, bibliotecaAberta: false, totalBiblioteca: 3, aoAbrirBiblioteca: () => {} }),
        }),
      )
    })
    return { raiz, desmontar: () => act(async () => r.unmount()) }
  }
  const fase = (raiz: HTMLElement, nome: string) => [...raiz.querySelectorAll("button[aria-expanded]")].find((b) => b.textContent?.includes(nome)) as HTMLElement
  const etapaBotao = (raiz: HTMLElement, titulo: string) => [...raiz.querySelectorAll("button:not([aria-expanded])")].find((b) => b.textContent?.includes(titulo)) as HTMLButtonElement | undefined

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("cada fase do catálogo é um botão que abre e fecha", async () => {
    const { raiz, desmontar } = await montarFases()
    expect(fase(raiz, "Diagnóstico").getAttribute("aria-expanded")).toBe("true")
    await act(async () => fase(raiz, "Diagnóstico").click())
    expect(fase(raiz, "Diagnóstico").getAttribute("aria-expanded")).toBe("false")
    expect(etapaBotao(raiz, "Unidade econômica")).toBeUndefined()
    await desmontar()
  })

  it("a etapa selecionada é a atual e a bloqueada fica desabilitada", async () => {
    const { raiz, desmontar } = await montarFases()
    expect(etapaBotao(raiz, "Unidade econômica")!.getAttribute("aria-current")).toBe("step")
    // Fase sem nada feito nem em andamento começa fechada; abrindo, a etapa bloqueada está desabilitada.
    expect(etapaBotao(raiz, "Soluções")).toBeUndefined()
    await act(async () => fase(raiz, "Soluções e metas").click())
    expect(etapaBotao(raiz, "Soluções")!.disabled).toBe(true)
    await desmontar()
  })

  it("mostra o progresso do ciclo e a fase atual", async () => {
    const { raiz, desmontar } = await montarFases()
    expect(raiz.textContent).toContain("2 de 4 etapas")
    expect(raiz.textContent).toContain("em Diagnóstico")
    await desmontar()
  })
})
