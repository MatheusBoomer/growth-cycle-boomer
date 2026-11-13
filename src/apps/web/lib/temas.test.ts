import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Fixa a identidade dos dois temas do redesign (escuro quase preto e claro pérola) direto no CSS.
const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")

function bloco(seletor: ":root" | ".dark"): Record<string, string> {
  const inicio = CSS.search(new RegExp(`^${seletor.replace(".", "\\.")} \\{`, "m"))
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado`)
  const corpo = CSS.slice(inicio, CSS.indexOf("}", inicio))
  return Object.fromEntries([...corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
}

describe("temas do redesign", () => {
  it("o claro é o pérola", () => expect(bloco(":root")["--background"]).toBe("#f7f6f3"))

  it("o escuro é quase preto neutro", () => expect(bloco(".dark")["--background"]).toBe("#0a0a0b"))

  it("os dois temas declaram o brilho de fundo", () => {
    expect(bloco(":root")["--brilho"]).toBe("rgb(235 97 10 / 0.1)")
    expect(bloco(".dark")["--brilho"]).toBe("rgb(235 97 10 / 0.12)")
  })

  it("os tokens do fundo ASCII saíram", () => expect(CSS).not.toMatch(/--orb-|--pontos/))

  it("o fundo da página é o brilho quente, preso à janela", () => {
    const body = /body\s*\{[^}]*\}/.exec(CSS)![0]
    expect(body).toMatch(/radial-gradient\([^)]*var\(--brilho\)/)
    expect(body).toMatch(/background-attachment:\s*fixed/)
  })

  it("o layout não monta mais o fundo ASCII", () => {
    const layout = readFileSync(path.resolve(import.meta.dirname, "../app/layout.tsx"), "utf-8")
    expect(layout).not.toMatch(/FundoOndasAscii/)
  })
})
