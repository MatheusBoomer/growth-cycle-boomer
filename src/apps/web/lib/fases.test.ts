import { describe, expect, it } from "vitest"
import { fasesEmOrdem } from "./fases"

describe("fasesEmOrdem", () => {
  it("devolve as fases únicas na ordem do catálogo", () => {
    const etapas = [{ fase: "Contexto" }, { fase: "Contexto" }, { fase: "Diagnóstico" }, { fase: "Apresentação" }, { fase: "Pós-apresentação" }]
    expect(fasesEmOrdem(etapas)).toEqual(["Contexto", "Diagnóstico", "Apresentação", "Pós-apresentação"])
  })
})
