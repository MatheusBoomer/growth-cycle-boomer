import { describe, expect, it } from "vitest"
import type { ValidacaoCliente } from "@workspace/core/tipos"
import { passosValidacao } from "./passos-validacao"

const gerado: ValidacaoCliente = {
  arquivo: "entrega/validacao-cliente/documento-validacao.pdf",
  primeiraGeracaoEm: "2026-11-16T10:00:00.000Z",
  geradoEm: "2026-11-16T10:00:00.000Z",
  baixadoEm: null,
  baixadoPor: null,
  confirmadoEm: null,
  confirmadoPor: null,
}
const baixado: ValidacaoCliente = { ...gerado, baixadoEm: "2026-11-16T10:05:00.000Z", baixadoPor: "ana@agencia.com" }
const confirmado: ValidacaoCliente = { ...baixado, confirmadoEm: "2026-11-16T11:00:00.000Z", confirmadoPor: "ana@agencia.com" }

describe("passosValidacao", () => {
  it("sem documento tudo falso", () => {
    expect(passosValidacao(undefined, false)).toEqual({ gerado: false, baixado: false, confirmado: false, podeConfirmar: false, aviso: null })
  })

  it("gerado e nao baixado: podeConfirmar falso com o aviso de baixar", () => {
    expect(passosValidacao(gerado, false)).toEqual({
      gerado: true,
      baixado: false,
      confirmado: false,
      podeConfirmar: false,
      aviso: "Baixe o PDF para liberar a confirmação.",
    })
  })

  it("baixado: podeConfirmar verdadeiro e aviso nulo", () => {
    expect(passosValidacao(baixado, false)).toEqual({ gerado: true, baixado: true, confirmado: false, podeConfirmar: true, aviso: null })
  })

  it("confirmado: podeConfirmar falso", () => {
    expect(passosValidacao(confirmado, false)).toEqual({ gerado: true, baixado: true, confirmado: true, podeConfirmar: false, aviso: null })
  })

  it("defasado: podeConfirmar falso com o aviso de PDF novo", () => {
    expect(passosValidacao(baixado, true)).toEqual({
      gerado: true,
      baixado: true,
      confirmado: false,
      podeConfirmar: false,
      aviso: "Os gráficos mudaram depois deste PDF. Peça um novo ao agente.",
    })
  })
})
