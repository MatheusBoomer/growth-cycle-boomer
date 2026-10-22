import { describe, expect, it } from "vitest"
import type { ConjuntoPerguntas } from "@workspace/core/tipos"
import { linhasDoHistorico } from "./historico-perguntas"

const base: ConjuntoPerguntas = {
  id: "c1",
  etapa: "03",
  status: "respondida",
  criadoEm: "2026-09-28T10:00:00.000Z",
  respondidoEm: "2026-09-28T10:05:00.000Z",
  perguntas: [
    { enunciado: "Qual cenário usar?", descricao: null, multipla: false, opcoes: [{ rotulo: "Realista", descricao: null }] },
    { enunciado: "Quais canais?", descricao: null, multipla: true, opcoes: [{ rotulo: "Meta Ads", descricao: null }] },
  ],
  respostas: [
    { selecionadas: ["Realista"], outra: null },
    { selecionadas: ["Meta Ads"], outra: "testar TikTok" },
  ],
}

describe("linhasDoHistorico", () => {
  it("junta as opções marcadas e a resposta escrita", () => {
    expect(linhasDoHistorico(base)).toEqual([
      { enunciado: "Qual cenário usar?", resposta: "Realista" },
      { enunciado: "Quais canais?", resposta: "Meta Ads; testar TikTok" },
    ])
  })

  it("conjunto que ficou pendente ou foi substituído aparece como sem resposta", () => {
    for (const status of ["pendente", "sem_resposta"] as const) {
      const linhas = linhasDoHistorico({ ...base, status, respostas: null, respondidoEm: null })
      expect(linhas.map((l) => l.resposta)).toEqual(["sem resposta", "sem resposta"])
    }
  })

  it("pergunta respondida em branco aparece como sem resposta", () => {
    const linhas = linhasDoHistorico({ ...base, respostas: [{ selecionadas: [], outra: null }, base.respostas![1]!] })
    expect(linhas[0]!.resposta).toBe("sem resposta")
  })
})
