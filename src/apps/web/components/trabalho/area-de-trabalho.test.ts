import { describe, expect, it } from "vitest"
import { etapaVazia } from "@workspace/core/maquina-estados"
import { ORDEM_ETAPAS, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { escolherEtapaInicial } from "./area-de-trabalho"

function estadoCom(status: Partial<Record<(typeof ORDEM_ETAPAS)[number], StatusEtapa>>): Estado {
  const etapas = {} as Estado["etapas"]
  for (const id of ORDEM_ETAPAS) etapas[id] = etapaVazia(status[id] ?? "bloqueada")
  return { etapas } as Estado
}

const TUDO_CONCLUIDO_MENOS_A_10 = { "01": "concluida", "02": "concluida", "03": "concluida", "04": "concluida", "05": "concluida", "06": "concluida", "07": "concluida", "08": "concluida", final: "concluida" } as const

describe("escolherEtapaInicial", () => {
  it("cai na etapa 10 quando tudo está concluído menos ela", () => {
    expect(escolherEtapaInicial(estadoCom({ ...TUDO_CONCLUIDO_MENOS_A_10, "10": "liberada" }))).toBe("10")
  })

  it("prospect todo concluído abre na última etapa, a 10", () => {
    expect(escolherEtapaInicial(estadoCom({ ...TUDO_CONCLUIDO_MENOS_A_10, "10": "concluida" }))).toBe("10")
  })

  it("etapa em andamento ainda vence a liberada", () => {
    expect(escolherEtapaInicial(estadoCom({ "01": "concluida", "02": "em_andamento", "03": "liberada" }))).toBe("02")
  })
})
