import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Fontes do redesign: Geist na interface, Geist Mono nos números técnicos, Instrument Serif só nos destaques.
const layout = readFileSync(path.resolve(import.meta.dirname, "../app/layout.tsx"), "utf-8")
const css = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")

describe("tipografia do redesign", () => {
  it("layout carrega Geist, Geist Mono e Instrument Serif, e não a Inter", () => {
    expect(layout).toMatch(/import \{[^}]*\bGeist\b[^}]*\} from "next\/font\/google"/)
    expect(layout).toMatch(/\bGeist_Mono\b/)
    expect(layout).toMatch(/\bInstrument_Serif\b/)
    expect(layout).not.toMatch(/\bInter\b/)
  })

  it("Instrument Serif vem com normal e itálico, peso 400, na variável --font-serif", () => {
    expect(layout).toMatch(/Instrument_Serif\(\{[^)]*weight: "400"/)
    expect(layout).toMatch(/style: \["normal", "italic"\]/)
    expect(layout).toMatch(/variable: "--font-serif"/)
  })

  it("o tema do Tailwind expõe font-serif", () => expect(css).toMatch(/--font-serif:\s*var\(--font-serif\)/))
})
