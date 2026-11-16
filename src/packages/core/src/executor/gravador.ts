import { appendFile, copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { pastaEnsaio } from "../ensaio/roteiro"
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

/** Um turno gravado: o que o disparou e os eventos do agente com o tempo (ms) desde o início do turno. */
export interface LinhaGravacao {
  /** Texto bruto do turno; vazio no turno de abertura. */
  mensagem: string
  automatica: boolean
  textoAnalista: string | null
  eventos: { tMs: number; evento: EventoExecutor }[]
}

export interface OpcoesGravador {
  /** Raiz do projeto, onde fica `clientes/_fixtures/`. */
  raiz: string
  /** Relógio em ms; os testes injetam um determinístico. */
  agora?: () => number
}

const PREFIXO_MCP = "mcp__planejamento__"
const FERRAMENTAS_COM_RASCUNHO = new Set([`${PREFIXO_MCP}propor_entregavel`, `${PREFIXO_MCP}propor_validacao_cliente`])

/**
 * Embrulha o executor real durante uma execução de verdade de um cliente de teste comum (sem ensaio) e grava cada turno
 * em `<pastaEnsaio>/gravacao.jsonl`, mais uma cópia dos rascunhos propostos em `<pastaEnsaio>/arquivos/`. Os eventos
 * passam intactos; só grava quando o pedido traz fixture, o turno não é uma reprodução de ensaio, terminou com sucesso
 * e não foi abortado. Falha ao gravar nunca derruba o turno.
 */
export class GravadorExecutor implements Executor {
  private readonly interno: Executor
  private readonly raiz: string
  private readonly agora: () => number

  constructor(interno: Executor, opcoes: OpcoesGravador) {
    this.interno = interno
    this.raiz = opcoes.raiz
    this.agora = opcoes.agora ?? Date.now
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    const contexto = pedido.contexto
    if (!contexto || !contexto.fixture || contexto.trecho !== null) {
      yield* this.interno.executar(pedido, sinal)
      return
    }
    const pasta = pastaEnsaio(this.raiz, contexto.fixture, contexto.etapa)
    const inicio = this.agora()
    const eventos: LinhaGravacao["eventos"] = []
    let terminouBem = false
    for await (const evento of this.interno.executar(pedido, sinal)) {
      eventos.push({ tMs: this.agora() - inicio, evento })
      if (evento.tipo === "fim") terminouBem = evento.ok
      if (evento.tipo === "ferramenta" && FERRAMENTAS_COM_RASCUNHO.has(evento.nome)) {
        await this.copiarRascunho(pedido, pasta, evento.entrada)
      }
      yield evento
    }
    if (!terminouBem || sinal.aborted) return
    const linha: LinhaGravacao = {
      mensagem: contexto.mensagemTurno ?? "",
      automatica: contexto.automatica,
      textoAnalista: contexto.textoAnalista,
      eventos,
    }
    try {
      await mkdir(pasta, { recursive: true })
      await appendFile(path.join(pasta, "gravacao.jsonl"), `${JSON.stringify(linha)}\n`, "utf8")
    } catch (e) {
      console.error("[ensaio] não consegui gravar o turno:", e)
    }
  }

  /** Copia o rascunho citado (lido de `clientes/<slug>/`) para o pacote; arquivo ausente ou fora do prospect é ignorado. */
  private async copiarRascunho(pedido: PedidoTurno, pasta: string, entrada: unknown): Promise<void> {
    const citado = (entrada as { arquivo_rascunho?: unknown } | null)?.arquivo_rascunho
    if (typeof citado !== "string" || !pedido.contexto) return
    const pastaProspect = path.resolve(pedido.cwd, "clientes", pedido.contexto.slug)
    const origem = path.resolve(pedido.cwd, citado)
    if (!origem.startsWith(pastaProspect + path.sep)) return
    try {
      await mkdir(path.join(pasta, "arquivos"), { recursive: true })
      await copyFile(origem, path.join(pasta, "arquivos", path.basename(origem)))
    } catch (e) {
      console.error(`[ensaio] não consegui copiar o rascunho ${citado}:`, e)
    }
  }
}
