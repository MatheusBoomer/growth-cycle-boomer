import { describe, expect, it } from "vitest"
import type { Entregavel } from "@workspace/core/tipos"
import { entregaveisDaConversa, visualizadorAbertoNaConversa } from "./entregaveis-da-conversa"

function entregavel(parcial: Partial<Entregavel>): Entregavel {
  return {
    id: "e1",
    etapa: "04",
    tipo: "html",
    titulo: "Relatório",
    arquivoRascunho: ".app/propostas/e1.html",
    nomeFinal: "relatorio.html",
    status: "pendente",
    ajustePedido: null,
    criadoEm: "2026-11-16T10:00:00.000Z",
    decididoEm: null,
    ...parcial,
  }
}

const proprio = entregavel({ id: "a", etapa: "04" })
const daTresNaConversaDaQuatro = entregavel({ id: "b", etapa: "03", etapaConversa: "04", nomeFinal: "grafico-03.html" })
const daTres = entregavel({ id: "c", etapa: "03", nomeFinal: "outro.html" })
const todos = [proprio, daTresNaConversaDaQuatro, daTres]

describe("entregaveisDaConversa", () => {
  it("a conversa da 04 inclui o entregavel da 03 proposto nela", () => {
    expect(entregaveisDaConversa(todos, "04").map((e) => e.id)).toEqual(["a", "b"])
  })

  it("a conversa da 03 nao inclui o que foi proposto na 04", () => {
    expect(entregaveisDaConversa(todos, "03").map((e) => e.id)).toEqual(["c"])
  })
})

describe("visualizadorAbertoNaConversa", () => {
  it("fechado nao esta aberto em conversa nenhuma", () => {
    expect(visualizadorAbertoNaConversa(todos, null, "04")).toBe(false)
  })

  it("entregavel da 03 aberto pela conversa da 04 abre na 04 e nao na 03", () => {
    const v = { etapa: "03" as const, nomeFinal: "grafico-03.html" }
    expect(visualizadorAbertoNaConversa(todos, v, "04")).toBe(true)
    expect(visualizadorAbertoNaConversa(todos, v, "03")).toBe(false)
  })

  it("entregavel sem etapaConversa abre na propria etapa", () => {
    const v = { etapa: "03" as const, nomeFinal: "outro.html" }
    expect(visualizadorAbertoNaConversa(todos, v, "03")).toBe(true)
    expect(visualizadorAbertoNaConversa(todos, v, "04")).toBe(false)
  })

  it("sem entregavel achado vale a etapa guardada", () => {
    expect(visualizadorAbertoNaConversa(todos, { etapa: "04", nomeFinal: "sumiu.html" }, "04")).toBe(true)
    expect(visualizadorAbertoNaConversa(todos, { etapa: "04", nomeFinal: "sumiu.html" }, "03")).toBe(false)
  })
})
