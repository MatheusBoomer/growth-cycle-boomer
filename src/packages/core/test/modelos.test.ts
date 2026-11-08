import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { ehErroDominio } from "../src/erros"
import type { InfoModeloSdk } from "../src/executor/modelos-sdk"
import { consultarModelosSdk } from "../src/executor/modelos-sdk"
import {
  alvosDaEtapa,
  criarCacheDeModelos,
  FRASES_ESFORCO,
  montarListaDeModelos,
  ROTULOS_ESFORCO,
  rotuloDoModelo,
  segmentosDoEsforco,
  seloDoModelo,
  validarEscolha,
} from "../src/modelos"
import { catalogoReal } from "./ajuda"

describe("alvosDaEtapa", () => {
  it("lista o principal e os subagentes da etapa", () => {
    expect(alvosDaEtapa(catalogoReal(), "08")).toEqual(["principal", "analista-dados", "pesquisador-benchmark"])
    expect(alvosDaEtapa(catalogoReal(), "01")).toEqual(["principal"])
  })
})

/** Iterador de sessão que não produz nada e termina ao abort (como o do SDK). */
const semMensagensAteAbortar = (options: { abortController?: AbortController }): AsyncIterable<never> => ({
  [Symbol.asyncIterator]: async function* () {
    const sinal = options.abortController?.signal
    if (sinal && !sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
  },
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
    expect(lista.modelos.map((m) => m.value)).toEqual(["haiku", "sonnet", "opus", "claude-haiku-5-5", "claude-opus-5-5"])
    expect(lista.modelos.slice(0, 3).every((m) => m.apelido)).toBe(true)
    expect(lista.modelos.slice(3).some((m) => m.apelido)).toBe(false)
    const por = (v: string) => lista.modelos.find((m) => m.value === v)
    expect(por("sonnet")).toMatchObject({ nome: "Sonnet (mais recente)", descricao: "equilibrado", esforcos: ["low", "high"] })
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
    expect(lista.modelos.map((m) => m.nome).slice(0, 3)).toEqual(["Haiku (mais recente)", "Sonnet (mais recente)", "Opus (mais recente)"])
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
    expect(lista.modelos.map((m) => m.value)).toEqual(["haiku", "sonnet", "opus"])
    expect(lista.modelos.every((m) => m.apelido && m.esforcos.length === 3)).toBe(true)
  })
})

describe("montarListaDeModelos: modelo padrão e versão dos apelidos", () => {
  const comPadrao: InfoModeloSdk[] = [
    { value: "default", resolvedModel: "claude-opus-5-5", displayName: "Default (recommended)", description: "o padrão da conta" },
    ...INFO,
  ]

  it("preenche padrao com o resolvedModel da entrada default e a deixa fora de modelos", () => {
    const lista = montarListaDeModelos(comPadrao)
    expect(lista.padrao).toBe("claude-opus-5-5")
    expect(lista.modelos.map((m) => m.value)).toEqual(["haiku", "sonnet", "opus", "claude-haiku-5-5", "claude-opus-5-5"])
  })

  it("sem resolvedModel, padrao cai no displayName; sem entrada default, é null", () => {
    expect(montarListaDeModelos([{ value: "default", displayName: "Default (recommended)", description: "" }]).padrao).toBe("Default (recommended)")
    expect(montarListaDeModelos(INFO).padrao).toBeNull()
    expect(montarListaDeModelos(null).padrao).toBeNull()
  })

  it("guarda o resolvedModel dos apelidos em resolvido", () => {
    const por = (v: string) => montarListaDeModelos(INFO).modelos.find((m) => m.value === v)
    expect(por("sonnet")?.resolvido).toBe("claude-sonnet-5-5")
    expect(por("opus")?.resolvido).toBeUndefined()
    expect(por("claude-opus-5-5")?.resolvido).toBeUndefined()
  })
})

