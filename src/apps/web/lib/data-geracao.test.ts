import { describe, expect, it } from "vitest"
import { dataDeGeracao } from "./data-geracao"

describe("dataDeGeracao", () => {
  it("formata dia, mes e hora no fuso informado", () => {
    expect(dataDeGeracao("2026-11-16T17:32:00.000Z", "America/Sao_Paulo")).toBe("16/11 às 14:32")
    expect(dataDeGeracao("2026-11-16T17:32:00.000Z", "UTC")).toBe("16/11 às 17:32")
  })

  it("meia-noite usa 00, nao 24", () => {
    expect(dataDeGeracao("2026-11-16T03:05:00.000Z", "America/Sao_Paulo")).toBe("16/11 às 00:05")
  })

  it("data invalida volta vazia, sem lancar", () => {
    expect(dataDeGeracao("nao-e-data")).toBe("")
    expect(dataDeGeracao("")).toBe("")
  })

  it("fuso invalido volta vazio, sem lancar", () => {
    expect(dataDeGeracao("2026-11-16T17:32:00.000Z", "Marte/Olympus")).toBe("")
  })
})
