import { describe, expect, it } from "vitest"
import { numerosDePessoas, tomDaVariacao } from "./numeros-pessoas"

describe("tomDaVariacao", () => {
  it("custo subiu: ruim; caiu: bom", () => {
    expect(tomDaVariacao(120, 100, true)).toBe("ruim")
    expect(tomDaVariacao(80, 100, true)).toBe("bom")
  })
  it("sem período anterior válido ou sem variação: neutro", () => {
    expect(tomDaVariacao(120, 0, true)).toBe("neutro")
    expect(tomDaVariacao(Number.NaN, 100, true)).toBe("neutro")
    expect(tomDaVariacao(100, 100, true)).toBe("neutro")
  })
})

describe("numerosDePessoas", () => {
  const agora = new Date("2026-11-13T12:00:00Z")
  it("conta total, admins e ativas nos últimos 7 dias (data inválida ou nula não conta)", () => {
    const pessoas = [
      { papel: "admin", ultimoAcesso: "2026-11-13T09:00:00Z" },
      { papel: "usuario", ultimoAcesso: "2026-11-06T12:00:00Z" },
      { papel: "usuario", ultimoAcesso: "2026-11-01T12:00:00Z" },
      { papel: "admin", ultimoAcesso: null },
      { papel: "usuario", ultimoAcesso: "lixo" },
    ]
    expect(numerosDePessoas(pessoas, agora)).toEqual({ total: 5, admins: 2, ativas7d: 2 })
  })
})
