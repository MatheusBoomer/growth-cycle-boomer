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
  it("o fundo fica só na navegação principal e na ilha da direita, no mesmo vidro", () => {
    expect(ler("navegacao-principal.tsx")).toMatch(/aria-label="Navegação principal" className="[^"]*bg-background\/60[^"]*backdrop-blur-xl/)
    expect(ler("barra-topo.tsx")).toMatch(/data-ilha-topo className="[^"]*bg-background\/60[^"]*backdrop-blur-xl/)
  })
})

describe("faixa pontilhada do topo", () => {
  it("sobe por trás da barra transparente (sem degrau onde a barra termina)", () => {
    expect(ler("faixa-dithered.tsx")).toContain("-top-14")
  })
})
