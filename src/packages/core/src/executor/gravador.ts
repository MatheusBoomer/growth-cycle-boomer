import { access, appendFile, copyFile, mkdir, readdir, rename } from "node:fs/promises"
import path from "node:path"
import { acompanhantesDaProposta, pastaEnsaio } from "../ensaio/roteiro"
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
 * em `<pastaEnsaio>/gravacao.jsonl`, mais uma cópia dos rascunhos propostos em `<pastaEnsaio>/arquivos/` (nome `<n>-<original>`, único por gravação; os JSONs
 * que acompanham o documento do plano vão com o mesmo `<n>-`). O turno de abertura começa uma gravação nova. Os eventos
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
    if (contexto.mensagemTurno === null) await this.guardarGravacaoAnterior(pasta)
    const inicio = this.agora()
    const eventos: LinhaGravacao["eventos"] = []
    let terminouBem = false
    for await (const evento of this.interno.executar(pedido, sinal)) {
      let gravado = evento
      if (evento.tipo === "fim") terminouBem = evento.ok
      if (evento.tipo === "ferramenta" && FERRAMENTAS_COM_RASCUNHO.has(evento.nome)) {
        const entrada = await this.copiarRascunho(pedido, pasta, evento.entrada)
        // O evento repassado fica intacto; só a gravação aponta para a cópia de nome único do pacote.
        if (entrada) gravado = { ...evento, entrada }
      }
      eventos.push({ tMs: this.agora() - inicio, evento: gravado })
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

  /**
   * O turno de abertura começa uma gravação nova da etapa. Se já existe uma, ela e a pasta `arquivos/` vão para
   * `gravacao-<data>.jsonl` e `arquivos-<data>/` (nada é apagado). Falha aqui só vai para o console.
   */
  private async guardarGravacaoAnterior(pasta: string): Promise<void> {
    const gravacao = path.join(pasta, "gravacao.jsonl")
    const existe = await access(gravacao).then(
      () => true,
      () => false,
    )
    if (!existe) return
    const data = new Date(this.agora()).toISOString().replace(/[:.]/g, "-")
    try {
      await rename(gravacao, path.join(pasta, `gravacao-${data}.jsonl`))
      const arquivos = path.join(pasta, "arquivos")
      const temArquivos = await access(arquivos).then(
        () => true,
        () => false,
      )
      if (temArquivos) await rename(arquivos, path.join(pasta, `arquivos-${data}`))
    } catch (e) {
      console.error("[ensaio] não consegui guardar a gravação anterior:", e)
    }
  }

  /**
   * Copia o rascunho citado (lido de `clientes/<slug>/`) para `arquivos/<n>-<nome>`, com n único na gravação da etapa
   * (sobrevive a turnos e reinícios, pois sai do que já está na pasta): o agente real reaproveita o nome do arquivo ao
   * ajustar um gráfico, e a cópia nova não pode sobrescrever a anterior. Devolve a entrada com `arquivo_rascunho`
   * apontando para a cópia; arquivo ausente ou fora do prospect devolve null.
   */
  private async copiarRascunho(pedido: PedidoTurno, pasta: string, entrada: unknown): Promise<Record<string, unknown> | null> {
    const citado = (entrada as { arquivo_rascunho?: unknown } | null)?.arquivo_rascunho
    if (typeof citado !== "string" || !pedido.contexto) return null
    const slug = pedido.contexto.slug
    const pastaProspect = path.resolve(pedido.cwd, "clientes", slug)
    const origem = path.resolve(pedido.cwd, citado)
    if (!origem.startsWith(pastaProspect + path.sep)) return null
    try {
      const pastaArquivos = path.join(pasta, "arquivos")
      await mkdir(pastaArquivos, { recursive: true })
      const usados = (await readdir(pastaArquivos)).map((nome) => Number(/^(\d+)-/.exec(nome)?.[1] ?? 0))
      const nome = `${Math.max(0, ...usados) + 1}-${path.basename(origem)}`
      await copyFile(origem, path.join(pastaArquivos, nome))
      // O documento do plano leva junto os JSONs que a aprovação procura ao lado dele, com o mesmo número.
      for (const acompanhante of acompanhantesDaProposta(entrada as Record<string, unknown>, pedido.contexto.etapa)) {
        try {
          await copyFile(path.join(path.dirname(origem), acompanhante), path.join(pastaArquivos, `${nome.slice(0, nome.indexOf("-") + 1)}${acompanhante}`))
        } catch (e) {
          console.error(`[ensaio] não consegui copiar o acompanhante ${acompanhante}:`, e)
        }
      }
      return { ...(entrada as Record<string, unknown>), arquivo_rascunho: `clientes/${slug}/.app/rascunhos/${nome}` }
    } catch (e) {
      console.error(`[ensaio] não consegui copiar o rascunho ${citado}:`, e)
      return null
    }
  }
}
