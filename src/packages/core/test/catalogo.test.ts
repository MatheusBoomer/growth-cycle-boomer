import { describe, expect, it } from "vitest"
import {
  etapaAnterior,
  etapaDoCatalogo,
  FASE_ARQUIVADA,
  faseDaEtapa,
  insumoDoCatalogo,
  proximaEtapa,
  validarCatalogo,
} from "../src/catalogo"
import type { Catalogo } from "../src/tipos"
import { catalogoReal } from "./ajuda"

describe("catálogo", () => {
  it("carrega o etapas.json real com as 9 etapas na ordem", () => {
    const c = catalogoReal()
    expect(c.etapas.map((e) => e.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "final"])
    expect(etapaDoCatalogo(c, "03").skill).toBe("03-diagnostico-performance")
    expect(etapaDoCatalogo(c, "05").skill).toBe("05-solucoes")
    expect(etapaDoCatalogo(c, "07").skill).toBe("07-midia-paga")
    expect(etapaDoCatalogo(c, "08").skill).toBe("08-plano-de-acao")
    expect(etapaDoCatalogo(c, "final").skill).toBe("09-apresentacao-final")
    expect(insumoDoCatalogo(c, "clientes-historico").sensivel).toBe(true)
  })

  it("recusa etapa referenciando insumo inexistente", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas[0]!.insumos.push({ id: "nao-existe", obrigatorio: true })
    expect(() => validarCatalogo(c)).toThrow(/nao-existe/)
  })

  it("recusa etapas fora de ordem", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas.reverse()
    expect(() => validarCatalogo(c)).toThrow(/ordem/)
  })

  it("traz os subagentes de cada etapa do etapas.json real", () => {
    const c = catalogoReal()
    expect(etapaDoCatalogo(c, "05").subagentes).toEqual(["analista-dados", "pesquisador-benchmark"])
    expect(etapaDoCatalogo(c, "01").subagentes).toEqual([])
  })

  it("recusa subagente fora dos configuráveis", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas[4]!.subagentes.push("designer")
    expect(() => validarCatalogo(c)).toThrow(/designer/)
  })

  it("recusa etapa sem a lista de subagentes", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    delete (c.etapas[0] as unknown as Record<string, unknown>).subagentes
    expect(() => validarCatalogo(c)).toThrow(/subagentes/)
  })

  it("agrupa as 9 etapas do etapas.json real em 5 fases, na ordem de aparição", () => {
    const c = catalogoReal()
    expect(c.etapas.every((e) => typeof e.fase === "string" && e.fase.length > 0)).toBe(true)
    expect([...new Set(c.etapas.map((e) => e.fase))]).toEqual([
      "Contexto",
      "Diagnóstico",
      "Soluções e metas",
      "Mídia e ação",
      "Apresentação",
    ])
    expect(c.etapas.map((e) => e.fase)).toEqual([
      "Contexto",
      "Contexto",
      "Diagnóstico",
      "Diagnóstico",
      "Soluções e metas",
      "Soluções e metas",
      "Mídia e ação",
      "Mídia e ação",
      "Apresentação",
    ])
  })

  it("devolve a fase da etapa e Arquivada para etapa fora do catálogo", () => {
    const c = catalogoReal()
    expect(faseDaEtapa(c, "04")).toBe("Diagnóstico")
    expect(faseDaEtapa(c, "final")).toBe("Apresentação")
    expect(faseDaEtapa(c, "briefing-benchmark")).toBe(FASE_ARQUIVADA)
    expect(FASE_ARQUIVADA).toBe("Arquivada")
  })

  it("recusa etapa sem fase", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    delete (c.etapas[2] as unknown as Record<string, unknown>).fase
    expect(() => validarCatalogo(c)).toThrow(/fase/)
  })

  it("recusa etapa com fase vazia", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas[2]!.fase = "  "
    expect(() => validarCatalogo(c)).toThrow(/fase/)
  })

  it("navega entre etapas", () => {
    expect(etapaAnterior("01")).toBeNull()
    expect(etapaAnterior("final")).toBe("08")
    expect(proximaEtapa("06")).toBe("07")
    expect(proximaEtapa("07")).toBe("08")
    expect(proximaEtapa("08")).toBe("final")
    expect(proximaEtapa("final")).toBeNull()
  })

  it("erra com mensagem clara para id desconhecido", () => {
    expect(() => insumoDoCatalogo(catalogoReal(), "xyz")).toThrow(/xyz/)
  })
})
