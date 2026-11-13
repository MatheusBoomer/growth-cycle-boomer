import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("administração na linguagem nova", () => {
  it("selo de modelo é pílula", () => expect(ler("selo-modelo.tsx")).toMatch(/inline-flex[^"]*rounded-full/))
  it("régua de esforço acende em laranja", () => expect(ler("barra-esforco.tsx")).toContain('i < acesos ? "bg-primary"'))
  it("título da etapa no card de modelos em serifada", () => expect(ler("cartao-etapa-modelos.tsx")).toMatch(/<h3 className="[^"]*font-serif/))
  it("título do item de skill em serifada", () => expect(ler("catalogo-skills.tsx")).toMatch(/<h2 className="[^"]*font-serif[^"]*">\{detalhe\.titulo\}/))
  it("contagem de notas abertas como pílula laranja em mono", () => expect(ler("catalogo-skills.tsx")).toMatch(/bg-aviso-fundo text-link-acao shrink-0 rounded-full[^"]*font-mono/))

  it("a frase da aba fica só no cabeçalho, sem repetir dentro do conteúdo", () => {
    expect(ler("catalogo-skills.tsx")).not.toContain("Fluxo e texto de cada etapa")
    expect(ler("tabela-modelos.tsx")).not.toContain("Vale a partir do próximo turno de cada etapa")
  })

  it("detalhe do projeto: nome em serifada e números grandes em serifada", () => {
    const d = ler("detalhe-projeto.tsx")
    expect(d).toMatch(/<h2 className="[^"]*font-serif[^"]*">\{projeto\.nome\}/)
    expect(d).toMatch(/<dd className="[^"]*font-serif/)
  })
  it("card de modelos: 'Etapa NN' pequeno acima do nome da etapa", () => expect(ler("cartao-etapa-modelos.tsx")).toMatch(/partesDoRotulo\(etapa\.rotulo\)/))
  it("cabeçalho do admin não corta letras ao quebrar (entrelinha 1.05)", () => expect(ler("cabecalho-admin.tsx")).toMatch(/<h1 className="[^"]*leading-\[1\.05\]/))
  it("detalhe do report: só o número em serifada, o selo do tipo fica na fonte normal", () => {
    const d = ler("reports/detalhe-report.tsx")
    expect(d).not.toMatch(/<SheetTitle className="[^"]*font-serif/)
    expect(d).toMatch(/<span className="font-serif[^"]*">Report #\{report\.id\}<\/span>/)
  })
})
