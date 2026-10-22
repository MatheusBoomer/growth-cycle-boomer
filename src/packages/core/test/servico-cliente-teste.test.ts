import { rm } from "node:fs/promises"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroFixture, ErroNaoEhTeste, ErroProspectExistente, ErroTurnoAtivo } from "../src/erros"
import { pastaDoFixture } from "../src/fixture"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import type { EventoTempoReal } from "../src/tipos"
import { catalogoReal, raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

let raiz: string
let arm: FsArmazenamento
let servico: ServicoPlanejamento
let barramento: Barramento
let ocupado: boolean

beforeEach(async () => {
  raiz = await raizTemporaria()
  await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  arm = new FsArmazenamento(raiz, async () => {})
  barramento = new Barramento()
  ocupado = false
  servico = new ServicoPlanejamento({
    armazenamento: arm,
    catalogo: catalogoReal(),
    barramento,
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-10-22T10:00:00.000Z",
  })
  servico.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => ocupado })
})

describe("criarClienteTeste", () => {
  it("cria o prospect na etapa pedida, com overrides e estado.teste", async () => {
    const slug = await servico.criarClienteTeste("mini", "03")
    expect(slug).toBe("cliente-teste")
    const estado = await servico.estado(slug)
    expect(estado.etapas["03"].status).toBe("liberada")
    expect(estado.etapas["02"].status).toBe("concluida")
    expect(estado.teste).toEqual({ fixture: "mini", etapaInicial: "03" })
    expect(await arm.lerTexto(slug, "CLAUDE.md")).toContain("O site é simulado.")
    expect(await servico.dossie(slug, "03")).toContain("O site é simulado.")
  })

  it("começa na etapa 01 por padrão", async () => {
    const slug = await servico.criarClienteTeste("mini")
    expect((await servico.estado(slug)).etapas["01"].status).toBe("liberada")
  })

  it("criar duas vezes lança ErroProspectExistente", async () => {
    await servico.criarClienteTeste("mini")
    await expect(servico.criarClienteTeste("mini")).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("fixture inexistente lança ErroFixture e não cria a pasta", async () => {
    await expect(servico.criarClienteTeste("nao-existe")).rejects.toBeInstanceOf(ErroFixture)
    expect(await arm.listarSlugs()).toEqual([])
  })
})

describe("reposicionarTeste", () => {
  it("move para a etapa escolhida, regera o status-planejamento.md e publica evento de estado", async () => {
    const slug = await servico.criarClienteTeste("mini", "01")
    const eventos: EventoTempoReal[] = []
    barramento.assinar(slug, (e) => eventos.push(e))
    await servico.reposicionarTeste(slug, "03")
    const estado = await servico.estado(slug)
    expect(estado.etapas["03"].status).toBe("liberada")
    expect(estado.teste?.etapaInicial).toBe("03")
    expect(eventos).toContainEqual({ tipo: "estado" })
    const md = await arm.lerTexto(slug, "contexto/status-planejamento.md")
    expect(md).toContain("| 02 · Contextualização estratégica | ✅")
    expect(md).toContain("| 03 · Diagnóstico de performance | ⬜")
  })

  it("com o agente rodando lança ErroTurnoAtivo e não apaga nada", async () => {
    const slug = await servico.criarClienteTeste("mini", "03")
    await arm.gravarTexto(slug, "dados/marca.txt", "meu trabalho")
    ocupado = true
    await expect(servico.reposicionarTeste(slug, "01")).rejects.toBeInstanceOf(ErroTurnoAtivo)
    expect(await arm.lerTexto(slug, "dados/marca.txt")).toBe("meu trabalho")
    expect((await servico.estado(slug)).teste?.etapaInicial).toBe("03")
  })

  it("em prospect comum lança ErroNaoEhTeste e não apaga nada", async () => {
    const slug = await servico.criarProspect("Prospect Real", null)
    await arm.gravarTexto(slug, "contexto/x.md", "dado real")
    await expect(servico.reposicionarTeste(slug, "01")).rejects.toBeInstanceOf(ErroNaoEhTeste)
    expect(await arm.lerTexto(slug, "contexto/x.md")).toBe("dado real")
  })

  it("com o fixture ausente lança ErroFixture e mantém a pasta", async () => {
    const slug = await servico.criarClienteTeste("mini", "03")
    await arm.gravarTexto(slug, "dados/marca.txt", "meu trabalho")
    await rm(pastaDoFixture(raiz, "mini"), { recursive: true })
    await expect(servico.reposicionarTeste(slug, "01")).rejects.toBeInstanceOf(ErroFixture)
    expect(await arm.lerTexto(slug, "dados/marca.txt")).toBe("meu trabalho")
  })
})

describe("kitDaEtapa", () => {
  it("prospect comum responde teste: false", async () => {
    const slug = await servico.criarProspect("Prospect Real", null)
    expect(await servico.kitDaEtapa(slug)).toEqual({ teste: false })
  })

  it("devolve o kit da etapa de partida por padrão e o de outra etapa quando pedida", async () => {
    const slug = await servico.criarClienteTeste("mini", "01")
    expect(await servico.kitDaEtapa(slug)).toEqual({
      teste: true,
      fixture: "mini",
      etapaInicial: "01",
      etapa: "01",
      arquivos: ["kit-de-teste/01/kickoff-transcricao-bruta.md"],
      roteiro: "Roteiro da etapa 01",
    })
    const kit03 = await servico.kitDaEtapa(slug, "03")
    expect(kit03).toMatchObject({ teste: true, etapa: "03", arquivos: ["kit-de-teste/03/historico-mensal.xlsx"] })
  })
})

describe("listarProspects", () => {
  it("marca teste: true só no cliente de teste", async () => {
    await servico.criarClienteTeste("mini")
    await servico.criarProspect("Prospect Real", null)
    const lista = await servico.listarProspects()
    expect(lista.find((p) => p.slug === "cliente-teste")?.teste).toBe(true)
    expect(lista.find((p) => p.slug === "prospect-real")?.teste).toBe(false)
  })
})
