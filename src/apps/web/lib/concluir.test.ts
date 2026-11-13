import { describe, expect, it } from "vitest"
import { estadoDoConcluir } from "./concluir"

const SINAL = "O agente ainda não sinalizou que a etapa está completa"

describe("estadoDoConcluir", () => {
  it("sem nada faltando e sem turno ativo: pronto", () =>
    expect(estadoDoConcluir({ condicoes: [], sinalizada: true, turnoAtivoAqui: false })).toBe("pronto"))

  it("só falta a sinalização do agente: esperando-agente", () =>
    expect(estadoDoConcluir({ condicoes: [SINAL], sinalizada: false, turnoAtivoAqui: false })).toBe("esperando-agente"))

  it("falta aprovar ou enviar algo: oculto", () => {
    expect(estadoDoConcluir({ condicoes: ["Aprovar: Gráfico"], sinalizada: true, turnoAtivoAqui: false })).toBe("oculto")
    expect(estadoDoConcluir({ condicoes: ["Aprovar: Gráfico", SINAL], sinalizada: false, turnoAtivoAqui: false })).toBe("oculto")
  })

  it("com o agente trabalhando nesta etapa: oculto", () => {
    expect(estadoDoConcluir({ condicoes: [], sinalizada: true, turnoAtivoAqui: true })).toBe("oculto")
    expect(estadoDoConcluir({ condicoes: [SINAL], sinalizada: false, turnoAtivoAqui: true })).toBe("oculto")
  })
})
