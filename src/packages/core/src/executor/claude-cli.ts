import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"
import { parseLinhaStreamJson } from "./stream-json"
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

export interface OpcoesClaudeCli {
  comando?: string
  /** Só para testes: argumentos antes dos do claude (ex.: o script do CLI falso). */
  prefixoArgs?: string[]
}

export function montarArgsClaude(p: PedidoTurno): string[] {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--append-system-prompt",
    p.systemPrompt,
    "--mcp-config",
    p.mcpConfig,
    "--settings",
    p.settings,
    "--allowedTools",
    p.allowedTools.join(","),
  ]
  if (p.sessionId) args.push("--resume", p.sessionId)
  return args
}

export class ClaudeCliExecutor implements Executor {
  private readonly opcoes: OpcoesClaudeCli

  constructor(opcoes: OpcoesClaudeCli = {}) {
    this.opcoes = opcoes
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    const env = { ...process.env }
    // v1 (protótipo): usa a assinatura logada no Claude Code, nunca uma chave de API paga.
    delete env.ANTHROPIC_API_KEY

    const filho: ChildProcessWithoutNullStreams = spawn(
      this.opcoes.comando ?? "claude",
      [...(this.opcoes.prefixoArgs ?? []), ...montarArgsClaude(pedido)],
      { cwd: pedido.cwd, env, stdio: ["pipe", "pipe", "pipe"] },
    )
    const falhaAoIniciar = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      filho.once("error", resolve)
      filho.once("spawn", () => resolve(null))
    })
    if (falhaAoIniciar) {
      yield {
        tipo: "fim",
        ok: false,
        erro:
          falhaAoIniciar.code === "ENOENT"
            ? "Claude Code não encontrado. Instale e faça login com `claude auth login`."
            : falhaAoIniciar.message,
        sessionId: null,
      }
      return
    }

    let stderr = ""
    filho.stderr.on("data", (d) => {
      stderr = (stderr + String(d)).slice(-4000)
    })
    const saida = new Promise<number | null>((resolve) => filho.once("close", (codigo) => resolve(codigo)))
    const abortar = () => filho.kill("SIGTERM")
    sinal.addEventListener("abort", abortar, { once: true })
    filho.stdin.on("error", () => {})
    filho.stdin.end(pedido.mensagem)

    let viuFim = false
    try {
      for await (const linha of createInterface({ input: filho.stdout })) {
        for (const evento of parseLinhaStreamJson(linha)) {
          if (evento.tipo === "fim") viuFim = true
          yield evento
        }
      }
      const codigo = await saida
      if (!viuFim) {
        yield {
          tipo: "fim",
          ok: false,
          erro: sinal.aborted
            ? "Interrompido pelo analista."
            : stderr.trim() || `O Claude Code encerrou sem resposta (código ${codigo}).`,
          sessionId: null,
        }
      }
    } finally {
      sinal.removeEventListener("abort", abortar)
      if (filho.exitCode === null) filho.kill("SIGTERM")
    }
  }
}
