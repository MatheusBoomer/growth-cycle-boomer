export const ORDEM_ETAPAS = ["01", "02", "03", "04", "05", "06", "07", "08", "final"] as const
export type EtapaId = (typeof ORDEM_ETAPAS)[number]

/**
 * Fase das etapas que saíram do catálogo (ex.: briefing-benchmark) mas ainda aparecem em projetos antigos. Fica aqui,
 * num módulo sem dependência do Node, para a tela (componente de cliente) usar a mesma constante do catálogo.
 */
export const FASE_ARQUIVADA = "Arquivada"

export type StatusEtapa =
  | "bloqueada"
  | "liberada"
  | "em_andamento"
  | "pronta"
  | "concluida"
  | "desatualizada"

export const TIPOS_ENTREGAVEL = ["grafico", "tabela", "secao", "planilha", "documento", "html", "roteiro", "apresentacao"] as const
export type TipoEntregavel = (typeof TIPOS_ENTREGAVEL)[number]

export interface InsumoCatalogo {
  id: string
  nome: string
  descricao: string
  instrucao: string
  tipo: "arquivo" | "link"
  formatos: string[]
  modelo: string | null
  /** Sem extensão (o app acrescenta a do arquivo enviado); termina em "/" quando é pasta. */
  destino: string
  validador: string | null
  sensivel: boolean
}

export interface RefInsumo {
  id: string
  obrigatorio: boolean
}

export interface EtapaCatalogo {
  id: EtapaId
  /** Agrupa etapas na tela (ex.: "Diagnóstico"). Opcional no tipo; o etapas.json real exige. */
  fase?: string
  numero: string
  titulo: string
  rotuloStatus: string
  descricao: string
  skill: string | null
  /** Subagentes que a etapa pode acionar (só os de SUBAGENTES_CONFIGURAVEIS). */
  subagentes: string[]
  insumos: RefInsumo[]
}

export interface Catalogo {
  etapas: EtapaCatalogo[]
  insumos: InsumoCatalogo[]
}

export interface EstadoEtapa {
  status: StatusEtapa
  sessionId: string | null
  iniciadaEm: string | null
  concluidaEm: string | null
  /** O agente chamou sinalizar_etapa_pronta desde a última mensagem do analista. */
  sinalizada: boolean
  resumoDecisoes: string | null
  handoff: string | null
  origem: "app" | "terminal"
  observacao: string | null
}

export type StatusEntregavel = "pendente" | "aprovado" | "substituido"

export interface Entregavel {
  id: string
  etapa: EtapaId
  tipo: TipoEntregavel
  titulo: string
  /** Cópia congelada em .app/propostas/<id><ext>, relativa à pasta do prospect. */
  arquivoRascunho: string
  nomeFinal: string
  status: StatusEntregavel
  ajustePedido: string | null
  criadoEm: string
  decididoEm: string | null
  /** Quando o analista editou o texto (seção) antes de decidir; a aprovação avisa a IA para reler. */
  editadoEm?: string
  /** E-mail de quem aprovou ou pediu ajuste; ausente sem login ou em estados antigos. */
  decididoPor?: string
}

export type StatusInsumo = "pendente" | "invalido" | "valido"

export interface EstadoInsumo {
  etapa: EtapaId
  insumoId: string
  status: StatusInsumo
  problemas: string[]
  avisos: string[]
  resumo: string | null
  /** Relativo à pasta do prospect. */
  arquivo: string | null
  atualizadoEm: string
  /** E-mail de quem enviou o insumo; ausente sem login ou em estados antigos. */
  enviadoPor?: string
}

export interface ItemFila {
  etapa: EtapaId
  texto: string
  /** E-mail de quem provocou o item; ausente quando não houve login ou o item nasceu sem autor. */
  autor?: string | null
}

export interface OpcaoPergunta {
  rotulo: string
  descricao: string | null
}

export interface Pergunta {
  enunciado: string
  descricao: string | null
  multipla: boolean
  opcoes: OpcaoPergunta[]
}

