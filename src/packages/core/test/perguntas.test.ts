import { describe, expect, it } from "vitest"
import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"
import { criarConjunto, encontrarConjunto, lerPerguntas, responderConjunto } from "../src/perguntas"

const em = "2026-10-07T10:00:00.000Z"
const base = () => estadoInicial({ slug: "p", nome: "P", site: null }, em)
const entrada = [
  { enunciado: " Qual cenário usar como meta? ", multipla: false, opcoes: [{ rotulo: "Pessimista" }, { rotulo: " Realista " }, { rotulo: "Otimista" }] },
  { enunciado: "Quais canais priorizar?", descricao: "Pode marcar mais de um", multipla: true, opcoes: [{ rotulo: "Meta Ads" }, { rotulo: "Google Ads" }] },
]

describe("lerPerguntas", () => {
  it("normaliza textos, descrição ausente vira null e multipla só é true quando true", () => {
    const [p1, p2] = lerPerguntas([...entrada.slice(0, 1).map((p) => ({ ...p, multipla: "sim" })), entrada[1]])
    expect(p1).toEqual({
      enunciado: "Qual cenário usar como meta?",
      descricao: null,
      multipla: false,
      opcoes: [
        { rotulo: "Pessimista", descricao: null },
        { rotulo: "Realista", descricao: null },
        { rotulo: "Otimista", descricao: null },
      ],
    })
    expect(p2?.descricao).toBe("Pode marcar mais de um")
    expect(p2?.multipla).toBe(true)
  })

  it.each([
    ["nenhuma pergunta", []],
    ["mais de 10 perguntas", Array(11).fill(entrada[1])],
    ["não é lista", "x"],
    ["uma opção só", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "a" }] }]],
    ["7 opções", [{ enunciado: "A?", multipla: false, opcoes: Array.from({ length: 7 }, (_, i) => ({ rotulo: `o${i}` })) }]],
    ["enunciado vazio", [{ enunciado: "  ", multipla: false, opcoes: [{ rotulo: "a" }, { rotulo: "b" }] }]],
    ["rótulo vazio", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "a" }, { rotulo: " " }] }]],
    ["rótulo repetido (caixa e espaços)", [{ enunciado: "A?", multipla: false, opcoes: [{ rotulo: "Meta Ads" }, { rotulo: " meta ads " }] }]],
  ])("recusa %s", (_, valor) => {
    expect(() => lerPerguntas(valor)).toThrow(ErroEntrada)
  })
})

describe("criarConjunto e responderConjunto", () => {
  it("cria pendente e marca como sem_resposta só os pendentes da mesma etapa", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = criarConjunto(e, "04", lerPerguntas(entrada), "b", em)
    e = criarConjunto(e, "03", lerPerguntas(entrada), "c", em)
    expect(e.perguntas.map((c) => [c.id, c.status])).toEqual([
      ["a", "sem_resposta"],
      ["b", "pendente"],
      ["c", "pendente"],
    ])
  })

  it("grava as respostas normalizadas e recusa responder de novo", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = responderConjunto(
      e,
      "a",
      [
        { selecionadas: ["Realista"], outra: "  " },
        { selecionadas: ["Meta Ads", "Google Ads", "Meta Ads"], outra: " testar TikTok " },
      ],
      "2026-10-07T11:00:00.000Z",
    )
    const c = encontrarConjunto(e, "a")
    expect(c.status).toBe("respondida")
    expect(c.respondidoEm).toBe("2026-10-07T11:00:00.000Z")
    expect(c.respostas).toEqual([
      { selecionadas: ["Realista"], outra: null },
      { selecionadas: ["Meta Ads", "Google Ads"], outra: "testar TikTok" },
    ])
    expect(() => responderConjunto(e, "a", c.respostas, em)).toThrow(TransicaoInvalida)
  })

  it("recusa responder conjunto substituído ou inexistente", () => {
    let e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    e = criarConjunto(e, "03", lerPerguntas(entrada), "b", em)
    const ok = [{ selecionadas: ["Realista"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]
    expect(() => responderConjunto(e, "a", ok, em)).toThrow(TransicaoInvalida)
    expect(() => responderConjunto(e, "zzz", ok, em)).toThrow(ErroNaoEncontrado)
  })

  it.each([
    ["faltando uma resposta", [{ selecionadas: ["Realista"], outra: null }]],
    ["pergunta sem nada marcado", [{ selecionadas: [], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["opção que não existe", [{ selecionadas: ["Neutro"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["duas opções em escolha única", [{ selecionadas: ["Realista", "Otimista"], outra: null }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["opção e Outra em escolha única", [{ selecionadas: ["Realista"], outra: "meio termo" }, { selecionadas: ["Meta Ads"], outra: null }]],
    ["não é lista", { a: 1 }],
  ])("recusa resposta com %s", (_, respostas) => {
    const e = criarConjunto(base(), "03", lerPerguntas(entrada), "a", em)
    expect(() => responderConjunto(e, "a", respostas, em)).toThrow(ErroEntrada)
  })
})

describe("perguntas abertas (etapa 02: perguntas estratégicas)", () => {
  const abertas = Array.from({ length: 10 }, (_, i) => ({ enunciado: `Pergunta ${i + 1}?`, multipla: false }))

  it("aceita até 10 perguntas sem opções (resposta livre)", () => {
    const ps = lerPerguntas(abertas)
    expect(ps).toHaveLength(10)
    expect(ps[0]?.opcoes).toEqual([])
  })

  it("pergunta aberta exige resposta escrita e não aceita opção marcada", () => {
    const e = criarConjunto(base(), "02", lerPerguntas(abertas.slice(0, 2)), "q1", em)
    expect(() => responderConjunto(e, "q1", [{ selecionadas: [], outra: "a" }, { selecionadas: [], outra: " " }], em)).toThrow(/Responda a pergunta 2/)
    expect(() => responderConjunto(e, "q1", [{ selecionadas: ["x"], outra: "a" }, { selecionadas: [], outra: "b" }], em)).toThrow(ErroEntrada)
    const ok = responderConjunto(e, "q1", [{ selecionadas: [], outra: "Margem de 60%" }, { selecionadas: [], outra: "O sócio" }], em)
    expect(encontrarConjunto(ok, "q1").respostas?.[0]).toEqual({ selecionadas: [], outra: "Margem de 60%" })
  })
})