describe("rotuloDoModelo", () => {
  it("lê família e versão do id", () => {
    expect(rotuloDoModelo("claude-sonnet-5-5")).toEqual({ familia: "sonnet", texto: "Sonnet 5.5" })
    expect(rotuloDoModelo("claude-fable-5-1")).toEqual({ familia: "fable", texto: "Fable 5.1" })
  })

  it("ignora o que vem depois da versão (datas, sufixos)", () => {
    expect(rotuloDoModelo("claude-opus-4-1-20250805")).toEqual({ familia: "opus", texto: "Opus 4.1" })
  })

  it("fora do padrão, usa o nome do SDK ou o próprio id", () => {
    expect(rotuloDoModelo("gpt-x", "Algo")).toEqual({ familia: null, texto: "Algo" })
    expect(rotuloDoModelo("gpt-x")).toEqual({ familia: null, texto: "gpt-x" })
  })
})

describe("seloDoModelo", () => {
  const lista = montarListaDeModelos([
    { value: "default", resolvedModel: "claude-opus-5-5", displayName: "Default", description: "" },
    ...INFO,
  ])

  it("apelido com versão conhecida mostra a versão para a qual aponta", () => {
    expect(seloDoModelo("sonnet", lista)).toEqual({ familia: "sonnet", texto: "Sonnet 5.5", apelido: true, fixo: false, padrao: false })
  })

  it("apelido sem versão conhecida mostra só a família", () => {
    expect(seloDoModelo("sonnet", montarListaDeModelos(null))).toMatchObject({ familia: "sonnet", texto: "Sonnet", apelido: true, fixo: false })
    expect(seloDoModelo("opus", lista)).toMatchObject({ familia: "opus", texto: "Opus", apelido: true })
  })

  it("id fixo mostra o rótulo do id", () => {
    expect(seloDoModelo("claude-opus-5-5", lista)).toEqual({ familia: "opus", texto: "Opus 5.5", apelido: false, fixo: true, padrao: false })
  })

  it("id fixo fora da lista ainda ganha rótulo pelo id", () => {
    expect(seloDoModelo("claude-velho-4-0", lista)).toMatchObject({ familia: "velho", texto: "Velho 4.0", fixo: true })
  })

  it("id fora do padrão usa o nome da lista, ou o próprio id", () => {
    const outra = montarListaDeModelos([{ value: "modelo-x", displayName: "Modelo X", description: "" }])
    expect(seloDoModelo("modelo-x", outra)).toMatchObject({ familia: null, texto: "Modelo X", fixo: true })
    expect(seloDoModelo("modelo-y", outra)).toMatchObject({ familia: null, texto: "modelo-y", fixo: true })
  })

  it("o valor `default` gravado vale como null: selo de padrão", () => {
    expect(seloDoModelo("default", lista)).toEqual(seloDoModelo(null, lista))
    expect(seloDoModelo("default", lista)).toMatchObject({ texto: "Padrão (Opus 5.5)", padrao: true, fixo: false })
  })

  it("null é o padrão, com o modelo padrão entre parênteses quando conhecido", () => {
    expect(seloDoModelo(null, lista)).toEqual({ familia: null, texto: "Padrão (Opus 5.5)", apelido: false, fixo: false, padrao: true })
    expect(seloDoModelo(null, montarListaDeModelos(INFO))).toMatchObject({ texto: "Padrão", padrao: true })
  })
})

