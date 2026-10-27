import { chmod, rm } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { NuvemArmazenamento } from "../src/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "../src/nuvem/memoria"
import { Mesa } from "../src/nuvem/mesa"
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

describe("reposicionarTeste no modo nuvem", () => {
  it("leva a remoção das pastas para a nuvem e limpa conversas e comentários", async () => {
    const armazem = new MemoriaArmazem()
    const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
    const nuvem = new NuvemArmazenamento({ raiz, repositorio: new MemoriaRepositorio(), armazem, mesa, atrasoAgendamentoMs: 0 })
    const servicoNuvem = new ServicoPlanejamento({
      armazenamento: nuvem,
      catalogo: catalogoReal(),
      barramento: new Barramento(),
      validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
      agora: () => "2026-10-22T10:00:00.000Z",
    })
    servicoNuvem.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
    const manifesto = async (slug: string) => (await armazem.listarManifesto(slug)).map((e) => e.caminho)

    const slug = await servicoNuvem.criarClienteTeste("mini", "03")
    await nuvem.sincronizar(slug)
    expect(await manifesto(slug)).toContain("contexto/contextualizacao-estrategica.md")
    await nuvem.anexarConversa(slug, "02", { tipo: "texto_agente", texto: "olá", em: "2026-10-22T10:00:00.000Z" })
    await nuvem.gravarComentarios(slug, "e2", [
      { id: "c1", slide: 1, regiao: null, campo: null, texto: "ajuste", criadoEm: "2026-10-22T10:00:00.000Z", enviadoEm: null },
    ])

    await servicoNuvem.reposicionarTeste(slug, "01")
    await nuvem.sincronizar(slug)

    expect(await manifesto(slug)).not.toContain("contexto/contextualizacao-estrategica.md")
    expect(await manifesto(slug)).toContain("contexto/status-planejamento.md")
    expect(await nuvem.lerConversa(slug, "02")).toEqual([])
    expect(await nuvem.lerComentarios(slug, "e2")).toEqual([])
    expect((await servicoNuvem.estado(slug)).etapas["01"].status).toBe("liberada")
  })
})

describe("falha no meio do reposicionamento", () => {
  it("mantém a marca de teste e permite reposicionar de novo depois de corrigir a causa", async () => {
    const slug = await servico.criarClienteTeste("mini", "01")
    const ilegivel = path.join(pastaDoFixture(raiz, "mini"), "base/contexto/kickoff-transcricao.md")
    await chmod(ilegivel, 0o000)
    try {
      await expect(servico.reposicionarTeste(slug, "03")).rejects.toThrow()
      const estado = await servico.estado(slug)
      expect(estado.teste).toEqual({ fixture: "mini", etapaInicial: "01" })
    } finally {
      await chmod(ilegivel, 0o644)
    }
    await servico.reposicionarTeste(slug, "03")
    expect((await servico.estado(slug)).etapas["03"].status).toBe("liberada")
    expect(await arm.existeArquivo(slug, "contexto/kickoff-transcricao.md")).toBe(true)
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
