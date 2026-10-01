import type { EventoConversa } from "@workspace/core/tipos"

export type Passo = Extract<EventoConversa, { tipo: "atividade" }>

/** Item do chat: um evento comum ou um bloco de passos consecutivos do agente. `indice` = posição do 1º evento. */
export type ItemChat = { tipo: "evento"; evento: EventoConversa; indice: number } | { tipo: "passos"; passos: Passo[]; indice: number }

export function agruparPassos(eventos: EventoConversa[]): ItemChat[] {
  const itens: ItemChat[] = []
  eventos.forEach((evento, indice) => {
    const ultimo = itens.at(-1)
    if (evento.tipo !== "atividade") itens.push({ tipo: "evento", evento, indice })
    else if (ultimo?.tipo === "passos") ultimo.passos.push(evento)
    else itens.push({ tipo: "passos", passos: [evento], indice })
  })
  return itens
}

/**
 * Com o turno em andamento, o bloco de passos mais recente (depois da última fala do agente) é o
 * que ele está executando agora: sai da lista e aparece no balão "Pensando…".
 */
export function separarPassosAoVivo(itens: ItemChat[], turnoAtivo: boolean): { itens: ItemChat[]; aoVivo: Passo[] } {
  const ultimo = itens.at(-1)
  if (!turnoAtivo || ultimo?.tipo !== "passos") return { itens, aoVivo: [] }
  return { itens: itens.slice(0, -1), aoVivo: ultimo.passos }
}
