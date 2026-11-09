// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import type { ProjetoComMetricas, RespostaPainel } from "@/lib/api"

const replace = vi.fn()
const push = vi.fn()
let busca = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(busca),
}))

const painelMetricas = vi.fn<(p: URLSearchParams) => Promise<RespostaPainel>>()
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: { painelMetricas: (p: URLSearchParams) => painelMetricas(p) },
}))

const { PainelProjetos, filtrarPorNome, ordenarPorAtividade, ROTULO_BASE_PEQUENA, MarcaEstimado, formatarDataHora } = await import("./painel-projetos")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const projeto = (nome: string, ultimaAtividade: string | null): ProjetoComMetricas =>
  ({ slug: nome.toLowerCase(), nome, metricas: { ultimaAtividade } }) as ProjetoComMetricas

describe("ordenarPorAtividade", () => {
  it("mais recente primeiro, sem atividade no fim", () => {
    const lista = [projeto("Zeta", null), projeto("Antiga", "2026-11-01T10:00:00Z"), projeto("Alfa", null), projeto("Recente", "2026-11-06T10:00:00Z")]
    expect(ordenarPorAtividade(lista).map((p) => p.nome)).toEqual(["Recente", "Antiga", "Alfa", "Zeta"])
  })

  it("não altera a lista original", () => {
    const lista = [projeto("A", "2026-11-01T10:00:00Z"), projeto("B", "2026-11-02T10:00:00Z")]
    ordenarPorAtividade(lista)
    expect(lista.map((p) => p.nome)).toEqual(["A", "B"])
  })
})

describe("filtrarPorNome", () => {
  it("busca sem distinguir maiúsculas e ignora espaços nas pontas", () => {
    const lista = [projeto("Verdeluz", null), projeto("Casa Azul", null)]
    expect(filtrarPorNome(lista, "  VERDE ").map((p) => p.nome)).toEqual(["Verdeluz"])
    expect(filtrarPorNome(lista, "")).toHaveLength(2)
  })
})

describe("ROTULO_BASE_PEQUENA", () => {
  it("diz quantos projetos faltam para a média valer", () => {
    expect(ROTULO_BASE_PEQUENA).toBe("base pequena, menos de 5 projetos")
  })
})

describe("exports que o detalhe do projeto usa", () => {
  it("MarcaEstimado e formatarDataHora continuam saindo daqui", () => {
    expect(typeof MarcaEstimado).toBe("function")
    expect(formatarDataHora(null)).toBe("Sem atividade")
  })
})

const ETAPAS = [
  { id: "01", rotulo: "Preparação" },
  { id: "03", rotulo: "Diagnóstico" },
] as never

function painel(parcial: Partial<PainelMetricas> = {}): PainelMetricas {
  return {
    periodo: { de: "2026-10-10", ate: "2026-11-08", granularidade: "dia" },
    totais: { custoUsd: 12, estimado: false, tempoUtilSeg: 3600, custoAnteriorUsd: 10, tempoUtilAnteriorSeg: 1800 },
    concluidos: { media: null, mediana: null, n: 0 },
    contagem: { ativos: 1, concluidos: 0, comPendencia: 0 },
    serie: [],
    porEtapa: [],
    porProjeto: [
      { slug: "verdeluz", nome: "Verdeluz", dono: "ana@boomer.com.br", usd: 12, porFase: {}, tempoUtilSeg: 3600, ultimaAtividade: "2026-11-05T12:00:00Z", etapaAtual: "03", ativo: true, concluidoEm: null, pendencias: 0, teste: false },
    ],
    tempoPorPessoa: [],
    tempoIgnoraModelo: false,
    ...parcial,
  }
}

function resposta(p: PainelMetricas = painel()): RespostaPainel {
  return { painel: p, opcoes: { donos: ["ana@boomer.com.br"], projetos: [{ slug: "verdeluz", nome: "Verdeluz" }], modelos: ["outros"] }, avatares: {} }
}

const zerado = () =>
  painel({
    totais: { custoUsd: 0, estimado: false, tempoUtilSeg: 0, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 },
    porProjeto: [],
    contagem: { ativos: 0, concluidos: 0, comPendencia: 0 },
  })

