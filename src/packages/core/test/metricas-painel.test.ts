import { describe, expect, it } from "vitest"
import { custoDoTurno } from "../src/metricas/custo"
import { agregarPainel, normalizarParcelas } from "../src/metricas/painel"
import type { EntradaProjeto, FiltroPainel, PainelMetricas } from "../src/metricas/painel"
import type { LinhaPresenca, LinhaUso } from "../src/metricas/tipos"

const LIMITES = { ociosoMin: 5, descarteMin: 15 }
const TOLERANCIA = 1e-6

const FASES: Record<string, string> = {
  "01": "Contexto",
  "02": "Contexto",
  "03": "Diagnóstico",
  "04": "Diagnóstico",
  "05": "Soluções e metas",
}
const faseDaEtapa = (etapa: string) => FASES[etapa] ?? "Arquivada"

function projeto(parcial: Partial<EntradaProjeto>): EntradaProjeto {
  return {
    slug: "verdeluz",
    nome: "Verde Luz",
    dono: "ana@x.com",
    teste: false,
    ativo: true,
    etapaAtual: "03",
    concluidoEm: null,
    pendencias: 0,
    ...parcial,
  }
}

function uso(parcial: Partial<Omit<LinhaUso, "etapa">> & { etapa?: string }): LinhaUso {
  return {
    slug: "verdeluz",
    autor: "ana@x.com",
    sessao: "s1",
    custoUsd: 1,
    custoTurnoUsd: 1,
    modelos: { opus: 1 },
    inicio: "2026-11-05T12:00:00Z",
    fim: "2026-11-05T12:00:20Z",
    ...parcial,
    etapa: (parcial.etapa ?? "03") as LinhaUso["etapa"],
  }
}

function aviso(parcial: Partial<LinhaPresenca>): LinhaPresenca {
  return {
    slug: "verdeluz",
    email: "ana@x.com",
    etapa: "03",
    em: "2026-11-05T12:00:05Z",
    visivel: true,
    segundosSemInteracao: 0,
    ...parcial,
  }
}

function filtro(parcial: Partial<FiltroPainel> = {}): FiltroPainel {
  return {
    de: "2026-11-03",
    ate: "2026-11-09",
    donos: [],
    projetos: [],
    etapas: [],
    modelos: [],
    incluirTestes: false,
    ...parcial,
  }
}

function agregar(
  dados: { projetos?: EntradaProjeto[]; usos?: LinhaUso[]; presencas?: LinhaPresenca[] },
  f: FiltroPainel = filtro(),
): PainelMetricas {
  return agregarPainel(
    {
      projetos: dados.projetos ?? [projeto({})],
      usos: dados.usos ?? [],
      presencas: dados.presencas ?? [],
      faseDaEtapa,
      limites: LIMITES,
    },
    f,
  )
}

function soma(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0)
}

/** Soma da série = soma de porEtapa = soma de porProjeto = totais.custoUsd. */
function conferirSomas(p: PainelMetricas): void {
  const total = p.totais.custoUsd
  expect(Math.abs(soma(p.serie.map((s) => s.total)) - total)).toBeLessThan(TOLERANCIA)
  expect(Math.abs(soma(p.porEtapa.map((e) => e.usd)) - total)).toBeLessThan(TOLERANCIA)
  expect(Math.abs(soma(p.porProjeto.map((e) => e.usd)) - total)).toBeLessThan(TOLERANCIA)
  for (const ponto of p.serie) {
    expect(Math.abs(soma(Object.values(ponto.porModelo)) - ponto.total)).toBeLessThan(TOLERANCIA)
    for (const v of Object.values(ponto.porModelo)) expect(v).toBeGreaterThan(0)
  }
  for (const pr of p.porProjeto) {
    expect(Math.abs(soma(Object.values(pr.porFase)) - pr.usd)).toBeLessThan(TOLERANCIA)
  }
}

/** Nenhum número do painel é NaN ou infinito. */
function semNumeroInvalido(valor: unknown): void {
  if (typeof valor === "number") expect(Number.isFinite(valor)).toBe(true)
  else if (valor && typeof valor === "object") for (const v of Object.values(valor)) semNumeroInvalido(v)
}

