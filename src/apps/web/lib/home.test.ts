import { describe, expect, it } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { continuarDeOndeParou, numerosDaHome, partesDoRotulo } from "./home"

const p = (slug: string, extra: Partial<ResumoProspect> = {}): ResumoProspect => ({
  slug,
  nome: slug,
  etapaAtual: "04",
  rotuloEtapaAtual: "04 · Unidade econômica",
  concluidas: 3,
  totalEtapas: 9,
  pendencias: 0,
  teste: false,
  dono: null,
  atualizadoEm: "2026-11-10T10:00:00Z",
  ...extra,
})

describe("continuarDeOndeParou", () => {
  it("escolhe o em andamento com a atividade mais recente", () => {
    const lista = [p("a", { atualizadoEm: "2026-11-01T10:00:00Z" }), p("b", { atualizadoEm: "2026-11-12T10:00:00Z" }), p("c", { etapaAtual: null, atualizadoEm: "2026-11-13T10:00:00Z" })]
    expect(continuarDeOndeParou(lista)?.slug).toBe("b")
  })

  it("data inválida não vence uma válida", () => {
    expect(continuarDeOndeParou([p("a", { atualizadoEm: "lixo" }), p("b", { atualizadoEm: "2020-01-01T00:00:00Z" })])?.slug).toBe("b")
  })

  it("sem nenhum em andamento devolve null", () => {
    expect(continuarDeOndeParou([])).toBeNull()
    expect(continuarDeOndeParou([p("a", { etapaAtual: null })])).toBeNull()
  })
})

describe("numerosDaHome", () => {
  it("conta em andamento, concluídos e soma as aprovações", () => {
    const lista = [p("a", { pendencias: 2 }), p("b"), p("c", { etapaAtual: null, pendencias: 1 })]
    const n = numerosDaHome(lista)
    expect([n.emAndamento, n.concluidos, n.aprovacoes]).toEqual([2, 1, 3])
    expect(n.comAprovacao.map((x) => x.slug)).toEqual(["a", "c"])
  })

  it("lista vazia dá zeros", () => {
    expect(numerosDaHome([])).toEqual({ emAndamento: 0, concluidos: 0, aprovacoes: 0, comAprovacao: [] })
  })
})

describe("partesDoRotulo", () => {
  it("separa número e título", () => expect(partesDoRotulo("04 · Unidade econômica")).toEqual({ numero: "04", titulo: "Unidade econômica" }))

  it("etapa 10 também", () => expect(partesDoRotulo("10 · Revisão pós-apresentação")).toEqual({ numero: "10", titulo: "Revisão pós-apresentação" }))

  it("rótulo sem número fica só com o título", () => expect(partesDoRotulo("Apresentação final")).toEqual({ numero: null, titulo: "Apresentação final" }))
})
