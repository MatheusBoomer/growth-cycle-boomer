import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ehErroDominio } from "../src/erros"
import type { InfoModeloSdk } from "../src/executor/modelos-sdk"
import { consultarModelosSdk } from "../src/executor/modelos-sdk"
import {
  alvosDaEtapa,
  CAMINHO_SUGESTOES,
  carregarSugestoes,
  criarCacheDeModelos,
  montarListaDeModelos,
  validarEscolha,
} from "../src/modelos"
import { catalogoReal, RAIZ } from "./ajuda"

function raizComSugestoes(conteudo: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "sugestoes-"))
  mkdirSync(path.dirname(path.join(dir, CAMINHO_SUGESTOES)), { recursive: true })
  writeFileSync(path.join(dir, CAMINHO_SUGESTOES), JSON.stringify(conteudo))
  return dir
}

const BOA = { etapa: "06", alvo: "analista-dados", modelo: "sonnet", esforco: null, motivo: "frágil" }

describe("sugestões de modelo", () => {
  it("carrega as sugestões reais, validadas contra o catálogo", () => {
    const s = carregarSugestoes(RAIZ, catalogoReal())
    const e06 = s.find((x) => x.etapa === "06" && x.alvo === "analista-dados")
    expect(e06?.modelo).toBe("sonnet")
    expect(s.filter((x) => x.alvo === "pesquisador-benchmark").map((x) => x.etapa)).toEqual(["02", "05", "08"])
    expect(s.every((x) => x.motivo.length > 0)).toBe(true)
  })

  it("recusa sugestão de subagente que a etapa não tem", () => {
    const raiz = raizComSugestoes([{ ...BOA, etapa: "01" }])
    expect(() => carregarSugestoes(raiz, catalogoReal())).toThrow(/analista-dados/)
  })

  it("recusa etapa inexistente, esforço inválido e motivo vazio", () => {
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, etapa: "99" }]), catalogoReal())).toThrow(/99/)
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, esforco: "extremo" }]), catalogoReal())).toThrow(/extremo/)
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, motivo: "  " }]), catalogoReal())).toThrow(/motivo/)
  })
})

describe("alvosDaEtapa", () => {
  it("lista o principal e os subagentes da etapa", () => {
    expect(alvosDaEtapa(catalogoReal(), "08")).toEqual(["principal", "analista-dados", "pesquisador-benchmark"])
    expect(alvosDaEtapa(catalogoReal(), "01")).toEqual(["principal"])
  })
})

