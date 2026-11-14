// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import type { RespostaPainel } from "@/lib/api"

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

// A 7b troca o stub pelos gráficos; aqui só se captura o que o painel entrega a eles.
let propsGraficos: import("./painel/graficos-painel").PropsGraficosPainel | null = null
let etapasDoContexto: readonly unknown[] | null = null
vi.mock("./painel/graficos-painel", async () => {
  const { useEtapasPainel } = await import("./painel/comuns")
  return {
    GraficosPainel: (props: import("./painel/graficos-painel").PropsGraficosPainel) => {
      propsGraficos = props
      etapasDoContexto = useEtapasPainel()
      return null
    },
  }
})

const { PainelProjetos, MarcaEstimado, formatarDataHora } = await import("./painel-projetos")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
      { slug: "verdeluz", nome: "Verdeluz", dono: "ana@boomer.com.br", usd: 12, porFase: {}, tempoUtilSeg: 3600, ultimaAtividade: "2026-11-05T12:00:00Z", etapaAtual: "03", ativo: true, concluidoEm: null, pendencias: 0, teste: false, estimado: false },
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
  const desenhar = () => act(async () => r.render(createElement(PainelProjetos, { etapas: ETAPAS })))
  await desenhar()
  const botao = (texto: string) => [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)
  /** Redesenha com a `busca` atual, como o Next faz depois de um `router.replace`. */
  return { raiz, botao, redesenhar: desenhar, desmontar: () => act(async () => r.unmount()) }
}

