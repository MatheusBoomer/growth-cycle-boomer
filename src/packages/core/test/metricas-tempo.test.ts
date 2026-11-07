import { describe, expect, it } from "vitest"
import { classificarTempo, limitesDoAmbiente, somarTempo, tempoUtil } from "../src/metricas/tempo"
import type { LinhaPresenca, LinhaUso } from "../src/metricas/tipos"

const LIMITES = { ociosoMin: 5, descarteMin: 15 }
const BLOCO_MS = 30_000
/** Início de um bloco de 30 s: 2026-11-07 10:00:00 UTC. */
const T0 = Date.parse("2026-11-07T10:00:00Z")

function aviso(parcial: Partial<LinhaPresenca> & { bloco?: number }): LinhaPresenca {
  const { bloco = 0, ...resto } = parcial
  return {
    slug: "verdeluz",
    email: "ana@agencia.com",
    etapa: "03",
    em: new Date(T0 + bloco * BLOCO_MS + 5_000).toISOString(),
    visivel: true,
    segundosSemInteracao: 0,
    ...resto,
  }
}

/** Avisos a cada 30 s, do bloco `de` (inclusive) ao `ate` (exclusive). */
function avisos(de: number, ate: number, parcial: Partial<LinhaPresenca> = {}): LinhaPresenca[] {
  const lista: LinhaPresenca[] = []
  for (let b = de; b < ate; b++) lista.push(aviso({ bloco: b, ...parcial }))
  return lista
}

const OCIOSO = { segundosSemInteracao: 300 }

function uso(parcial: Partial<LinhaUso> = {}): LinhaUso {
  return {
    slug: "verdeluz",
    etapa: "03",
    autor: "ana@agencia.com",
    sessao: null,
    custoUsd: null,
    custoTurnoUsd: null,
    modelos: null,
    inicio: new Date(T0).toISOString(),
    fim: new Date(T0 + 10_000).toISOString(),
    ...parcial,
  }
}

function contar(blocos: ReturnType<typeof classificarTempo>) {
  const c = { agente: 0, ativo: 0, ocioso: 0, descartado: 0 }
  for (const b of blocos) c[b.categoria]++
  return c
}

describe("classificarTempo: presença", () => {
  it("aviso visível com 299 s sem interação é ativo", () => {
    const r = classificarTempo([aviso({ segundosSemInteracao: 299 })], [], LIMITES)
    expect(r.map((b) => b.categoria)).toEqual(["ativo"])
  })

  it("aviso visível com 300 s sem interação é ocioso", () => {
    const r = classificarTempo([aviso({ segundosSemInteracao: 300 })], [], LIMITES)
    expect(r.map((b) => b.categoria)).toEqual(["ocioso"])
  })

  it("aviso com a aba escondida e 0 s é ocioso", () => {
    const r = classificarTempo([aviso({ visivel: false, segundosSemInteracao: 0 })], [], LIMITES)
    expect(r.map((b) => b.categoria)).toEqual(["ocioso"])
  })

  it("duas abas no mesmo bloco, uma ativa e uma ociosa, dão um bloco ativo", () => {
    const r = classificarTempo(
      [aviso({ ...OCIOSO }), aviso({ em: new Date(T0 + 20_000).toISOString() })],
      [],
      LIMITES,
    )
    expect(r).toHaveLength(1)
    expect(r[0]?.categoria).toBe("ativo")
  })

  it("a etapa do bloco é a do aviso de maior em", () => {
    const r = classificarTempo(
      [
        aviso({ etapa: "04", em: new Date(T0 + 25_000).toISOString() }),
        aviso({ etapa: "03", em: new Date(T0 + 5_000).toISOString() }),
      ],
      [],
      LIMITES,
    )
    expect(r).toHaveLength(1)
    expect(r[0]?.etapa).toBe("04")
  })

  it("e-mails com caixa diferente são a mesma pessoa", () => {
    const r = classificarTempo(
      [aviso({ email: "Ana@Agencia.com", bloco: 0 }), aviso({ email: "ana@agencia.com", bloco: 1 })],
      [],
      LIMITES,
    )
    expect(r.map((b) => b.email)).toEqual(["ana@agencia.com", "ana@agencia.com"])
  })

  it("pessoas e projetos diferentes não se misturam", () => {
    const r = classificarTempo(
      [aviso({ email: "ana@agencia.com" }), aviso({ email: "beto@agencia.com" }), aviso({ slug: "outro" })],
      [],
      LIMITES,
    )
    expect(r).toHaveLength(3)
  })

  it("avisos fora de ordem dão o mesmo resultado que em ordem", () => {
    const lista = [...avisos(0, 40, OCIOSO), ...avisos(40, 50), ...avisos(50, 90, OCIOSO)]
    const usos = [uso({ inicio: new Date(T0 + 45 * BLOCO_MS).toISOString(), fim: new Date(T0 + 47 * BLOCO_MS).toISOString() })]
    const embaralhada = lista
      .map((a, i) => ({ a, k: (i * 37) % lista.length }))
      .sort((x, y) => x.k - y.k)
      .map((x) => x.a)
    expect(embaralhada).not.toEqual(lista)
    expect(classificarTempo(embaralhada, [...usos].reverse(), LIMITES)).toEqual(classificarTempo(lista, usos, LIMITES))
  })
})

