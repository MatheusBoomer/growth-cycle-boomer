// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { act, createElement, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import { BarrasPessoas } from "./barras-pessoas"
import { BarrasProjetos } from "./barras-projetos"
import { EtapasPainelContext, TEXTO_SEM_USO } from "./comuns"
import { fixturePainel } from "./fixture-painel"
import { GraficoCustoTempo } from "./grafico-custo-tempo"
import { GraficosPainel } from "./graficos-painel"
import { RoscaEtapas } from "./rosca-etapas"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  // jsdom não mede layout nem tem ResizeObserver; o Recharts só precisa que ele exista.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  document.body.innerHTML = ""
})

async function montar(el: ReactElement) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(el))
  return {
    raiz,
    redesenhar: (novo: ReactElement) => act(async () => r.render(novo)),
    texto: () => raiz.textContent ?? "",
    botao: (nome: string | RegExp) =>
      [...raiz.querySelectorAll("button")].find((b) => (typeof nome === "string" ? b.textContent?.includes(nome) || b.getAttribute("aria-label") === nome : nome.test(b.textContent ?? ""))),
    clicar: async (b: Element | undefined) => {
      if (!b) throw new Error("botão não achado")
      await act(async () => (b as HTMLElement).click())
    },
    desmontar: () => act(async () => r.unmount()),
  }
}

const FILTRO: FiltroPainel = { de: "2026-08-11", ate: "2026-11-08", donos: [], projetos: [], etapas: [], modelos: [], incluirTestes: false }

describe("RoscaEtapas", () => {
  const dados = fixturePainel("cheio").porEtapa

  it("legenda em HTML lista as fases com US$ e percentuais que somam 100", async () => {
    const m = await montar(createElement(RoscaEtapas, { dados, etapasSelecionadas: [], aoFiltrarEtapa: () => {} }))
    for (const fase of ["Contexto", "Diagnóstico", "Soluções e metas", "Mídia e ação", "Apresentação", "Briefing e benchmark (arquivada)"]) {
      expect(m.texto()).toContain(fase)
    }
    const pcts = [...m.raiz.querySelectorAll("[data-pct]")].map((e) => Number(e.getAttribute("data-pct")))
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100)
    expect(m.raiz.querySelector('[data-slot="total-rosca"]')?.textContent).toContain("US$")
    await m.desmontar()
  })

  it("'Por fase' (padrão) só destaca: clicar na legenda não filtra", async () => {
    const aoFiltrarEtapa = vi.fn()
    const m = await montar(createElement(RoscaEtapas, { dados, etapasSelecionadas: [], aoFiltrarEtapa }))
    const linha = m.botao("Diagnóstico")
    await m.clicar(linha)
    expect(aoFiltrarEtapa).not.toHaveBeenCalled()
    expect(linha?.getAttribute("aria-pressed")).toBe("true")
    await m.desmontar()
  })

  it("'Por etapa': clicar na linha da legenda filtra pela etapa", async () => {
    const aoFiltrarEtapa = vi.fn()
    const m = await montar(createElement(RoscaEtapas, { dados, etapasSelecionadas: [], aoFiltrarEtapa }))
    await m.clicar(m.botao("Por etapa"))
    await m.clicar(m.botao("03 · Diagnóstico"))
    expect(aoFiltrarEtapa).toHaveBeenCalledWith("03")
    await m.desmontar()
  })

  it("etapa filtrada aparece destacada e abre na visão por etapa", async () => {
    const m = await montar(createElement(RoscaEtapas, { dados, etapasSelecionadas: ["03"], aoFiltrarEtapa: () => {} }))
    expect(m.botao("03 · Diagnóstico")?.getAttribute("aria-pressed")).toBe("true")
    expect(m.botao("04 · Diagnóstico")?.getAttribute("aria-pressed")).toBe("false")
    await m.desmontar()
  })

  it("com o catálogo no contexto, 'Por etapa' mostra o título do catálogo; a arquivada mantém o rótulo próprio", async () => {
    const catalogo = [
      { id: "01", rotulo: "01 · Preparação de contexto", fase: "Contexto" },
      { id: "03", rotulo: "03 · Diagnóstico de performance", fase: "Diagnóstico" },
    ] as never
    const aoFiltrarEtapa = vi.fn()
    const m = await montar(createElement(EtapasPainelContext.Provider, { value: catalogo }, createElement(RoscaEtapas, { dados, etapasSelecionadas: [], aoFiltrarEtapa })))
    await m.clicar(m.botao("Por etapa"))
    expect(m.texto()).toContain("03 · Diagnóstico de performance")
    expect(m.texto()).toContain("01 · Preparação de contexto")
    expect(m.texto()).toContain("Briefing e benchmark (arquivada)")
    // Etapa sem título no catálogo dado cai no rótulo curto.
    expect(m.texto()).toContain("04 · Diagnóstico")
    await m.clicar(m.botao("03 · Diagnóstico de performance"))
    expect(aoFiltrarEtapa).toHaveBeenCalledWith("03")
    await m.desmontar()
  })

  it("quando passa a haver etapa filtrada, a rosca troca sozinha para 'Por etapa'", async () => {
    const props = { dados, aoFiltrarEtapa: () => {} }
    const m = await montar(createElement(RoscaEtapas, { ...props, etapasSelecionadas: [] }))
    const visao = () => [...m.raiz.querySelectorAll('[aria-label="Agrupar a rosca"] button')].find((b) => b.getAttribute("aria-pressed") === "true")?.textContent
    expect(visao()).toBe("Por fase")
    await m.redesenhar(createElement(RoscaEtapas, { ...props, etapasSelecionadas: ["03"] }))
    expect(visao()).toBe("Por etapa")
    expect(m.botao("03 · Diagnóstico")?.getAttribute("aria-pressed")).toBe("true")
    // Sem filtro de novo, a escolha da pessoa fica como está.
    await m.redesenhar(createElement(RoscaEtapas, { ...props, etapasSelecionadas: [] }))
    expect(visao()).toBe("Por etapa")
    await m.desmontar()
  })

  it("sem custo mostra o texto de vazio", async () => {
    const m = await montar(createElement(RoscaEtapas, { dados: [], etapasSelecionadas: [], aoFiltrarEtapa: () => {} }))
    expect(m.texto()).toContain(TEXTO_SEM_USO)
    await m.desmontar()
  })
})

