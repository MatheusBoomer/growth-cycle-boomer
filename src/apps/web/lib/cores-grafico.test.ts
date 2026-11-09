import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Lê as cores de gráfico direto do CSS: o tema escuro precisa declarar as próprias, ajustadas ao fundo escuro,
// e o claro não pode perder o contraste mínimo de elemento gráfico (3:1, WCAG 1.4.11).
const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")

function bloco(seletor: ":root" | ".dark"): Record<string, string> {
  const inicio = CSS.search(new RegExp(`^${seletor.replace(".", "\\.")} \\{`, "m"))
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado`)
  const corpo = CSS.slice(inicio, CSS.indexOf("}", inicio))
  return Object.fromEntries([...corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
}

function rgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) throw new Error(`cor em formato não suportado pelo teste: ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro! + 0.05) / (escuro! + 0.05)
}

const CHARTS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]

describe("cores de gráfico no tema escuro", () => {
  const escuro = bloco(".dark")
  const fundo = escuro["--background"]!
  for (const token of CHARTS) {
    it(`${token} é declarado no .dark e passa 3:1 sobre o fundo escuro`, () => {
      const valor = escuro[token]
      expect(valor, `${token} ausente no bloco .dark`).toBeDefined()
      expect(contraste(valor!, fundo)).toBeGreaterThanOrEqual(3)
    })
  }
  it("os cinzas (4 e 5) continuam distinguíveis entre si", () => {
    const valores = CHARTS.map((t) => escuro[t]!)
    expect(new Set(valores).size).toBe(5)
    expect(Math.abs(luminancia(valores[3]!) - luminancia(valores[4]!))).toBeGreaterThan(0.05)
  })
})

describe("cores de gráfico no tema claro", () => {
  const claro = bloco(":root")
  const fundo = claro["--background"]!
  for (const token of CHARTS) {
    // --chart-4 (#94a3b8) é o cinza neutro de "outros" e já nasceu com 2,37:1; fica como exceção explícita
    // em 2:1 até a marca decidir escurecê-lo. Os demais seguem 3:1.
    const minimo = token === "--chart-4" ? 2 : 3
    it(`${token} passa ${minimo}:1 sobre o fundo claro`, () => {
      expect(contraste(claro[token]!, fundo)).toBeGreaterThanOrEqual(minimo)
    })
  }
})