describe("classificarTempo: descarte", () => {
  it("40 min de avisos ociosos seguidos dão 30 blocos ociosos e 50 descartados", () => {
    const r = classificarTempo(avisos(0, 80, OCIOSO), [], LIMITES)
    expect(contar(r)).toEqual({ agente: 0, ativo: 0, ocioso: 30, descartado: 50 })
    expect(r[29]?.categoria).toBe("ocioso")
    expect(r[30]?.categoria).toBe("descartado")
  })

  it("um bloco ativo no meio zera a contagem das duas sequências", () => {
    const r = classificarTempo([...avisos(0, 40, OCIOSO), aviso({ bloco: 40 }), ...avisos(41, 81, OCIOSO)], [], LIMITES)
    expect(contar(r)).toEqual({ agente: 0, ativo: 1, ocioso: 60, descartado: 20 })
    expect(r.slice(0, 30).every((b) => b.categoria === "ocioso")).toBe(true)
    expect(r.slice(30, 40).every((b) => b.categoria === "descartado")).toBe(true)
    expect(r.slice(41, 71).every((b) => b.categoria === "ocioso")).toBe(true)
    expect(r.slice(71).every((b) => b.categoria === "descartado")).toBe(true)
  })

  it("10 min sem aviso entre dois períodos ociosos zera a contagem", () => {
    // 10 min ociosos (20 blocos), 10 min de buraco (20 blocos), 10 min ociosos (20 blocos): nada descartado.
    const r = classificarTempo([...avisos(0, 20, OCIOSO), ...avisos(40, 60, OCIOSO)], [], LIMITES)
    expect(contar(r)).toEqual({ agente: 0, ativo: 0, ocioso: 40, descartado: 0 })
  })

  it("um buraco de um só bloco também zera a contagem", () => {
    const r = classificarTempo([...avisos(0, 25, OCIOSO), ...avisos(26, 51, OCIOSO)], [], LIMITES)
    expect(contar(r)).toEqual({ agente: 0, ativo: 0, ocioso: 50, descartado: 0 })
  })

  it("a contagem é por pessoa e por projeto", () => {
    const r = classificarTempo(
      [...avisos(0, 20, OCIOSO), ...avisos(0, 20, { ...OCIOSO, email: "beto@agencia.com" })],
      [],
      LIMITES,
    )
    expect(contar(r).descartado).toBe(0)
  })

  it("respeita os limites informados", () => {
    const r = classificarTempo(
      [...avisos(0, 10, { segundosSemInteracao: 120 }), ...avisos(10, 30, { segundosSemInteracao: 180 })],
      [],
      { ociosoMin: 3, descarteMin: 5 },
    )
    // 2 min sem interação ainda é ativo; 3 min é ocioso e a partir do 10º ocioso vira descartado.
    expect(contar(r)).toEqual({ agente: 0, ativo: 10, ocioso: 10, descartado: 10 })
  })
})