/** Dados com dois projetos, linhas novas e antigas na mesma etapa, vários modelos e turnos fora do período. */
function dadosMistos() {
  return {
    projetos: [
      projeto({ slug: "a", nome: "A", dono: "ana@x.com" }),
      projeto({ slug: "b", nome: "B", dono: "bia@x.com" }),
    ],
    usos: [
      // a/03: duas antigas (viram uma entrada no maior fim, 06/11) e duas novas.
      uso({ slug: "a", etapa: "03", sessao: null, custoTurnoUsd: null, custoUsd: 0.4, modelos: { opus: 0.4 }, fim: "2026-11-04T10:00:00Z" }),
      uso({ slug: "a", etapa: "03", sessao: null, custoTurnoUsd: null, custoUsd: 1.2, modelos: { opus: 1, haiku: 0.2 }, fim: "2026-11-06T10:00:00Z" }),
      uso({ slug: "a", etapa: "03", custoTurnoUsd: 0.3, modelos: { sonnet: 0.25, haiku: 0.05 }, fim: "2026-11-05T15:00:00Z" }),
      uso({ slug: "a", etapa: "03", custoTurnoUsd: 0.1234, modelos: { haiku: 0.1234 }, fim: "2026-11-09T20:00:00Z" }),
      // a/briefing-benchmark (arquivada)
      uso({ slug: "a", etapa: "briefing-benchmark", custoTurnoUsd: 0.5, modelos: { opus: 0.5 }, fim: "2026-11-07T10:00:00Z" }),
      // b/04 e b/01
      uso({ slug: "b", etapa: "04", autor: "bia@x.com", sessao: "s9", custoTurnoUsd: 0.75, modelos: { opus: 0.7, haiku: 0.05 }, fim: "2026-11-03T03:30:00Z" }),
      uso({ slug: "b", etapa: "01", autor: null, sessao: "s8", custoTurnoUsd: 0.2, modelos: { haiku: 0.2 }, fim: "2026-11-08T10:00:00Z" }),
      // fora do período: antes (período anterior) e depois
      uso({ slug: "b", etapa: "04", sessao: "s7", custoTurnoUsd: 2, modelos: { opus: 2 }, fim: "2026-10-30T10:00:00Z" }),
      uso({ slug: "a", etapa: "03", sessao: "s6", custoTurnoUsd: 4, modelos: { opus: 4 }, fim: "2026-11-10T12:00:00Z" }),
    ],
  }
}

describe("agregarPainel: série", () => {
  it("período de 7 dias tem 7 pontos diários, com zero nos dias sem turno", () => {
    const p = agregar({ usos: [uso({ custoTurnoUsd: 0.5, modelos: { opus: 0.5 }, fim: "2026-11-05T12:00:00Z" })] })
    expect(p.periodo).toEqual({ de: "2026-11-03", ate: "2026-11-09", granularidade: "dia" })
    expect(p.serie).toHaveLength(7)
    expect(p.serie.map((s) => s.total)).toEqual([0, 0, 0.5, 0, 0, 0, 0])
    expect(p.serie[0]?.porModelo).toEqual({})
    expect(p.serie[2]?.porModelo).toEqual({ opus: 0.5 })
  })

  it("buckets começam à meia-noite de Brasília", () => {
    const p = agregar({})
    expect(p.serie[0]?.inicio).toBe("2026-11-03T03:00:00.000Z")
    expect(p.serie[6]?.inicio).toBe("2026-11-09T03:00:00.000Z")
  })

  it("um turno às 2026-11-10T01:00:00Z cai no dia 2026-11-09 de Brasília", () => {
    const p = agregar({ usos: [uso({ custoTurnoUsd: 0.7, fim: "2026-11-10T01:00:00Z" })] })
    expect(p.serie[6]?.inicio).toBe("2026-11-09T03:00:00.000Z")
    expect(p.serie[6]?.total).toBe(0.7)
    expect(p.totais.custoUsd).toBe(0.7)
  })

  it("um turno às 2026-11-10T03:00:00Z (meia-noite local do dia 10) fica fora do período", () => {
    const p = agregar({ usos: [uso({ custoTurnoUsd: 0.7, fim: "2026-11-10T03:00:00Z" })] })
    expect(p.totais.custoUsd).toBe(0)
  })

  it("período de 60 dias agrupa por semana, com início nas segundas-feiras", () => {
    // 2026-09-11 (sexta) a 2026-11-09 (segunda): 60 dias.
    const p = agregar(
      { usos: [uso({ custoTurnoUsd: 1, fim: "2026-09-12T12:00:00Z" }), uso({ custoTurnoUsd: 2, fim: "2026-11-09T12:00:00Z" })] },
      filtro({ de: "2026-09-11", ate: "2026-11-09" }),
    )
    expect(p.periodo.granularidade).toBe("semana")
    expect(p.serie[0]?.inicio).toBe("2026-09-07T03:00:00.000Z")
    expect(p.serie.at(-1)?.inicio).toBe("2026-11-09T03:00:00.000Z")
    expect(p.serie).toHaveLength(10)
    for (const ponto of p.serie) {
      const local = new Date(Date.parse(ponto.inicio) - 3 * 3600_000)
      expect(local.getUTCDay()).toBe(1)
      expect(local.getUTCHours()).toBe(0)
    }
    expect(p.serie[0]?.total).toBe(1)
    expect(p.serie.at(-1)?.total).toBe(2)
    expect(p.totais.custoUsd).toBe(3)
  })

  it("custo sem modelo registrado entra em \"outros\" e o porModelo soma o total do bucket", () => {
    const usos = [
      uso({ sessao: null, custoTurnoUsd: null, custoUsd: 0.6, modelos: null, fim: "2026-11-05T12:00:00Z" }),
      uso({ sessao: "s2", custoTurnoUsd: 0.25, modelos: { haiku: 0.25 }, fim: "2026-11-05T14:00:00Z" }),
    ]
    const p = agregar({ usos })
    expect(p.serie[2]?.total).toBe(0.85)
    expect(p.serie[2]?.porModelo).toEqual({ haiku: 0.25, outros: 0.6 })
    conferirSomas(p)
  })

  it("modelos que não cobrem o custo do turno deixam o resto em \"outros\"; ids crus nas chaves", () => {
    const usos = [uso({ custoTurnoUsd: 1, modelos: { "claude-opus-4": 0.7 } })]
    expect(agregar({ usos }).serie[2]?.porModelo).toEqual({ "claude-opus-4": 0.7, outros: 0.3 })
  })

  it("com filtro de modelo, \"outros\" não aparece e o porModelo soma o total", () => {
    const usos = [
      uso({ sessao: null, custoTurnoUsd: null, custoUsd: 0.6, modelos: null, fim: "2026-11-05T12:00:00Z" }),
      uso({ sessao: "s2", custoTurnoUsd: 0.4, modelos: { haiku: 0.12345, opus: 0.27655 }, fim: "2026-11-05T14:00:00Z" }),
    ]
    const p = agregar({ usos }, filtro({ modelos: ["haiku"] }))
    expect(p.serie[2]?.porModelo).toEqual({ haiku: p.serie[2]?.total })
    expect(p.serie.every((s) => !("outros" in s.porModelo))).toBe(true)
    conferirSomas(p)
  })

  it("31 dias ainda é por dia", () => {
    const p = agregar({}, filtro({ de: "2026-10-10", ate: "2026-11-09" }))
    expect(p.periodo.granularidade).toBe("dia")
    expect(p.serie).toHaveLength(31)
  })
})

