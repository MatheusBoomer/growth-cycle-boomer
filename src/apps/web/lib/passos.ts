import type { EventoConversa } from "@workspace/core/tipos"

/** O que vai para o dropdown do processo: passos (ferramentas) e falas intermediárias do agente. */
export type EventoProcesso = Extract<EventoConversa, { tipo: "atividade" | "texto_agente" }>

/** Item do chat: um evento visível ou um bloco de processo. `indice` = posição do 1º evento. */
export type ItemChat =
  | { tipo: "evento"; evento: EventoConversa; indice: number }
  | { tipo: "processo"; itens: EventoProcesso[]; indice: number }

/** Eventos que separam turnos: dentro de um turno, só a última fala do agente é resposta. */
function divisoria(e: EventoConversa): boolean {
  return e.tipo === "mensagem_analista" || e.tipo === "turno_inicio" || e.tipo === "turno_fim"
}

/**
 * Fala do agente é processo quando, no mesmo turno, ainda vieram passos depois dela (era
 * narração do caminho, não a resposta). No turno em andamento toda fala é processo: a resposta
 * só se define quando o turno termina, para o chat não "pular".
 */
function falasDeProcesso(eventos: EventoConversa[], turnoAtivo: boolean): Set<number> {
  const processo = new Set<number>()
  let passoDepois = false
  let haDivisoriaDepois = false
  for (let i = eventos.length - 1; i >= 0; i--) {
    const e = eventos[i]!
    if (divisoria(e)) {
      passoDepois = false
      haDivisoriaDepois = true
    } else if (e.tipo === "atividade") {
      passoDepois = true
    } else if (e.tipo === "texto_agente" && (passoDepois || (turnoAtivo && !haDivisoriaDepois))) {
      processo.add(i)
    }
  }
  return processo
}

export function agruparProcesso(eventos: EventoConversa[], turnoAtivo: boolean): ItemChat[] {
  const deProcesso = falasDeProcesso(eventos, turnoAtivo)
  const itens: ItemChat[] = []
  eventos.forEach((evento, indice) => {
    const ehProcesso = evento.tipo === "atividade" || (evento.tipo === "texto_agente" && deProcesso.has(indice))
    const ultimo = itens.at(-1)
    if (!ehProcesso) itens.push({ tipo: "evento", evento, indice })
    else if (ultimo?.tipo === "processo") ultimo.itens.push(evento as EventoProcesso)
    else itens.push({ tipo: "processo", itens: [evento as EventoProcesso], indice })
  })
  return itens
}

/**
 * Cards (aprovação, arquivo, perguntas) são gravados quando o agente chama a ferramenta, quase
 * sempre antes de ele escrever a resposta do turno. Para a leitura seguir a ordem do raciocínio,
 * os cards de um turno vão para logo depois da resposta dele. Sem resposta (turno em andamento ou
 * sem fala final), ficam onde estão.
 */
export function cardsDepoisDaResposta(itens: ItemChat[]): ItemChat[] {
  const saida: ItemChat[] = []
  let trecho: ItemChat[] = []
  const fecharTrecho = () => {
    let resposta = -1
    trecho.forEach((item, i) => {
      if (item.tipo === "evento" && item.evento.tipo === "texto_agente") resposta = i
    })
    if (resposta < 0) {
      saida.push(...trecho)
    } else {
      const ehCard = (item: ItemChat, i: number) => i < resposta && item.tipo === "evento" && item.evento.tipo.startsWith("card_")
      const cards = trecho.filter(ehCard)
      trecho.forEach((item, i) => {
        if (!ehCard(item, i)) {
          // Sem o card no meio, dois blocos de processo vizinhos viram um só.
          const anterior = saida.at(-1)
          if (item.tipo === "processo" && anterior?.tipo === "processo") saida[saida.length - 1] = { ...anterior, itens: [...anterior.itens, ...item.itens] }
          else saida.push(item)
        }
        if (i === resposta) saida.push(...cards)
      })
    }
    trecho = []
  }
  for (const item of itens) {
    if (item.tipo === "evento" && divisoria(item.evento)) {
      fecharTrecho()
      saida.push(item)
    } else {
      trecho.push(item)
    }
  }
  fecharTrecho()
  return saida
}

/**
 * Com o turno em andamento, o bloco de processo mais recente é o que o agente está fazendo
 * agora: sai da lista e aparece como um ChainOfThought expandido. O balão "Pensando…" só
 * aparece quando não há nada ao vivo.
 */
export function separarProcessoAoVivo(itens: ItemChat[], turnoAtivo: boolean): { itens: ItemChat[]; aoVivo: EventoProcesso[] } {
  const ultimo = itens.at(-1)
  if (!turnoAtivo || ultimo?.tipo !== "processo") return { itens, aoVivo: [] }
  return { itens: itens.slice(0, -1), aoVivo: ultimo.itens }
}

/**
 * Duração do processo em segundos, com uma casa (Thought Line). Ao vivo (`agora` em ms): do primeiro passo até agora.
 * Encerrado (`agora` nulo): do primeiro ao último passo. Null se algum horário for inválido ou, encerrado, com menos
 * de dois passos (não há intervalo a medir).
 */
export function duracaoDoProcesso(itens: EventoProcesso[], agora: number | null): number | null {
  if (itens.length === 0) return null
  const inicio = Date.parse(itens[0]!.em)
  const fim = agora ?? (itens.length < 2 ? Number.NaN : Date.parse(itens[itens.length - 1]!.em))
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return null
  return Math.round(Math.max(0, fim - inicio) / 100) / 10
}
