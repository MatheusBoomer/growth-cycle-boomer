import { readFileSync } from "node:fs"
import path from "node:path"
import { alvosDaEtapa, NIVEIS_ESFORCO, type Sugestao } from "./modelos"
import type { Catalogo } from "./tipos"

// Módulo só de servidor: lê arquivo. Fica separado de modelos.ts porque os componentes do cliente do web
// importam valores de modelos.ts, e um `node:fs` ali quebra o build de produção.

export const CAMINHO_SUGESTOES = ".claude/skills/_shared/sugestoes-modelos.json"

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