describe("agregarPainel: invariante das somas", () => {
  it("sem filtro: série, etapas, projetos e total batem, e só o período entra no total", () => {
    const p = agregar(dadosMistos())
    conferirSomas(p)
    // a: 1.2 (antigas) + 0.3 + 0.1234 + 0.5; b: 0.75 + 0.2.
    expect(p.totais.custoUsd).toBeCloseTo(3.0734, 6)
    expect(p.totais.estimado).toBe(true)
    expect(p.totais.custoAnteriorUsd).toBe(2)
  })

  it("com filtro de modelo: as somas continuam batendo", () => {
    const p = agregar(dadosMistos(), filtro({ modelos: ["haiku"] }))
    conferirSomas(p)
    expect(p.totais.custoUsd).toBeCloseTo(0.2 + 0.05 + 0.1234 + 0.05 + 0.2, 6)
  })

  it("com filtro de etapa e de vários modelos: as somas continuam batendo", () => {
    const p = agregar(dadosMistos(), filtro({ etapas: ["03", "04"], modelos: ["opus", "sonnet"] }))
    conferirSomas(p)
    expect(p.totais.custoUsd).toBeCloseTo(1 + 0.25 + 0.7, 6)
  })

  it("a soma por etapa do painel bate com a soma das entradas por turno no período", () => {
    const p = agregar(dadosMistos())
    const etapa03 = p.porEtapa.find((e) => e.etapa === "03")
    expect(etapa03?.usd).toBeCloseTo(1.2 + 0.3 + 0.1234, 6)
    expect(etapa03?.fase).toBe("Diagnóstico")
  })
})