async function montar() {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(createElement(PainelProjetos, { etapas: ETAPAS })))
  const botao = (texto: string) => [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)
  return { raiz, botao, desmontar: () => act(async () => r.unmount()) }
}

beforeEach(() => {
  busca = ""
  painelMetricas.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ""
  replace.mockClear()
  push.mockClear()
})

describe("PainelProjetos", () => {
  it("mostra o esqueleto enquanto carrega", async () => {
    painelMetricas.mockReturnValue(new Promise(() => {}))
    const m = await montar()
    expect(m.raiz.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(m.raiz.querySelector('[aria-label="Filtros do painel"]')).toBeNull()
    await m.desmontar()
  })

  it("monta filtros, números e lista, nessa ordem, sem a tabela antiga de médias por etapa", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    const ordem = ["Filtros do painel", "Números do período", "Projetos"].map((r) => m.raiz.querySelector(`[aria-label="${r}"]`))
    expect(ordem.every((e) => e !== null)).toBe(true)
    expect(ordem[0]!.compareDocumentPosition(ordem[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ordem[1]!.compareDocumentPosition(ordem[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(m.raiz.textContent).toContain("US$ 12,00")
    expect(m.raiz.textContent).toContain("Verdeluz")
    expect(m.raiz.textContent).not.toContain("Médias por etapa")
    await m.desmontar()
  })

  it("sem parâmetros pede o período padrão de 30 dias; a URL traz o filtro dela", async () => {
    painelMetricas.mockResolvedValue(resposta())
    busca = "periodo=90d&modelos=outros&testes=1"
    const m = await montar()
    const p = painelMetricas.mock.calls[0]![0]
    expect(p.get("periodo")).toBe("90d")
    expect(p.get("modelos")).toBe("outros")
    expect(p.get("testes")).toBe("1")
    expect(p.has("atualizar")).toBe(false)
    await m.desmontar()
  })

  it("trocar o período grava na URL com router.replace e scroll: false", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    await act(async () => m.botao("7 dias")!.click())
    expect(replace).toHaveBeenCalledTimes(1)
    const [url, opcoes] = replace.mock.calls[0]!
    expect(String(url)).toContain("periodo=7d")
    expect(opcoes).toEqual({ scroll: false })
    await m.desmontar()
  })

  it("tudo zero mostra o estado vazio do período", async () => {
    painelMetricas.mockResolvedValue(resposta(zerado()))
    const m = await montar()
    expect(m.raiz.textContent).toContain("Ainda não há uso registrado neste período")
    expect(m.raiz.querySelector('[aria-label="Filtros do painel"]')).not.toBeNull()
    expect(m.raiz.querySelector('[aria-label="Números do período"]')).toBeNull()
    await m.desmontar()
  })

  it("erro da API vira um Alert com a mensagem", async () => {
    painelMetricas.mockRejectedValue(new Error("Sem permissão"))
    const m = await montar()
    const alerta = m.raiz.querySelector('[data-slot="alert"]')
    expect(alerta?.textContent).toContain("Sem permissão")
    await m.desmontar()
  })

  it("durante a recarga o conteúdo esmaecido fica com aria-busy true, e volta a false ao terminar", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    const embrulho = () => m.raiz.querySelector("[aria-busy]")!
    expect(embrulho().getAttribute("aria-busy")).toBe("false")
    let liberar!: (r: RespostaPainel) => void
    painelMetricas.mockReturnValue(new Promise((ok) => (liberar = ok)))
    await act(async () => m.botao("Atualizar")!.click())
    expect(embrulho().getAttribute("aria-busy")).toBe("true")
    await act(async () => liberar(resposta()))
    expect(embrulho().getAttribute("aria-busy")).toBe("false")
    await m.desmontar()
  })

  it("Atualizar pede de novo com atualizar=1; o primeiro pedido não leva o parâmetro", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    expect(painelMetricas.mock.calls[0]![0].has("atualizar")).toBe(false)
    await act(async () => m.botao("Atualizar")!.click())
    expect(painelMetricas).toHaveBeenCalledTimes(2)
    expect(painelMetricas.mock.calls[1]![0].get("atualizar")).toBe("1")
    await m.desmontar()
  })
})
