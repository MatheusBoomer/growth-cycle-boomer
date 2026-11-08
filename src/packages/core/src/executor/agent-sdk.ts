import { realpathSync } from "node:fs"
import path from "node:path"
import { query, type Options } from "@anthropic-ai/claude-agent-sdk"
import { ambienteDoAgente } from "./ambiente-agente"
import { eventosDaMensagem } from "./stream-json"
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

/** Só o que o executor usa do `query` do SDK (permite trocá-lo nos testes). */
export type ConsultaSdk = (entrada: { prompt: string; options: Options }) => AsyncIterable<unknown>

export interface OpcoesAgentSdk {
  /** Só para testes: no lugar do `query` real do SDK. */
  consulta?: ConsultaSdk
}

type Json = Record<string, unknown>

/** mcpConfig e settings chegam como o JSON dos argumentos do CLI (--mcp-config / --settings). */
function lerJson(texto: string): Json {
  const valor: unknown = JSON.parse(texto)
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Json) : {}
}

/**
 * Na nuvem, `<raiz>/clientes` é um link para o volume (`/data/clientes`). O Claude Code resolve links
 * na checagem de permissão de caminho, então escrever em `<raiz>/clientes/<slug>/...` cai fora do
 * diretório de trabalho e é negado (o SDK não tem aprovador interativo). Devolve o caminho real da
 * pasta `clientes` só quando ela difere do caminho lógico; em pasta comum ou ausente devolve [].
 */
export function diretoriosExtrasDoAgente(cwd: string): string[] {
  const logico = path.resolve(cwd, "clientes")
  try {
    const real = realpathSync(logico)
    // O cwd também pode passar por link (ex.: /tmp no macOS); compara com o caminho lógico já resolvido.
    const logicoReal = path.join(realpathSync(cwd), "clientes")
    return real === logicoReal ? [] : [real]
  } catch {
    return []
  }
}

export function montarOpcoesSdk(p: PedidoTurno, controle: AbortController, env: Record<string, string | undefined>): Options {
  const opcoes: Options = {
    cwd: p.cwd,
    systemPrompt: { type: "preset", preset: "claude_code", append: p.systemPrompt },
    mcpServers: (lerJson(p.mcpConfig).mcpServers ?? {}) as NonNullable<Options["mcpServers"]>,
    settings: lerJson(p.settings) as NonNullable<Options["settings"]>,
    allowedTools: p.allowedTools,
    includePartialMessages: true,
    abortController: controle,
    env,
  }
  const extras = diretoriosExtrasDoAgente(p.cwd)
  if (extras.length > 0) opcoes.additionalDirectories = extras
  if (p.sessionId) opcoes.resume = p.sessionId
  if (p.modelo) opcoes.model = p.modelo
  if (p.esforco) opcoes.effort = p.esforco
  if (p.agentes) opcoes.agents = p.agentes
  return opcoes
}

/**
 * Executor que usa o Claude Agent SDK com chave de API (cobrança por uso no Console).
 * Emite os mesmos eventos do ClaudeCliExecutor: o resto do app não percebe a troca.
 */
export class AgentSdkExecutor implements Executor {
  private readonly consulta: ConsultaSdk

  constructor(opcoes: OpcoesAgentSdk = {}) {
    this.consulta = opcoes.consulta ?? (query as unknown as ConsultaSdk)
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    if (!process.env.ANTHROPIC_API_KEY) {
      yield {
        tipo: "fim",
        ok: false,
        erro: "ANTHROPIC_API_KEY não está definida. Preencha o .env da raiz do projeto.",
        sessionId: null,
      }
      return
    }

    const controle = new AbortController()
    const abortar = () => controle.abort()
    sinal.addEventListener("abort", abortar, { once: true })
    // Parar pode ter sido clicado antes de a consulta existir: o evento já passou.
    if (sinal.aborted) abortar()

    let viuFim = false
    try {
      const mensagens = this.consulta({
        prompt: pedido.mensagem,
        options: montarOpcoesSdk(pedido, controle, ambienteDoAgente(process.env)),
      })
      for await (const mensagem of mensagens) {
        for (const evento of eventosDaMensagem(mensagem)) {
          if (evento.tipo === "fim") viuFim = true
          yield evento
        }
      }
    } catch (e) {
      if (!viuFim) {
        viuFim = true
        yield { tipo: "fim", ok: false, erro: sinal.aborted ? "Interrompido pelo analista." : mensagemDeErro(e), sessionId: null }
      }
    } finally {
      sinal.removeEventListener("abort", abortar)
      controle.abort()
    }
    if (!viuFim) {
      yield {
        tipo: "fim",
        ok: false,
        erro: sinal.aborted ? "Interrompido pelo analista." : "O Claude encerrou sem resposta.",
        sessionId: null,
      }
    }
  }
}

function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
