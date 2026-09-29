import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { promptInicialEtapa, systemPromptModoInterface } from "../src/prompts"
import { catalogoReal, RAIZ } from "./ajuda"

// Regra de escrita da agência: travessão (—) só para intervalo entre números (ex.: 10—20).
const TRAVESSAO_FORA_DE_INTERVALO = /(?<!\d)\s*—|—\s*(?!\d)/

const ALVOS = [
  "src/packages/core/src",
  "src/packages/mcp-planejamento/src",
  "src/apps/web/app",
  "src/apps/web/components",
  "src/apps/web/hooks",
  "src/apps/web/lib",
  "src/apps/web/proxy.ts",
  ".claude/skills/_shared/etapas.json",
  ".claude/skills/_shared/modelos-insumo",
  "scripts/validar_insumo.py",
]

function arquivos(alvo: string): string[] {
  const abs = path.join(RAIZ, alvo)
  if (statSync(abs).isFile()) return [abs]
  return readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(tsx?|json|md|py)$/.test(d.name))
    .map((d) => path.join(d.parentPath, d.name))
}

describe("sem travessão no meio das frases", () => {
  it("nenhum texto do app usa — fora de intervalo numérico", () => {
    const achados: string[] = []
    for (const alvo of ALVOS) {
      for (const arquivo of arquivos(alvo)) {
        readFileSync(arquivo, "utf8")
          .split("\n")
          .forEach((linha, i) => {
            if (TRAVESSAO_FORA_DE_INTERVALO.test(linha)) achados.push(`${path.relative(RAIZ, arquivo)}:${i + 1}`)
          })
      }
    }
    expect(achados).toEqual([])
  })

  it("o agente no modo interface recebe a regra do travessão", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(catalogoReal(), "03") })
    expect(s).toContain("travessão")
    expect(s).toMatch(/intervalo entre números/)
  })

  it("o prompt inicial e o system prompt não têm travessão fora da regra", () => {
    const cat = catalogoReal()
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
      .split("\n")
      .filter((l) => !l.includes("travessão"))
      .join("\n")
    const p = promptInicialEtapa({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03"), dossie: "d" })
    expect(TRAVESSAO_FORA_DE_INTERVALO.test(s)).toBe(false)
    expect(TRAVESSAO_FORA_DE_INTERVALO.test(p)).toBe(false)
  })
})
