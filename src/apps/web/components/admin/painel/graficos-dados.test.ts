import { describe, expect, it } from "vitest"
import { FASE_ARQUIVADA as FASE_ARQUIVADA_CORE } from "@workspace/core/catalogo"
import { ID_ETAPA_ARQUIVADA } from "@workspace/core/migracao-etapas"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { fixturePainel } from "./fixture-painel"
import {
  alturaBarras,
  corDaFase,
  ETAPA_ARQUIVADA,
  FASE_ARQUIVADA,
  fasesOrdenadas,
  fatiasDaRosca,
  ORDEM_FASES,
  ordemDasFases,
  formatarDiaMes,
  modelosDaSerie,
  percentuaisMaiorResto,
  pessoasDoGrafico,
  rotuloEtapa,
  ticksDeTempo,
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

  it("'outros' vira 'Sem modelo registrado', fica sempre por último e com a cor apagada, mesmo sendo o maior", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { a: 1, outros: 3 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["a", "Sem modelo registrado"])
    expect(r.series[1]!.cor).toBe("var(--muted-foreground)")
  })

  it("cor pela identidade: Opus, Sonnet e Haiku têm cor fixa, não importa o total nem quem mais aparece", () => {
    const cores = (porModelo: Record<string, number>) =>
      Object.fromEntries(modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", porModelo)]).series.map((s) => [s.rotulo, s.cor]))
    const cheio = cores({ "claude-opus-4-5": 1, "claude-sonnet-4-5": 9, "claude-haiku-4-5": 5, outros: 2 })
    const poucos = cores({ "claude-sonnet-4-5": 1, "claude-opus-4-5": 3 })
    const so = cores({ "claude-haiku-4-5": 1 })
    expect(cheio["claude-opus-4-5"]).toBe("var(--chart-1)")
    expect(cheio["claude-sonnet-4-5"]).toBe("var(--chart-2)")
    expect(cheio["claude-haiku-4-5"]).toBe("var(--chart-3)")
    expect(poucos["claude-opus-4-5"]).toBe(cheio["claude-opus-4-5"])
    expect(poucos["claude-sonnet-4-5"]).toBe(cheio["claude-sonnet-4-5"])
    expect(so["claude-haiku-4-5"]).toBe(cheio["claude-haiku-4-5"])
    // Apelido curto ("opus") é a mesma família.
    expect(cores({ opus: 1, sonnet: 2 })).toEqual({ opus: "var(--chart-1)", sonnet: "var(--chart-2)" })
  })

  it("ordem estável: famílias conhecidas primeiro (opus, sonnet, haiku), depois os outros pelo total, 'outros' no fim", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { x: 1, outros: 9, "claude-haiku-4-5": 2, y: 5, "claude-opus-4-5": 1 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["claude-opus-4-5", "claude-haiku-4-5", "y", "x", "Sem modelo registrado"])
    expect(r.series.map((s) => s.cor)).toEqual(["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"])
  })

  it("segunda versão da mesma família não repete a cor: vai para as cores livres", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { "claude-opus-4-5": 3, "claude-opus-4-6": 5 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["claude-opus-4-6", "claude-opus-4-5"])
    expect(new Set(r.series.map((s) => s.cor)).size).toBe(2)
    expect(r.series[0]!.cor).toBe("var(--chart-1)")
  })

  it("muitos modelos sem família: os 4 maiores ficam e o resto vira 'Outros modelos', cada um com uma cor", () => {
    const r = modelosDaSerie([ponto("2026-11-01T03:00:00.000Z", { a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 })])
    expect(r.series.map((s) => s.rotulo)).toEqual(["a", "b", "c", "d", "Outros modelos"])
    const linha = r.linhas[0]!
    expect(linha[r.series[4]!.chave]).toBe(3)
    expect(new Set(r.series.map((s) => s.cor)).size).toBe(5)
    expect(r.series.every((s) => /^var\(--chart-[1-5]\)$/.test(s.cor))).toBe(true)
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

describe("fases pelo catálogo", () => {
  const CATALOGO = [
    { id: "01", rotulo: "01 · Preparação de contexto", fase: "Contexto" },
    { id: "02", rotulo: "02 · Contextualização estratégica", fase: "Contexto" },
    { id: "03", rotulo: "03 · Diagnóstico de performance", fase: "Diagnóstico" },
    { id: "05", rotulo: "05 · Soluções", fase: "Soluções e metas" },
    { id: "final", rotulo: "Apresentação final", fase: "Apresentação" },
  ] as never

  it("FASE_ARQUIVADA e ETAPA_ARQUIVADA são as mesmas constantes do core", () => {
    expect(FASE_ARQUIVADA).toBe(FASE_ARQUIVADA_CORE)
    expect(ETAPA_ARQUIVADA).toBe(ID_ETAPA_ARQUIVADA)
  })

  it("ordemDasFases segue a primeira aparição de cada fase no catálogo, com a arquivada no fim; sem catálogo, a ordem fixa", () => {
    expect(ordemDasFases(CATALOGO)).toEqual(["Contexto", "Diagnóstico", "Soluções e metas", "Apresentação", FASE_ARQUIVADA])
    expect(ordemDasFases([{ id: "01", rotulo: "x", fase: "Nova" }, { id: "02", rotulo: "y", fase: "Contexto" }] as never)).toEqual(["Nova", "Contexto", FASE_ARQUIVADA])
    expect(ordemDasFases([])).toEqual(ORDEM_FASES)
    expect(ordemDasFases([{ id: "01", rotulo: "x" }] as never)).toEqual(ORDEM_FASES)
  })

  it("cor e ordem acompanham a ordem dada; a arquivada mantém a cor própria e fase fora da ordem fica apagada", () => {
    const ordem = ["Nova", "Contexto", FASE_ARQUIVADA]
    expect(corDaFase("Nova", ordem)).toBe("var(--chart-1)")
    expect(corDaFase("Contexto", ordem)).toBe("var(--chart-2)")
    expect(corDaFase(FASE_ARQUIVADA, ordem)).toBe("var(--selo-opus)")
    expect(corDaFase("Diagnóstico", ordem)).toBe("var(--muted-foreground)")
    expect(corDaFase("Diagnóstico")).toBe("var(--chart-2)")
    expect(fasesOrdenadas(["Contexto", FASE_ARQUIVADA, "Zeta", "Nova"], ordem)).toEqual(["Nova", "Contexto", FASE_ARQUIVADA, "Zeta"])
  })

  it("por etapa, a fatia usa o título do catálogo; etapa fora do catálogo cai no rótulo curto", () => {
    const porEtapa: PainelMetricas["porEtapa"] = [
      { etapa: "03", fase: "Diagnóstico", usd: 5 },
      { etapa: "01", fase: "Contexto", usd: 4 },
      { etapa: "final", fase: "Apresentação", usd: 3 },
      { etapa: "briefing-benchmark", fase: FASE_ARQUIVADA, usd: 2 },
    ]
    const f = fatiasDaRosca(porEtapa, "etapa", CATALOGO)
    expect(f.map((x) => x.rotulo)).toEqual(["01 · Preparação de contexto", "03 · Diagnóstico de performance", "Apresentação final", "Briefing e benchmark (arquivada)"])
    expect(fatiasDaRosca(porEtapa, "etapa").map((x) => x.rotulo)[0]).toBe("01 · Contexto")
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

describe("ticksDeTempo", () => {
  it("marcas em horas redondas, no máximo 4 intervalos, cobrindo o máximo", () => {
    expect(ticksDeTempo(22.5 * 3600)).toEqual([0, 6, 12, 18, 24].map((h) => h * 3600))
    expect(ticksDeTempo(3 * 3600)).toEqual([0, 1, 2, 3].map((h) => h * 3600))
  })

  it("abaixo de uma hora usa minutos redondos; zero não quebra", () => {
    expect(ticksDeTempo(40 * 60)).toEqual([0, 10, 20, 30, 40].map((m) => m * 60))
    expect(ticksDeTempo(50 * 60)).toEqual([0, 15, 30, 45, 60].map((m) => m * 60))
    expect(ticksDeTempo(0)).toEqual([0])
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