describe("esforço: rótulos, frases e segmentos", () => {
  it("rótulos dos cinco níveis", () => {
    expect(ROTULOS_ESFORCO).toEqual({ low: "Baixo", medium: "Médio", high: "Alto", xhigh: "Muito alto", max: "Máximo" })
  })

  it("frases dos cinco níveis e do padrão", () => {
    expect(FRASES_ESFORCO).toEqual({
      padrao: "deixa o Claude Code decidir",
      low: "respostas rápidas, pouca reflexão",
      medium: "equilíbrio entre rapidez e cuidado",
      high: "pensa com cuidado antes de responder",
      xhigh: "reflexão longa, para problemas difíceis",
      max: "o máximo de reflexão, mais lento e caro",
    })
  })

  it("segmentos acesos, de 0 (padrão) a 5", () => {
    expect(segmentosDoEsforco(null)).toBe(0)
    expect([..."low medium high xhigh max".split(" ")].map((n) => segmentosDoEsforco(n as never))).toEqual([1, 2, 3, 4, 5])
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
      expect((e as Error).message).toMatch(/não aceita esforço; deixe o esforço em Padrão/)
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
      return { ...semMensagensAteAbortar(options), supportedModels: async () => INFO }
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
        ...semMensagensAteAbortar(options),
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
          return { ...semMensagensAteAbortar(options), supportedModels: () => new Promise<InfoModeloSdk[]>(() => {}) }
        },
        50,
      ),
    ).rejects.toThrow(/tempo/)
    expect(controle?.signal.aborted).toBe(true)
  })

  it("repassa o cwd às opções só quando informado", async () => {
    const vistos: Array<string | undefined> = []
    const consulta = ({ options }: { options: { cwd?: string; abortController?: AbortController } }) => {
      vistos.push(options.cwd)
      return { ...semMensagensAteAbortar(options), supportedModels: async () => INFO }
    }
    await consultarModelosSdk({}, consulta, 50, "/raiz/do/projeto")
    await consultarModelosSdk({}, consulta)
    expect(vistos).toEqual(["/raiz/do/projeto", undefined])
  })

  it("propaga a falha da consulta e aborta", async () => {
    let controle: AbortController | undefined
    await expect(
      consultarModelosSdk({}, ({ options }) => {
        controle = options.abortController
        return { ...semMensagensAteAbortar(options), supportedModels: async () => Promise.reject(new Error("sem rede")) }
      }),
    ).rejects.toThrow("sem rede")
    expect(controle?.signal.aborted).toBe(true)
  })

  it("rejeição do iterador depois do abort não vira unhandledRejection", async () => {
    const naoTratadas: unknown[] = []
    const ouvinte = (motivo: unknown) => naoTratadas.push(motivo)
    process.on("unhandledRejection", ouvinte)
    try {
      await consultarModelosSdk({}, ({ options }) => {
        // Como no SDK, a falha nasce do abort por conta própria: quem não consumir o iterador deixa a rejeição solta.
        const falha = new Promise<never>((_, rejeitar) =>
          options.abortController?.signal.addEventListener("abort", () => rejeitar(new Error("sessão abortada")), { once: true }),
        )
        return {
          [Symbol.asyncIterator]: () => ({ next: () => falha }),
          supportedModels: async () => INFO,
        }
      })
      // dá tempo de a rejeição do iterador (disparada pelo abort) acontecer e de o Node reportar uma eventual não tratada
      await new Promise((r) => setTimeout(r, 50))
    } finally {
      process.off("unhandledRejection", ouvinte)
    }
    expect(naoTratadas).toEqual([])
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

  it("duas chamadas durante a mesma busca fazem uma busca só", async () => {
    let buscas = 0
    let liberar!: () => void
    const cache = criarCacheDeModelos(async () => {
      buscas++
      await new Promise<void>((r) => (liberar = r))
      return INFO
    })
    const a = cache()
    const b = cache()
    liberar()
    expect(await a).toBe(await b)
    expect(buscas).toBe(1)
  })

  it("em falha devolve só os apelidos, registra o erro uma vez e tenta de novo na chamada seguinte", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    let buscas = 0
    const cache = criarCacheDeModelos(async () => {
      buscas++
      if (buscas === 1) throw new Error("fora do ar")
      return INFO
    })
    const falha = await cache()
    expect(falha.completa).toBe(false)
    expect(falha.modelos.map((m) => m.value)).toEqual(["haiku", "sonnet", "opus"])
    expect(erro).toHaveBeenCalledTimes(1)
    expect(String(erro.mock.calls[0]?.[0])).toContain("fora do ar")
    erro.mockRestore()
    const ok = await cache()
    expect(buscas).toBe(2)
    expect(ok.completa).toBe(true)
  })
})

// Módulos de core que os componentes do cliente do web importam (direta ou transitivamente) como valor.
const MODULOS_DO_CLIENTE = ["modelos.ts", "erros.ts", "autenticacao.ts", "seguranca.ts"]

describe("módulos importados pelo cliente do web", () => {
  it.each(MODULOS_DO_CLIENTE)("%s não importa módulos do Node", (arquivo) => {
    const fonte = readFileSync(path.join(import.meta.dirname, "../src", arquivo), "utf8")
    expect(fonte).not.toMatch(/from\s+["']node:/)
    expect(fonte).not.toMatch(/require\(\s*["']node:/)
  })
})
