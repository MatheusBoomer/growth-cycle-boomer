// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { NumerosGrandes, textoVariacao } from "./numeros-grandes"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function painel(parcial: Partial<PainelMetricas> = {}): PainelMetricas {
  return {
    periodo: { de: "2026-10-10", ate: "2026-11-08", granularidade: "dia" },
    totais: { custoUsd: 120, estimado: false, tempoUtilSeg: 7200, custoAnteriorUsd: 100, tempoUtilAnteriorSeg: 9000 },
    concluidos: { media: 40, mediana: 35, n: 3 },
    contagem: { ativos: 8, concluidos: 3, comPendencia: 2 },
    serie: [],
    porEtapa: [],
    porProjeto: [],
    tempoPorPessoa: [],
    tempoIgnoraModelo: false,
    ...parcial,
  }
}

async function montar(p: PainelMetricas) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(createElement(NumerosGrandes, { painel: p })))
  return { texto: () => raiz.textContent ?? "", desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("textoVariacao", () => {
  it("compara com o período anterior em percentual inteiro, com sinal", () => {
    expect(textoVariacao(120, 100)).toBe("+20% vs. período anterior")
    expect(textoVariacao(80, 100)).toBe("-20% vs. período anterior")
    expect(textoVariacao(100, 100)).toBe("0% vs. período anterior")
  })

  it("sem valor anterior positivo não calcula: texto fixo, nunca NaN nem Infinity", () => {
    expect(textoVariacao(50, 0)).toBe("sem período anterior")
    expect(textoVariacao(0, 0)).toBe("sem período anterior")
    expect(textoVariacao(5, Number.NaN)).toBe("sem período anterior")
  })
})

describe("NumerosGrandes", () => {
  it("mostra custo, tempo útil e variação de cada um", async () => {
    const m = await montar(painel())
    expect(m.texto()).toContain("US$ 120,00")
    expect(m.texto()).toContain("+20% vs. período anterior")
    expect(m.texto()).toContain("2h00")
    expect(m.texto()).toContain("-20% vs. período anterior")
    await m.desmontar()
  })

  it("período anterior zerado vira 'sem período anterior' e a tela não tem NaN nem Infinity", async () => {
    const m = await montar(painel({ totais: { custoUsd: 30, estimado: false, tempoUtilSeg: 600, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 } }))
    expect(m.texto().match(/sem período anterior/g)).toHaveLength(2)
    expect(m.texto()).not.toMatch(/NaN|Infinity/)
    await m.desmontar()
  })

  it("custo médio por concluído mostra mediana e N; sem concluídos no período, traço e nota", async () => {
    const com = await montar(painel())
    expect(com.texto()).toContain("US$ 40,00")
    expect(com.texto()).toContain("mediana US$ 35,00")
    expect(com.texto()).toContain("3 concluídos")
    await com.desmontar()
    const sem = await montar(painel({ concluidos: { media: null, mediana: null, n: 0 } }))
    expect(sem.texto()).toContain("Nenhum concluído no período")
    expect(sem.texto()).not.toMatch(/NaN|Infinity|null/)
    await sem.desmontar()
  })

  it("custo estimado leva a marca 'estimado'", async () => {
    const sem = await montar(painel())
    expect(sem.texto()).not.toContain("estimado")
    await sem.desmontar()
    const com = await montar(painel({ totais: { custoUsd: 120, estimado: true, tempoUtilSeg: 0, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 } }))
    expect(com.texto()).toContain("estimado")
    await com.desmontar()
  })

  it("com filtro de modelo, avisa que o tempo não filtra por modelo", async () => {
    const sem = await montar(painel())
    expect(sem.texto()).not.toContain("tempo não filtra por modelo")
    await sem.desmontar()
    const com = await montar(painel({ tempoIgnoraModelo: true }))
    expect(com.texto()).toContain("tempo não filtra por modelo")
    await com.desmontar()
  })

  it("conta projetos ativos, concluídos e com pendências", async () => {
    const m = await montar(painel())
    expect(m.texto()).toContain("8 ativos")
    expect(m.texto()).toContain("3 concluídos")
    expect(m.texto()).toContain("2 com pendências")
    await m.desmontar()
    const um = await montar(painel({ contagem: { ativos: 1, concluidos: 1, comPendencia: 1 } }))
    expect(um.texto()).toContain("1 com pendência")
    expect(um.texto()).not.toContain("1 com pendências")
    await um.desmontar()
  })
})

describe("NumerosGrandes: visual", () => {
  it("valor em serifada e variação numa pílula com o tom (custo subindo é aviso)", async () => {
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(NumerosGrandes, { painel: painel() })))
    const pilulas = [...raiz.querySelectorAll("[data-tom]")].map((e) => e.getAttribute("data-tom"))
    expect(pilulas.slice(0, 2)).toEqual(["ruim", "bom"])
    expect(raiz.querySelector("p.font-serif")).not.toBeNull()
    await act(async () => r.unmount())
    document.body.innerHTML = ""
  })
})
