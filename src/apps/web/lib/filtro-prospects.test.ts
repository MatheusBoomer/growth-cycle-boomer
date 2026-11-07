import { describe, expect, it } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { filtrarProspects } from "./filtro-prospects"

const p = (nome: string, dono: string | null) => ({ slug: nome.toLowerCase(), nome, dono }) as unknown as ResumoProspect

const lista = [p("Iszi", "Ana@Boomer.com"), p("Verdeluz", "bia@boomer.com"), p("Iguatemi", null), p("Ilha", "ana@boomer.com")]

describe("filtrarProspects", () => {
  it("sem filtros devolve a lista inteira", () => {
    expect(filtrarProspects(lista, { busca: "", apenasMeus: false, email: "ana@boomer.com" })).toHaveLength(4)
  })

  it("apenasMeus traz só os do dono, sem diferença de maiúsculas", () => {
    const r = filtrarProspects(lista, { busca: "", apenasMeus: true, email: "ANA@boomer.com" })
    expect(r.map((x) => x.nome)).toEqual(["Iszi", "Ilha"])
  })

  it("apenasMeus sem e-mail (modo sem login) não traz nada", () => {
    expect(filtrarProspects(lista, { busca: "", apenasMeus: true, email: null })).toEqual([])
  })

  it("a busca continua valendo junto com o filtro", () => {
    const r = filtrarProspects(lista, { busca: " is ", apenasMeus: true, email: "ana@boomer.com" })
    expect(r.map((x) => x.nome)).toEqual(["Iszi"])
  })

  it("a busca sozinha ignora maiúsculas", () => {
    expect(filtrarProspects(lista, { busca: "IG", apenasMeus: false, email: null }).map((x) => x.nome)).toEqual(["Iguatemi"])
  })
})
