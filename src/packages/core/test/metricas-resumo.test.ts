import { describe, expect, it } from "vitest"
import { compararComMedia, mediasPorEtapa, resumirProjeto } from "../src/metricas/resumo"
import type { MetricasEtapa, MetricasProjeto } from "../src/metricas/resumo"
import type { LinhaPresenca, LinhaUso } from "../src/metricas/tipos"
import type { EtapaId } from "../src/tipos"

const LIMITES = { ociosoMin: 5, descarteMin: 15 }
const T0 = Date.parse("2026-11-07T10:00:00Z")

function uso(parcial: Partial<LinhaUso>): LinhaUso {
  return {
    slug: "verdeluz",
    etapa: "03",
    autor: "ana@agencia.com",
    sessao: "s1",
    custoUsd: 1,
    custoTurnoUsd: 1,
    modelos: { opus: 1 },
    inicio: new Date(T0).toISOString(),
    fim: new Date(T0 + 60_000).toISOString(),
    ...parcial,
  }
}

function aviso(parcial: Partial<LinhaPresenca>): LinhaPresenca {
  return {
    slug: "verdeluz",
    email: "ana@agencia.com",
    etapa: "03",
    em: new Date(T0 + 5_000).toISOString(),
    visivel: true,
    segundosSemInteracao: 0,
    ...parcial,
  }
}

const TEMPO_ZERO = { agente: 0, ativo: 0, ocioso: 0, descartado: 0 }

describe("resumirProjeto", () => {
  it("sem uso nem presença devolve tudo zerado", () => {
    expect(resumirProjeto([], [], LIMITES)).toEqual({
      custoUsd: 0,
      estimado: false,
      tempo: TEMPO_ZERO,
      porEtapa: {},
      porPessoa: [],
      ultimaAtividade: null,
    })
  })

  it("os totais batem com a soma das etapas e das pessoas", () => {
    const usos = [
      uso({ etapa: "03", autor: "ana@agencia.com", custoTurnoUsd: 2, custoUsd: 2, modelos: { opus: 2 } }),
      uso({
        etapa: "04",
        autor: "Bia@agencia.com",
        sessao: "s2",
        custoTurnoUsd: 3,
        custoUsd: 3,
        modelos: { opus: 3 },
        inicio: new Date(T0 + 600_000).toISOString(),
        fim: new Date(T0 + 660_000).toISOString(),
      }),
    ]
    const presencas = [
      aviso({ etapa: "03", email: "ana@agencia.com", em: new Date(T0 + 300_000 + 5_000).toISOString() }),
      aviso({ etapa: "04", email: "bia@agencia.com", em: new Date(T0 + 900_000 + 5_000).toISOString() }),
      aviso({ etapa: "04", email: "bia@agencia.com", em: new Date(T0 + 930_000 + 5_000).toISOString() }),
    ]
    const r = resumirProjeto(usos, presencas, LIMITES)

    expect(r.custoUsd).toBe(5)
    expect(r.estimado).toBe(false)
    expect(r.porEtapa["03"]?.custo.usd).toBe(2)
    expect(r.porEtapa["04"]?.custo.usd).toBe(3)
    expect(r.porEtapa["03"]?.temPresenca).toBe(true)
    expect(r.porEtapa["04"]?.temPresenca).toBe(true)

    const somaEtapas = Object.values(r.porEtapa).reduce((s, e) => s + (e as MetricasEtapa).tempo.ativo, 0)
    expect(somaEtapas).toBe(r.tempo.ativo)
    expect(r.tempo).toEqual({ agente: 120, ativo: 90, ocioso: 0, descartado: 0 })

    // ordem por tempo útil decrescente: bia (60 agente + 60 ativo) antes de ana (60 agente + 30 ativo)
    expect(r.porPessoa.map((p) => p.email)).toEqual(["bia@agencia.com", "ana@agencia.com"])
    expect(r.porPessoa.reduce((s, p) => s + p.custoUsd, 0)).toBe(5)
    expect(r.porPessoa.reduce((s, p) => s + p.tempo.ativo, 0)).toBe(r.tempo.ativo)
    expect(r.porPessoa.reduce((s, p) => s + p.tempo.agente, 0)).toBe(r.tempo.agente)
    expect(r.ultimaAtividade).toBe(new Date(T0 + 930_000 + 5_000).toISOString())
  })

  it("etapa só com turnos do agente não tem presença", () => {
    const r = resumirProjeto([uso({})], [], LIMITES)
    expect(r.porEtapa["03"]?.temPresenca).toBe(false)
    expect(r.porEtapa["03"]?.tempo.agente).toBe(60)
  })

  it("inclui quem só tem custo ou só tem tempo", () => {
    const r = resumirProjeto(
      [uso({ autor: "ana@agencia.com" })],
      [aviso({ email: "bia@agencia.com", em: new Date(T0 + 3_600_000).toISOString() })],
      LIMITES,
    )
    const bia = r.porPessoa.find((p) => p.email === "bia@agencia.com")
    expect(bia?.custoUsd).toBe(0)
    expect(bia?.tempo.ativo).toBe(30)
    expect(r.porPessoa.find((p) => p.email === "ana@agencia.com")?.custoUsd).toBe(1)
  })

  it("marca estimado quando há linha antiga", () => {
    const r = resumirProjeto([uso({ sessao: null, custoTurnoUsd: null, modelos: null, custoUsd: 4 })], [], LIMITES)
    expect(r.estimado).toBe(true)
    expect(r.custoUsd).toBe(4)
  })
})