describe("classificarTempo: agente", () => {
  it("turno de 10 min sem nenhum aviso dá 20 blocos de agente na etapa do turno", () => {
    const r = classificarTempo(
      [],
      [uso({ etapa: "05", inicio: new Date(T0).toISOString(), fim: new Date(T0 + 10 * 60_000 - 1).toISOString() })],
      LIMITES,
    )
    expect(r).toHaveLength(20)
    expect(r.every((b) => b.categoria === "agente" && b.etapa === "05")).toBe(true)
  })

  it("turno de 10 s dá 1 bloco de agente", () => {
    const r = classificarTempo([], [uso()], LIMITES)
    expect(r).toHaveLength(1)
    expect(r[0]?.categoria).toBe("agente")
  })

  it("turno de 23:59:50 a 00:00:20 dá blocos consecutivos, sem duplicar", () => {
    const r = classificarTempo(
      [],
      [uso({ inicio: "2026-11-07T23:59:50Z", fim: "2026-11-08T00:00:20Z" })],
      LIMITES,
    )
    expect(r).toHaveLength(2)
    expect(r[1]!.bloco - r[0]!.bloco).toBe(1)
  })

  it("bloco com turno e aviso ativo ao mesmo tempo vira um bloco de agente", () => {
    const r = classificarTempo([aviso({ etapa: "03" })], [uso({ etapa: "04" })], LIMITES)
    expect(r).toHaveLength(1)
    expect(r[0]?.categoria).toBe("agente")
    expect(r[0]?.etapa).toBe("04")
  })

  it("bloco de agente zera a sequência de ociosos", () => {
    const r = classificarTempo(
      [...avisos(0, 20, OCIOSO), ...avisos(21, 41, OCIOSO)],
      [uso({ inicio: new Date(T0 + 20 * BLOCO_MS).toISOString(), fim: new Date(T0 + 20 * BLOCO_MS + 1_000).toISOString() })],
      LIMITES,
    )
    expect(contar(r)).toEqual({ agente: 1, ativo: 0, ocioso: 40, descartado: 0 })
  })

  it("turno sem autor não gera bloco", () => {
    expect(classificarTempo([], [uso({ autor: null })], LIMITES)).toEqual([])
  })

  it("autor com caixa diferente casa com o e-mail do aviso", () => {
    const r = classificarTempo([aviso({ ...OCIOSO })], [uso({ autor: "ANA@agencia.com" })], LIMITES)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ email: "ana@agencia.com", categoria: "agente" })
  })
})

describe("somarTempo e tempoUtil", () => {
  it("soma 30 s por bloco, agrupando pela chave", () => {
    const blocos = classificarTempo(
      [...avisos(0, 4), ...avisos(4, 6, OCIOSO)],
      [uso({ inicio: new Date(T0 + 10 * BLOCO_MS).toISOString(), fim: new Date(T0 + 11 * BLOCO_MS).toISOString() })],
      LIMITES,
    )
    const porEtapa = somarTempo(blocos, (b) => b.etapa)
    expect(porEtapa.get("03")).toEqual({ agente: 60, ativo: 120, ocioso: 60, descartado: 0 })
    const porPessoa = somarTempo(blocos, (b) => b.email)
    expect([...porPessoa.keys()]).toEqual(["ana@agencia.com"])
  })

  it("tempoUtil é agente mais ativo", () => {
    expect(tempoUtil({ agente: 60, ativo: 120, ocioso: 30, descartado: 90 })).toBe(180)
  })
})

describe("limitesDoAmbiente", () => {
  it("usa 5 e 15 sem variáveis", () => {
    expect(limitesDoAmbiente({})).toEqual({ ociosoMin: 5, descarteMin: 15 })
  })

  it("ignora valor inválido ou zero", () => {
    expect(limitesDoAmbiente({ PLANEJAMENTO_OCIOSO_MIN: "abc", PLANEJAMENTO_DESCARTE_MIN: "0" })).toEqual({
      ociosoMin: 5,
      descarteMin: 15,
    })
  })

  it("lê os valores válidos", () => {
    expect(limitesDoAmbiente({ PLANEJAMENTO_OCIOSO_MIN: "3", PLANEJAMENTO_DESCARTE_MIN: "10" })).toEqual({
      ociosoMin: 3,
      descarteMin: 10,
    })
  })
})
