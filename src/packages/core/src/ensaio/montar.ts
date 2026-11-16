import path from "node:path"
import type { LinhaGravacao } from "../executor/gravador"
import type { EventoExecutor } from "../executor/tipos"
import type { EtapaId } from "../tipos"
import { classificarGatilho, type ChamadaGravada, type EventoGravado, type RoteiroEnsaio, type TrechoEnsaio } from "./roteiro"

const PREFIXO_MCP = "mcp__planejamento__"
const DESCARTADOS = new Set<EventoExecutor["tipo"]>(["sessao", "uso", "limite", "fim", "ferramenta_resultado"])

/** Lê o `gravacao.jsonl` (uma `LinhaGravacao` por linha), ignorando linhas em branco. */
export function lerLinhasGravacao(conteudo: string): LinhaGravacao[] {
  return conteudo
    .split("\n")
    .filter((linha) => linha.trim() !== "")
    .map((linha) => JSON.parse(linha) as LinhaGravacao)
}

function trechoDaLinha(linha: LinhaGravacao): TrechoEnsaio {
  const gatilho = classificarGatilho(linha.mensagem, linha.automatica)
  const passos: (EventoGravado | ChamadaGravada)[] = []
  let anterior = 0
  for (const { tMs, evento } of linha.eventos) {
    const dtMs = Math.max(0, tMs - anterior)
    anterior = tMs
    if (DESCARTADOS.has(evento.tipo)) continue
    if (evento.tipo === "ferramenta" && evento.nome.startsWith(PREFIXO_MCP)) {
      const entrada: Record<string, unknown> =
        evento.entrada && typeof evento.entrada === "object" ? { ...(evento.entrada as Record<string, unknown>) } : {}
      // O pacote guarda o rascunho em arquivos/<basename>; o executor de ensaio recria o caminho do prospect.
      if (typeof entrada.arquivo_rascunho === "string") entrada.arquivo_rascunho = path.basename(entrada.arquivo_rascunho)
      passos.push({ dtMs, ferramenta: evento.nome.slice(PREFIXO_MCP.length), entrada })
    } else {
      passos.push({ dtMs, evento })
    }
  }
  const comTexto = gatilho === "mensagem" || gatilho === "ajuste"
  return { gatilho, textoPreenchido: comTexto ? linha.textoAnalista : null, passos }
}

/** Converte as linhas gravadas de uma etapa no roteiro de ensaio: um trecho por turno. */
export function montarRoteiro(etapa: EtapaId, linhas: LinhaGravacao[]): RoteiroEnsaio {
  return { versao: 1, etapa, trechos: linhas.map(trechoDaLinha) }
}
