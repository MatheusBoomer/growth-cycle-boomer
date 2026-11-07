import { describe, expect, it } from "vitest"
import type { MediaEtapa, MetricasEtapa } from "@workspace/core/metricas/resumo"
import { comparacoesDaEtapa } from "./detalhe-projeto"

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
