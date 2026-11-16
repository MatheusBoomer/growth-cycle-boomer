import { etapaAnterior, etapaDoCatalogo, insumoDoCatalogo } from "./catalogo"
import { TransicaoInvalida } from "./erros"
import { etapaDaConversa, limparConfirmacaoValidacao, pendenciasValidacao } from "./validacao-cliente"
import { ORDEM_ETAPAS, type Catalogo, type Estado, type EstadoEtapa, type EtapaId, type StatusEtapa } from "./tipos"

export function etapaVazia(status: StatusEtapa): EstadoEtapa {
  return {
    status,
    sessionId: null,
    iniciadaEm: null,
    concluidaEm: null,
    sinalizada: false,
    resumoDecisoes: null,
    handoff: null,
    origem: "app",
    observacao: null,
  }
}

export function estadoInicial(prospect: { slug: string; nome: string; site: string | null }, em: string): Estado {
  const etapas = {} as Record<EtapaId, EstadoEtapa>
  for (const id of ORDEM_ETAPAS) etapas[id] = etapaVazia(id === "01" ? "liberada" : "bloqueada")
  return {
    versao: 1,
    versaoEtapas: 2,
    prospect: { ...prospect, criadoEm: em },
    etapas,
    entregaveis: [],
    insumos: [],
    perguntas: [],
    filaAutomatica: [],
    atualizadoEm: em,
  }
}

export function comEtapa(estado: Estado, id: EtapaId, mudancas: Partial<EstadoEtapa>, em: string): Estado {
  return { ...estado, etapas: { ...estado.etapas, [id]: { ...estado.etapas[id], ...mudancas } }, atualizadoEm: em }
}

function exigir(estado: Estado, id: EtapaId, permitidos: StatusEtapa[], acao: string): void {
  const atual = estado.etapas[id].status
  if (!permitidos.includes(atual)) {
    throw new TransicaoInvalida(`Não dá para ${acao} a etapa ${id}: ela está "${atual.replace("_", " ")}".`)
  }
}

/** Etapas que só liberam sem nenhuma outra desatualizada: a apresentação final e a revisão pós-apresentação. */
export const ETAPAS_DE_FECHAMENTO: readonly EtapaId[] = ["final", "10"]

/** Uma etapa está liberada se, e só se, a anterior está concluída (e, para as de fechamento, nada está desatualizado). */
export function recalcularLiberacoes(estado: Estado): Estado {
  const existeDesatualizada = ORDEM_ETAPAS.some((id) => estado.etapas[id].status === "desatualizada")
  let novo = estado
  for (const id of ORDEM_ETAPAS) {
    const anterior = etapaAnterior(id)
    const podeLiberar =
      anterior === null ||
      (novo.etapas[anterior].status === "concluida" && (!ETAPAS_DE_FECHAMENTO.includes(id) || !existeDesatualizada))
    const status = novo.etapas[id].status
    if (status === "bloqueada" && podeLiberar) novo = comEtapa(novo, id, { status: "liberada" }, novo.atualizadoEm)
    else if (status === "liberada" && !podeLiberar) novo = comEtapa(novo, id, { status: "bloqueada" }, novo.atualizadoEm)
  }
  return novo
}

export function iniciarEtapa(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["liberada"], "iniciar")
  return comEtapa(estado, id, { status: "em_andamento", iniciadaEm: em, sinalizada: false }, em)
}

export function condicoesConcluir(estado: Estado, id: EtapaId, catalogo: Catalogo): string[] {
  const faltando: string[] = []
  for (const ref of etapaDoCatalogo(catalogo, id).insumos) {
    if (!ref.obrigatorio) continue
    const recebido = estado.insumos.find((i) => i.etapa === id && i.insumoId === ref.id)
    if (recebido?.status !== "valido") faltando.push(`Enviar: ${insumoDoCatalogo(catalogo, ref.id).nome}`)
  }
  for (const e of estado.entregaveis) {
    if (etapaDaConversa(e) === id && e.status === "pendente") faltando.push(`Aprovar: ${e.titulo}`)
  }
  if (!estado.etapas[id].sinalizada) faltando.push("O agente ainda não sinalizou que a etapa está completa")
  if (id === "04") faltando.push(...pendenciasValidacao(estado))
  return faltando
}

export function reavaliarPronta(estado: Estado, id: EtapaId, catalogo: Catalogo, em: string): Estado {
  const status = estado.etapas[id].status
  if (status !== "em_andamento" && status !== "pronta") return estado
  const novoStatus = condicoesConcluir(estado, id, catalogo).length === 0 ? "pronta" : "em_andamento"
  return novoStatus === status ? estado : comEtapa(estado, id, { status: novoStatus }, em)
}

export function sinalizarPronta(
  estado: Estado,
  id: EtapaId,
  dados: { resumoDecisoes: string; handoff: string },
  catalogo: Catalogo,
  em: string,
): { estado: Estado; faltando: string[] } {
  exigir(estado, id, ["em_andamento", "pronta"], "sinalizar")
  const marcado = comEtapa(
    estado,
    id,
    { sinalizada: true, resumoDecisoes: dados.resumoDecisoes, handoff: dados.handoff },
    em,
  )
  const novo = reavaliarPronta(marcado, id, catalogo, em)
  return { estado: novo, faltando: condicoesConcluir(novo, id, catalogo) }
}

export function registrarMensagemAnalista(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["em_andamento", "pronta"], "enviar mensagem para")
  const novo = comEtapa(estado, id, { status: "em_andamento", sinalizada: false }, em)
  return id === "04" ? limparConfirmacaoValidacao(novo, em) : novo
}

export function concluirEtapa(estado: Estado, id: EtapaId, catalogo: Catalogo, em: string): Estado {
  exigir(estado, id, ["pronta"], "concluir")
  const faltando = condicoesConcluir(estado, id, catalogo)
  if (faltando.length > 0) throw new TransicaoInvalida(`Ainda falta: ${faltando.join("; ")}`)
  return recalcularLiberacoes(comEtapa(estado, id, { status: "concluida", concluidaEm: em }, em))
}

export function reabrirEtapa(
  estado: Estado,
  id: EtapaId,
  em: string,
): { estado: Estado; afetadasEmAndamento: EtapaId[] } {
  exigir(estado, id, ["concluida"], "reabrir")
  let novo = comEtapa(estado, id, { status: "em_andamento", sinalizada: false, concluidaEm: null }, em)
  const afetadas: EtapaId[] = []
  for (const outra of ORDEM_ETAPAS.slice(ORDEM_ETAPAS.indexOf(id) + 1)) {
    const s = novo.etapas[outra].status
    if (s === "concluida") novo = comEtapa(novo, outra, { status: "desatualizada" }, em)
    else if (s === "em_andamento" || s === "pronta") afetadas.push(outra)
  }
  return { estado: recalcularLiberacoes(novo), afetadasEmAndamento: afetadas }
}

export function confirmarValida(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["desatualizada"], "confirmar")
  return recalcularLiberacoes(comEtapa(estado, id, { status: "concluida" }, em))
}

export function revisarEtapa(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["desatualizada"], "revisar")
  return recalcularLiberacoes(comEtapa(estado, id, { status: "em_andamento", sinalizada: false }, em))
}
