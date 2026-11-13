import { describe, expect, it } from "vitest"
import type { EtapaId, ResumoProspect } from "@workspace/core/tipos"
import { filtrarProspects, ordenarProspects, separarPorSituacao, type FiltroProspects } from "./filtro-prospects"

function p(nome: string, dono: string | null, extra: Partial<ResumoProspect> = {}): ResumoProspect {
  return { slug: nome.toLowerCase(), nome, dono, etapaAtual: "01", pendencias: 0, atualizadoEm: "2026-10-01T10:00:00Z", ...extra } as unknown as ResumoProspect
}

const lista = [
  p("Iszi", "Ana@Boomer.com", { etapaAtual: "03", pendencias: 1, atualizadoEm: "2026-10-05T10:00:00Z" }),
  p("Verdeluz", "bia@boomer.com", { etapaAtual: "01", atualizadoEm: "2026-10-09T10:00:00Z" }),
  p("Iguatemi", null, { etapaAtual: null, atualizadoEm: "2026-10-02T10:00:00Z" }),
  p("Ilha", "ana@boomer.com", { etapaAtual: "final", pendencias: 2, atualizadoEm: "2026-10-07T10:00:00Z" }),
  p("Água Clara", "bia@boomer.com", { etapaAtual: "03", atualizadoEm: "2026-10-03T10:00:00Z" }),
]

const sem: FiltroProspects = { busca: "", donos: [], etapas: [], soPendentes: false, email: null }
const nomes = (l: ResumoProspect[]) => l.map((x) => x.nome)

describe("filtrarProspects", () => {
  it("sem filtros devolve a lista inteira", () => {
    expect(filtrarProspects(lista, sem)).toHaveLength(5)
  })

  it("a busca ignora maiúsculas e acentos, nos dois sentidos", () => {
    expect(nomes(filtrarProspects(lista, { ...sem, busca: " agua " }))).toEqual(["Água Clara"])
    expect(nomes(filtrarProspects(lista, { ...sem, busca: "ÁGUA" }))).toEqual(["Água Clara"])
    expect(nomes(filtrarProspects(lista, { ...sem, busca: "IG" }))).toEqual(["Iguatemi"])
  })

  it("a busca também acha pelo nome da etapa e pelo analista, como promete o campo", () => {
    const comRotulo = [
      p("Iszi", "ana.souza@boomer.com", { rotuloEtapaAtual: "03 · Diagnóstico de performance" }),
      p("Verdeluz", "bia@boomer.com", { rotuloEtapaAtual: "01 · Preparação de contexto" }),
    ]
    expect(nomes(filtrarProspects(comRotulo, { ...sem, busca: "diagnostico" }))).toEqual(["Iszi"])
    expect(nomes(filtrarProspects(comRotulo, { ...sem, busca: "Ana", buscaPorDono: true }))).toEqual(["Iszi"])
  })

  it("sem buscaPorDono (quem não é admin), o próprio nome não puxa a lista inteira", () => {
    const meus = [p("Matriz", "matheus@boomer.com", { rotuloEtapaAtual: "01 · Preparação" }), p("Iszi", "matheus@boomer.com", { rotuloEtapaAtual: "01 · Preparação" })]
    expect(nomes(filtrarProspects(meus, { ...sem, busca: "mat" }))).toEqual(["Matriz"])
    expect(nomes(filtrarProspects(meus, { ...sem, busca: "mat", buscaPorDono: true }))).toEqual(["Matriz", "Iszi"])
  })

  it("donos filtra sem diferença de maiúsculas e aceita mais de um", () => {
    expect(nomes(filtrarProspects(lista, { ...sem, donos: ["ANA@boomer.com"] }))).toEqual(["Iszi", "Ilha"])
    expect(nomes(filtrarProspects(lista, { ...sem, donos: ["ana@boomer.com", "bia@boomer.com"] }))).toEqual(["Iszi", "Verdeluz", "Ilha", "Água Clara"])
  })

  it("prospect sem dono não quebra o filtro de donos nem aparece nele", () => {
    expect(nomes(filtrarProspects(lista, { ...sem, donos: ["ana@boomer.com"] }))).not.toContain("Iguatemi")
  })

  it("etapas traz só quem está em uma das etapas escolhidas", () => {
    expect(nomes(filtrarProspects(lista, { ...sem, etapas: ["03"] }))).toEqual(["Iszi", "Água Clara"])
    expect(nomes(filtrarProspects(lista, { ...sem, etapas: ["01", "final"] as EtapaId[] }))).toEqual(["Verdeluz", "Ilha"])
  })

  it("soPendentes traz só quem tem aprovação pendente", () => {
    expect(nomes(filtrarProspects(lista, { ...sem, soPendentes: true }))).toEqual(["Iszi", "Ilha"])
  })

  it("os filtros valem em conjunto", () => {
    const r = filtrarProspects(lista, { ...sem, donos: ["ana@boomer.com"], soPendentes: true, etapas: ["final"], busca: "il" })
    expect(nomes(r)).toEqual(["Ilha"])
  })

  it("o e-mail de quem usa a tela não filtra sozinho", () => {
    expect(filtrarProspects(lista, { ...sem, email: "ana@boomer.com" })).toHaveLength(5)
  })
})

