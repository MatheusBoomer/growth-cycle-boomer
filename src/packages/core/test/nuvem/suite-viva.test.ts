import { describe, expect, it } from "vitest"
import { ehEmailDeContrato, ehSlugDeContrato, novoEmail, novoSlug, suiteVivaHabilitada } from "./suite-viva"

describe("slugs da suíte de contrato", () => {
  it("a limpeza da suíte viva só reconhece o formato gerado por novoSlug", () => {
    for (let i = 0; i < 20; i++) expect(ehSlugDeContrato(novoSlug())).toBe(true)
    // Um prospect real chamado "Contrato ..." nunca entra na limpeza.
    for (const real of ["contrato-x", "contrato-acme", "contrato-acme-ltda", "contrato-abc123", "contrato-", "contrato-0123456789ab-2"]) {
      expect(ehSlugDeContrato(real)).toBe(false)
    }
  })
})

describe("suiteVivaHabilitada", () => {
  it("exige a URL e a chave de serviço do projeto de teste", () => {
    expect(suiteVivaHabilitada({})).toBe(false)
    expect(suiteVivaHabilitada({ SUPABASE_TESTE_URL: "u" })).toBe(false)
    expect(suiteVivaHabilitada({ SUPABASE_TESTE_SERVICE_ROLE_KEY: "k" })).toBe(false)
    expect(suiteVivaHabilitada({ SUPABASE_TESTE_URL: "u", SUPABASE_TESTE_SERVICE_ROLE_KEY: "" })).toBe(false)
    expect(suiteVivaHabilitada({ SUPABASE_TESTE_URL: "u", SUPABASE_TESTE_SERVICE_ROLE_KEY: "k" })).toBe(true)
  })
})

describe("e-mails da suíte de contrato", () => {
  it("a limpeza só reconhece o formato gerado por novoEmail", () => {
    for (let i = 0; i < 20; i++) expect(ehEmailDeContrato(novoEmail())).toBe(true)
    for (const real of [
      "matheus.moreira@boomer.com.br",
      "contrato-x@teste.invalid",
      "contrato-0123456789ab@boomer.com.br",
      "contrato-0123456789ab@testeXinvalid",
      "contrato-0123456789ab@teste.invalid.com",
    ]) {
      expect(ehEmailDeContrato(real)).toBe(false)
    }
  })
})
