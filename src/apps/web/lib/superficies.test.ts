import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Com o vidro translúcido, o que flutua sobre conteúdo ou sobre o material do cliente precisa de fundo sólido,
// e texto laranja precisa do tom de link (o laranja da marca não passa AA como texto no tema claro).
const COMPONENTES = path.resolve(import.meta.dirname, "../components")
const ler = (relativo: string) => readFileSync(path.join(COMPONENTES, relativo), "utf-8")

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome)
    if (statSync(caminho).isDirectory()) return nome === "modo-dev" ? [] : arquivos(caminho)
    return nome.endsWith(".tsx") ? [caminho] : []
  })
}

describe("superfícies e texto no tema Boomer", () => {
  it("texto laranja usa text-link-acao; text-primary só em ícone", () => {
    const achados = arquivos(COMPONENTES).flatMap((f) =>
      readFileSync(f, "utf-8")
        .split("\n")
        .map((linha, i) => ({ linha, i }))
        .filter(({ linha }) => /\btext-primary(?![-\w])/.test(linha) && !/Icon\b/.test(linha))
        .map(({ i }) => `${path.relative(COMPONENTES, f)}:${i + 1}`),
    )
    expect(achados).toEqual([])
  })

  it("cards de vidro são quase opacos: o fundo animado de ondas não interfere no conteúdo", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")
    const [claro, escuro] = css.split(/^\.dark\s*\{/m) as [string, string]
    const alfa = (bloco: string, n: 1 | 2) => Number(new RegExp(`--vidro-${n}:\\s*rgb\\([^)]*/\\s*([\\d.]+)\\)`).exec(bloco)![1])
    expect(alfa(claro, 1)).toBeGreaterThanOrEqual(0.95)
    expect(alfa(claro, 2)).toBeGreaterThanOrEqual(0.92)
    expect(alfa(escuro, 1)).toBeGreaterThanOrEqual(0.9)
    expect(alfa(escuro, 2)).toBeGreaterThanOrEqual(0.88)
  })

  it("o conteúdo da administração fica num painel de fundo sólido (tabelas não têm fundo próprio)", () => {
    const layout = readFileSync(path.resolve(import.meta.dirname, "../app/admin/layout.tsx"), "utf-8")
    expect(layout).toMatch(/className="[^"]*\bbg-popover\b[^"]*"/)
  })

  it("avisos fixos do sistema têm fundo sólido", () => {
    const alertas = [...ler("sistema/verificacao-sistema.tsx").matchAll(/<Alert\b[^>]*>/g)].map((m) => m[0])
    expect(alertas.length).toBeGreaterThan(0)
    for (const alerta of alertas) expect(alerta).toContain("bg-popover")
  })

  it("controles sobre o material do cliente usam a variante 'midia'", () => {
    for (const arquivo of ["cards/previa-arquivo.tsx", "biblioteca/imagem-ampliada.tsx", "biblioteca/card-imagem.tsx"]) {
      const sobrepostos = [...ler(arquivo).matchAll(/<(?:Button|Badge)\b[^>]*\babsolute\b[^>]*>/g)].map((m) => m[0])
      expect(sobrepostos.length, arquivo).toBeGreaterThan(0)
      for (const tag of sobrepostos) expect(tag, arquivo).toContain('variant="midia"')
    }
  })

  it("miniatura da biblioteca fica no papel branco", () => {
    expect(ler("biblioteca/card-imagem.tsx")).toMatch(/className="bg-papel relative flex aspect-\[4\/3\]/)
  })
})
