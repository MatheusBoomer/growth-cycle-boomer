import { describe, expect, it } from "vitest"
import { insumoDoCatalogo } from "../src/catalogo"
import { destinoInsumo, extensaoAceita, nomeSeguro } from "../src/insumos"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("insumos", () => {
  it("monta o destino com a extensão do arquivo enviado", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "historico-mensal"), "Planilha Final.XLSX")).toBe(
      "dados/historico-mensal.xlsx",
    )
    expect(destinoInsumo(insumoDoCatalogo(cat, "kickoff-transcricao"), "reuniao.pdf")).toBe(
      "contexto/brutos/kickoff-transcricao-bruta.pdf",
    )
  })

  it("mantém o nome original (seguro) quando o destino é pasta", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "prints-campanhas"), "Campanha Março (1).png")).toBe(
      "contexto/brutos/prints-campanhas/Campanha_Marco_1_.png",
    )
  })

  it("aceita só os formatos do catálogo", () => {
    const ins = insumoDoCatalogo(cat, "historico-mensal")
    expect(extensaoAceita(ins, "a.xlsx")).toBe(true)
    expect(extensaoAceita(ins, "a.csv")).toBe(false)
    expect(extensaoAceita(ins, "sem-extensao")).toBe(false)
  })

  it("nomeSeguro remove diretórios", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd")
  })
})
