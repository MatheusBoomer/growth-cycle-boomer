import { readFileSync } from "node:fs"
import path from "node:path"
import type { Catalogo, EtapaId } from "./tipos"

export const NIVEIS_ESFORCO = ["low", "medium", "high", "xhigh", "max"] as const
export type NivelEsforco = (typeof NIVEIS_ESFORCO)[number]

/** Alvo de uma configuração que vale para o agente principal da etapa. */
export const ALVO_PRINCIPAL = "principal"
export const SUBAGENTES_CONFIGURAVEIS = ["analista-dados", "pesquisador-benchmark"] as const

export interface EscolhaModelo {
  modelo: string | null
  esforco: NivelEsforco | null
}

export interface Sugestao {
  etapa: EtapaId
  alvo: string
  modelo: string
  esforco: NivelEsforco | null
  motivo: string
}

export const CAMINHO_SUGESTOES = ".claude/skills/_shared/sugestoes-modelos.json"

/** Alvos configuráveis de uma etapa: o agente principal e os subagentes que ela aciona. */
export function alvosDaEtapa(catalogo: Catalogo, etapa: EtapaId): string[] {
  const e = catalogo.etapas.find((x) => x.id === etapa)
  if (!e) throw new Error(`Etapa desconhecida no catálogo: ${etapa}`)
  return [ALVO_PRINCIPAL, ...e.subagentes]
}

export function carregarSugestoes(raiz: string, catalogo: Catalogo): Sugestao[] {
  const bruto = JSON.parse(readFileSync(path.join(raiz, CAMINHO_SUGESTOES), "utf8")) as Sugestao[]
  if (!Array.isArray(bruto)) throw new Error("sugestoes-modelos.json: o conteúdo deve ser uma lista")
  for (const s of bruto) {
    const etapa = catalogo.etapas.find((e) => e.id === s.etapa)
    if (!etapa) throw new Error(`sugestoes-modelos.json: etapa inexistente "${s.etapa}"`)
    if (!alvosDaEtapa(catalogo, etapa.id).includes(s.alvo)) {
      throw new Error(`sugestoes-modelos.json: o alvo "${s.alvo}" não existe na etapa ${s.etapa}`)
    }
    if (typeof s.modelo !== "string" || s.modelo.trim() === "") {
      throw new Error(`sugestoes-modelos.json: a sugestão da etapa ${s.etapa} (${s.alvo}) precisa de modelo`)
    }
    if (s.esforco !== null && !(NIVEIS_ESFORCO as readonly string[]).includes(s.esforco)) {
      throw new Error(`sugestoes-modelos.json: esforço inválido "${s.esforco}" na etapa ${s.etapa} (${s.alvo})`)
    }
    if (typeof s.motivo !== "string" || s.motivo.trim() === "") {
      throw new Error(`sugestoes-modelos.json: a sugestão da etapa ${s.etapa} (${s.alvo}) precisa de motivo`)
    }
  }
  return bruto
}
