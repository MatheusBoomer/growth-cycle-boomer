import { describe, expect, it } from "vitest"
import { type ComentarioDev, ErroValidacaoDev, interpretarArgumentos, resumoEmTexto } from "./nucleo.ts"

const base: ComentarioDev = {
  id: "a",
  numero: 1,
  criadoEm: "2026-10-13T12:00:00.000Z",
  editadoEm: null,
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa", "AreaDeTrabalho"],
  seletor: "#trilha > div:nth-of-type(2)",
  tag: "div",
  texto: "Diagnóstico",
  caixa: { x: 10, y: 20, largura: 300, altura: 40, larguraTela: 1440, alturaTela: 900 },
  captura: "capturas/a.png",
  comentario: "Aumentar o espaço.",
}

describe("resumoEmTexto", () => {
  it("lista vazia", () => {
    expect(resumoEmTexto([], "/repo/.dev-comentarios")).toBe("Nenhum comentário aberto.")
  })

  it("agrupa por página, ordena por número e mostra o caminho absoluto do recorte", () => {
    const comentarios: ComentarioDev[] = [
      { ...base, id: "c", numero: 3, pagina: "/", componente: "GradeProspects", cadeia: ["GradeProspects"], texto: "", captura: null, comentario: "Linha 1\nLinha 2" },
      base,
      { ...base, id: "b", numero: 2, componente: null, cadeia: [], captura: null },
    ]
    expect(resumoEmTexto(comentarios, "/repo/.dev-comentarios")).toBe(
      [
        "3 comentários abertos em /repo/.dev-comentarios",
        "",
        "## /prospects/acme",
        "#1 · PainelEtapa ← AreaDeTrabalho",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        '   texto: "Diagnóstico"',
        "   recorte: /repo/.dev-comentarios/capturas/a.png",
        "   pedido: Aumentar o espaço.",
        "#2 · (componente não identificado)",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        '   texto: "Diagnóstico"',
        "   recorte: (sem recorte)",
        "   pedido: Aumentar o espaço.",
        "",
        "## /",
        "#3 · GradeProspects",
        "   elemento: <div> 300×40, tela 1440×900",
        "   seletor: #trilha > div:nth-of-type(2)",
        "   recorte: (sem recorte)",
        "   pedido: Linha 1",
        "           Linha 2",
      ].join("\n"),
    )
  })

  it("usa o singular com um comentário", () => {
    expect(resumoEmTexto([base], "/p").split("\n")[0]).toBe("1 comentário aberto em /p")
  })
})

describe("interpretarArgumentos", () => {
  it("sem argumentos lista", () => {
    expect(interpretarArgumentos([])).toEqual({ acao: "listar" })
  })

  it("--limpar sozinho apaga tudo", () => {
    expect(interpretarArgumentos(["--limpar"])).toEqual({ acao: "limpar", numeros: null })
  })

  it("--limpar com números, com ou sem espaço depois da vírgula, sem repetidos", () => {
    expect(interpretarArgumentos(["--limpar", "3,5"])).toEqual({ acao: "limpar", numeros: [3, 5] })
    expect(interpretarArgumentos(["--limpar", "3,", "5", "3"])).toEqual({ acao: "limpar", numeros: [3, 5] })
  })

  it("recusa números inválidos e argumentos desconhecidos", () => {
    expect(() => interpretarArgumentos(["--limpar", "3,x"])).toThrow(ErroValidacaoDev)
    expect(() => interpretarArgumentos(["--limpar", "0"])).toThrow(ErroValidacaoDev)
    expect(() => interpretarArgumentos(["--apagar"])).toThrow(ErroValidacaoDev)
  })
})