describe("agregarPainel: filtros", () => {
  it("filtro de modelo soma só a parcela e liga tempoIgnoraModelo; o tempo não muda", () => {
    const usos = [uso({ custoTurnoUsd: 1, modelos: { opus: 0.8, haiku: 0.2 } })]
    const presencas = [aviso({})]
    const sem = agregar({ usos, presencas })
    const com = agregar({ usos, presencas }, filtro({ modelos: ["haiku"] }))
    expect(sem.totais.custoUsd).toBe(1)
    expect(sem.tempoIgnoraModelo).toBe(false)
    expect(com.totais.custoUsd).toBe(0.2)
    expect(com.serie[2]?.porModelo).toEqual({ haiku: 0.2 })
    expect(com.tempoIgnoraModelo).toBe(true)
    expect(com.totais.tempoUtilSeg).toBe(sem.totais.tempoUtilSeg)
    expect(com.tempoPorPessoa).toEqual(sem.tempoPorPessoa)
  })

  it("donos compara e-mail sem diferenciar caixa", () => {
    const projetos = [projeto({ slug: "a", dono: "ana@x.com" }), projeto({ slug: "b", dono: "bia@x.com" })]
    const usos = [uso({ slug: "a", custoTurnoUsd: 1 }), uso({ slug: "b", custoTurnoUsd: 2 })]
    const maiuscula = agregar({ projetos, usos }, filtro({ donos: ["Ana@X.com"] }))
    const minuscula = agregar({ projetos, usos }, filtro({ donos: ["ana@x.com"] }))
    expect(maiuscula).toEqual(minuscula)
    expect(maiuscula.totais.custoUsd).toBe(1)
    expect(maiuscula.porProjeto.map((p) => p.slug)).toEqual(["a"])
  })

  it("projetos seleciona projetos inteiros", () => {
    const projetos = [projeto({ slug: "a" }), projeto({ slug: "b" })]
    const usos = [uso({ slug: "a", custoTurnoUsd: 1 }), uso({ slug: "b", custoTurnoUsd: 2 })]
    const p = agregar({ projetos, usos }, filtro({ projetos: ["b"] }))
    expect(p.totais.custoUsd).toBe(2)
    expect(p.contagem.ativos).toBe(1)
  })

  it("incluirTestes: false tira o projeto de teste de tudo", () => {
    const projetos = [
      projeto({ slug: "a" }),
      projeto({ slug: "t", teste: true, ativo: false, pendencias: 2, concluidoEm: "2026-11-05T12:00:00Z" }),
    ]
    const usos = [uso({ slug: "a", custoTurnoUsd: 1 }), uso({ slug: "t", autor: "teo@x.com", custoTurnoUsd: 5 })]
    const presencas = [aviso({ slug: "t", email: "teo@x.com" })]
    const sem = agregar({ projetos, usos, presencas }, filtro({ incluirTestes: false }))
    expect(sem.totais.custoUsd).toBe(1)
    expect(sem.porProjeto.map((p) => p.slug)).toEqual(["a"])
    expect(sem.tempoPorPessoa.map((p) => p.email)).toEqual(["ana@x.com"])
    expect(sem.contagem).toEqual({ ativos: 1, concluidos: 0, comPendencia: 0 })
    expect(sem.concluidos.n).toBe(0)
    const com = agregar({ projetos, usos, presencas }, filtro({ incluirTestes: true }))
    expect(com.totais.custoUsd).toBe(6)
    expect(com.contagem).toEqual({ ativos: 1, concluidos: 1, comPendencia: 1 })
    expect(com.concluidos.n).toBe(1)
  })

  it("etapas: [\"briefing-benchmark\"] filtra a etapa arquivada e cai na fase Arquivada", () => {
    const usos = [
      uso({ etapa: "briefing-benchmark", custoTurnoUsd: 0.4 }),
      uso({ etapa: "03", custoTurnoUsd: 1, inicio: "2026-11-06T11:59:50Z", fim: "2026-11-06T12:00:00Z" }),
    ]
    const presencas = [aviso({ etapa: "briefing-benchmark" as LinhaPresenca["etapa"] }), aviso({ etapa: "03", em: "2026-11-06T15:00:00Z" })]
    const p = agregar({ usos, presencas }, filtro({ etapas: ["briefing-benchmark"] }))
    expect(p.totais.custoUsd).toBe(0.4)
    expect(p.porEtapa).toEqual([{ etapa: "briefing-benchmark", fase: "Arquivada", usd: 0.4 }])
    expect(p.porProjeto[0]?.porFase).toEqual({ Arquivada: 0.4 })
    // Só o bloco da etapa arquivada (o do agente e o do aviso caem no mesmo bloco de 30 s).
    expect(p.totais.tempoUtilSeg).toBe(30)
  })

  it("projeto sem dono entra normalmente; com filtro de donos ele fica de fora", () => {
    const projetos = [projeto({ slug: "orfao", nome: "Órfão", dono: null })]
    const usos = [uso({ slug: "orfao", custoTurnoUsd: 1 })]
    const p = agregar({ projetos, usos })
    expect(p.porProjeto).toEqual([
      expect.objectContaining({ slug: "orfao", nome: "Órfão", dono: null, usd: 1 }),
    ])
    expect(p.contagem.ativos).toBe(1)
    expect(agregar({ projetos, usos }, filtro({ donos: ["ana@x.com"] })).porProjeto).toEqual([])
  })

  it("usos e presenças de projetos que não estão na lista são ignorados", () => {
    const p = agregar({ usos: [uso({ slug: "fantasma", custoTurnoUsd: 3 })], presencas: [aviso({ slug: "fantasma" })] })
    expect(p.totais.custoUsd).toBe(0)
    expect(p.tempoPorPessoa).toEqual([])
  })
})