function projeto(
  custos: Partial<Record<EtapaId, number>>,
  opcoes: { concluidas?: EtapaId[]; teste?: boolean; semPresenca?: boolean; ativo?: number } = {},
) {
  const porEtapa: MetricasProjeto["porEtapa"] = {}
  for (const [etapa, usd] of Object.entries(custos) as Array<[EtapaId, number]>) {
    porEtapa[etapa] = {
      custo: { usd, estimado: false, turnos: 1, modelos: {} },
      tempo: { agente: 60, ativo: opcoes.ativo ?? 0, ocioso: 0, descartado: 0 },
      temPresenca: !opcoes.semPresenca,
    }
  }
  const metricas: MetricasProjeto = {
    custoUsd: 0,
    estimado: false,
    tempo: TEMPO_ZERO,
    porEtapa,
    porPessoa: [],
    ultimaAtividade: null,
  }
  return { metricas, concluidas: opcoes.concluidas ?? (Object.keys(custos) as EtapaId[]), teste: opcoes.teste ?? false }
}

describe("mediasPorEtapa", () => {
  it("calcula média, mediana, mínimo e máximo de 5 projetos", () => {
    const r = mediasPorEtapa([1, 2, 3, 4, 10].map((v) => projeto({ "03": v })))
    expect(r["03"]?.custo).toEqual({ media: 4, mediana: 3, min: 1, max: 10, n: 5 })
    expect(r["03"]?.basePequena).toBe(false)
  })

  it("mediana de quantidade par é a média dos centrais e base pequena abaixo de 5", () => {
    const r = mediasPorEtapa([1, 2, 3, 4].map((v) => projeto({ "03": v })))
    expect(r["03"]?.custo?.mediana).toBe(2.5)
    expect(r["03"]?.basePequena).toBe(true)
  })

  it("deixa de fora projeto de teste e etapa não concluída", () => {
    const r = mediasPorEtapa([
      projeto({ "03": 1 }),
      projeto({ "03": 100 }, { teste: true }),
      projeto({ "03": 200 }, { concluidas: [] }),
      projeto({ "03": 300 }, { concluidas: ["04"] }),
    ])
    expect(r["03"]?.custo).toEqual({ media: 1, mediana: 1, min: 1, max: 1, n: 1 })
  })

  it("etapa sem presença entra no custo e fica fora do tempo", () => {
    const r = mediasPorEtapa([
      projeto({ "03": 2 }, { semPresenca: true, ativo: 600 }),
      projeto({ "03": 4 }, { ativo: 600 }),
    ])
    expect(r["03"]?.custo?.n).toBe(2)
    expect(r["03"]?.tempoUtil).toEqual({ media: 660, mediana: 660, min: 660, max: 660, n: 1 })
  })

  it("etapa sem custo não entra no custo", () => {
    const r = mediasPorEtapa([projeto({ "03": 0 }), projeto({ "03": 3 })])
    expect(r["03"]?.custo?.n).toBe(1)
  })

  it("sem nenhum projeto elegível não devolve a etapa", () => {
    expect(mediasPorEtapa([projeto({ "03": 1 }, { teste: true })])).toEqual({})
  })
})

describe("compararComMedia", () => {
  it("devolve a razão com uma casa e vírgula", () => {
    expect(compararComMedia(7.59, 3.16)).toBe("2,4× a média")
  })
  it("devolve dentro da média entre 0,8 e 1,25", () => {
    expect(compararComMedia(1.0, 1.1)).toBe("dentro da média")
    expect(compararComMedia(0.8, 1)).toBe("dentro da média")
    expect(compararComMedia(1.25, 1)).toBe("dentro da média")
  })
  it("abaixo da faixa também mostra a razão", () => {
    expect(compararComMedia(0.5, 1)).toBe("0,5× a média")
  })
  it("sem média útil devolve nulo", () => {
    expect(compararComMedia(1, 0)).toBeNull()
    expect(compararComMedia(1, null)).toBeNull()
    expect(compararComMedia(1, undefined)).toBeNull()
  })
})
