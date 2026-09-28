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

/**
 * Liga com PLANEJAMENTO_EXECUTOR=demo: permite mexer na UI sem gastar a assinatura.
 * Uma mensagem "demo:propor <tipo> <caminho relativo à raiz>" faz o demo chamar
 * propor_entregavel de verdade (pelo mesmo endpoint que o servidor MCP usa), para ver o card.
 */
export function criarExecutorDemo(): Executor {
  return new FakeExecutor(async function* (pedido, sinal) {
    const comando = pedido.mensagem.match(/demo:propor\s+(\S+)\s+(\S+)/)
    if (comando) {
      const [, tipo, caminho] = comando
      const env = (JSON.parse(pedido.mcpConfig) as { mcpServers: { planejamento: { env: Record<string, string> } } })
        .mcpServers.planejamento.env
      const resposta = await fetch(`${env.PLANEJAMENTO_APP_URL}/api/interno/ferramentas`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.PLANEJAMENTO_TOKEN}` },
        body: JSON.stringify({
          ferramenta: "propor_entregavel",
          entrada: { tipo, titulo: `Demonstração (${tipo})`, arquivo_rascunho: caminho, nome_final: `demonstracao-${tipo}` },
        }),
      })
      const { mensagem } = (await resposta.json()) as { mensagem?: string }
      yield* roteiroSimples(`Modo demonstração: ${mensagem ?? "sem resposta"}`)(pedido, sinal)
      return
    }
    const texto = `Modo demonstração (sem Claude). Recebi: “${pedido.mensagem.slice(0, 200)}”`
    yield* roteiroSimples(texto)(pedido, sinal)
  })
}
