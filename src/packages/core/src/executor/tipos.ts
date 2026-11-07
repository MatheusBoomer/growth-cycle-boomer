export type EventoExecutor =
  | { tipo: "sessao"; sessionId: string }
  | { tipo: "texto_delta"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramenta"; id: string; nome: string; entrada: unknown }
  | { tipo: "ferramenta_resultado"; id: string; erro: boolean }
  | { tipo: "limite"; status: string; resetsAt: number | null }
  | { tipo: "uso"; janelas: JanelaUso[] }
  | { tipo: "fim"; ok: boolean; erro: string | null; sessionId: string | null; uso?: UsoDoTurno }

/** Custo e tokens informados pelo Claude no fim do turno (null quando o campo não veio). */
export interface UsoDoTurno {
  custoUsd: number | null
  tokensEntrada: number | null
  tokensSaida: number | null
  /** Custo acumulado por modelo (chave = nome do modelo); null quando o result não trouxe modelUsage. */
  modelos: Record<string, number> | null
}

export interface PedidoTurno {
  cwd: string
  mensagem: string
  sessionId: string | null
  systemPrompt: string
  /** JSON (string) passado em --mcp-config. */
  mcpConfig: string
  /** JSON (string) passado em --settings (hook de escrita). */
  settings: string
  allowedTools: string[]
}

/** Fronteira trocável: v1 é o CLI headless; a Fase 2 troca por Agent SDK sem mexer no resto. */
export interface Executor {
  executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor>
}

/** Quanto da assinatura já foi usado numa janela de limite (five_hour, seven_day…), de 0 a 1. */
export interface JanelaUso {
  janela: string
  utilizacao: number
  resetsAt: number | null
}
