import { describe, expect, it } from "vitest"
import { avancarEnsaioLiberado, chaveDoTrecho, textoParaPreencher } from "./ensaio"

const base = {
  ensaio: true,
  semTurno: true,
  textoAtual: "",
  etapa: "03" as const,
  gatilho: { gatilho: "mensagem" as const, textoPreenchido: "Os dados estão corretos." },
  jaPreenchido: null,
}

describe("textoParaPreencher", () => {
  it("preenche a caixa vazia quando o trecho é de mensagem", () => {
    expect(textoParaPreencher(base)).toBe("Os dados estão corretos.")
  })

  it("preenche também quando o trecho é de ajuste", () => {
    expect(textoParaPreencher({ ...base, gatilho: { gatilho: "ajuste", textoPreenchido: "Troque o eixo." } })).toBe("Troque o eixo.")
  })

  it("não preenche fora do ensaio, com turno ativo ou com texto na caixa", () => {
    expect(textoParaPreencher({ ...base, ensaio: false })).toBeNull()
    expect(textoParaPreencher({ ...base, semTurno: false })).toBeNull()
    expect(textoParaPreencher({ ...base, textoAtual: "  algo " })).toBeNull()
  })

  it("não preenche gatilho de aprovar ou automática, nem sem texto, nem sem trecho", () => {
    expect(textoParaPreencher({ ...base, gatilho: { gatilho: "aprovar", textoPreenchido: "x" } })).toBeNull()
    expect(textoParaPreencher({ ...base, gatilho: { gatilho: "automatica", textoPreenchido: "x" } })).toBeNull()
    expect(textoParaPreencher({ ...base, gatilho: { gatilho: "mensagem", textoPreenchido: null } })).toBeNull()
    expect(textoParaPreencher({ ...base, gatilho: null })).toBeNull()
  })

  it("não preenche de novo o mesmo trecho que o analista apagou", () => {
    expect(textoParaPreencher({ ...base, jaPreenchido: chaveDoTrecho("03", "Os dados estão corretos.") })).toBeNull()
  })

  it("preenche o trecho seguinte, de outra etapa ou de outro texto", () => {
    expect(textoParaPreencher({ ...base, jaPreenchido: chaveDoTrecho("03", "Outro texto.") })).toBe("Os dados estão corretos.")
    expect(textoParaPreencher({ ...base, jaPreenchido: chaveDoTrecho("04", "Os dados estão corretos.") })).toBe("Os dados estão corretos.")
  })
})

describe("avancarEnsaioLiberado", () => {
  const livre = { etapa: "03" as const, turnoAtivo: false, temTrecho: true, enviando: false, avancandoNoServidor: null }

  it("libera com trecho a tocar, sem turno, sem envio e sem avanço em curso", () => {
    expect(avancarEnsaioLiberado(livre)).toBe(true)
  })

  it("bloqueia enquanto o servidor avança a etapa aberta, mesmo entre turnos", () => {
    expect(avancarEnsaioLiberado({ ...livre, avancandoNoServidor: "03" })).toBe(false)
  })

  it("avanço em curso em outra etapa não bloqueia esta", () => {
    expect(avancarEnsaioLiberado({ ...livre, avancandoNoServidor: "04" })).toBe(true)
  })

  it("bloqueia com turno ativo, sem trecho ou com o pedido ainda em envio", () => {
    expect(avancarEnsaioLiberado({ ...livre, turnoAtivo: true })).toBe(false)
    expect(avancarEnsaioLiberado({ ...livre, temTrecho: false })).toBe(false)
    expect(avancarEnsaioLiberado({ ...livre, enviando: true })).toBe(false)
  })
})
