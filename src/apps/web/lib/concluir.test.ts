import { describe, expect, it } from "vitest"
import { contagemInsumos, estadoDoConcluir } from "./concluir"

const SINAL = "O agente ainda não sinalizou que a etapa está completa"

describe("estadoDoConcluir", () => {
  it("sem nada faltando e sem turno ativo: pronto", () =>
    expect(estadoDoConcluir({ condicoes: [], sinalizada: true, turnoAtivoAqui: false, temEntregaveis: true })).toBe("pronto"))

  it("só falta a sinalização do agente: esperando-agente", () =>
    expect(estadoDoConcluir({ condicoes: [SINAL], sinalizada: false, turnoAtivoAqui: false, temEntregaveis: true })).toBe("esperando-agente"))

  it("falta aprovar ou enviar algo: oculto", () => {
    expect(estadoDoConcluir({ condicoes: ["Aprovar: Gráfico"], sinalizada: true, turnoAtivoAqui: false, temEntregaveis: true })).toBe("oculto")
    expect(estadoDoConcluir({ condicoes: ["Aprovar: Gráfico", SINAL], sinalizada: false, turnoAtivoAqui: false, temEntregaveis: true })).toBe("oculto")
  })

  it("com o agente trabalhando nesta etapa: oculto", () => {
    expect(estadoDoConcluir({ condicoes: [], sinalizada: true, turnoAtivoAqui: true, temEntregaveis: true })).toBe("oculto")
    expect(estadoDoConcluir({ condicoes: [SINAL], sinalizada: false, turnoAtivoAqui: true, temEntregaveis: true })).toBe("oculto")
  })
})

describe("estadoDoConcluir: sem nada proposto ainda", () => {
  it("só a sinalização falta mas nenhum entregável existe: oculto (não é 'tudo aprovado')", () =>
    expect(estadoDoConcluir({ condicoes: [SINAL], sinalizada: false, turnoAtivoAqui: false, temEntregaveis: false })).toBe("oculto"))
})

describe("contagemInsumos", () => {
  it("conta só os obrigatórios: 1 obrigatório recebido e 1 opcional pendente dá 1/1", () => {
    const refs = [{ id: "a", obrigatorio: true }, { id: "b", obrigatorio: false }]
    const recebidos = [{ etapa: "04", insumoId: "a", status: "valido" }, { etapa: "03", insumoId: "b", status: "valido" }]
    expect(contagemInsumos(refs, recebidos, "04")).toEqual({ recebidos: 1, total: 1 })
  })
})
