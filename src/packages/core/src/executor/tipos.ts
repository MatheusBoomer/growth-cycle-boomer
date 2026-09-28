export type EventoExecutor =
  | { tipo: "sessao"; sessionId: string }
  | { tipo: "texto_delta"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramenta"; id: string; nome: string; entrada: unknown }
  | { tipo: "ferramenta_resultado"; id: string; erro: boolean }
  | { tipo: "limite"; status: string; resetsAt: number | null }
  | { tipo: "fim"; ok: boolean; erro: string | null; sessionId: string | null }

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