export interface RespostaPergunta {
  selecionadas: string[]
  outra: string | null
}

export type StatusPerguntas = "pendente" | "respondida" | "sem_resposta"

/** Card de perguntas do agente, que não existe mais: fica só para ler o histórico de conversas antigas. `respostas` segue a ordem de `perguntas`. */
export interface ConjuntoPerguntas {
  id: string
  etapa: EtapaId
  perguntas: Pergunta[]
  status: StatusPerguntas
  respostas: RespostaPergunta[] | null
  criadoEm: string
  respondidoEm: string | null
}

export interface Estado {
  versao: 1
  /** Marca a numeração atual das etapas (07 = mídia paga, 08 = plano de ação); ausente em estado anterior à renumeração. */
  versaoEtapas?: 2
  prospect: { slug: string; nome: string; site: string | null; criadoEm: string }
  etapas: Record<EtapaId, EstadoEtapa>
  entregaveis: Entregavel[]
  insumos: EstadoInsumo[]
  perguntas: ConjuntoPerguntas[]
  filaAutomatica: ItemFila[]
  /** Só em cliente de teste: de qual fixture ele veio e em qual etapa começou o último reposicionamento. */
  teste?: { fixture: string; etapaInicial: EtapaId }
  atualizadoEm: string
}

/** Entregável citado numa mensagem do analista (pedido de ajuste); `primeiraMarcacao` segue contínua entre referências. */
export interface ReferenciaAjuste {
  entregavelId: string
  titulo: string
  marcacoes: number
  primeiraMarcacao: number
}

export type EventoConversa =
  | { tipo: "turno_inicio"; em: string }
  | { tipo: "mensagem_analista"; texto: string; automatica: boolean; referencias?: ReferenciaAjuste[]; autor?: string; em: string }
  | { tipo: "texto_agente"; texto: string; em: string }
  | { tipo: "atividade"; nome: string; detalhe: string; em: string }
  | { tipo: "card_entregavel"; entregavelId: string; em: string }
  | { tipo: "card_insumo"; insumoId: string; em: string }
  | { tipo: "card_perguntas"; conjuntoId: string; em: string }
  | { tipo: "aviso"; nivel: "info" | "alerta" | "erro"; texto: string; em: string }
  | { tipo: "turno_fim"; status: "ok" | "interrompido" | "erro"; detalhe: string | null; em: string }

export type EventoTempoReal =
  | { tipo: "delta"; etapa: EtapaId; texto: string }
  | { tipo: "conversa"; etapa: EtapaId; evento: EventoConversa }
  | { tipo: "estado" }
  | { tipo: "turno"; etapa: EtapaId; ativo: boolean }

export interface ResultadoValidacao {
  ok: boolean
  problemas: string[]
  avisos: string[]
  resumo: string | null
}

export interface ResumoProspect {
  slug: string
  nome: string
  etapaAtual: EtapaId | null
  rotuloEtapaAtual: string
  concluidas: number
  totalEtapas: number
  pendencias: number
  teste: boolean
  /** E-mail de quem criou o prospect; null em disco ou quando não há dono gravado. */
  dono: string | null
  atualizadoEm: string
}

/** Kit do analista numa etapa do cliente de teste; `arquivos` são caminhos relativos à pasta do cliente, em kit-de-teste/NN/. */
export type RespostaTeste =
  | { teste: false }
  | { teste: true; fixture: string; etapaInicial: EtapaId; etapa: EtapaId; arquivos: string[]; roteiro: string | null }

export interface RespostaEstado {
  estado: Estado
  catalogo: Catalogo
  condicoes: Record<EtapaId, string[]>
  turnoAtivo: EtapaId | null
  /** E-mail de quem está com o turno ativo (null sem turno, sem login ou turno da fila). */
  turnoPor: string | null
  modelosDisponiveis: string[]
  /** Arquivos em entrega/ativos-aprovados/ sem entregável aprovado pela interface (terminal ou escrita direta). */
  aprovadosForaDaInterface: string[]
}