describe("ordenarProspects", () => {
  it("atividade: atualizadoEm decrescente", () => {
    expect(nomes(ordenarProspects(lista, "atividade"))).toEqual(["Verdeluz", "Ilha", "Iszi", "Água Clara", "Iguatemi"])
  })

  it("atividade compara o instante, não o texto: ISO com Z e com -03:00, e datas inválidas por último", () => {
    const mistas = [
      p("Zulu", null, { atualizadoEm: "2026-10-05T14:00:00Z" }), // 14:00Z
      p("Brasilia", null, { atualizadoEm: "2026-10-05T12:00:00-03:00" }), // 15:00Z, depois do Zulu
      p("Quebrado", null, { atualizadoEm: "ontem" }),
      p("Cedo", null, { atualizadoEm: "2026-10-05T10:00:00Z" }),
    ]
    expect(nomes(ordenarProspects(mistas, "atividade"))).toEqual(["Brasilia", "Zulu", "Cedo", "Quebrado"])
  })

  it("nome: ordem alfabética sem ligar para acento e caixa", () => {
    expect(nomes(ordenarProspects(lista, "nome"))).toEqual(["Água Clara", "Iguatemi", "Ilha", "Iszi", "Verdeluz"])
  })

  it("etapa: ordem das etapas, com concluídos por último", () => {
    expect(nomes(ordenarProspects(lista, "etapa"))).toEqual(["Verdeluz", "Iszi", "Água Clara", "Ilha", "Iguatemi"])
  })

  it("não altera a lista de entrada", () => {
    const copia = [...lista]
    ordenarProspects(lista, "nome")
    expect(lista).toEqual(copia)
  })
})

describe("separarPorSituacao", () => {
  it("concluído é quem não tem etapa atual", () => {
    const { emAndamento, concluidos } = separarPorSituacao(lista)
    expect(nomes(concluidos)).toEqual(["Iguatemi"])
    expect(emAndamento).toHaveLength(4)
  })
})

describe("200 prospects", () => {
  const etapas: (EtapaId | null)[] = ["01", "02", "03", "04", "05", "06", "07", "08", "final", null]
  const muitos = Array.from({ length: 200 }, (_, i) =>
    p(`Prospect ${i}`, i % 7 === 0 ? null : `dono${i % 5}@boomer.com`, {
      slug: `p-${i}`,
      etapaAtual: etapas[i % etapas.length],
      pendencias: i % 3,
      atualizadoEm: new Date(Date.UTC(2026, 9, 1 + (i % 20))).toISOString(),
    }),
  )

  it("filtra, ordena e separa sem erro, mantendo a ordem estável", () => {
    const f = filtrarProspects(muitos, { ...sem, donos: ["dono1@boomer.com", "DONO2@boomer.com"], soPendentes: true })
    expect(f.length).toBeGreaterThan(0)
    const o = ordenarProspects(muitos, "atividade")
    expect(o).toHaveLength(200)
    // Empate em atualizadoEm preserva a ordem original (sort estável).
    for (let i = 1; i < o.length; i++) {
      if (o[i - 1]!.atualizadoEm === o[i]!.atualizadoEm) expect(muitos.indexOf(o[i - 1]!)).toBeLessThan(muitos.indexOf(o[i]!))
    }
    const { emAndamento, concluidos } = separarPorSituacao(ordenarProspects(muitos, "etapa"))
    expect(emAndamento.length + concluidos.length).toBe(200)
    expect(concluidos).toHaveLength(20)
  })
})