describe("agregarPainel: totais, tempo e listas", () => {
  it("entrada vazia devolve zeros e listas vazias, sem NaN", () => {
    const p = agregar({ projetos: [] })
    expect(p.totais).toEqual({ custoUsd: 0, estimado: false, tempoUtilSeg: 0, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 })
    expect(p.concluidos).toEqual({ media: null, mediana: null, n: 0 })
    expect(p.contagem).toEqual({ ativos: 0, concluidos: 0, comPendencia: 0 })
    expect(p.serie).toHaveLength(7)
    expect(p.serie.every((s) => s.total === 0)).toBe(true)
    expect(p.porEtapa).toEqual([])
    expect(p.porProjeto).toEqual([])
    expect(p.tempoPorPessoa).toEqual([])
    expect(p.tempoIgnoraModelo).toBe(false)
    semNumeroInvalido(p)
  })

  it("período anterior sem custo deixa os campos anteriores em zero (só somas, sem divisão)", () => {
    const p = agregar({ usos: [uso({ custoTurnoUsd: 1 })], presencas: [aviso({})] })
    expect(p.totais.custoAnteriorUsd).toBe(0)
    expect(p.totais.tempoUtilAnteriorSeg).toBe(0)
    semNumeroInvalido(p)
  })

  it("o período anterior tem o mesmo comprimento e só alimenta os totais anteriores", () => {
    const usos = [
      // 7 dias antes de 03/11 em Brasília: 27/10 00:00 até 02/11 23:59.
      uso({ sessao: "p1", custoTurnoUsd: 1, inicio: "2026-10-27T03:00:00Z", fim: "2026-10-27T03:00:20Z" }),
      uso({ sessao: "p2", custoTurnoUsd: 2, inicio: "2026-11-03T02:59:00Z", fim: "2026-11-03T02:59:20Z" }),
      // Antes do período anterior: não entra em nada.
      uso({ sessao: "p3", custoTurnoUsd: 8, inicio: "2026-10-27T02:59:00Z", fim: "2026-10-27T02:59:20Z" }),
    ]
    const p = agregar({ usos })
    expect(p.totais.custoUsd).toBe(0)
    expect(p.totais.custoAnteriorUsd).toBe(3)
    expect(p.totais.tempoUtilSeg).toBe(0)
    expect(p.totais.tempoUtilAnteriorSeg).toBe(60)
    expect(p.serie.every((s) => s.total === 0)).toBe(true)
    expect(p.porEtapa).toEqual([])
  })

  it("tempo útil e tempo por pessoa somam blocos do período, agrupados por e-mail de quem trabalhou", () => {
    const presencas = [
      aviso({ email: "Ana@X.com", em: "2026-11-05T12:00:05Z" }),
      aviso({ email: "ana@x.com", em: "2026-11-05T12:00:35Z" }),
      aviso({ email: "bia@x.com", em: "2026-11-05T12:00:05Z", segundosSemInteracao: 600 }),
      aviso({ email: "bia@x.com", em: "2026-11-01T12:00:05Z" }),
    ]
    const p = agregar({ presencas })
    expect(p.tempoPorPessoa).toEqual([
      { email: "ana@x.com", agenteSeg: 0, ativoSeg: 60, ociosoSeg: 0 },
      { email: "bia@x.com", agenteSeg: 0, ativoSeg: 0, ociosoSeg: 30 },
    ])
    expect(p.totais.tempoUtilSeg).toBe(60)
    expect(p.totais.tempoUtilAnteriorSeg).toBe(30)
    expect(p.porProjeto[0]?.tempoUtilSeg).toBe(60)
  })

  it("tempo do agente conta para o autor do turno", () => {
    const p = agregar({ usos: [uso({ autor: "Bia@x.com", inicio: "2026-11-05T12:00:00Z", fim: "2026-11-05T12:01:00Z" })] })
    expect(p.tempoPorPessoa).toEqual([{ email: "bia@x.com", agenteSeg: 60, ativoSeg: 0, ociosoSeg: 0 }])
  })

  it("porEtapa e porProjeto ficam em ordem decrescente de custo; porFase agrupa por fase", () => {
    const projetos = [projeto({ slug: "a", nome: "A" }), projeto({ slug: "b", nome: "B" }), projeto({ slug: "c", nome: "C" })]
    const usos = [
      uso({ slug: "a", etapa: "01", custoTurnoUsd: 0.1 }),
      uso({ slug: "a", etapa: "02", custoTurnoUsd: 0.2 }),
      uso({ slug: "b", etapa: "03", custoTurnoUsd: 1 }),
      uso({ slug: "b", etapa: "05", custoTurnoUsd: 0.5 }),
    ]
    const p = agregar({ projetos, usos })
    expect(p.porEtapa.map((e) => e.etapa)).toEqual(["03", "05", "02", "01"])
    expect(p.porProjeto.map((e) => e.slug)).toEqual(["b", "a", "c"])
    expect(p.porProjeto[1]?.porFase).toEqual({ Contexto: 0.3 })
    expect(p.porProjeto[0]?.porFase).toEqual({ Diagnóstico: 1, "Soluções e metas": 0.5 })
    expect(p.porProjeto[2]).toEqual({
      slug: "c",
      nome: "C",
      dono: "ana@x.com",
      usd: 0,
      porFase: {},
      tempoUtilSeg: 0,
      ultimaAtividade: null,
      etapaAtual: "03",
      ativo: true,
      concluidoEm: null,
      pendencias: 0,
      teste: false,
      estimado: false,
    })
  })

  it("ultimaAtividade é o turno ou aviso mais recente do projeto", () => {
    const usos = [uso({ fim: "2026-11-05T12:00:20Z" })]
    const presencas = [aviso({ em: "2026-11-11T09:00:00Z" })]
    expect(agregar({ usos, presencas }).porProjeto[0]?.ultimaAtividade).toBe("2026-11-11T09:00:00Z")
  })

  it("contagem reflete o estado de hoje e não muda com o período", () => {
    const projetos = [
      projeto({ slug: "a", ativo: true, pendencias: 1 }),
      projeto({ slug: "b", ativo: false, concluidoEm: "2025-01-01T12:00:00Z" }),
      projeto({ slug: "c", ativo: false, concluidoEm: null, pendencias: 3 }),
    ]
    const curto = agregar({ projetos })
    const longo = agregar({ projetos }, filtro({ de: "2026-01-01", ate: "2026-11-09" }))
    expect(curto.contagem).toEqual({ ativos: 1, concluidos: 2, comPendencia: 2 })
    expect(longo.contagem).toEqual(curto.contagem)
  })

  it("concluidos conta só os projetos concluídos no período, com o custo de vida inteira", () => {
    const projetos = [
      projeto({ slug: "a", ativo: false, concluidoEm: "2026-11-04T15:00:00Z" }),
      projeto({ slug: "b", ativo: false, concluidoEm: "2026-11-08T15:00:00Z" }),
      projeto({ slug: "c", ativo: false, concluidoEm: "2026-11-09T15:00:00Z" }),
      projeto({ slug: "d", ativo: false, concluidoEm: "2026-10-01T15:00:00Z" }),
      projeto({ slug: "e", ativo: false, concluidoEm: null }),
      projeto({ slug: "f", ativo: true }),
    ]
    const usos = [
      // a: custo antigo, de meses atrás, conta (vida inteira).
      uso({ slug: "a", custoTurnoUsd: 3, fim: "2026-06-01T12:00:00Z" }),
      uso({ slug: "a", sessao: "s2", custoTurnoUsd: 1, fim: "2026-11-04T12:00:00Z" }),
      uso({ slug: "b", custoTurnoUsd: 2, fim: "2026-11-08T12:00:00Z" }),
      uso({ slug: "c", sessao: null, custoTurnoUsd: null, custoUsd: 10, fim: "2026-09-01T12:00:00Z" }),
      uso({ slug: "d", custoTurnoUsd: 100 }),
      uso({ slug: "e", custoTurnoUsd: 100 }),
      uso({ slug: "f", custoTurnoUsd: 100 }),
    ]
    const p = agregar({ projetos, usos })
    expect(p.concluidos).toEqual({ media: 5.3333, mediana: 4, n: 3 })
  })

  it("mediana com número par de concluídos é a média dos dois do meio", () => {
    const projetos = [
      projeto({ slug: "a", ativo: false, concluidoEm: "2026-11-04T15:00:00Z" }),
      projeto({ slug: "b", ativo: false, concluidoEm: "2026-11-05T15:00:00Z" }),
    ]
    const usos = [uso({ slug: "a", custoTurnoUsd: 1 }), uso({ slug: "b", custoTurnoUsd: 2 })]
    expect(agregar({ projetos, usos }).concluidos).toEqual({ media: 1.5, mediana: 1.5, n: 2 })
  })

  it("período inválido lança erro em vez de devolver NaN", () => {
    expect(() => agregar({}, filtro({ de: "ontem" }))).toThrow(RangeError)
    expect(() => agregar({}, filtro({ de: "2026-11-09", ate: "2026-11-03" }))).toThrow(RangeError)
    expect(() => agregar({}, filtro({ de: "2026-02-30" }))).toThrow(RangeError)
  })
})

