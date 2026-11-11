import { describe, expect, it } from "vitest"
import { compararRoteiros, resumoDoSlide, type SlideRoteiro } from "./roteiro"

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

describe("desafio no resumo", () => {
  it("traz problema, hipóteses, soluções e impacto", () => {
    const r = resumoDoSlide({ tipo: "desafio", titulo: "Funil: **quebra**", problema: "p", hipoteses: ["h1", "h2"], solucoes: ["s1"], impacto: "i" })
    expect(r.linhas).toEqual(["Problema: p", "Hipótese: h1", "Hipótese: h2", "Solução: s1", "Impacto: i"])
  })
})

const g = (titulo: string, conclusoes: string[] = ["a"], imagem = `${titulo}.png`): SlideRoteiro => ({ tipo: "grafico", titulo, imagem, conclusoes })
const estados = (r: ReturnType<typeof compararRoteiros>) => r.slides.map((s) => s.status)

describe("comparar roteiros", () => {
  it("roteiro igual: nada mudou", () => {
    const r = compararRoteiros([g("A"), g("B")], [g("A"), g("B")])
    expect(estados(r)).toEqual(["igual", "igual"])
    expect(r.resumo).toEqual({ alterados: 0, novos: 0, removidos: 0, movidos: 0 })
  })
  it("texto alterado mostra o que saiu e o que entrou", () => {
    const r = compararRoteiros([g("A", ["velha", "fica"])], [g("A", ["nova", "fica"])])
    expect(r.slides[0]).toMatchObject({ status: "alterado", numero: 1 })
    expect(r.slides[0]!.diferencas).toEqual([{ rotulo: "Texto", removidos: ["velha"], adicionados: ["nova"] }])
  })
  it("imagem trocada conta como alteração", () => {
    const r = compararRoteiros([g("A", ["a"], "x.png")], [g("A", ["a"], "y.png")])
    expect(r.slides[0]!.status).toBe("alterado")
    expect(r.slides[0]!.diferencas[0]).toMatchObject({ rotulo: "Imagem", removidos: ["x.png"], adicionados: ["y.png"] })
  })
  it("pendência e fonte também contam", () => {
    expect(compararRoteiros([g("A")], [{ ...g("A"), pendencia: "falta" }]).slides[0]!.status).toBe("alterado")
    expect(compararRoteiros([g("A")], [{ ...g("A"), fonte: "03" }]).slides[0]!.diferencas[0]!.rotulo).toBe("Fonte")
  })
  it("slide novo no meio não faz os seguintes virarem movidos", () => {
    const r = compararRoteiros([g("A"), g("B"), g("C")], [g("A"), g("X"), g("B"), g("C")])
    expect(estados(r)).toEqual(["igual", "novo", "igual", "igual"])
    expect(r.resumo).toEqual({ alterados: 0, novos: 1, removidos: 0, movidos: 0 })
  })
  it("slide removido aparece com a posição de antes e depois de qual slide novo ele ficava", () => {
    const r = compararRoteiros([g("A"), g("B"), g("C")], [g("A"), g("C")])
    expect(estados(r)).toEqual(["igual", "igual"])
    expect(r.removidos).toEqual([{ slide: g("B"), numeroAnterior: 2, depoisDoNumero: 1 }])
    expect(r.resumo.removidos).toBe(1)
  })
  it("slide que só mudou de lugar é movido", () => {
    const r = compararRoteiros([g("A"), g("B"), g("C"), g("D")], [g("A"), g("C"), g("D"), g("B")])
    expect(estados(r)).toEqual(["igual", "igual", "igual", "movido"])
  })
  it("título editado na mesma posição é alterado, não novo + removido", () => {
    const r = compararRoteiros([g("A", ["a"], "1.png"), g("B", ["b"], "2.png")], [g("A", ["a"], "1.png"), g("B2", ["b"], "2.png")])
    expect(estados(r)).toEqual(["igual", "alterado"])
    expect(r.slides[1]!.diferencas[0]).toMatchObject({ rotulo: "Título", removidos: ["B"], adicionados: ["B2"] })
    expect(r.removidos).toEqual([])
  })
  it("slides repetidos (mesmo título) casam em ordem", () => {
    const r = compararRoteiros([{ tipo: "obrigado" }, g("A"), { tipo: "obrigado" }], [{ tipo: "obrigado" }, g("A"), { tipo: "obrigado" }])
    expect(estados(r)).toEqual(["igual", "igual", "igual"])
  })
  it("campo não exibido que mudou ainda é alteração", () => {
    const r = compararRoteiros([{ ...g("A"), problema_id: "P1" }], [{ ...g("A"), problema_id: "P2" }])
    expect(r.slides[0]!.status).toBe("alterado")
    expect(r.slides[0]!.diferencas[0]!.rotulo).toBe("Outros campos")
  })
})
