import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { pastaEnsaio, type ChamadaGravada, type EventoGravado } from "../ensaio/roteiro"
import { chamarFerramentaDoApp } from "./fake"
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

/** As esperas gravadas tocam a 25% do tempo original, e nenhuma passa de 2 s. */
export const FATOR_TEMPO = 0.25
export const ESPERA_MAXIMA_MS = 2000

const RESPOSTA_FIM_DO_ROTEIRO = "O ensaio desta etapa terminou. Use Concluir etapa, ou o seletor de etapa para recomeçar."

export interface OpcoesExecutorEnsaio {
  /** Espera entre os passos; os testes injetam uma versão instantânea. */
  dormir?: (ms: number) => Promise<void>
  /**
   * Chama uma ferramenta do MCP `planejamento` (nome sem prefixo) e devolve a mensagem. Lançar erro marca a chamada como
   * falha; devolver texto conta como sucesso. O padrão chama o endpoint interno do app e lança quando a resposta vem com
   * `ok: false`.
   */
  chamarFerramenta?: (pedido: PedidoTurno, nome: string, entrada: unknown) => Promise<string>
}

const dormirPadrao = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms))

async function chamarFerramentaPadrao(pedido: PedidoTurno, nome: string, entrada: unknown): Promise<string> {
  const resposta = await chamarFerramentaDoApp(pedido, nome, entrada)
  if (resposta.ok === false) throw new Error(resposta.mensagem ?? "a ferramenta recusou a chamada")
  return resposta.mensagem ?? ""
}

function ehChamada(passo: EventoGravado | ChamadaGravada): passo is ChamadaGravada {
  return "ferramenta" in passo
}

/**
 * Executor do modo ensaiado: reproduz um trecho gravado de uma execução real, sem abrir processo nem SDK do Claude.
 * Só serve para prospect de ensaio; fora dele (sem fixture) o turno termina com erro.
 */
export function criarExecutorEnsaio(opcoes: OpcoesExecutorEnsaio = {}): Executor {
  const dormir = opcoes.dormir ?? dormirPadrao
  const chamarFerramenta = opcoes.chamarFerramenta ?? chamarFerramentaPadrao

  return {
    async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
      const contexto = pedido.contexto
      if (!contexto || !contexto.fixture) {
        yield { tipo: "fim", ok: false, erro: "O executor de ensaio só roda em prospect de ensaio com fixture.", sessionId: null }
        return
      }
      const sessionId = `ensaio-${contexto.slug}-${contexto.etapa}`
      yield { tipo: "sessao", sessionId }

      if (!contexto.trecho) {
        yield { tipo: "texto", texto: RESPOSTA_FIM_DO_ROTEIRO }
        yield { tipo: "fim", ok: true, erro: null, sessionId }
        return
      }

      const pacote = pastaEnsaio(pedido.cwd, contexto.fixture, contexto.etapa)
      let contador = 0
      for (const passo of contexto.trecho.passos) {
        if (sinal.aborted) return
        await dormir(Math.min(passo.dtMs * FATOR_TEMPO, ESPERA_MAXIMA_MS))
        if (sinal.aborted) return

        if (!ehChamada(passo)) {
          yield passo.evento
          continue
        }

        let entrada: Record<string, unknown> = passo.entrada
        if (typeof entrada.arquivo_rascunho === "string") {
          const nomeArquivo = path.basename(entrada.arquivo_rascunho)
          const relativo = path.join("clientes", contexto.slug, ".app", "rascunhos", nomeArquivo)
          try {
            await mkdir(path.join(pedido.cwd, path.dirname(relativo)), { recursive: true })
            await copyFile(path.join(pacote, "arquivos", nomeArquivo), path.join(pedido.cwd, relativo))
          } catch {
            const rotulo = `clientes/_fixtures/${contexto.fixture}/ensaio/${contexto.etapa}/arquivos/${nomeArquivo}`
            yield { tipo: "fim", ok: false, erro: `Falta o arquivo do ensaio: ${rotulo}.`, sessionId }
            return
          }
          entrada = { ...entrada, arquivo_rascunho: relativo }
        }

        contador += 1
        const id = `ensaio-${contexto.etapa}-${contador}`
        yield { tipo: "ferramenta", id, nome: `mcp__planejamento__${passo.ferramenta}`, entrada }
        let erro = false
        try {
          await chamarFerramenta(pedido, passo.ferramenta, entrada)
        } catch {
          erro = true
        }
        yield { tipo: "ferramenta_resultado", id, erro }
      }
      yield { tipo: "fim", ok: true, erro: null, sessionId }
    },
  }
}
