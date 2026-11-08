import { describe, expect, it } from "vitest"
import type { ListaDeModelos } from "@workspace/core/modelos"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"
import { escolhaAoTrocarModelo, esforcosDoModelo, foraDaLista, textoAlteracao } from "./celula-modelo"

const lista: ListaDeModelos = {
  completa: true,
  padrao: null,
  modelos: [
    { value: "haiku", nome: "Haiku (mais recente)", descricao: "", esforcos: [], apelido: true },
    { value: "sonnet", nome: "Sonnet (mais recente)", descricao: "", esforcos: ["low", "medium", "high"], apelido: true },
    { value: "opus", nome: "Opus (mais recente)", descricao: "", esforcos: ["low", "medium", "high", "xhigh", "max"], apelido: true },
  ],
}

describe("esforcosDoModelo", () => {
  it("com o padrão (nulo) aceita os 5 níveis", () => {
    expect(esforcosDoModelo(lista, null)).toEqual(["low", "medium", "high", "xhigh", "max"])
  })
  it("devolve os níveis do modelo, e vazio quando ele não aceita esforço", () => {
    expect(esforcosDoModelo(lista, "sonnet")).toEqual(["low", "medium", "high"])
    expect(esforcosDoModelo(lista, "haiku")).toEqual([])
  })
  it("modelo fora da lista não tem níveis conhecidos: aceita todos, como o padrão", () => {
    expect(esforcosDoModelo(lista, "claude-velho")).toHaveLength(5)
  })
})

describe("escolhaAoTrocarModelo", () => {
  it("limpa o esforço quando o novo modelo não aceita esse nível", () => {
    expect(escolhaAoTrocarModelo({ modelo: "sonnet", esforco: "high" }, "haiku", lista)).toEqual({ modelo: "haiku", esforco: null })
    expect(escolhaAoTrocarModelo({ modelo: "opus", esforco: "max" }, "sonnet", lista)).toEqual({ modelo: "sonnet", esforco: null })
  })
  it("mantém o esforço que o novo modelo aceita", () => {
    expect(escolhaAoTrocarModelo({ modelo: "sonnet", esforco: "high" }, "opus", lista)).toEqual({ modelo: "opus", esforco: "high" })
  })
  it("voltar ao padrão mantém o esforço (o padrão aceita qualquer nível)", () => {
    expect(escolhaAoTrocarModelo({ modelo: "sonnet", esforco: "high" }, null, lista)).toEqual({ modelo: null, esforco: "high" })
  })
})

describe("foraDaLista", () => {
  it("é verdadeiro para um modelo gravado que sumiu da lista", () => {
    expect(foraDaLista(lista, "claude-velho")).toBe(true)
  })
  it("é falso para modelo da lista e para o padrão", () => {
    expect(foraDaLista(lista, "opus")).toBe(false)
    expect(foraDaLista(lista, null)).toBe(false)
  })
})

describe("textoAlteracao", () => {
  const linha = (o: Partial<LinhaConfigModelo>): LinhaConfigModelo => ({
    etapa: "03",
    alvo: "principal",
    modelo: "sonnet",
    esforco: null,
    alteradoPor: "ana.silva@agencia.com",
    alteradoEm: "2026-11-08T15:00:00.000Z",
    ...o,
  })
  it("diz quem alterou e o dia/mês", () => {
    expect(textoAlteracao(linha({}))).toBe("Alterado por Ana Silva em 08/11")
  })
  it("sem linha, sem autor ou com data inválida não há texto", () => {
    expect(textoAlteracao(undefined)).toBeNull()
    expect(textoAlteracao(linha({ alteradoPor: null }))).toBeNull()
    expect(textoAlteracao(linha({ alteradoEm: null }))).toBeNull()
    expect(textoAlteracao(linha({ alteradoEm: "não é data" }))).toBeNull()
  })
})
