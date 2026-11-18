// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import { ChatEtapa } from "./chat-etapa"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dadosDe = (turnoAtivo: "01" | null): RespostaEstado =>
  ({
    estado: { etapas: { "01": { status: "em_andamento", origem: "interface" } }, entregaveis: [] },
    catalogo: { etapas: [{ id: "02", rotuloStatus: "Etapa 2" }], insumos: [] },
    condicoes: { "01": [] },
    turnoAtivo,
    turnoPor: null,
    modelosDisponiveis: [],
    aprovadosForaDaInterface: [],
  }) as unknown as RespostaEstado

const t = (s: number) => new Date(Date.UTC(2026, 10, 12, 10, 0, s)).toISOString()
const AO_VIVO: EventoConversa[] = [
  { tipo: "turno_inicio", em: t(0) },
  { tipo: "atividade", nome: "Read", detalhe: "Lendo dados/base.xlsx", em: t(1) },
  { tipo: "atividade", nome: "Bash", detalhe: "Rodando: python3 scripts/ltv.py", em: t(5) },
]
const ENCERRADO: EventoConversa[] = [
  ...AO_VIVO,
  { tipo: "texto_agente", texto: "Pronto, calculei o LTV.", em: t(9) },
  { tipo: "turno_fim", status: "ok", detalhe: null, em: t(10) },
]

let raiz: HTMLDivElement
let r: Root
const tela = (dados: RespostaEstado, eventos: EventoConversa[]) =>
  createElement(ProvedorConta, { email: null, children: createElement(ChatEtapa, { slug: "x", etapa: "01", dados, eventos, delta: "" }) })

afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
})

async function montar(dados: RespostaEstado, eventos: EventoConversa[]) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } root = null; rootMargin = ""; thresholds = [] } as unknown as typeof IntersectionObserver
  Element.prototype.scrollTo = () => {}
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
  await act(async () => r.render(tela(dados, eventos)))
}

const cabecalhos = () => [...raiz.querySelectorAll<HTMLElement>("button[aria-expanded]")].filter((b) => b.querySelector("svg.lucide-sparkles") || /Pensou|Processo|Lendo|Fazendo|Folheando|Passando|Rodando|Relendo/.test(b.textContent ?? ""))

describe("histórico de ações ao longo do turno", () => {
  it("o analista abre o histórico ao vivo e ele continua aberto quando o turno termina", async () => {
    await montar(dadosDe("01"), AO_VIVO)
    expect(cabecalhos()).toHaveLength(1)
    expect(cabecalhos()[0]!.getAttribute("aria-expanded")).toBe("false")
    await act(async () => cabecalhos()[0]!.click())
    expect(cabecalhos()[0]!.getAttribute("aria-expanded")).toBe("true")

    await act(async () => r.render(tela(dadosDe(null), ENCERRADO)))
    const depois = cabecalhos()
    expect(depois).toHaveLength(1)
    expect(depois[0]!.textContent).toContain("Pensou por")
    expect(depois[0]!.getAttribute("aria-expanded")).toBe("true")
  })

  it("histórico que ficou fechado ao vivo continua fechado quando o turno termina", async () => {
    await montar(dadosDe("01"), AO_VIVO)
    await act(async () => r.render(tela(dadosDe(null), ENCERRADO)))
    expect(cabecalhos()[0]!.getAttribute("aria-expanded")).toBe("false")
  })
})
