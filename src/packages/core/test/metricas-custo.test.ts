import { describe, expect, it } from "vitest"
import { custoDoTurno, custoPorEtapa, custoPorPessoa } from "../src/metricas/custo"
import type { LinhaUso } from "../src/metricas/tipos"

function linha(parcial: Partial<LinhaUso>): LinhaUso {
  return {
    slug: "verdeluz",
    etapa: "03",
    autor: null,
    sessao: null,
    custoUsd: null,
    custoTurnoUsd: null,
    modelos: null,
    inicio: "2026-11-07T10:00:00Z",
    fim: "2026-11-07T10:05:00Z",
    ...parcial,
  }
}

describe("custoDoTurno", () => {
  it("primeiro turno da conversa vale o próprio acumulado", () => {
    const r = custoDoTurno({ custoUsd: 0.3, modelos: null }, null)
    expect(r.custoTurnoUsd).toBeCloseTo(0.3, 4)
    expect(r.modelos).toBeNull()
  })

  it("turno seguinte vale a diferença para o acumulado anterior", () => {
    const r = custoDoTurno({ custoUsd: 0.5, modelos: null }, { custoUsd: 0.3, modelos: null })
    expect(r.custoTurnoUsd).toBeCloseTo(0.2, 4)
  })

  it("acumulado que caiu significa conversa reiniciada: vale o valor atual", () => {
    const r = custoDoTurno({ custoUsd: 0.1, modelos: null }, { custoUsd: 0.5, modelos: null })
    expect(r.custoTurnoUsd).toBeCloseTo(0.1, 4)
  })

  it("aplica a regra a cada modelo; modelo sem valor anterior entra com o próprio valor", () => {
    const r = custoDoTurno(
      { custoUsd: 0.5, modelos: { sonnet: 0.45, haiku: 0.05 } },
      { custoUsd: 0.3, modelos: { sonnet: 0.3 } },
    )
    expect(r.modelos?.sonnet).toBeCloseTo(0.15, 4)
    expect(r.modelos?.haiku).toBeCloseTo(0.05, 4)
  })

  it("modelo cujo acumulado caiu vale o valor atual", () => {
    const r = custoDoTurno(
      { custoUsd: 0.2, modelos: { sonnet: 0.2 } },
      { custoUsd: 0.6, modelos: { sonnet: 0.6 } },
    )
    expect(r.modelos?.sonnet).toBeCloseTo(0.2, 4)
  })

  it("custoUsd nulo deixa o custo do turno nulo", () => {
    const r = custoDoTurno({ custoUsd: null, modelos: null }, { custoUsd: 0.3, modelos: null })
    expect(r.custoTurnoUsd).toBeNull()
  })

  it("anterior sem custo trata o atual como primeiro turno", () => {
    const r = custoDoTurno({ custoUsd: 0.4, modelos: null }, { custoUsd: null, modelos: null })
    expect(r.custoTurnoUsd).toBeCloseTo(0.4, 4)
  })

  it("arredonda para 4 casas", () => {
    const r = custoDoTurno({ custoUsd: 0.3, modelos: null }, { custoUsd: 0.1, modelos: null })
    expect(r.custoTurnoUsd).toBe(0.2)
  })
})

