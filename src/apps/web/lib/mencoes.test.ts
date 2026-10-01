import { describe, expect, it } from "vitest"
import { consultaDeMencao, extrairMencoes, semRodape, textoParaAgente } from "./mencoes"

describe("menções de arquivo no chat", () => {
  it("extrai os caminhos mencionados, sem repetir", () => {
    expect(extrairMencoes("muda a cor do @entrega/ativos-aprovados/graficos/roas.png e do @dados/x.xlsx, e de novo @dados/x.xlsx")).toEqual([
      "entrega/ativos-aprovados/graficos/roas.png",
      "dados/x.xlsx",
    ])
    expect(extrairMencoes("escreve pro email@exemplo.com sem arquivo")).toEqual([])
  })

  it("acrescenta para o agente o caminho completo a partir da raiz do projeto", () => {
    const t = textoParaAgente("troca o título do @entrega/ativos-aprovados/graficos/roas.png", "sottile-teste")
    expect(t).toContain("troca o título do @entrega/ativos-aprovados/graficos/roas.png")
    expect(t).toContain("[Arquivos mencionados]")
    expect(t).toContain("- clientes/sottile-teste/entrega/ativos-aprovados/graficos/roas.png")
    expect(textoParaAgente("sem menção", "x")).toBe("sem menção")
  })

  it("o rodapé some na hora de mostrar a mensagem no chat", () => {
    const t = textoParaAgente("olha o @dados/x.xlsx", "p")
    expect(semRodape(t)).toBe("olha o @dados/x.xlsx")
    expect(semRodape("texto normal")).toBe("texto normal")
  })

  it("detecta o @ que está sendo digitado no cursor", () => {
    expect(consultaDeMencao("olha o @gra", 11)).toEqual({ inicio: 7, termo: "gra" })
    expect(consultaDeMencao("@", 1)).toEqual({ inicio: 0, termo: "" })
    expect(consultaDeMencao("email@x", 7)).toBeNull()
    expect(consultaDeMencao("olha o @dados/x.xlsx feito", 26)).toBeNull()
  })
})

describe("etiquetas de menção na mensagem", () => {
  it("separa texto e menções", async () => {
    const { partesComMencoes } = await import("./mencoes")
    expect(partesComMencoes("muda @dados/x.xlsx agora")).toEqual([
      { tipo: "texto", valor: "muda " },
      { tipo: "mencao", caminho: "dados/x.xlsx" },
      { tipo: "texto", valor: " agora" },
    ])
    expect(partesComMencoes("sem nada")).toEqual([{ tipo: "texto", valor: "sem nada" }])
  })
})
