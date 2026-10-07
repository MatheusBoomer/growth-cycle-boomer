import { describe, expect, it } from "vitest"
import { resumoDoSlide } from "./roteiro"

describe("resumo de cada slide do roteiro", () => {
  it("gráfico: título e subtítulo sem asteriscos, conclusões e imagem", () => {
    const r = resumoDoSlide({
      tipo: "grafico",
      titulo: "Cenário Atual",
      subtitulo: "**ROAS** por plataforma",
      imagem: "entrega/ativos-aprovados/graficos/roas.png",
      conclusoes: ["a", "b"],
    })
    expect(r).toEqual({ titulo: "Cenário Atual · ROAS por plataforma", linhas: ["a", "b"], imagens: ["entrega/ativos-aprovados/graficos/roas.png"] })
  })
  it("análises em 2 colunas e cartões viram linhas legíveis", () => {
    expect(resumoDoSlide({ tipo: "analises_2_colunas", esquerda: { titulo: "Sobre **x**", itens: ["1"] }, direita: { titulo: "Sobre y", itens: ["2"] } }).linhas).toEqual([
      "Sobre x: 1",
      "Sobre y: 2",
    ])
    expect(resumoDoSlide({ tipo: "cartoes", titulo: "Desafios", subtitulo: "Como", cartoes: ["A", "B", "C"] }).linhas).toEqual(["A", "B", "C"])
  })
  it("capa, divisória e benchmark", () => {
    expect(resumoDoSlide({ tipo: "capa", prospect: "Marca" }).titulo).toBe("Capa · Marca")
    expect(resumoDoSlide({ tipo: "divisoria", numero: "01.", titulo: "CENÁRIO **ATUAL**" }).titulo).toBe("01. CENÁRIO ATUAL")
    expect(resumoDoSlide({ tipo: "benchmark", titulo: "Benchmarking", subtitulo: "s", concorrente: "X", imagens: ["a.jpg"], conclusoes: ["c"], link: "https://x" }).imagens).toEqual(["a.jpg"])
  })
})
