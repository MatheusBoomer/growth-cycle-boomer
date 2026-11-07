import { describe, expect, it } from "vitest"
import { formatarDuracao, formatarUsd } from "../src/metricas/formato"

describe("formatarUsd", () => {
  it("usa vírgula e duas casas", () => {
    expect(formatarUsd(9.8)).toBe("US$ 9,80")
    expect(formatarUsd(0)).toBe("US$ 0,00")
    expect(formatarUsd(1234.5)).toBe("US$ 1.234,50")
  })
})

describe("formatarDuracao", () => {
  it("formata horas e minutos com minutos de dois dígitos", () => {
    expect(formatarDuracao(11520)).toBe("3h12")
    expect(formatarDuracao(11100)).toBe("3h05")
    expect(formatarDuracao(3600)).toBe("1h00")
  })
  it("formata só minutos abaixo de uma hora", () => {
    expect(formatarDuracao(2700)).toBe("45 min")
  })
  it("distingue menos de um minuto de zero", () => {
    expect(formatarDuracao(20)).toBe("< 1 min")
    expect(formatarDuracao(59)).toBe("< 1 min")
    expect(formatarDuracao(0)).toBe("0 min")
  })
})
