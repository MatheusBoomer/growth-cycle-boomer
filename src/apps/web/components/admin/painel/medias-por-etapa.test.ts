// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MediasPorEtapa } from "@/lib/api"

const metricasGerais = vi.fn<() => Promise<{ projetos: never[]; medias: MediasPorEtapa }>>()
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: { metricasGerais: () => metricasGerais() },
}))

const { SecaoMediasPorEtapa, ROTULO_BASE_PEQUENA } = await import("./medias-por-etapa")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ETAPAS = [
  { id: "01", rotulo: "01 · Preparação de contexto" },
  { id: "03", rotulo: "03 · Diagnóstico de performance" },
  { id: "04", rotulo: "04 · Unidade econômica" },
] as never

const MEDIAS: MediasPorEtapa = {
  "01": {
    custo: { media: 1.5, mediana: 1.4, min: 1, max: 2, n: 6 },
    tempoUtil: { media: 600, mediana: 540, min: 300, max: 900, n: 6 },
    basePequena: false,
  },
  "03": {
    custo: { media: 4, mediana: 4, min: 3, max: 5, n: 2 },
    tempoUtil: null,
    basePequena: true,
  },
}

async function montar() {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(createElement(SecaoMediasPorEtapa, { etapas: ETAPAS })))
  const botao = (texto: string) => [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)
  const clicar = (b: HTMLElement | undefined) => act(async () => b!.click())
  return { raiz, botao, clicar, desmontar: () => act(async () => r.unmount()) }
}

beforeEach(() => {
  metricasGerais.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ""
})

describe("SecaoMediasPorEtapa", () => {
  it("ROTULO_BASE_PEQUENA diz quantos projetos faltam para a média valer", () => {
    expect(ROTULO_BASE_PEQUENA).toBe("base pequena, menos de 5 projetos")
  })

  it("começa fechada e não pede nada", async () => {
    const m = await montar()
    const abrir = m.botao("Médias por etapa")
    expect(abrir?.getAttribute("aria-expanded")).toBe("false")
    expect(m.raiz.querySelector("[data-media]")).toBeNull()
    expect(metricasGerais).not.toHaveBeenCalled()
    await m.desmontar()
  })

  it("ao abrir pede uma vez, mostra o esqueleto e depois as linhas na ordem do processo", async () => {
    let liberar!: (v: { projetos: never[]; medias: MediasPorEtapa }) => void
    metricasGerais.mockReturnValue(new Promise((ok) => (liberar = ok)))
    const m = await montar()
    await m.clicar(m.botao("Médias por etapa"))
    expect(m.botao("Médias por etapa")?.getAttribute("aria-expanded")).toBe("true")
    expect(m.raiz.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    await act(async () => liberar({ projetos: [], medias: MEDIAS }))
    const linhas = [...m.raiz.querySelectorAll("[data-media]")].map((li) => li.firstElementChild?.textContent ?? "")
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toContain("01Preparação de contexto")
    expect(linhas[1]).toContain("03Diagnóstico de performance")
    const texto = m.raiz.textContent ?? ""
    expect(texto).toContain("US$ 1,50")
    expect(texto).toContain("mediana US$ 1,40")
    expect(texto).toContain("US$ 1,00 a US$ 2,00")
    expect(texto).toContain("6 projetos")
    expect(texto).toContain("Sem dados")

    // Fechar e abrir de novo não pede outra vez.
    await m.clicar(m.botao("Médias por etapa"))
    expect(m.raiz.querySelector("[data-media]")).toBeNull()
    await m.clicar(m.botao("Médias por etapa"))
    expect(m.raiz.querySelector("[data-media]")).not.toBeNull()
    expect(metricasGerais).toHaveBeenCalledTimes(1)
    await m.desmontar()
  })

  it("etapa com base pequena leva o selo e o aviso; as outras não", async () => {
    metricasGerais.mockResolvedValue({ projetos: [], medias: MEDIAS })
    const m = await montar()
    await m.clicar(m.botao("Médias por etapa"))
    const [primeira, segunda] = [...m.raiz.querySelectorAll("[data-media]")]
    expect(primeira?.textContent).not.toContain(ROTULO_BASE_PEQUENA)
    expect(segunda?.querySelector('[data-slot="badge"]')?.textContent).toBe(ROTULO_BASE_PEQUENA)
    expect(m.raiz.querySelector('[data-slot="alert"]')?.textContent).toContain("Base pequena")
    await m.desmontar()
  })

  it("sem nenhuma etapa concluída diz que ainda não há médias", async () => {
    metricasGerais.mockResolvedValue({ projetos: [], medias: {} })
    const m = await montar()
    await m.clicar(m.botao("Médias por etapa"))
    expect(m.raiz.textContent).toContain("Ainda não há etapa concluída para calcular médias.")
    await m.desmontar()
  })

  it("erro vira um Alert com 'Tentar de novo', que pede de novo e mostra as linhas", async () => {
    metricasGerais.mockRejectedValueOnce(new Error("Falha de rede"))
    const m = await montar()
    await m.clicar(m.botao("Médias por etapa"))
    expect(m.raiz.querySelector('[data-slot="alert"]')?.textContent).toContain("Falha de rede")
    expect(m.raiz.querySelector("[data-media]")).toBeNull()
    metricasGerais.mockResolvedValueOnce({ projetos: [], medias: MEDIAS })
    await m.clicar(m.botao("Tentar de novo"))
    expect(metricasGerais).toHaveBeenCalledTimes(2)
    expect(m.raiz.querySelector("[data-media]")).not.toBeNull()
    expect(m.botao("Tentar de novo")).toBeUndefined()
    await m.desmontar()
  })
})
