import { describe, expect, it } from "vitest"
import { ehSlugDeContrato, novoSlug, suiteVivaHabilitada } from "./suite-viva"

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
