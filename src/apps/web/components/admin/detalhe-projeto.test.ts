// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MediaEtapa, MetricasEtapa } from "@workspace/core/metricas/resumo"

const metricasDoProjeto = vi.fn()
const configModelos = vi.fn()
vi.mock("next/link", () => ({ default: (p: { href: string; children?: unknown }) => createElement("a", { href: p.href }, p.children as never) }))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { metricasDoProjeto, configModelos },
}))

const { comparacoesDaEtapa, larguraDaBarra, textoSemModelos, DetalheProjeto } = await import("./detalhe-projeto")
const { TERMOS } = await import("./legenda-termos")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const etapa = (usd: number, ativo: number, temPresenca: boolean): MetricasEtapa => ({
  custo: { usd, estimado: false, turnos: 1, modelos: {} },
  tempo: { agente: 0, ativo, ocioso: 0, descartado: 0 },
  temPresenca,
})
const estat = (media: number) => ({ media, mediana: media, min: media, max: media, n: 6 })
const media: MediaEtapa = { custo: estat(2), tempoUtil: estat(600), basePequena: false }

describe("comparacoesDaEtapa", () => {
  it("compara custo e tempo útil com a média", () => {
    expect(comparacoesDaEtapa(etapa(4.8, 1500, true), media)).toEqual({ custo: "2,4× a média", tempo: "2,5× a média" })
    expect(comparacoesDaEtapa(etapa(2, 600, true), media)).toEqual({ custo: "dentro da média", tempo: "dentro da média" })
  })

  it("sem média, não mostra nada", () => {
    expect(comparacoesDaEtapa(etapa(4.8, 1500, true), undefined)).toEqual({ custo: null, tempo: null })
    expect(comparacoesDaEtapa(etapa(4.8, 1500, true), { custo: null, tempoUtil: null, basePequena: true })).toEqual({ custo: null, tempo: null })
  })

  it("não compara o tempo de etapa sem presença nem o custo zerado", () => {
    expect(comparacoesDaEtapa(etapa(0, 1500, false), media)).toEqual({ custo: null, tempo: null })
  })
})

describe("textoSemModelos", () => {
  it("etapa só estimada diz não registrado; sem estimativa, Sem detalhe", () => {
    const estimada: MetricasEtapa = { ...etapa(1, 0, false), custo: { usd: 1, estimado: true, turnos: 2, modelos: {} } }
    expect(textoSemModelos(estimada)).toBe("não registrado")
    expect(textoSemModelos(etapa(1, 0, false))).toBe("Sem detalhe")
  })
})

const ETAPAS = [
  { id: "03", rotulo: "Diagnóstico" },
  { id: "04", rotulo: "Unidade econômica" },
  { id: "05", rotulo: "Soluções" },
] as never

const tempo = { agente: 60, ativo: 120, ocioso: 30, descartado: 10 }
const detalhe = {
  projeto: { slug: "verdeluz", nome: "Verdeluz", dono: "ana.souza@boomer.com.br", rotuloEtapaAtual: "Diagnóstico" },
  metricas: {
    custoUsd: 12,
    estimado: false,
    ultimaAtividade: "2026-11-05T12:00:00.000Z",
    tempo,
    porEtapa: {
      "03": { custo: { usd: 10, estimado: false, turnos: 2, modelos: { "claude-sonnet-5-5": 10 } }, tempo, temPresenca: true },
      "04": { custo: { usd: 5, estimado: false, turnos: 1, modelos: {} }, tempo, temPresenca: true },
      "05": { custo: { usd: 0, estimado: false, turnos: 0, modelos: {} }, tempo, temPresenca: true },
    },
    porPessoa: [
      { email: "ana.souza@boomer.com.br", custoUsd: 8, tempo },
      { email: "bia@boomer.com.br", custoUsd: 4, tempo },
      { email: "caio@boomer.com.br", custoUsd: 0, tempo },
    ],
  },
  medias: null,
}

async function montar() {
  metricasDoProjeto.mockResolvedValue(detalhe)
  configModelos.mockResolvedValue({ lista: { modelos: [], padrao: null, completa: false } })
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(createElement(DetalheProjeto, { slug: "verdeluz", etapas: ETAPAS })))
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.clearAllMocks()
})

