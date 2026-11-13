import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("barra do topo", () => {
  it("é transparente: sem fundo nem desfoque na barra inteira, e não gruda (o conteúdo não passa por baixo do logo)", () => {
    const header = /<header className="([^"]+)"/.exec(ler("barra-topo.tsx"))![1]!
    expect(header).not.toMatch(/\bbg-/)
    expect(header).not.toContain("backdrop-blur")
    expect(header).not.toContain("sticky")
  })
  it("o fundo fica só na navegação principal e nos controles da direita", () => {
    expect(ler("navegacao-principal.tsx")).toMatch(/aria-label="Navegação principal" className="[^"]*bg-background\/60[^"]*backdrop-blur-xl/)
    const barra = ler("barra-topo.tsx")
    expect(barra).toContain("[&_[data-slot=button]:not([data-reportar])]:bg-background/60")
    expect(ler("relogio.tsx")).toContain("bg-background/60")
  })
})

describe("faixa pontilhada do topo", () => {
  it("sobe por trás da barra transparente (sem degrau onde a barra termina)", () => {
    expect(ler("faixa-dithered.tsx")).toContain("-top-14")
  })
})
