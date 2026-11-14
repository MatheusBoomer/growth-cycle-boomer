import { describe, expect, it } from "vitest"
import { consultaDoFiltro, STATUS_PADRAO } from "./filtro-reports"

describe("consultaDoFiltro", () => {
  it("monta a query de GET /api/admin/reports", () => {
    expect(consultaDoFiltro({ status: STATUS_PADRAO, tipo: null })).toBe("?status=aberto,em_andamento")
    expect(consultaDoFiltro({ status: [], tipo: "bug" })).toBe("?tipo=bug")
    expect(consultaDoFiltro({ status: ["resolvido"], tipo: "melhoria" })).toBe("?status=resolvido&tipo=melhoria")
    expect(consultaDoFiltro({ status: [], tipo: null })).toBe("")
  })
})
