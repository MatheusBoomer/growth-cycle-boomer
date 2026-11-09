import { readFileSync } from "node:fs"
import path from "node:path"
import { SUBAGENTES_CONFIGURAVEIS } from "./modelos"
import { FASE_ARQUIVADA, ORDEM_ETAPAS, type Catalogo, type EtapaCatalogo, type EtapaId, type InsumoCatalogo } from "./tipos"

export const CAMINHO_CATALOGO = ".claude/skills/_shared/etapas.json"

/** Fase das etapas que saíram do catálogo; definida em `tipos.ts` (sem Node) e reexportada aqui. */
export { FASE_ARQUIVADA }

export function carregarCatalogo(raiz: string): Catalogo {
  const bruto = JSON.parse(readFileSync(path.join(raiz, CAMINHO_CATALOGO), "utf8")) as Catalogo
  validarCatalogo(bruto)
  return bruto
}

export function validarCatalogo(c: Catalogo): void {
  const ids = c.etapas.map((e) => e.id)
  if (ids.join(",") !== ORDEM_ETAPAS.join(",")) {
    throw new Error(
      `etapas.json: as etapas devem ser exatamente ${ORDEM_ETAPAS.join(", ")}, nessa ordem (recebido: ${ids.join(", ")})`,
    )
  }
  const insumos = new Set(c.insumos.map((i) => i.id))
  for (const e of c.etapas) {
    if (typeof e.fase !== "string" || e.fase.trim() === "") {
      throw new Error(`etapas.json: a etapa ${e.id} precisa do campo "fase" (texto não vazio)`)
    }
    if (!Array.isArray(e.subagentes)) {
      throw new Error(`etapas.json: a etapa ${e.id} precisa do campo "subagentes" (lista, pode ser vazia)`)
    }
    for (const nome of e.subagentes) {
      if (!(SUBAGENTES_CONFIGURAVEIS as readonly string[]).includes(nome)) {
        throw new Error(`etapas.json: a etapa ${e.id} lista o subagente "${nome}", que não é configurável`)
      }
    }
    for (const r of e.insumos) {
      if (!insumos.has(r.id)) throw new Error(`etapas.json: a etapa ${e.id} referencia o insumo inexistente "${r.id}"`)
    }
  }
  for (const i of c.insumos) {
    if (i.tipo === "arquivo" && i.formatos.length === 0) {
      throw new Error(`etapas.json: o insumo "${i.id}" é arquivo mas não lista formatos aceitos`)
    }
  }
}

export function etapaDoCatalogo(c: Catalogo, id: EtapaId): EtapaCatalogo {
  const e = c.etapas.find((x) => x.id === id)
  if (!e) throw new Error(`Etapa desconhecida no catálogo: ${id}`)
  return e
}

/** Fase da etapa; etapa fora do catálogo (arquivada) devolve FASE_ARQUIVADA. */
export function faseDaEtapa(c: Catalogo, etapa: string): string {
  return c.etapas.find((x) => x.id === etapa)?.fase ?? FASE_ARQUIVADA
}

export function insumoDoCatalogo(c: Catalogo, id: string): InsumoCatalogo {
  const i = c.insumos.find((x) => x.id === id)
  if (!i) throw new Error(`Insumo desconhecido no catálogo: ${id}`)
  return i
}

export function etapaAnterior(id: EtapaId): EtapaId | null {
  const i = ORDEM_ETAPAS.indexOf(id)
  return i > 0 ? ORDEM_ETAPAS[i - 1]! : null
}

export function proximaEtapa(id: EtapaId): EtapaId | null {
  const i = ORDEM_ETAPAS.indexOf(id)
  return i >= 0 && i < ORDEM_ETAPAS.length - 1 ? ORDEM_ETAPAS[i + 1]! : null
}
