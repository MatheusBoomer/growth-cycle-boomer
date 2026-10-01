import { describe, expect, it } from "vitest"
import type { EventoConversa } from "@workspace/core/tipos"
import { agruparPassos, separarPassosAoVivo } from "./passos"

const em = "2026-10-01T00:00:00.000Z"
const msg = (texto: string): EventoConversa => ({ tipo: "mensagem_analista", texto, automatica: false, em })
const fala = (texto: string): EventoConversa => ({ tipo: "texto_agente", texto, em })
const passo = (detalhe: string): EventoConversa => ({ tipo: "atividade", nome: "Read", detalhe, em })
const inicio: EventoConversa = { tipo: "turno_inicio", em }

describe("agrupar os passos do agente no chat", () => {
  it("junta atividades consecutivas num bloco, mantendo os demais eventos", () => {
    const itens = agruparPassos([msg("oi"), inicio, passo("a"), passo("b"), fala("ok"), passo("c")])
    expect(itens.map((i) => (i.tipo === "passos" ? `passos:${i.passos.length}` : i.evento.tipo))).toEqual([
      "mensagem_analista",
      "turno_inicio",
      "passos:2",
      "texto_agente",
      "passos:1",
    ])
  })

  it("guarda a posição original do primeiro evento de cada item (chave estável)", () => {
    const itens = agruparPassos([msg("oi"), passo("a"), passo("b"), fala("ok")])
    expect(itens.map((i) => i.indice)).toEqual([0, 1, 3])
  })

  it("sem atividades, devolve os eventos como estão", () => {
    expect(agruparPassos([msg("oi"), fala("ok")]).every((i) => i.tipo === "evento")).toBe(true)
  })
})

describe("passos ao vivo durante o turno", () => {
  it("com o turno ativo, o último bloco de passos sai da lista e vai para o balão", () => {
    const { itens, aoVivo } = separarPassosAoVivo(agruparPassos([msg("oi"), passo("a"), fala("x"), passo("b"), passo("c")]), true)
    expect(aoVivo?.map((p) => p.detalhe)).toEqual(["b", "c"])
    expect(itens.at(-1)?.tipo).toBe("evento")
  })

  it("se o agente já falou depois dos passos, não há passos ao vivo", () => {
    const { aoVivo } = separarPassosAoVivo(agruparPassos([passo("a"), fala("x")]), true)
    expect(aoVivo).toEqual([])
  })

  it("sem turno ativo, nada é separado", () => {
    const agrupados = agruparPassos([passo("a")])
    expect(separarPassosAoVivo(agrupados, false)).toEqual({ itens: agrupados, aoVivo: [] })
  })
})
