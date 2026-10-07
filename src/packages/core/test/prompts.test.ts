import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { promptInicialEtapa, systemPromptModoInterface } from "../src/prompts"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("prompts", () => {
  it("o system prompt cita a pasta, a etapa e as três ferramentas", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
    expect(s).toContain("clientes/iszi/.app/rascunhos/")
    expect(s).toContain("03 · Diagnóstico de performance")
    for (const f of ["propor_entregavel", "solicitar_insumo", "sinalizar_etapa_pronta"]) expect(s).toContain(f)
  })

  it("pede resposta em português (a validação real abriu o chat em inglês)", () => {
    expect(systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "01") })).toContain("português do Brasil")
  })

  it("o prompt inicial manda usar a skill da etapa e inclui o dossiê", () => {
    const p = promptInicialEtapa({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03"), dossie: "DOSSIE-AQUI" })
    expect(p).toContain("`03-diagnostico-performance`")
    expect(p).toContain("DOSSIE-AQUI")
  })

  it("a etapa final usa a skill 09 (roteiro e pptx), não mais o subagente do Canva", () => {
    const p = promptInicialEtapa({ slug: "iszi", etapa: etapaDoCatalogo(cat, "final"), dossie: "" })
    expect(p).toContain("09-apresentacao-final")
    expect(p).not.toContain("designer-apresentacao")
  })
})