beforeEach(() => {
  busca = ""
  propsGraficos = null
  etapasDoContexto = null
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

  it("monta filtros, números, lista e as médias por etapa (fechadas), nessa ordem", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    const ordem = ["Filtros do painel", "Números do período", "Projetos", "Médias por etapa"].map((r) => m.raiz.querySelector(`section[aria-label="${r}"]`))
    expect(ordem.every((e) => e !== null)).toBe(true)
    for (let i = 1; i < ordem.length; i++) expect(ordem[i - 1]!.compareDocumentPosition(ordem[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(m.raiz.textContent).toContain("US$ 12,00")
    expect(m.raiz.textContent).toContain("Verdeluz")
    expect(m.botao("Médias por etapa")?.getAttribute("aria-expanded")).toBe("false")
    await m.desmontar()
  })

  it("os gráficos recebem as etapas do catálogo pelo EtapasPainelContext, sem mudar as props", async () => {
    painelMetricas.mockResolvedValue(resposta())
    const m = await montar()
    expect(etapasDoContexto).toBe(ETAPAS)
    expect(Object.keys(propsGraficos!).sort()).toEqual(["aoFiltrar", "avatares", "filtro", "painel"])
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
    expect(m.raiz.textContent).toContain("Nenhum uso neste período")
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

  it("primeira carga com erro mostra o Alert com 'Tentar de novo', e o botão pede com atualizar=1", async () => {
    painelMetricas.mockRejectedValueOnce(new Error("Falha de rede"))
    const m = await montar()
    expect(m.raiz.querySelector('[data-slot="alert"]')?.textContent).toContain("Falha de rede")
    expect(m.raiz.querySelector('[aria-label="Filtros do painel"]')).toBeNull()
    painelMetricas.mockResolvedValue(resposta())
    await act(async () => m.botao("Tentar de novo")!.click())
    expect(painelMetricas.mock.calls[1]![0].get("atualizar")).toBe("1")
    expect(m.raiz.querySelector('[data-slot="alert"]')).toBeNull()
    expect(m.raiz.querySelector('[aria-label="Filtros do painel"]')).not.toBeNull()
    await m.desmontar()
  })

  it("erro depois de uma carga boa mantém filtros e conteúdo, com o Alert em linha e o botão de tentar de novo", async () => {
    busca = "periodo=90d&modelos=outros"
    painelMetricas.mockResolvedValueOnce(resposta())
    const m = await montar()
    painelMetricas.mockRejectedValueOnce(new Error("Erro 503"))
    await act(async () => m.botao("Atualizar")!.click())
    expect(m.raiz.querySelector('[data-slot="alert"]')?.textContent).toContain("Erro 503")
    expect(m.botao("Tentar de novo")).toBeTruthy()
    expect(m.botao("Atualizar")).toBeTruthy()
    expect(m.botao("Limpar")).toBeTruthy()
    expect(m.raiz.querySelector('[aria-label="Filtros do painel"]')).not.toBeNull()
    expect(m.raiz.textContent).toContain("US$ 12,00")
    expect(m.raiz.textContent).toContain("Verdeluz")
    await m.desmontar()
  })

  it("depois de uma recarga com erro o conteúdo antigo fica esmaecido, com aria-busy, e o Exportar CSV desabilitado", async () => {
    painelMetricas.mockResolvedValueOnce(resposta())
    const m = await montar()
    const conteudo = () => m.raiz.querySelector("[aria-busy]")!
    expect(m.botao("Exportar CSV")?.disabled).toBe(false)
    painelMetricas.mockRejectedValueOnce(new Error("Erro 503"))
    await act(async () => m.botao("Atualizar")!.click())
    expect(conteudo().getAttribute("aria-busy")).toBe("true")
    expect(conteudo().className).toContain("opacity-60")
    expect(conteudo().textContent).toContain("Verdeluz")
    expect(m.botao("Exportar CSV")?.disabled).toBe(true)
    // Ao dar certo, tudo volta ao normal.
    painelMetricas.mockResolvedValueOnce(resposta())
    await act(async () => m.botao("Tentar de novo")!.click())
    expect(conteudo().getAttribute("aria-busy")).toBe("false")
    expect(conteudo().className).not.toContain("opacity-60")
    expect(m.botao("Exportar CSV")?.disabled).toBe(false)
    await m.desmontar()
  })

  it("'Tentar de novo' pede com atualizar=1 e, ao dar certo, o Alert some", async () => {
    painelMetricas.mockResolvedValueOnce(resposta())
    const m = await montar()
    painelMetricas.mockRejectedValueOnce(new Error("Erro 503"))
    await act(async () => m.botao("Atualizar")!.click())
    painelMetricas.mockResolvedValueOnce(resposta())
    await act(async () => m.botao("Tentar de novo")!.click())
    expect(painelMetricas).toHaveBeenCalledTimes(3)
    expect(painelMetricas.mock.calls[2]![0].get("atualizar")).toBe("1")
    expect(m.raiz.querySelector('[data-slot="alert"]')).toBeNull()
    expect(m.botao("Tentar de novo")).toBeUndefined()
    await m.desmontar()
  })

  it("mudar o filtro com o Alert na tela limpa o erro assim que o novo pedido começa", async () => {
    painelMetricas.mockResolvedValueOnce(resposta())
    const m = await montar()
    painelMetricas.mockRejectedValueOnce(new Error("Erro 503"))
    await act(async () => m.botao("Atualizar")!.click())
    expect(m.raiz.querySelector('[data-slot="alert"]')).not.toBeNull()
    painelMetricas.mockReturnValueOnce(new Promise(() => {}))
    busca = "periodo=7d"
    await m.redesenhar()
    expect(painelMetricas).toHaveBeenCalledTimes(3)
    expect(painelMetricas.mock.calls[2]![0].get("periodo")).toBe("7d")
    expect(m.raiz.querySelector('[data-slot="alert"]')).toBeNull()
    await m.desmontar()
  })

  it("aoFiltrar alterna etapa e projeto na URL e preserva período, analista e os outros filtros", async () => {
    painelMetricas.mockResolvedValue(resposta())
    busca = "periodo=90d&donos=ana@boomer.com.br"
    const m = await montar()
    const aplicar = async (f: { etapa?: string; projeto?: string }) => {
      await act(async () => propsGraficos!.aoFiltrar(f))
      const [url, opcoes] = replace.mock.calls.at(-1)!
      expect(opcoes).toEqual({ scroll: false })
      busca = String(url).split("?")[1]!
      await m.redesenhar()
      return new URLSearchParams(busca)
    }

    const comEtapa = await aplicar({ etapa: "03" })
    expect(comEtapa.get("etapas")).toBe("03")
    expect(comEtapa.get("periodo")).toBe("90d")
    expect(comEtapa.get("donos")).toBe("ana@boomer.com.br")

    const comProjeto = await aplicar({ projeto: "slug-x" })
    expect(comProjeto.get("projetos")).toBe("slug-x")
    expect(comProjeto.get("etapas")).toBe("03")
    expect(comProjeto.get("periodo")).toBe("90d")
    expect(comProjeto.get("donos")).toBe("ana@boomer.com.br")

    const semEtapa = await aplicar({ etapa: "03" })
    expect(semEtapa.has("etapas")).toBe(false)
    expect(semEtapa.get("projetos")).toBe("slug-x")
    expect(semEtapa.get("donos")).toBe("ana@boomer.com.br")
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
