import { describe, expect, it } from "vitest"
import { etapaAnterior, etapaDoCatalogo, insumoDoCatalogo, proximaEtapa, validarCatalogo } from "../src/catalogo"
import type { Catalogo } from "../src/tipos"
import { catalogoReal } from "./ajuda"

describe("catálogo", () => {
  it("carrega o etapas.json real com as 10 etapas na ordem", () => {
    const c = catalogoReal()
    expect(c.etapas.map((e) => e.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "final"])
    expect(etapaDoCatalogo(c, "03").skill).toBe("03-diagnostico-performance")
    expect(etapaDoCatalogo(c, "05").skill).toBe("05-solucoes")
    expect(etapaDoCatalogo(c, "09").skill).toBe("09-plano-de-acao")
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

  it("navega entre etapas", () => {
    expect(etapaAnterior("01")).toBeNull()
    expect(etapaAnterior("final")).toBe("09")
    expect(proximaEtapa("08")).toBe("09")
    expect(proximaEtapa("09")).toBe("final")
    expect(proximaEtapa("final")).toBeNull()
  })

  it("erra com mensagem clara para id desconhecido", () => {
    expect(() => insumoDoCatalogo(catalogoReal(), "xyz")).toThrow(/xyz/)
  })
})