describe("normalizarParcelas", () => {
  it("modelos que somam mais que o turno são reduzidos na proporção e somam o custo exato", () => {
    expect(normalizarParcelas(0.5, { haiku: 1.5 })).toEqual({ haiku: 0.5 })
    const r = normalizarParcelas(0.2469, { opus: 0.1235, haiku: 0.1235 })
    expect(soma(Object.values(r))).toBeCloseTo(0.2469, 10)
    expect(Object.keys(r).sort()).toEqual(["haiku", "opus"])
    expect(Object.values(r).sort()).toEqual([0.1234, 0.1235])
  })

  it("modelos que somam menos que o turno deixam o resto em outros", () => {
    expect(normalizarParcelas(1, { opus: 0.7 })).toEqual({ opus: 0.7, outros: 0.3 })
  })

  it("modelos nulos ou vazios viram tudo outros", () => {
    expect(normalizarParcelas(0.6, null)).toEqual({ outros: 0.6 })
    expect(normalizarParcelas(0.6, {})).toEqual({ outros: 0.6 })
  })

  it("um modelo só que cobre o turno fica igual, sem outros", () => {
    expect(normalizarParcelas(0.25, { sonnet: 0.25 })).toEqual({ sonnet: 0.25 })
  })

  it("empate no arredondamento: o resto vai para a maior parcela, desempatando pelo nome", () => {
    expect(normalizarParcelas(0.1, { c: 1, a: 1, b: 1 })).toEqual({ a: 0.0334, b: 0.0333, c: 0.0333 })
  })

  it("custo zero não tem parcelas", () => {
    expect(normalizarParcelas(0, { opus: 0.3 })).toEqual({})
    expect(normalizarParcelas(0, null)).toEqual({})
  })
})

