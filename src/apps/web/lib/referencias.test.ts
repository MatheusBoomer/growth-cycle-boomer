import { describe, expect, it } from "vitest"
import type { Marca } from "./anotacoes"
import { adicionarReferencia, descartarSuperadas, numerar, removerReferencia, type Referencia } from "./referencias"

const marca = (id: string): Marca => ({ id, forma: "numero", x: 1, y: 2, w: 0, h: 0 })
const ref = (entregavelId: string, marcas: Marca[] = []): Referencia => ({
  entregavelId,
  titulo: `Título ${entregavelId}`,
  tipo: "grafico",
  urlImagem: `/img/${entregavelId}.png`,
  marcas,
})

describe("adicionarReferencia e removerReferencia", () => {
  it("clicar de novo no mesmo entregável não duplica nem apaga as marcações", () => {
    const lista = adicionarReferencia([], ref("g1", [marca("m1")]))
    const de_novo = adicionarReferencia(lista, ref("g1"))
    expect(de_novo).toHaveLength(1)
    expect(de_novo[0]!.marcas).toHaveLength(1)
  })

  it("remove só a referência pedida", () => {
    expect(removerReferencia([ref("g1"), ref("g2")], "g1").map((r) => r.entregavelId)).toEqual(["g2"])
  })
})

describe("numerar", () => {
  it("numera de forma contínua entre as referências, na ordem da lista", () => {
    expect(numerar([ref("a", [marca("1"), marca("2")]), ref("b", [marca("3")]), ref("c")])).toEqual([
      { entregavelId: "a", primeira: 1, quantidade: 2 },
      { entregavelId: "b", primeira: 3, quantidade: 1 },
      { entregavelId: "c", primeira: 4, quantidade: 0 },
    ])
  })
})

describe("descartarSuperadas", () => {
  it("descarta a referência cujo entregável não está mais pendente e conta quantas saíram", () => {
    const r = descartarSuperadas([ref("a"), ref("b")], ["b"])
    expect(r.lista.map((x) => x.entregavelId)).toEqual(["b"])
    expect(r.descartadas).toBe(1)
  })

  it("sem mudança devolve a mesma lista", () => {
    const lista = [ref("a")]
    const r = descartarSuperadas(lista, ["a", "z"])
    expect(r.lista).toBe(lista)
    expect(r.descartadas).toBe(0)
  })
})
