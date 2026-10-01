import { describe, expect, it } from "vitest"
import type { EventoConversa } from "@workspace/core/tipos"
import { agruparProcesso, separarProcessoAoVivo, type ItemChat } from "./passos"

const em = "2026-10-01T00:00:00.000Z"
const msg = (texto: string): EventoConversa => ({ tipo: "mensagem_analista", texto, automatica: false, em })
const fala = (texto: string): EventoConversa => ({ tipo: "texto_agente", texto, em })
const passo = (detalhe: string): EventoConversa => ({ tipo: "atividade", nome: "Read", detalhe, em })
const card: EventoConversa = { tipo: "card_entregavel", entregavelId: "e1", em }
const inicio: EventoConversa = { tipo: "turno_inicio", em }
const fim = (status: "ok" | "interrompido" = "ok"): EventoConversa => ({ tipo: "turno_fim", status, detalhe: null, em })

/** Resumo legível: eventos visíveis pelo tipo/texto, processo como [conteúdo]. */
function resumo(itens: ItemChat[]): string[] {
  return itens.map((i) =>
    i.tipo === "processo"
      ? `[${i.itens.map((e) => (e.tipo === "atividade" ? e.detalhe : `"${e.texto}"`)).join(" ")}]`
      : i.evento.tipo === "texto_agente"
        ? `resposta:${i.evento.texto}`
        : i.evento.tipo,
  )
}

describe("processo x resposta no chat", () => {
  it("só a última fala do turno vira resposta; falas seguidas de passos entram no processo", () => {
    const eventos = [msg("oi"), inicio, passo("a"), fala("vou ler"), passo("b"), passo("c"), fala("pronto"), fim()]
    expect(resumo(agruparProcesso(eventos, false))).toEqual([
      "mensagem_analista",
      "turno_inicio",
      '[a "vou ler" b c]',
      "resposta:pronto",
      "turno_fim",
    ])
  })

  it("card no meio do turno continua visível e divide o processo", () => {
    const eventos = [msg("oi"), inicio, passo("a"), fala("enviei"), card, passo("b"), fala("fim"), fim()]
    expect(resumo(agruparProcesso(eventos, false))).toEqual([
      "mensagem_analista",
      "turno_inicio",
      '[a "enviei"]',
      "card_entregavel",
      "[b]",
      "resposta:fim",
      "turno_fim",
    ])
  })

  it("falas finais em sequência (antes e depois de um card) são todas resposta", () => {
    const eventos = [msg("oi"), inicio, passo("a"), fala("relatório pronto"), card, fala("aguardo sua decisão"), fim()]
    expect(resumo(agruparProcesso(eventos, false))).toEqual([
      "mensagem_analista",
      "turno_inicio",
      "[a]",
      "resposta:relatório pronto",
      "card_entregavel",
      "resposta:aguardo sua decisão",
      "turno_fim",
    ])
  })

  it("turno em andamento: todas as falas do turno atual ficam no processo", () => {
    const eventos = [msg("oi"), inicio, passo("a"), fala("vou ler"), passo("b"), fala("analisando")]
    expect(resumo(agruparProcesso(eventos, true))).toEqual(["mensagem_analista", "turno_inicio", '[a "vou ler" b "analisando"]'])
  })

  it("turno em andamento não afeta turnos anteriores já encerrados", () => {
    const eventos = [msg("1"), inicio, passo("a"), fala("resposta 1"), fim(), msg("2"), inicio, passo("b"), fala("pensando")]
    expect(resumo(agruparProcesso(eventos, true))).toEqual([
      "mensagem_analista",
      "turno_inicio",
      "[a]",
      "resposta:resposta 1",
      "turno_fim",
      "mensagem_analista",
      "turno_inicio",
      '[b "pensando"]',
    ])
  })

  it("turno interrompido mostra a última fala como resposta", () => {
    const eventos = [msg("oi"), inicio, passo("a"), fala("parei aqui"), fim("interrompido")]
    expect(resumo(agruparProcesso(eventos, false))).toContain("resposta:parei aqui")
  })

  it("conversa sem marcação de turno usa a mensagem do analista como divisória", () => {
    const eventos = [msg("1"), passo("a"), fala("narração"), passo("b"), fala("resposta 1"), msg("2"), fala("resposta 2")]
    expect(resumo(agruparProcesso(eventos, false))).toEqual([
      "mensagem_analista",
      '[a "narração" b]',
      "resposta:resposta 1",
      "mensagem_analista",
      "resposta:resposta 2",
    ])
  })

  it("guarda a posição original do primeiro evento de cada item (chave estável)", () => {
    const itens = agruparProcesso([msg("oi"), passo("a"), passo("b"), fala("ok")], false)
    expect(itens.map((i) => i.indice)).toEqual([0, 1, 3])
  })
})

describe("processo ao vivo durante o turno", () => {
  it("com o turno ativo, o último bloco de processo sai da lista e vai para o balão", () => {
    const { itens, aoVivo } = separarProcessoAoVivo(agruparProcesso([msg("oi"), inicio, passo("a"), fala("x"), passo("b")], true), true)
    expect(aoVivo.length).toBe(3)
    expect(itens.at(-1)?.tipo).toBe("evento")
  })

  it("sem turno ativo, nada é separado", () => {
    const agrupados = agruparProcesso([msg("oi"), passo("a"), fala("ok")], false)
    expect(separarProcessoAoVivo(agrupados, false)).toEqual({ itens: agrupados, aoVivo: [] })
  })
})
