import { describe, expect, it } from "vitest"
import { formatarDescricao } from "./descricao-pergunta"

describe("formatarDescricao", () => {
  it("mantém o texto que já tem quebras de linha", () => {
    expect(formatarDescricao("- P1 Conversão\n- P2 Mensuração")).toBe("- P1 Conversão\n- P2 Mensuração")
  })

  it("separa em linhas os itens P1, P2… que vieram corridos num parágrafo só", () => {
    expect(formatarDescricao("P1 Conversão do site 0,35%. P2 Mensuração falha (agrupa 3 achados). P3 Quebra de 15,9%.")).toBe(
      "P1 Conversão do site 0,35%.\nP2 Mensuração falha (agrupa 3 achados).\nP3 Quebra de 15,9%.",
    )
  })

  it("não mexe em texto comum nem em um item só", () => {
    expect(formatarDescricao("Pode marcar mais de um")).toBe("Pode marcar mais de um")
    expect(formatarDescricao("Veja o P1 do relatório")).toBe("Veja o P1 do relatório")
  })
})
