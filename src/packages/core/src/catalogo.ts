import { readFileSync } from "node:fs"
import path from "node:path"
import { ORDEM_ETAPAS, type Catalogo, type EtapaCatalogo, type EtapaId, type InsumoCatalogo } from "./tipos"

export const CAMINHO_CATALOGO = ".claude/skills/_shared/etapas.json"

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
