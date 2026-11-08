import { describe, expect, it } from "vitest"
import { ErroApi, type ItemSkill } from "./api"
import type { NotaSkill } from "@workspace/core/notas-skills"
import { agruparPorGrupo, ehErroSemNuvem, MSG_SEM_NUVEM, rotuloAutorEData, rotuloResolvidas, semFrontmatter, separarNotas } from "./catalogo-skills-tela"

function item(id: string, grupo: ItemSkill["grupo"]): ItemSkill {
  return { id, grupo, titulo: id, resumo: "", temFluxo: true, notasAbertas: 0 }
}

function nota(id: number, criadaEm: string, resolvidaEm: string | null = null): NotaSkill {
  return { id, item: "etapa:03", texto: `nota ${id}`, autor: "ana.silva@x.com", criadaEm, resolvidaEm, resolvidaPor: resolvidaEm ? "bia@x.com" : null }
}

describe("agruparPorGrupo", () => {
  it("segue a ordem dos grupos e mantém a ordem dos itens dentro de cada um", () => {
    const grupos = agruparPorGrupo([
      item("regra:a", "Regras compartilhadas"),
      item("etapa:02", "Etapas"),
      item("visao-geral", "Processo"),
      item("etapa:01", "Etapas"),
      item("subagente:x", "Subagentes"),
    ])
    expect(grupos.map((g) => [g.grupo, g.itens.map((i) => i.id)])).toEqual([
      ["Processo", ["visao-geral"]],
      ["Etapas", ["etapa:02", "etapa:01"]],
      ["Subagentes", ["subagente:x"]],
      ["Regras compartilhadas", ["regra:a"]],
    ])
  })

  it("omite grupo sem itens", () => {
    expect(agruparPorGrupo([item("visao-geral", "Processo")]).map((g) => g.grupo)).toEqual(["Processo"])
  })
})

describe("rotuloResolvidas", () => {
  it("mostra a quantidade entre parênteses", () => {
    expect(rotuloResolvidas(0)).toBe("Resolvidas (0)")
    expect(rotuloResolvidas(3)).toBe("Resolvidas (3)")
  })
})

describe("separarNotas", () => {
  it("separa abertas de resolvidas e põe as mais novas primeiro, qualquer que seja a ordem recebida", () => {
    const { abertas, resolvidas } = separarNotas([
      nota(1, "2026-11-01T12:00:00Z"),
      nota(2, "2026-11-03T12:00:00Z"),
      nota(3, "2026-11-02T12:00:00Z", "2026-11-04T12:00:00Z"),
      nota(4, "2026-11-01T12:00:00Z", "2026-11-05T12:00:00Z"),
      nota(5, "2026-11-02T12:00:00Z"),
    ])
    expect(abertas.map((n) => n.id)).toEqual([2, 5, 1])
    expect(resolvidas.map((n) => n.id)).toEqual([4, 3])
  })
})

describe("rotuloAutorEData", () => {
  it("junta o nome curto do autor e o dia/mês no fuso de São Paulo", () => {
    expect(rotuloAutorEData(nota(1, "2026-11-08T01:00:00Z"))).toBe("Ana Silva · 07/11")
  })
})

describe("semFrontmatter", () => {
  it("tira o bloco YAML do começo", () => {
    expect(semFrontmatter("---\nname: x\ntools: Read\n---\n\nVocê é o analista.\n")).toBe("Você é o analista.\n")
  })

  it("aceita fim de linha do Windows", () => {
    expect(semFrontmatter("---\r\nname: x\r\n---\r\ntexto")).toBe("texto")
  })

  it("não mexe em texto sem frontmatter, nem em traços no meio do texto", () => {
    expect(semFrontmatter("# Título\n\n---\n\noutro")).toBe("# Título\n\n---\n\noutro")
  })

  it("não mexe em frontmatter sem fechamento", () => {
    expect(semFrontmatter("---\nname: x\nsem fim")).toBe("---\nname: x\nsem fim")
  })
})

describe("ehErroSemNuvem", () => {
  it("só reconhece o 400 do modo fs", () => {
    expect(ehErroSemNuvem(new ErroApi(MSG_SEM_NUVEM, 400, null, {}))).toBe(true)
    expect(ehErroSemNuvem(new ErroApi("Texto vazio.", 400, null, {}))).toBe(false)
    expect(ehErroSemNuvem(new ErroApi(MSG_SEM_NUVEM, 500, null, {}))).toBe(false)
    expect(ehErroSemNuvem(new Error(MSG_SEM_NUVEM))).toBe(false)
  })
})

describe("semFrontmatter (borda)", () => {
  it("aceita bloco vazio", () => {
    expect(semFrontmatter("---\n---\ntexto")).toBe("texto")
  })
})