const INFO: InfoModeloSdk[] = [
  { value: "sonnet", resolvedModel: "claude-sonnet-5-5", displayName: "Sonnet", description: "equilibrado", supportsEffort: true, supportedEffortLevels: ["low", "high"] },
  { value: "claude-haiku-5-5", displayName: "Haiku 5.5", description: "rápido", supportsEffort: false },
  { value: "claude-opus-5-5", displayName: "Opus 5.5", description: "o mais capaz", supportsEffort: true, supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
]

describe("montarListaDeModelos", () => {
  it("põe os três apelidos primeiro e depois os demais modelos do SDK", () => {
    const lista = montarListaDeModelos(INFO)
    expect(lista.completa).toBe(true)
    expect(lista.modelos.map((m) => m.value)).toEqual(["opus", "sonnet", "haiku", "claude-haiku-5-5", "claude-opus-5-5"])
    expect(lista.modelos.slice(0, 3).every((m) => m.apelido)).toBe(true)
    expect(lista.modelos.slice(3).some((m) => m.apelido)).toBe(false)
    const por = (v: string) => lista.modelos.find((m) => m.value === v)
    expect(por("sonnet")).toMatchObject({ nome: "Sonnet", descricao: "equilibrado", esforcos: ["low", "high"] })
    expect(por("claude-haiku-5-5")?.esforcos).toEqual([])
    expect(por("claude-opus-5-5")?.esforcos).toEqual(["low", "medium", "high", "xhigh", "max"])
  })

  it("apelido sem linha própria usa low, medium e high; sem informação própria, herda da linha do modelo resolvido", () => {
    const lista = montarListaDeModelos([
      { value: "opus", resolvedModel: "claude-opus-5-5", displayName: "Opus", description: "" },
      { value: "claude-opus-5-5", displayName: "Opus 5.5", description: "", supportsEffort: true, supportedEffortLevels: ["medium", "max"] },
    ])
    const por = (v: string) => lista.modelos.find((m) => m.value === v)
    expect(por("opus")?.esforcos).toEqual(["medium", "max"])
    expect(por("sonnet")?.esforcos).toEqual(["low", "medium", "high"])
    expect(lista.modelos.filter((m) => m.value === "opus")).toHaveLength(1)
  })

  it("ignora níveis de esforço que o app não conhece", () => {
    const lista = montarListaDeModelos([
      { value: "x", displayName: "X", description: "", supportsEffort: true, supportedEffortLevels: ["low", "ultra" as never] },
    ])
    expect(lista.modelos.find((m) => m.value === "x")?.esforcos).toEqual(["low"])
  })

  it("sem resposta do SDK, traz só os apelidos e marca como incompleta", () => {
    const lista = montarListaDeModelos(null)
    expect(lista.completa).toBe(false)
    expect(lista.modelos.map((m) => m.value)).toEqual(["opus", "sonnet", "haiku"])
    expect(lista.modelos.every((m) => m.apelido && m.esforcos.length === 3)).toBe(true)
  })
})

describe("validarEscolha", () => {
  const lista = montarListaDeModelos(INFO)

  it("aceita o que a lista permite", () => {
    expect(() => validarEscolha({ modelo: "opus", esforco: "high" }, lista)).not.toThrow()
    expect(() => validarEscolha({ modelo: null, esforco: "max" }, lista)).not.toThrow()
    expect(() => validarEscolha({ modelo: null, esforco: null }, lista)).not.toThrow()
    expect(() => validarEscolha({ modelo: "claude-haiku-5-5", esforco: null }, lista)).not.toThrow()
  })

  it("recusa modelo fora da lista, listando o que vale", () => {
    try {
      validarEscolha({ modelo: "claude-x", esforco: null }, lista)
      expect.unreachable()
    } catch (e) {
      expect(ehErroDominio(e) && e.status).toBe(400)
      expect((e as Error).message).toContain("claude-x")
      expect((e as Error).message).toContain("sonnet")
      expect((e as Error).message).toContain("claude-haiku-5-5")
    }
  })

  it("recusa esforço que o modelo não aceita, listando os níveis aceitos", () => {
    try {
      validarEscolha({ modelo: "sonnet", esforco: "max" }, lista)
      expect.unreachable()
    } catch (e) {
      expect(ehErroDominio(e) && e.status).toBe(400)
      expect((e as Error).message).toContain("low, high")
    }
    try {
      validarEscolha({ modelo: "claude-haiku-5-5", esforco: "high" }, lista)
      expect.unreachable()
    } catch (e) {
      expect(ehErroDominio(e) && e.status).toBe(400)
      expect((e as Error).message).toMatch(/não aceita esforço/)
    }
  })

  it("recusa esforço desconhecido, com ou sem modelo", () => {
    expect(() => validarEscolha({ modelo: null, esforco: "extremo" as never }, lista)).toThrow(/extremo/)
    expect(() => validarEscolha({ modelo: "opus", esforco: "extremo" as never }, lista)).toThrow(/extremo/)
  })
})

describe("consultarModelosSdk", () => {
  it("devolve os modelos do SDK e aborta a consulta ao terminar", async () => {
    let controle: AbortController | undefined
    const r = await consultarModelosSdk({ A: "1" }, ({ options }) => {
      controle = options.abortController
      expect(options.env).toEqual({ A: "1" })
      return { supportedModels: async () => INFO }
    })
    expect(r).toEqual(INFO)
    expect(controle?.signal.aborted).toBe(true)
  })

  it("o prompt é um gerador que não envia nenhuma mensagem", async () => {
    let produziu = false
    await consultarModelosSdk({}, ({ prompt, options }) => {
      void (async () => {
        for await (const _ of prompt as AsyncIterable<unknown>) produziu = true
      })()
      return {
        supportedModels: async () => {
          options.abortController?.abort()
          await new Promise((r) => setTimeout(r, 10))
          return INFO
        },
      }
    })
    expect(produziu).toBe(false)
  })

  it("rejeita no tempo limite e aborta a consulta", async () => {
    let controle: AbortController | undefined
    await expect(
      consultarModelosSdk(
        {},
        ({ options }) => {
          controle = options.abortController
          return { supportedModels: () => new Promise<InfoModeloSdk[]>(() => {}) }
        },
        50,
      ),
    ).rejects.toThrow(/tempo/)
    expect(controle?.signal.aborted).toBe(true)
  })

  it("propaga a falha da consulta e aborta", async () => {
    let controle: AbortController | undefined
    await expect(
      consultarModelosSdk({}, ({ options }) => {
        controle = options.abortController
        return { supportedModels: async () => Promise.reject(new Error("sem rede")) }
      }),
    ).rejects.toThrow("sem rede")
    expect(controle?.signal.aborted).toBe(true)
  })
})

describe("criarCacheDeModelos", () => {
  it("reaproveita o resultado dentro do TTL e busca de novo depois", async () => {
    let agora = 1000
    let buscas = 0
    const cache = criarCacheDeModelos(async () => (buscas++, INFO), () => agora, 5000)
    const a = await cache()
    await cache()
    expect(buscas).toBe(1)
    expect(a.completa).toBe(true)
    agora += 5001
    await cache()
    expect(buscas).toBe(2)
  })

  it("em falha devolve só os apelidos e tenta de novo na chamada seguinte", async () => {
    let buscas = 0
    const cache = criarCacheDeModelos(async () => {
      buscas++
      if (buscas === 1) throw new Error("fora do ar")
      return INFO
    })
    const falha = await cache()
    expect(falha.completa).toBe(false)
    expect(falha.modelos.map((m) => m.value)).toEqual(["opus", "sonnet", "haiku"])
    const ok = await cache()
    expect(buscas).toBe(2)
    expect(ok.completa).toBe(true)
  })
})
