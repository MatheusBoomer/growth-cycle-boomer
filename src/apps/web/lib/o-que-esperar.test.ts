import { describe, expect, it } from "vitest"
import { passosDoQueEsperar } from "./o-que-esperar"

describe("passosDoQueEsperar", () => {
  it("vira um passo por frase", () => {
    expect(passosDoQueEsperar("O agente lê o kickoff (e os materiais). Você confere. A etapa só avança depois da sua aprovação.")).toEqual([
      "O agente lê o kickoff (e os materiais).",
      "Você confere.",
      "A etapa só avança depois da sua aprovação.",
    ])
  })
  it("não quebra em abreviação seguida de minúscula nem em número", () => {
    expect(passosDoQueEsperar("Calcula o ROAS ex. por canal em 1.5 vezes.")).toEqual(["Calcula o ROAS ex. por canal em 1.5 vezes."])
  })
  it("texto vazio não dá passo", () => expect(passosDoQueEsperar("  ")).toEqual([]))
})