describe("agregarPainel: parcelas reais de custoDoTurno", () => {
  /** Uma linha de uso montada com a saída real de custoDoTurno. */
  function usoDoTurno(
    atual: { custoUsd: number; modelos: Record<string, number> },
    anterior: { custoUsd: number; modelos: Record<string, number> } | null,
    parcial: Partial<LinhaUso> = {},
  ): LinhaUso {
    const turno = custoDoTurno(atual, anterior)
    return uso({ custoUsd: atual.custoUsd, custoTurnoUsd: turno.custoTurnoUsd, modelos: turno.modelos, ...parcial })
  }

  it("caso A: arredondamento por modelo que passa do total não desequilibra a série", () => {
    const usos = [
      usoDoTurno({ custoUsd: 0.24692, modelos: { opus: 0.12346, haiku: 0.12346 } }, null, { sessao: "a1" }),
      usoDoTurno({ custoUsd: 0.24692, modelos: { opus: 0.12346, haiku: 0.12346 } }, null, { sessao: "a2" }),
      usoDoTurno({ custoUsd: 0.24688, modelos: { opus: 0.12344, haiku: 0.12344 } }, null, { sessao: "a3" }),
    ]
    expect(usos[0]?.custoTurnoUsd).toBe(0.2469)
    expect(usos[0]?.modelos).toEqual({ opus: 0.1235, haiku: 0.1235 })
    const p = agregar({ usos })
    conferirSomas(p)
    conferirSomas(agregar({ usos }, filtro({ modelos: ["haiku"] })))
  })

  it("caso B: conversa reiniciada com outro modelo; o filtro nunca passa do custo sem filtro", () => {
    const primeiro = { custoUsd: 1, modelos: { opus: 1 } }
    const segundo = { custoUsd: 1.5, modelos: { haiku: 1.5 } }
    const usos = [
      usoDoTurno(primeiro, null, { fim: "2026-11-05T12:00:00Z" }),
      usoDoTurno(segundo, primeiro, { fim: "2026-11-05T13:00:00Z" }),
    ]
    expect(usos[1]?.custoTurnoUsd).toBe(0.5)
    expect(usos[1]?.modelos).toEqual({ haiku: 1.5 })
    const sem = agregar({ usos })
    const com = agregar({ usos }, filtro({ modelos: ["haiku"] }))
    conferirSomas(sem)
    conferirSomas(com)
    expect(sem.totais.custoUsd).toBe(1.5)
    expect(sem.serie[2]?.porModelo).toEqual({ opus: 1, haiku: 0.5 })
    expect(com.totais.custoUsd).toBe(0.5)
    expect(com.totais.custoUsd).toBeLessThanOrEqual(sem.totais.custoUsd)
    for (const [i, ponto] of com.serie.entries()) expect(ponto.total).toBeLessThanOrEqual(sem.serie[i]!.total)
  })

  it("estimado só liga quando a linha antiga contribui com custo depois dos filtros", () => {
    const usos = [
      uso({ sessao: null, custoTurnoUsd: null, custoUsd: 0.6, modelos: { opus: 0.6 } }),
      uso({ sessao: "s2", custoTurnoUsd: 0.25, modelos: { haiku: 0.25 } }),
    ]
    expect(agregar({ usos }).totais.estimado).toBe(true)
    expect(agregar({ usos }, filtro({ modelos: ["haiku"] })).totais.estimado).toBe(false)
  })

  it("estimado por projeto: só o projeto cuja linha antiga contribui no período, depois dos filtros", () => {
    const p = agregar(dadosMistos())
    conferirSomas(p)
    expect(p.porProjeto.find((e) => e.slug === "a")?.estimado).toBe(true)
    expect(p.porProjeto.find((e) => e.slug === "b")?.estimado).toBe(false)
    expect(p.totais.estimado).toBe(p.porProjeto.some((e) => e.estimado))

    // Só haiku: a linha antiga de 06/11 ainda tem parcela haiku (0.2), então "a" continua estimado.
    const haiku = agregar(dadosMistos(), filtro({ modelos: ["haiku"] }))
    expect(haiku.porProjeto.find((e) => e.slug === "a")?.estimado).toBe(true)
    // Só sonnet: as antigas não têm sonnet, então nada é estimado.
    const sonnet = agregar(dadosMistos(), filtro({ modelos: ["sonnet"] }))
    expect(sonnet.porProjeto.every((e) => !e.estimado)).toBe(true)
    expect(sonnet.totais.estimado).toBe(false)
    // Etapa sem linhas antigas: nada estimado.
    const etapa01 = agregar(dadosMistos(), filtro({ etapas: ["01"] }))
    expect(etapa01.porProjeto.every((e) => !e.estimado)).toBe(true)
  })

  it("estimado por projeto ignora linha antiga fora do período", () => {
    const usos = [uso({ sessao: null, custoTurnoUsd: null, custoUsd: 0.6, modelos: { opus: 0.6 }, fim: "2026-10-30T10:00:00Z" })]
    const p = agregar({ usos })
    expect(p.porProjeto[0]?.estimado).toBe(false)
    expect(p.totais.estimado).toBe(false)
  })
})

