export const ORDEM_ETAPAS = ["01", "02", "03", "04", "05", "06", "07", "08", "final"] as const
export type EtapaId = (typeof ORDEM_ETAPAS)[number]

export type StatusEtapa =
  | "bloqueada"
  | "liberada"
  | "em_andamento"
  | "pronta"
  | "concluida"
  | "desatualizada"

export const TIPOS_ENTREGAVEL = ["grafico", "tabela", "secao", "planilha", "documento", "html"] as const
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
  numero: string
  titulo: string
  rotuloStatus: string
  descricao: string
  skill: string | null
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
}

export interface ItemFila {
  etapa: EtapaId
  texto: string
}

export interface Estado {
  versao: 1
  prospect: { slug: string; nome: string; site: string | null; criadoEm: string }
  etapas: Record<EtapaId, EstadoEtapa>
  entregaveis: Entregavel[]
  insumos: EstadoInsumo[]
  filaAutomatica: ItemFila[]
  atualizadoEm: string
}

export type EventoConversa =
  | { tipo: "turno_inicio"; em: string }
  | { tipo: "mensagem_analista"; texto: string; automatica: boolean; em: string }
  | { tipo: "texto_agente"; texto: string; em: string }
  | { tipo: "atividade"; nome: string; detalhe: string; em: string }
  | { tipo: "card_entregavel"; entregavelId: string; em: string }
  | { tipo: "card_insumo"; insumoId: string; em: string }
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
  atualizadoEm: string
}

export interface RespostaEstado {
  estado: Estado
  catalogo: Catalogo
  condicoes: Record<EtapaId, string[]>
  turnoAtivo: EtapaId | null
  modelosDisponiveis: string[]
  /** Arquivos em entrega/ativos-aprovados/ sem entregável aprovado pela interface (terminal ou escrita direta). */
  aprovadosForaDaInterface: string[]
}
