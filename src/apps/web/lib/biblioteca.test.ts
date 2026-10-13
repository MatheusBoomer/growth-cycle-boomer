import { describe, expect, it } from "vitest"
import type { ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import {
  agruparPorEtapa,
  agruparPorMarca,
  contarPorEtapa,
  FILTROS_INICIAIS,
  filtrarItens,
  ordemDeExibicao,
  rotuloEtapa,
  totalVisivel,
  type FiltrosBiblioteca,
} from "./biblioteca"

function item(p: Partial<ItemBiblioteca> & Pick<ItemBiblioteca, "caminho">): ItemBiblioteca {
  return {
    id: p.caminho,
    origem: "aprovado",
    etapa: "03",
    titulo: p.caminho,
    nomeArquivo: p.caminho.split("/").pop()!,
    imagens: [p.caminho],
    capa: p.caminho,
    modificadoEm: "2026-10-01T10:00:00.000Z",
    ...p,
  }
}

const cac = item({ caminho: "g/cac-mensal.png", titulo: "CAC mensal", etapa: "04" })
const acao = item({ caminho: "g/acao.png", titulo: "Ação de mídia", etapa: "07", origem: "anexo" })
const velho = item({ caminho: "p/velho.png", titulo: "Cenários antigos", etapa: "05", origem: "substituido" })
const pendente = item({ caminho: "p/novo.png", titulo: "Cenários", etapa: "05", origem: "proposta" })
const insider = item({ caminho: "b/insider/1", etapa: "06", origem: "benchmark", grupo: { tipo: "anuncio", marca: "insider" } })
const alpha = item({ caminho: "b/alpha/1", etapa: "06", origem: "benchmark", grupo: { tipo: "anuncio", marca: "alpha" } })
const solto = item({ caminho: "x/solto.png", etapa: "sem-etapa" })
const todos = [cac, acao, velho, pendente, insider, alpha, solto]

const com = (f: Partial<FiltrosBiblioteca>): FiltrosBiblioteca => ({ ...FILTROS_INICIAIS, ...f })

describe("filtros da biblioteca", () => {
  it("por padrão esconde versões antigas e mostra o resto", () => {
    expect(filtrarItens(todos, FILTROS_INICIAIS)).not.toContain(velho)
    expect(filtrarItens(todos, FILTROS_INICIAIS)).toHaveLength(6)
    expect(filtrarItens(todos, com({ versoesAntigas: true }))).toContain(velho)
  })

  it("versões antigas seguem o filtro de Pendentes", () => {
    expect(filtrarItens(todos, com({ versoesAntigas: true, origens: new Set(["aprovado"]) }))).not.toContain(velho)
  })

  it("filtra por etapa e por origem", () => {
    expect(filtrarItens(todos, com({ etapa: "06" }))).toEqual([insider, alpha])
    expect(filtrarItens(todos, com({ origens: new Set(["anexo"]) }))).toEqual([acao])
  })

  it("busca no título e no nome do arquivo, sem diferenciar maiúscula nem acento", () => {
    expect(filtrarItens(todos, com({ busca: "acao" }))).toEqual([acao])
    expect(filtrarItens(todos, com({ busca: "CAC-MENSAL" }))).toEqual([cac])
  })

  it("contagem por etapa respeita busca e origem, mas não a etapa escolhida", () => {
    const c = contarPorEtapa(todos, com({ etapa: "04" }))
    expect(c.todas).toBe(6)
    expect(c["06"]).toBe(2)
    expect(c["05"]).toBe(1)
    expect(c["01"]).toBe(0)
    expect(c["sem-etapa"]).toBe(1)
  })

  it("total da trilha não conta versões antigas", () => {
    expect(totalVisivel(todos)).toBe(6)
  })
})

describe("agrupamentos", () => {
  it("por etapa na ordem do planejamento, sem etapa no fim, grupos vazios fora", () => {
    expect(agruparPorEtapa([solto, cac, insider]).map((g) => g.etapa)).toEqual(["04", "06", "sem-etapa"])
  })

  it("por marca: soltos primeiro, depois marcas em ordem alfabética", () => {
    expect(agruparPorMarca([insider, cac, alpha])).toEqual([
      { marca: null, itens: [cac] },
      { marca: "alpha", itens: [alpha] },
      { marca: "insider", itens: [insider] },
    ])
  })

  it("ordem de exibição segue os agrupamentos (é a ordem das setas na imagem ampliada)", () => {
    expect(ordemDeExibicao([solto, insider, cac, alpha])).toEqual([cac, alpha, insider, solto])
  })
})

describe("rótulos de etapa", () => {
  const catalogo = {
    etapas: [
      { id: "03", numero: "03", titulo: "Diagnóstico de performance" },
      { id: "final", numero: "", titulo: "Apresentação final" },
    ],
    insumos: [],
  } as unknown as Catalogo

  it("longo para cabeçalho, curto para a pílula", () => {
    expect(rotuloEtapa(catalogo, "03")).toBe("03 · Diagnóstico de performance")
    expect(rotuloEtapa(catalogo, "03", true)).toBe("03")
    expect(rotuloEtapa(catalogo, "final")).toBe("Apresentação final")
    expect(rotuloEtapa(catalogo, "final", true)).toBe("Final")
    expect(rotuloEtapa(catalogo, "sem-etapa")).toBe("Sem etapa")
  })
})
