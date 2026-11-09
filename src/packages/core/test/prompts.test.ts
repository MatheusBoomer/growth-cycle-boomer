import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { promptInicialEtapa, promptRetomadaEtapa, systemPromptModoInterface } from "../src/prompts"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("prompts", () => {
  it("o system prompt cita a pasta, a etapa e as três ferramentas", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
    expect(s).toContain("clientes/iszi/.app/rascunhos/")
    expect(s).toContain("03 · Diagnóstico de performance")
    for (const f of ["propor_entregavel", "solicitar_insumo", "sinalizar_etapa_pronta"]) expect(s).toContain(f)
  })

  it("chama o produto de Growth Cycle", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
    expect(s).toContain("# Modo interface do Growth Cycle")
    expect(s).not.toContain("Planejamento Estratégico")
  })

  it("manda perguntar no chat, em texto, uma pergunta por vez", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
    expect(s).not.toContain("fazer_perguntas")
    expect(s).toContain("uma pergunta por vez")
    expect(s).toContain("sua recomendação")
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

  it("retomada inclui o prompt inicial da etapa e o histórico em ordem", () => {
    const etapa = etapaDoCatalogo(cat, "03")
    const p = promptRetomadaEtapa({
      slug: "iszi",
      etapa,
      dossie: "DOSSIE-AQUI",
      historico: [
        { tipo: "turno_inicio", em: "2026-01-01T00:00:00Z" },
        { tipo: "mensagem_analista", texto: "Oi", automatica: false, em: "2026-01-01T00:00:01Z" },
        { tipo: "atividade", nome: "Read", detalhe: "x", em: "2026-01-01T00:00:02Z" },
        { tipo: "texto_agente", texto: "Olá, analista", em: "2026-01-01T00:00:03Z" },
        { tipo: "aviso", nivel: "info", texto: "ignorado", em: "2026-01-01T00:00:04Z" },
        { tipo: "mensagem_analista", texto: "Segue", automatica: true, em: "2026-01-01T00:00:05Z" },
      ],
    })
    expect(p.startsWith(promptInicialEtapa({ slug: "iszi", etapa, dossie: "DOSSIE-AQUI" }))).toBe(true)
    expect(p).toContain("\n\n---\n\n### Histórico desta etapa (a sessão anterior não pôde ser restaurada)\n\n")
    expect(p).not.toContain("ignorado")
    const i1 = p.indexOf("**Analista:** Oi")
    const i2 = p.indexOf("**Agente:** Olá, analista")
    const i3 = p.indexOf("**Analista:** Segue")
    expect(i1).toBeGreaterThan(0)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
  })

  it("histórico longo guarda as mensagens mais recentes até 40000 caracteres", () => {
    const etapa = etapaDoCatalogo(cat, "03")
    const historico = Array.from({ length: 20 }, (_, i) => ({
      tipo: "texto_agente" as const,
      texto: `M${String(i).padStart(2, "0")}-${"x".repeat(4000)}`,
      em: "2026-01-01T00:00:00Z",
    }))
    const p = promptRetomadaEtapa({ slug: "iszi", etapa, dossie: "D", historico })
    const base = promptInicialEtapa({ slug: "iszi", etapa, dossie: "D" })
    const marcador = "(a sessão anterior não pôde ser restaurada)\n\n"
    const hist = p.slice(p.indexOf(marcador) + marcador.length)
    expect(hist.length).toBeLessThanOrEqual(40000)
    expect(p.startsWith(base)).toBe(true)
    expect(p).toContain("M19-")
    expect(p).not.toContain("M00-")
    const presentes = historico.filter((h) => p.includes(h.texto.slice(0, 4))).length
    expect(presentes).toBeGreaterThan(5)
  })
})
