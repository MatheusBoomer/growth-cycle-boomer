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
})
