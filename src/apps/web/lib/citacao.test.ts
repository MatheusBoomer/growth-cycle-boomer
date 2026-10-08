import { describe, expect, it } from "vitest"
import { citacao, primeiroParagrafo, separadorAntes } from "./citacao"

describe("citação de resposta do agente", () => {
  it("cita cada linha e deixa uma linha em branco para a resposta", () => {
    expect(citacao("  ROAS caiu 12%.\nCPA subiu.\n\nVer abril.  ")).toBe("> ROAS caiu 12%.\n> CPA subiu.\n>\n> Ver abril.\n\n")
  })

  it("primeiro parágrafo do markdown", () => {
    expect(primeiroParagrafo("\n\nPrimeiro\ncontinua.\n\nSegundo")).toBe("Primeiro\ncontinua.")
    expect(primeiroParagrafo("único")).toBe("único")
  })

  it("separador: citação começa em linha própria; menção só precisa de espaço", () => {
    expect(separadorAntes("", "> a\n\n")).toBe("")
    expect(separadorAntes("texto", "> a\n\n")).toBe("\n\n")
    expect(separadorAntes("texto\n", "> a\n\n")).toBe("\n")
    expect(separadorAntes("texto\n\n", "> a\n\n")).toBe("")
    expect(separadorAntes("texto", "@a.png ")).toBe(" ")
    expect(separadorAntes("texto ", "@a.png ")).toBe("")
  })
})
