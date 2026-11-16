import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

export type Roteiro = (pedido: PedidoTurno, sinal: AbortSignal) => AsyncIterable<EventoExecutor>

/** Executor para testes: grava os pedidos e reproduz o roteiro dado. */
export class FakeExecutor implements Executor {
  readonly pedidos: PedidoTurno[] = []
  private readonly roteiro: Roteiro

  constructor(roteiro: Roteiro) {
    this.roteiro = roteiro
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    this.pedidos.push(pedido)
    yield* this.roteiro(pedido, sinal)
  }
}

export function roteiroSimples(texto: string, sessionId = "sessao-demo"): Roteiro {
  return async function* () {
    yield { tipo: "sessao", sessionId }
    yield { tipo: "texto_delta", texto }
    yield { tipo: "texto", texto }
    yield { tipo: "fim", ok: true, erro: null, sessionId }
  }
}

/** Resposta do endpoint interno de ferramentas do app. */
export interface RespostaFerramenta {
  ok?: boolean
  mensagem?: string
}

/** Chama uma ferramenta do MCP `planejamento` pelo endpoint interno do app, com a URL e o token do `mcpConfig` do pedido. */
export async function chamarFerramentaDoApp(pedido: PedidoTurno, ferramenta: string, entrada: unknown): Promise<RespostaFerramenta> {
  const { PLANEJAMENTO_APP_URL, PLANEJAMENTO_TOKEN } = (
    JSON.parse(pedido.mcpConfig) as { mcpServers: { planejamento: { env: Record<string, string> } } }
  ).mcpServers.planejamento.env
  const resposta = await fetch(`${PLANEJAMENTO_APP_URL}/api/interno/ferramentas`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${PLANEJAMENTO_TOKEN}` },
    body: JSON.stringify({ ferramenta, entrada }),
  })
  return (await resposta.json()) as RespostaFerramenta
}

/**
 * Liga com PLANEJAMENTO_EXECUTOR=demo: permite mexer na UI sem gastar a assinatura.
 * "demo:propor <tipo> <caminho>" faz o demo chamar propor_entregavel com um card de exemplo.
 */
export function criarExecutorDemo(): Executor {
  return new FakeExecutor(async function* (pedido, sinal) {
    const chamarFerramenta = async (ferramenta: string, entrada: unknown) =>
      (await chamarFerramentaDoApp(pedido, ferramenta, entrada)).mensagem ?? "sem resposta"

    const comando = pedido.mensagem.match(/demo:propor\s+(\S+)\s+(\S+)/)
    if (comando) {
      const [, tipo, caminho] = comando
      const mensagem = await chamarFerramenta("propor_entregavel", {
        tipo,
        titulo: `Demonstração (${tipo})`,
        arquivo_rascunho: caminho,
        nome_final: `demonstracao-${tipo}`,
      })
      yield* roteiroSimples(`Modo demonstração: ${mensagem}`)(pedido, sinal)
      return
    }
    const texto = `Modo demonstração (sem Claude). Recebi: "${pedido.mensagem.slice(0, 200)}"`
    yield* roteiroSimples(texto)(pedido, sinal)
  })
}
