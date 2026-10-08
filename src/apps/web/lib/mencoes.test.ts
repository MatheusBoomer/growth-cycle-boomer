import { describe, expect, it } from "vitest"
import { caminhoNoProspect, consultaDeMencao, extrairAnexos, extrairMencoes, nomeDoAnexo, semRodape, textoParaAgente } from "./mencoes"

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

describe("anexos na mensagem", () => {
  const anexo = "clientes/p/.app/anexos/1728300000000-historico mensal.xlsx"

  it("acrescenta o rodapé [Anexos] depois do de menções e some na hora de mostrar", () => {
    const t = textoParaAgente("olha o @dados/x.xlsx", "p", [anexo, "clientes/p/.app/anexos/2-print.png"])
    expect(t).toBe(
      "olha o @dados/x.xlsx\n\n[Arquivos mencionados]\n- clientes/p/dados/x.xlsx\n\n[Anexos]\n- clientes/p/.app/anexos/1728300000000-historico mensal.xlsx\n- clientes/p/.app/anexos/2-print.png",
    )
    expect(semRodape(t)).toBe("olha o @dados/x.xlsx")
    expect(extrairAnexos(t)).toEqual([anexo, "clientes/p/.app/anexos/2-print.png"])
  })

  it("mensagem só com anexo", () => {
    const t = textoParaAgente("", "p", [anexo])
    expect(t).toBe(`\n\n[Anexos]\n- ${anexo}`)
    expect(semRodape(t)).toBe("")
    expect(extrairAnexos(t)).toEqual([anexo])
  })

  it("mensagem só com anexo depois do trim (como a rota salva) também some e vira etiqueta", () => {
    const t = textoParaAgente("", "p", [anexo]).trim()
    expect(t).toBe(`[Anexos]\n- ${anexo}`)
    expect(semRodape(t)).toBe("")
    expect(extrairAnexos(t)).toEqual([anexo])
  })

  it("sem anexos não muda nada e texto com [Anexos] no meio da linha não é cortado", () => {
    expect(textoParaAgente("oi", "p", [])).toBe("oi")
    expect(extrairAnexos("oi")).toEqual([])
    const literal = "veja a seção [Anexos] do relatório"
    expect(semRodape(literal)).toBe(literal)
    expect(extrairAnexos(literal)).toEqual([])
  })

  it("nome e caminho do anexo para mostrar e abrir", () => {
    expect(nomeDoAnexo(anexo)).toBe("historico mensal.xlsx")
    expect(nomeDoAnexo("clientes/p/dados/x.xlsx")).toBe("x.xlsx")
    expect(caminhoNoProspect(anexo, "p")).toBe(".app/anexos/1728300000000-historico mensal.xlsx")
    expect(caminhoNoProspect("dados/x.xlsx", "p")).toBe("dados/x.xlsx")
  })
})
