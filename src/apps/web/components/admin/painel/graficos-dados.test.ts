import { describe, expect, it } from "vitest"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { fixturePainel } from "./fixture-painel"
import {
  alturaBarras,
  fatiasDaRosca,
  formatarDiaMes,
  modelosDaSerie,
  percentuaisMaiorResto,
  pessoasDoGrafico,
  rotuloEtapa,
  topProjetos,
} from "./graficos-dados"

describe("formatarDiaMes", () => {
  it("mostra dd/MM no fuso de Brasília", () => {
    expect(formatarDiaMes("2026-08-10T03:00:00.000Z")).toBe("10/08")
  })

  it("meia-noite UTC ainda é o dia anterior em Brasília", () => {
    expect(formatarDiaMes("2026-11-09T00:00:00.000Z")).toBe("08/11")
  })

  it("data inválida não vira 'Invalid Date'", () => {
    expect(formatarDiaMes("nada")).toBe("")
  })
})

describe("percentuaisMaiorResto", () => {
  it("soma exatamente 100 pelo método do maior resto", () => {
    const p = percentuaisMaiorResto([1, 1, 1])
    expect(p.reduce((a, b) => a + b, 0)).toBe(100)
    expect(p).toEqual([34, 33, 33])
  })

  it("distribui o resto para quem tem a maior parte decimal", () => {
    expect(percentuaisMaiorResto([10.4, 20.5, 69.1])).toEqual([10, 21, 69])
  })

  it("total zero dá zeros, sem NaN", () => {
    expect(percentuaisMaiorResto([0, 0])).toEqual([0, 0])
    expect(percentuaisMaiorResto([])).toEqual([])
  })
})

describe("modelosDaSerie", () => {
  const ponto = (inicio: string, porModelo: Record<string, number>) => ({
    inicio,
    total: Object.values(porModelo).reduce((a, b) => a + b, 0),
    porModelo,
  })

  it("esconde modelos cujo total no período é zero (ruído de arredondamento)", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { a: 2, b: 0, c: 0.0001 }), ponto("2026-11-02T03:00:00.000Z", { a: 1, b: 0 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["a"])
  })

  it("ordena por total e rotula 'outros' como 'Sem modelo registrado'", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { a: 1, outros: 3 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["Sem modelo registrado", "a"])
  })

  it("mais de 5 modelos: os 4 maiores ficam e o resto vira 'Outros modelos'", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["a", "b", "c", "d", "Outros modelos"])
    const linha = r.linhas[0]!
    expect(linha[r.series[4]!.chave]).toBe(3)
    expect(r.series.every((s, i) => s.cor === `var(--chart-${i + 1})`)).toBe(true)
  })

  it("linhas trazem rótulo dd/MM e total; série vazia não lança", () => {
    const r = modelosDaSerie([ponto("2026-11-02T03:00:00.000Z", { a: 1.5 })])
    expect(r.linhas[0]).toMatchObject({ rotulo: "02/11", total: 1.5 })
    expect(modelosDaSerie([])).toEqual({ series: [], linhas: [], total: 0 })
  })
})

describe("fatiasDaRosca", () => {
  const porEtapa: PainelMetricas["porEtapa"] = [
    { etapa: "01", fase: "Contexto", usd: 40 },
    { etapa: "03", fase: "Diagnóstico", usd: 50 },
    { etapa: "05", fase: "Soluções e metas", usd: 2 },
    { etapa: "07", fase: "Mídia e ação", usd: 2 },
    { etapa: "final", fase: "Apresentação", usd: 5 },
    { etapa: "briefing-benchmark", fase: "Arquivada", usd: 1 },
  ]

  it("por fase: agrupa as fases abaixo de 3% em 'Outras' e mantém a arquivada com fatia própria", () => {
    const f = fatiasDaRosca(porEtapa, "fase")
    expect(f.map((x) => x.rotulo)).toEqual(["Contexto", "Diagnóstico", "Apresentação", "Briefing e benchmark (arquivada)", "Outras"])
    expect(f.find((x) => x.rotulo === "Outras")!.etapas).toEqual(["05", "07"])
  })

  it("percentuais somam 100", () => {
    for (const visao of ["fase", "etapa"] as const) {
      expect(fatiasDaRosca(porEtapa, visao).reduce((a, x) => a + x.pct, 0)).toBe(100)
    }
  })

  it("por etapa: cada etapa é uma fatia, com id da etapa", () => {
    const f = fatiasDaRosca([{ etapa: "01", fase: "Contexto", usd: 1 }, { etapa: "03", fase: "Diagnóstico", usd: 3 }], "etapa")
    expect(f.map((x) => x.etapas)).toEqual([["01"], ["03"]])
    expect(f.map((x) => x.rotulo)).toEqual([rotuloEtapa("01", "Contexto"), rotuloEtapa("03", "Diagnóstico")])
  })

  it("uma fase pequena sozinha não vira 'Outras'", () => {
    const f = fatiasDaRosca([{ etapa: "01", fase: "Contexto", usd: 99 }, { etapa: "03", fase: "Diagnóstico", usd: 1 }], "fase")
    expect(f.map((x) => x.rotulo)).toEqual(["Contexto", "Diagnóstico"])
  })

  it("zeros e lista vazia não têm fatias", () => {
    expect(fatiasDaRosca([], "fase")).toEqual([])
    expect(fatiasDaRosca([{ etapa: "01", fase: "Contexto", usd: 0 }], "etapa")).toEqual([])
  })
})

describe("rotuloEtapa", () => {
  it("número e fase; final e arquivada com nome próprio", () => {
    expect(rotuloEtapa("03", "Diagnóstico")).toBe("03 · Diagnóstico")
    expect(rotuloEtapa("final", "Apresentação")).toBe("Final · Apresentação")
    expect(rotuloEtapa("briefing-benchmark", "Arquivada")).toBe("Briefing e benchmark (arquivada)")
  })
})

describe("topProjetos", () => {
  it("só projetos com custo, os 8 maiores, e conta quantos ficaram de fora", () => {
    const r = topProjetos(fixturePainel("cheio").porProjeto)
    expect(r.linhas).toHaveLength(8)
    expect(r.linhas[0]!.slug).toBe("verdeluz")
    expect(r.aMais).toBe(3)
    expect(r.linhas.every((p) => p.usd > 0)).toBe(true)
  })

  it("lista vazia", () => {
    expect(topProjetos([])).toEqual({ linhas: [], aMais: 0 })
  })
})

describe("alturaBarras", () => {
  it("36 px por linha mais 40 px de eixo", () => {
    expect(alturaBarras(1)).toBe(76)
    expect(alturaBarras(8)).toBe(328)
  })
})

describe("pessoasDoGrafico", () => {
  it("tira quem não tem tempo e ordena pelo total", () => {
    const r = pessoasDoGrafico([
      { email: "a@x.com", agenteSeg: 10, ativoSeg: 0, ociosoSeg: 0 },
      { email: "b@x.com", agenteSeg: 0, ativoSeg: 0, ociosoSeg: 0 },
      { email: "c@x.com", agenteSeg: 10, ativoSeg: 10, ociosoSeg: 0 },
    ])
    expect(r.map((p) => p.email)).toEqual(["c@x.com", "a@x.com"])
  })
})
