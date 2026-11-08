import { describe, expect, it } from "vitest"
import type { ListaDeModelos } from "@workspace/core/modelos"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"
import { seloDoModelo, type Sugestao } from "@workspace/core/modelos"
import { ROTULOS_ALVO, escolhaAoTrocarModelo, escolhaSalva, esforcosDoModelo, foraDaLista, sugestaoVisivel, textoAlteracao, textoRodape, textoSelo, textoSugestao } from "./celula-modelo"

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
    expect(foraDaLista(lista, "default")).toBe(false)
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

describe("ROTULOS_ALVO", () => {
  it("dá o rótulo de cada agente", () => {
    expect(ROTULOS_ALVO).toEqual({
      principal: "Agente principal",
      "analista-dados": "Analista de dados · gráficos e projeções",
      "pesquisador-benchmark": "Pesquisador · benchmark e sites",
    })
  })
})

describe("sugestaoVisivel", () => {
  const sug = (modelo: string, esforco: Sugestao["esforco"]): Sugestao => ({ etapa: "03", alvo: "principal", modelo, esforco, motivo: "custo" })
  it("é falso quando a sugestão já é o valor salvo", () => {
    expect(sugestaoVisivel(sug("haiku", null), { modelo: "haiku", esforco: null })).toBe(false)
  })
  it("é verdadeiro quando o modelo ou o esforço salvo diferem", () => {
    expect(sugestaoVisivel(sug("haiku", null), { modelo: "sonnet", esforco: null })).toBe(true)
    expect(sugestaoVisivel(sug("sonnet", "high"), { modelo: "sonnet", esforco: null })).toBe(true)
    expect(sugestaoVisivel(sug("haiku", null), { modelo: null, esforco: null })).toBe(true)
  })
  it("sem sugestão é falso", () => {
    expect(sugestaoVisivel(undefined, { modelo: "haiku", esforco: null })).toBe(false)
  })
})

describe("textoRodape", () => {
  it("sem uso, diz que não há uso ainda", () => {
    expect(textoRodape(undefined, lista)).toEqual(["sem uso ainda"])
    expect(textoRodape({ mediaUsd: null, projetos: 0, modeloRecente: null }, lista)).toEqual(["sem uso ainda"])
  })
  it("mostra a média, os projetos e o modelo dos últimos turnos", () => {
    expect(textoRodape({ mediaUsd: 7.59, projetos: 2, modeloRecente: "claude-opus-5-5" }, lista)).toEqual([
      "média US$ 7,59 por etapa · 2 projetos",
      "últimos turnos: Opus 5.5",
    ])
  })
  it("sem média, só a linha dos últimos turnos", () => {
    expect(textoRodape({ mediaUsd: null, projetos: 0, modeloRecente: "claude-sonnet-5-5" }, lista)).toEqual(["últimos turnos: Sonnet 5.5"])
  })
  it("sem turnos, só a linha da média, e um projeto fica no singular", () => {
    expect(textoRodape({ mediaUsd: 1.5, projetos: 1, modeloRecente: null }, lista)).toEqual(["média US$ 1,50 por etapa · 1 projeto"])
  })
})

describe("textoSelo", () => {
  const comPadrao = (padrao: string | null): ListaDeModelos => ({ ...lista, padrao })
  it("o padrão mostra o modelo entre parênteses quando é um id Claude reconhecido", () => {
    const l = comPadrao("claude-opus-5-5")
    expect(textoSelo(seloDoModelo(null, l), l)).toBe("Padrão (Opus 5.5)")
  })
  it("o padrão fica só `Padrão` quando o nome não é reconhecido ou não existe", () => {
    const l = comPadrao("Default (recommended)")
    expect(textoSelo(seloDoModelo(null, l), l)).toBe("Padrão")
    expect(textoSelo(seloDoModelo(null, lista), lista)).toBe("Padrão")
  })
  it("o apelido leva `mais recente` e a versão fixa leva `fixo`", () => {
    const l: ListaDeModelos = {
      ...lista,
      modelos: [{ ...lista.modelos[1]!, resolvido: "claude-sonnet-5-5" }, { value: "claude-opus-4-1", nome: "Opus 4.1", descricao: "", esforcos: [], apelido: false }],
    }
    expect(textoSelo(seloDoModelo("sonnet", l), l)).toBe("Sonnet 5.5 · mais recente")
    expect(textoSelo(seloDoModelo("claude-opus-4-1", l), l)).toBe("Opus 4.1 · fixo")
  })
})

describe("escolhaSalva", () => {
  const linha = (o: Partial<LinhaConfigModelo>): LinhaConfigModelo => ({ etapa: "03", alvo: "principal", modelo: "sonnet", esforco: "high", alteradoPor: null, alteradoEm: null, ...o })
  it("devolve o gravado para a etapa e o alvo", () => {
    expect(escolhaSalva([linha({}), linha({ alvo: "analista-dados", modelo: "haiku", esforco: null })], "03", "analista-dados")).toEqual({ modelo: "haiku", esforco: null })
  })
  it("sem linha é o padrão, e esforço desconhecido vira nulo", () => {
    expect(escolhaSalva([linha({})], "04", "principal")).toEqual({ modelo: null, esforco: null })
    expect(escolhaSalva([linha({ esforco: "ultra" })], "03", "principal")).toEqual({ modelo: "sonnet", esforco: null })
  })
})

describe("textoSugestao", () => {
  const comVersao: ListaDeModelos = {
    ...lista,
    modelos: lista.modelos.map((m) => (m.value === "sonnet" ? { ...m, resolvido: "claude-sonnet-5-5" } : m)),
  }
  const base: Sugestao = { etapa: "03", alvo: "principal", modelo: "sonnet", esforco: null, motivo: "análise numérica pesada" }

  it("usa só o nome amigável, sem `mais recente`, e termina no motivo (um único ponto médio)", () => {
    const texto = textoSugestao(base, comVersao)
    expect(texto).toBe("Sugestão: Sonnet 5.5 · análise numérica pesada")
    expect(texto.match(/·/g)).toHaveLength(1)
  })
  it("id fixo também sai sem o sufixo `fixo`", () => {
    expect(textoSugestao({ ...base, modelo: "claude-opus-5-5" }, comVersao)).toBe("Sugestão: Opus 5.5 · análise numérica pesada")
  })
  it("acrescenta o esforço sugerido", () => {
    expect(textoSugestao({ ...base, esforco: "xhigh" }, comVersao)).toBe("Sugestão: Sonnet 5.5, esforço muito alto · análise numérica pesada")
  })
  it("acrescenta o agente quando o rótulo é informado", () => {
    expect(textoSugestao({ ...base, alvo: "analista-dados", modelo: "haiku" }, comVersao, "Analista de dados")).toBe(
      "Sugestão (Analista de dados): Haiku · análise numérica pesada",
    )
  })
})
