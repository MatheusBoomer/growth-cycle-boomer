import { describe, expect, it } from "vitest"
import { ErroValidacaoDev, validarEdicao, validarNovo } from "./nucleo.ts"

const valido = {
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa", "AreaDeTrabalho"],
  seletor: "#trilha > div:nth-of-type(2)",
  tag: "div",
  texto: "Diagnóstico",
  caixa: { x: 10, y: 20, largura: 300, altura: 40, larguraTela: 1440, alturaTela: 900 },
  comentario: "  Aumentar o espaço.  ",
}

function erroDe(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error("esperava um erro")
}

describe("validarNovo", () => {
  it("aceita um comentário válido e apara o texto do comentário", () => {
    expect(validarNovo(valido)).toEqual({ ...valido, comentario: "Aumentar o espaço." })
  })

  it("descarta campos extras, como o png", () => {
    expect(validarNovo({ ...valido, png: "abc", outro: 1 })).toEqual({ ...valido, comentario: "Aumentar o espaço." })
  })

  it("aceita componente null e cadeia vazia", () => {
    expect(validarNovo({ ...valido, componente: null, cadeia: [] })).toMatchObject({ componente: null, cadeia: [] })
  })

  it("recusa comentário vazio ou só com espaços", () => {
    expect(() => validarNovo({ ...valido, comentario: "   " })).toThrow("O comentário está vazio.")
  })

  it("aceita exatamente 2000 caracteres e recusa 2001", () => {
    expect(validarNovo({ ...valido, comentario: "a".repeat(2000) }).comentario).toHaveLength(2000)
    expect(() => validarNovo({ ...valido, comentario: "a".repeat(2001) })).toThrow(/2000 caracteres/)
  })

  it("recusa campos fora do formato", () => {
    const ruins = [
      { pagina: "prospects" },
      { pagina: 3 },
      { componente: 3 },
      { cadeia: "PainelEtapa" },
      { cadeia: [1] },
      { cadeia: Array(9).fill("A") },
      { seletor: "" },
      { tag: "" },
      { texto: "a".repeat(301) },
      { caixa: { x: 1 } },
      { caixa: { ...valido.caixa, y: Number.NaN } },
      { comentario: 5 },
    ]
    for (const ruim of ruins) {
      expect(() => validarNovo({ ...valido, ...ruim }), JSON.stringify(ruim)).toThrow(ErroValidacaoDev)
    }
  })

  it("recusa corpo que não é objeto", () => {
    for (const corpo of [null, "x", [], 3]) expect(() => validarNovo(corpo)).toThrow(ErroValidacaoDev)
  })

  it("o erro tem a forma de erro de domínio (400), que lib/http.ts converte sozinho", () => {
    expect(erroDe(() => validarNovo(null))).toMatchObject({ codigo: "entrada_invalida", status: 400 })
  })
})

describe("validarEdicao", () => {
  it("devolve o comentário aparado", () => {
    expect(validarEdicao({ comentario: " Novo texto " })).toBe("Novo texto")
  })

  it("recusa vazio, longo demais e corpo inválido", () => {
    expect(() => validarEdicao({ comentario: "" })).toThrow(ErroValidacaoDev)
    expect(() => validarEdicao({ comentario: "a".repeat(2001) })).toThrow(ErroValidacaoDev)
    expect(() => validarEdicao(null)).toThrow(ErroValidacaoDev)
  })
})