describe("agregarPainel: porProjeto lista todos os projetos visíveis", () => {
  it("copia etapaAtual, ativo, concluidoEm e pendencias de cada projeto", () => {
    const projetos = [
      projeto({ slug: "ativo", nome: "Ativo", etapaAtual: "04", ativo: true, pendencias: 2 }),
      projeto({ slug: "fim", nome: "Fim", etapaAtual: null, ativo: false, concluidoEm: "2026-11-05T12:00:00Z" }),
    ]
    const p = agregar({ projetos })
    expect(p.porProjeto.find((e) => e.slug === "ativo")).toMatchObject({ etapaAtual: "04", ativo: true, concluidoEm: null, pendencias: 2 })
    expect(p.porProjeto.find((e) => e.slug === "fim")).toMatchObject({ etapaAtual: null, ativo: false, concluidoEm: "2026-11-05T12:00:00Z", pendencias: 0 })
  })

  it("teste vem de EntradaProjeto: projeto de teste aparece com teste: true só com incluirTestes", () => {
    const projetos = [projeto({ slug: "a", nome: "A" }), projeto({ slug: "t", nome: "T", teste: true })]
    const com = agregar({ projetos }, filtro({ incluirTestes: true }))
    expect(com.porProjeto.find((e) => e.slug === "t")?.teste).toBe(true)
    expect(com.porProjeto.find((e) => e.slug === "a")?.teste).toBe(false)
    expect(agregar({ projetos }, filtro({ incluirTestes: false })).porProjeto.map((e) => e.slug)).toEqual(["a"])
  })

  it("projeto sem uso no período aparece com usd 0; empate de custo desempata pelo nome", () => {
    const projetos = [
      projeto({ slug: "z", nome: "Zeta", etapaAtual: "05" }),
      projeto({ slug: "a", nome: "Alfa", etapaAtual: "01" }),
      projeto({ slug: "g", nome: "Gasto" }),
    ]
    const p = agregar({ projetos, usos: [uso({ slug: "g", custoTurnoUsd: 1 })] })
    expect(p.porProjeto.map((e) => e.slug)).toEqual(["g", "a", "z"])
    expect(p.porProjeto[1]).toMatchObject({ usd: 0, etapaAtual: "01", ativo: true })
  })

  it("filtros de dono, projeto e teste tiram o projeto da lista; etapa e modelo só restringem o custo", () => {
    const projetos = [
      projeto({ slug: "a", nome: "A", dono: "ana@x.com" }),
      projeto({ slug: "b", nome: "B", dono: "bia@x.com" }),
      projeto({ slug: "t", nome: "T", dono: "ana@x.com", teste: true }),
    ]
    const usos = [uso({ slug: "a", etapa: "03", custoTurnoUsd: 1 })]
    expect(agregar({ projetos, usos }, filtro({ donos: ["ana@x.com"] })).porProjeto.map((e) => e.slug)).toEqual(["a"])
    expect(agregar({ projetos, usos }, filtro({ projetos: ["b"] })).porProjeto.map((e) => e.slug)).toEqual(["b"])
    expect(agregar({ projetos, usos }, filtro({ incluirTestes: false })).porProjeto.map((e) => e.slug)).toEqual(["a", "b"])
    expect(agregar({ projetos, usos }, filtro({ incluirTestes: true })).porProjeto.map((e) => e.slug)).toEqual(["a", "b", "t"])
    const porEtapa = agregar({ projetos, usos }, filtro({ etapas: ["05"] }))
    expect(porEtapa.porProjeto.map((e) => e.slug)).toEqual(["a", "b"])
    expect(porEtapa.porProjeto.every((e) => e.usd === 0)).toBe(true)
    const porModelo = agregar({ projetos, usos }, filtro({ modelos: ["inexistente"] }))
    expect(porModelo.porProjeto.map((e) => e.slug)).toEqual(["a", "b"])
  })
})
