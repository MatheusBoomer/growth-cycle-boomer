import { readFile } from "node:fs/promises"
import path from "node:path"
import { nomesAcompanhantes, normalizarNomeFinal } from "../entregaveis"
import { ErroFixture } from "../erros"
import type { EventoExecutor } from "../executor/tipos"
import { pastaDoFixture } from "../fixture"
import type { EtapaId, TipoEntregavel } from "../tipos"

/** O que disparou o trecho: texto do analista, aprovação, pedido de ajuste ou mensagem automática do app. */
export type TipoGatilho = "mensagem" | "aprovar" | "ajuste" | "automatica"

/** Evento do agente gravado com o tempo desde o início do trecho. `sessao`, `uso`, `limite` e `fim` não entram no pacote. */
export interface EventoGravado {
  dtMs: number
  evento: EventoExecutor
}

/** Chamada de ferramenta do MCP `planejamento`; `ferramenta` vem sem o prefixo `mcp__planejamento__`. */
export interface ChamadaGravada {
  dtMs: number
  ferramenta: string
  entrada: Record<string, unknown>
}

/** Um turno do agente: o gatilho, o texto que o analista escreveu (quando houve) e o que o agente fez. */
export interface TrechoEnsaio {
  gatilho: TipoGatilho
  textoPreenchido: string | null
  passos: (EventoGravado | ChamadaGravada)[]
}

export interface RoteiroEnsaio {
  versao: 1
  etapa: EtapaId
  trechos: TrechoEnsaio[]
}

export function pastaEnsaio(raiz: string, fixture: string, etapa: EtapaId): string {
  return path.join(pastaDoFixture(raiz, fixture), "ensaio", etapa)
}

export async function carregarRoteiro(raiz: string, fixture: string, etapa: EtapaId): Promise<RoteiroEnsaio> {
  const arquivo = path.join(pastaEnsaio(raiz, fixture, etapa), "roteiro.json")
  const rotulo = `clientes/_fixtures/${fixture}/ensaio/${etapa}/roteiro.json`
  let bruto: string
  try {
    bruto = await readFile(arquivo, "utf8")
  } catch {
    throw new ErroFixture(`Falta o roteiro de ensaio: ${rotulo}.`)
  }
  let lido: unknown
  try {
    lido = JSON.parse(bruto)
  } catch {
    throw new ErroFixture(`O roteiro de ensaio não é um JSON válido: ${rotulo}.`)
  }
  const roteiro = lido as Partial<RoteiroEnsaio> | null
  if (!roteiro || typeof roteiro !== "object" || roteiro.versao !== 1) {
    throw new ErroFixture(`Versão do roteiro de ensaio não suportada: ${rotulo}.`)
  }
  if (roteiro.etapa !== etapa || !Array.isArray(roteiro.trechos)) {
    throw new ErroFixture(`O roteiro de ensaio não corresponde à etapa ${etapa}: ${rotulo}.`)
  }
  return roteiro as RoteiroEnsaio
}

/** Classifica a mensagem que abriu o turno, para o ensaio escolher o trecho certo do roteiro. */
export function classificarGatilho(mensagem: string, automatica: boolean): TipoGatilho {
  if (mensagem.startsWith("O analista APROVOU")) return "aprovar"
  if (mensagem.includes("AJUSTE no entregável")) return "ajuste"
  return automatica ? "automatica" : "mensagem"
}

/**
 * JSONs que acompanham o documento citado numa chamada de `propor_entregavel` (como a aprovação os procura, ao lado do
 * rascunho). `etapa` é a da conversa; `etapa_origem`, quando vem, manda. Entrada que não é documento do plano: vazio.
 */
export function acompanhantesDaProposta(entrada: Record<string, unknown>, etapa: EtapaId): string[] {
  if (entrada.tipo !== "documento" || typeof entrada.nome_final !== "string") return []
  const dona = (typeof entrada.etapa_origem === "string" ? entrada.etapa_origem : etapa) as EtapaId
  try {
    const nomeFinal = normalizarNomeFinal(entrada.tipo as TipoEntregavel, entrada.nome_final, dona)
    return nomesAcompanhantes({ tipo: "documento", etapa: dona, nomeFinal })
  } catch {
    return []
  }
}