describe("TERMOS", () => {
  it("tem os quatro termos, todos com texto", () => {
    expect(Object.keys(TERMOS).sort()).toEqual(["agente", "ativo", "descartado", "ocioso"])
    for (const texto of Object.values(TERMOS)) expect(texto.trim().length).toBeGreaterThan(10)
  })

  it("ocioso e descartado dizem a regra de metricas/tempo.ts (aba escondida ou 5 min sem interação; além dos primeiros 15 min)", () => {
    expect(TERMOS.ocioso).toBe("Tempo com o projeto aberto, mas com a aba escondida ou sem interação por 5 minutos (padrão).")
    expect(TERMOS.descartado).toBe("Tempo ocioso além dos primeiros 15 minutos seguidos (padrão): a pessoa provavelmente saiu.")
  })
})

describe("larguraDaBarra", () => {
  it("sem maior (tudo zerado) a barra é 0, sem NaN", () => {
    expect(larguraDaBarra(5, 0)).toBe(0)
    expect(larguraDaBarra(0, 0)).toBe(0)
    expect(larguraDaBarra(5, 10)).toBe(50)
  })
})

describe("DetalheProjeto", () => {
  it("focar o cabeçalho Ocioso mostra o significado no tooltip", async () => {
    const m = await montar()
    const gatilho = [...m.raiz.querySelectorAll<HTMLElement>("th [tabindex]")].find((g) => g.textContent === "Ocioso")
    expect(gatilho).toBeTruthy()
    const tooltip = () => document.querySelector('[data-slot="tooltip-content"]')
    expect(tooltip()).toBeNull()
    await act(async () => gatilho!.focus())
    expect(tooltip()?.textContent).toContain(TERMOS.ocioso)
    await m.desmontar()
  })

  it("o rótulo do termo tem a explicação como descrição acessível, mesmo com o tooltip fechado", async () => {
    const m = await montar()
    const gatilho = [...m.raiz.querySelectorAll<HTMLElement>("th [tabindex]")].find((g) => g.textContent === "Ocioso")!
    const id = gatilho.getAttribute("aria-describedby")
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)?.textContent).toBe(TERMOS.ocioso)
    expect(gatilho.textContent).toBe("Ocioso")
    await m.desmontar()
  })

  it("se a lista de modelos falhar, a tabela por etapa continua na tela", async () => {
    metricasDoProjeto.mockResolvedValue(detalhe)
    configModelos.mockRejectedValue(new Error("SDK fora do ar"))
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(DetalheProjeto, { slug: "verdeluz", etapas: ETAPAS })))
    expect(raiz.querySelectorAll('[data-barra="custo-etapa"]')).toHaveLength(3)
    expect(raiz.textContent).toContain("US$ 10,00")
    expect(raiz.querySelector('[data-slot="alert"]')).toBeNull()
    await act(async () => r.unmount())
  })

  it("o modelo aparece como selo, não como id cru, com o custo ao lado", async () => {
    const m = await montar()
    const texto = m.raiz.textContent ?? ""
    expect(texto).toContain("Sonnet 5.5 · fixo")
    expect(texto).not.toContain("claude-sonnet-5-5")
    await m.desmontar()
  })

  it("a barra de custo da etapa mais cara tem 100%, a de custo zero 0%, e o número continua", async () => {
    const m = await montar()
    const larguras = [...m.raiz.querySelectorAll<HTMLElement>('[data-barra="custo-etapa"]')].map((b) => b.style.width)
    expect(larguras).toEqual(["100%", "50%", "0%"])
    expect(m.raiz.textContent).toContain("US$ 10,00")
    await m.desmontar()
  })

  it("por pessoa, a barra do custo dos turnos é proporcional ao maior", async () => {
    const m = await montar()
    const larguras = [...m.raiz.querySelectorAll<HTMLElement>('[data-barra="custo-pessoa"]')].map((b) => b.style.width)
    expect(larguras).toEqual(["100%", "50%", "0%"])
    await m.desmontar()
  })
})
