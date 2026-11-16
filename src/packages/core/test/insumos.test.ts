import { describe, expect, it } from "vitest"
import { insumoDoCatalogo } from "../src/catalogo"
import { destinoInsumo, extensaoAceita, nomeSeguro, registrarInsumo } from "../src/insumos"
import { estadoInicial } from "../src/maquina-estados"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("registrarInsumo e ultimoValidoEm", () => {
  const T1 = "2026-11-01T10:00:00.000Z"
  const T2 = "2026-11-01T11:00:00.000Z"
  const valido = { etapa: "03" as const, insumoId: "historico-mensal", status: "valido" as const, problemas: [], avisos: [], resumo: "ok", arquivo: "dados/historico-mensal.xlsx" }
  const invalido = { ...valido, status: "invalido" as const, problemas: ["12 meses"], resumo: null, arquivo: null }
  const base = () => estadoInicial({ slug: "x", nome: "X", site: null }, T1)
  const registro = (e: ReturnType<typeof base>) => e.insumos.find((i) => i.etapa === "03" && i.insumoId === "historico-mensal")!

  it("envio valido grava ultimoValidoEm igual a atualizadoEm", () => {
    expect(registro(registrarInsumo(base(), valido, T1))).toMatchObject({ atualizadoEm: T1, ultimoValidoEm: T1 })
  })

  it("invalido depois de valido guarda ultimoValidoEm do valido e o resto do registro invalido como hoje", () => {
    const r = registro(registrarInsumo(registrarInsumo(base(), valido, T1), invalido, T2))
    expect(r).toMatchObject({ status: "invalido", problemas: ["12 meses"], arquivo: null, atualizadoEm: T2, ultimoValidoEm: T1 })
  })

  it("valido de novo depois do invalido renova ultimoValidoEm", () => {
    const e = registrarInsumo(registrarInsumo(registrarInsumo(base(), valido, T1), invalido, T2), valido, "2026-11-01T12:00:00.000Z")
    expect(registro(e).ultimoValidoEm).toBe("2026-11-01T12:00:00.000Z")
  })

  it("invalido sem valido anterior nao tem ultimoValidoEm", () => {
    const r = registro(registrarInsumo(base(), invalido, T1))
    expect(r).not.toHaveProperty("ultimoValidoEm")
  })
})

describe("insumos", () => {
  it("monta o destino com a extensão do arquivo enviado", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "historico-mensal"), "Planilha Final.XLSX")).toBe(
      "dados/historico-mensal.xlsx",
    )
    expect(destinoInsumo(insumoDoCatalogo(cat, "kickoff-transcricao"), "reuniao.pdf")).toBe(
      "contexto/brutos/kickoff-transcricao-bruta.pdf",
    )
  })

  it("mantém o nome original (seguro) quando o destino é pasta", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "prints-campanhas"), "Campanha Março (1).png")).toBe(
      "contexto/brutos/prints-campanhas/Campanha_Marco_1_.png",
    )
  })

  it("aceita só os formatos do catálogo", () => {
    const ins = insumoDoCatalogo(cat, "historico-mensal")
    expect(extensaoAceita(ins, "a.xlsx")).toBe(true)
    expect(extensaoAceita(ins, "a.csv")).toBe(false)
    expect(extensaoAceita(ins, "sem-extensao")).toBe(false)
  })

  it("nomeSeguro remove diretórios", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd")
  })
})
