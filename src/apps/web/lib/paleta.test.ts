import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Cor de interface só por token: nada de paleta nomeada do Tailwind nem bg-white solto.
// O modo dev de comentários tem visual próprio e fica de fora.
const RAIZES = [
  path.resolve(import.meta.dirname, "../components"),
  path.resolve(import.meta.dirname, "../../../packages/ui/src/components"),
]
const IGNORAR = /[\\/]modo-dev[\\/]/
const PALETA =
  /\b(?:bg|text|border|ring|from|to|via|shadow|fill|stroke|outline|decoration|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\bbg-white\b/g

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) && !nome.endsWith(".test.ts") ? [caminho] : []
  })
}

describe("paleta da interface", () => {
  it("nenhum componente usa cor fora dos tokens", () => {
    const achados = RAIZES.flatMap(arquivos)
      .filter((f) => !IGNORAR.test(f))
      .flatMap((f) => [...readFileSync(f, "utf-8").matchAll(PALETA)].map((m) => `${path.basename(f)}: ${m[0]}`))
    expect(achados).toEqual([])
  })
})