describe("BarrasProjetos", () => {
  const projetos = fixturePainel("cheio").porProjeto

  it("clicar no nome filtra pelo projeto e conta os que ficaram na lista", async () => {
    const aoFiltrarProjeto = vi.fn()
    const m = await montar(createElement(BarrasProjetos, { projetos, projetosSelecionados: [], aoFiltrarProjeto }))
    await m.clicar(m.botao("Casa Norte Móveis"))
    expect(aoFiltrarProjeto).toHaveBeenCalledWith("casa-norte")
    expect(m.texto()).toContain("3 projetos a mais na lista abaixo")
    expect(m.texto()).not.toContain("Mercado Bom Preço")
    await m.desmontar()
  })

  it("nome longo trunca com title; projeto filtrado fica destacado", async () => {
    const m = await montar(createElement(BarrasProjetos, { projetos, projetosSelecionados: ["verdeluz"], aoFiltrarProjeto: () => {} }))
    const longo = m.botao("Distribuidora Paulista")
    expect(longo?.getAttribute("title")).toContain("Distribuidora Paulista")
    expect(longo?.querySelector(".truncate")).not.toBeNull()
    expect(m.botao("Verdeluz Cosméticos")?.getAttribute("aria-pressed")).toBe("true")
    expect(m.botao("Pet Amigo")?.getAttribute("aria-pressed")).toBe("false")
    await m.desmontar()
  })

  it("projeto com custo estimado diz 'estimado' no nome acessível do botão e no resumo do gráfico", async () => {
    const lista = projetos.map((p) => (p.slug === "pet-amigo" ? { ...p, estimado: true } : p))
    const m = await montar(createElement(BarrasProjetos, { projetos: lista, projetosSelecionados: [], aoFiltrarProjeto: () => {} }))
    expect(m.botao("Pet Amigo")?.getAttribute("aria-label")).toBe("Pet Amigo, US$ 11,90, estimado")
    expect(m.botao("Aurora Joias")?.getAttribute("aria-label")).not.toContain("estimado")
    expect(m.raiz.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("Pet Amigo US$ 11,90 (estimado)")
    await m.desmontar()
  })

  it("altura calculada pelas linhas, sem aspect", async () => {
    const m = await montar(createElement(BarrasProjetos, { projetos, projetosSelecionados: [], aoFiltrarProjeto: () => {} }))
    const grafico = m.raiz.querySelector<HTMLElement>('[data-slot="chart"]')
    expect(grafico?.style.height).toBe("328px")
    await m.desmontar()
  })

  it("sem custo mostra o texto de vazio", async () => {
    const m = await montar(createElement(BarrasProjetos, { projetos: [], projetosSelecionados: [], aoFiltrarProjeto: () => {} }))
    expect(m.texto()).toContain(TEXTO_SEM_USO)
    await m.desmontar()
  })
})

describe("BarrasPessoas", () => {
  const tempo = fixturePainel("cheio").tempoPorPessoa

  it("clicar na pessoa só destaca e mostra o detalhe", async () => {
    const m = await montar(createElement(BarrasPessoas, { tempo, avatares: {}, tempoIgnoraModelo: false }))
    const b = m.botao("Bruno Lima")
    await m.clicar(b)
    expect(b?.getAttribute("aria-pressed")).toBe("true")
    expect(m.raiz.querySelector('[data-slot="detalhe-pessoa"]')?.textContent).toContain("Bruno Lima")
    expect(m.texto()).toContain("Agente")
    expect(m.texto()).toContain("Analista ativo")
    expect(m.texto()).toContain("Ocioso")
    await m.desmontar()
  })

  it("notas: autor ausente sempre; 'Tempo não filtra por modelo' só com o aviso ligado", async () => {
    const sem = await montar(createElement(BarrasPessoas, { tempo, avatares: {}, tempoIgnoraModelo: false }))
    expect(sem.texto()).toContain("Custos antigos sem autor ficam fora deste gráfico.")
    expect(sem.texto()).not.toContain("Tempo não filtra por modelo")
    await sem.desmontar()
    const com = await montar(createElement(BarrasPessoas, { tempo, avatares: {}, tempoIgnoraModelo: true }))
    expect(com.texto()).toContain("Tempo não filtra por modelo")
    await com.desmontar()
  })

  it("sem tempo mostra o texto de vazio", async () => {
    const m = await montar(createElement(BarrasPessoas, { tempo: [{ email: "a@b.com", agenteSeg: 0, ativoSeg: 0, ociosoSeg: 0 }], avatares: {}, tempoIgnoraModelo: false }))
    expect(m.texto()).toContain(TEXTO_SEM_USO)
    await m.desmontar()
  })
})

describe("GraficoCustoTempo", () => {
  it("legenda em HTML com os modelos e resumo acessível com o total", async () => {
    const m = await montar(createElement(GraficoCustoTempo, { serie: fixturePainel("cheio").serie }))
    expect(m.texto()).toContain("claude-opus-4-5")
    expect(m.texto()).toContain("Sem modelo registrado")
    expect(m.raiz.querySelector('[role="img"]')?.getAttribute("aria-label")).toMatch(/^Custo por modelo ao longo do tempo, total US\$ /)
    await m.desmontar()
  })

  it("série zerada ou vazia mostra o texto de vazio", async () => {
    for (const serie of [[], [{ inicio: "2026-11-01T03:00:00.000Z", total: 0, porModelo: {} }]]) {
      const m = await montar(createElement(GraficoCustoTempo, { serie }))
      expect(m.texto()).toContain(TEXTO_SEM_USO)
      await m.desmontar()
    }
  })

  it("um ponto só não quebra", async () => {
    const m = await montar(createElement(GraficoCustoTempo, { serie: [{ inicio: "2026-11-01T03:00:00.000Z", total: 2, porModelo: { a: 2 } }] }))
    expect(m.texto()).not.toContain(TEXTO_SEM_USO)
    expect(m.texto()).toContain("a")
    await m.desmontar()
  })
})

describe("GraficosPainel", () => {
  it("monta com as três variantes da fixture", async () => {
    for (const v of ["cheio", "poucos", "vazio"] as const) {
      const m = await montar(createElement(GraficosPainel, { painel: fixturePainel(v), avatares: {}, filtro: FILTRO, aoFiltrar: () => {} }))
      if (v === "vazio") expect(m.texto().match(new RegExp(TEXTO_SEM_USO, "g"))?.length).toBe(4)
      else expect(m.texto()).toContain("Custo ao longo do tempo")
      await m.desmontar()
    }
  })

  it("propaga aoFiltrar com a etapa e com o projeto", async () => {
    const aoFiltrar = vi.fn()
    const m = await montar(createElement(GraficosPainel, { painel: fixturePainel("cheio"), avatares: {}, filtro: FILTRO, aoFiltrar }))
    await m.clicar(m.botao("Por etapa"))
    await m.clicar(m.botao("05 · Soluções e metas"))
    expect(aoFiltrar).toHaveBeenCalledWith({ etapa: "05" })
    await m.clicar(m.botao("Pet Amigo"))
    expect(aoFiltrar).toHaveBeenCalledWith({ projeto: "pet-amigo" })
    await m.desmontar()
  })
})

describe("guarda estática dos gráficos", () => {
  const pasta = import.meta.dirname
  const fontes = readdirSync(pasta)
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => ({ nome: n, texto: readFileSync(path.join(pasta, n), "utf8") }))

  it("sem preserveAspectRatio='none' nem cor hexadecimal", () => {
    for (const f of fontes) {
      expect(f.texto, f.nome).not.toMatch(/preserveAspectRatio="none"/)
      expect(f.texto, f.nome).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    }
  })

  it("todo ChartContainer tem altura ou proporção explícita no className", () => {
    let total = 0
    for (const f of fontes) {
      for (const m of f.texto.matchAll(/<ChartContainer\b[^>]*?className="([^"]*)"/g)) {
        total++
        expect(m[1], f.nome).toMatch(/h-\[|aspect-|size-/)
      }
    }
    expect(total).toBeGreaterThanOrEqual(4)
  })
})