describe("custoPorEtapa", () => {
  it("etapa só com linhas antigas usa o maior acumulado e fica estimada", () => {
    const usos = [0.2, 0.6, 1.1].map((c) => linha({ custoUsd: c }))
    const r = custoPorEtapa(usos).get("03")
    expect(r?.usd).toBeCloseTo(1.1, 4)
    expect(r?.estimado).toBe(true)
    expect(r?.turnos).toBe(3)
  })

  it("etapa mista soma o máximo das antigas com os turnos novos", () => {
    const usos = [
      linha({ custoUsd: 0.4 }),
      linha({ custoUsd: 1.0 }),
      linha({ sessao: "s1", custoUsd: 0.2, custoTurnoUsd: 0.2 }),
      linha({ sessao: "s1", custoUsd: 0.5, custoTurnoUsd: 0.3 }),
    ]
    const r = custoPorEtapa(usos).get("03")
    expect(r?.usd).toBeCloseTo(1.5, 4)
    expect(r?.estimado).toBe(true)
    expect(r?.turnos).toBe(4)
  })

  it("etapa só com linhas novas não é estimada e soma os modelos", () => {
    const usos = [
      linha({ sessao: "s1", custoTurnoUsd: 0.2, modelos: { sonnet: 0.2 } }),
      linha({ sessao: "s1", custoTurnoUsd: 0.3, modelos: { sonnet: 0.1, haiku: 0.2 } }),
    ]
    const r = custoPorEtapa(usos).get("03")
    expect(r?.usd).toBeCloseTo(0.5, 4)
    expect(r?.estimado).toBe(false)
    expect(r?.modelos.sonnet).toBeCloseTo(0.3, 4)
    expect(r?.modelos.haiku).toBeCloseTo(0.2, 4)
  })

  it("turno com sessão e custoTurnoUsd nulo conta zero", () => {
    const usos = [
      linha({ sessao: "s1", custoTurnoUsd: null }),
      linha({ sessao: "s1", custoTurnoUsd: 0.25 }),
    ]
    const r = custoPorEtapa(usos).get("03")
    expect(r?.usd).toBeCloseTo(0.25, 4)
    expect(r?.estimado).toBe(false)
    expect(r?.turnos).toBe(2)
  })

  it("turno novo sem sessão mas com custo do turno não é linha antiga", () => {
    const usos = [
      linha({ custoUsd: 2 }),
      linha({ sessao: null, custoUsd: 0.5, custoTurnoUsd: 0.5 }),
    ]
    const r = custoPorEtapa(usos).get("03")
    expect(r?.usd).toBeCloseTo(2.5, 4)
    expect(r?.estimado).toBe(true)
    const soNovo = custoPorEtapa([linha({ sessao: null, custoUsd: 0.5, custoTurnoUsd: 0.5 })]).get("03")
    expect(soNovo?.usd).toBeCloseTo(0.5, 4)
    expect(soNovo?.estimado).toBe(false)
  })

  it("separa as etapas", () => {
    const usos = [
      linha({ etapa: "01", sessao: "a", custoTurnoUsd: 0.1 }),
      linha({ etapa: "02", sessao: "b", custoTurnoUsd: 0.2 }),
    ]
    const r = custoPorEtapa(usos)
    expect(r.get("01")?.usd).toBeCloseTo(0.1, 4)
    expect(r.get("02")?.usd).toBeCloseTo(0.2, 4)
  })
})

describe("custoPorPessoa", () => {
  it("soma por autor normalizado", () => {
    const usos = [
      linha({ autor: "Ana@X", sessao: "s1", custoTurnoUsd: 0.2 }),
      linha({ autor: "ana@x", sessao: "s2", custoTurnoUsd: 0.3 }),
    ]
    const r = custoPorPessoa(usos)
    expect(r.size).toBe(1)
    expect(r.get("ana@x")).toBeCloseTo(0.5, 4)
  })

  it("turno novo sem sessão conta para o autor", () => {
    const usos = [
      linha({ autor: "ana@x", sessao: null, custoUsd: 0.4, custoTurnoUsd: 0.4 }),
      linha({ autor: "ana@x", custoUsd: 3 }),
    ]
    expect(custoPorPessoa(usos).get("ana@x")).toBeCloseTo(0.4, 4)
  })

  it("linha antiga sem sessão e autor nulo não entram", () => {
    const usos = [
      linha({ autor: "ana@x", custoUsd: 2 }),
      linha({ autor: null, sessao: "s1", custoTurnoUsd: 0.4 }),
    ]
    expect(custoPorPessoa(usos).size).toBe(0)
  })
})
