import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Comentario } from "../../src/comentarios"
import { ErroNaoEncontrado, ErroProspectExistente } from "../../src/erros"
import { estadoInicial } from "../../src/maquina-estados"
import { NuvemArmazenamento } from "../../src/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "../../src/nuvem/memoria"
import { Mesa } from "../../src/nuvem/mesa"
import { raizTemporaria } from "../ajuda"

const SLUG = "acme"
const AGORA = "2026-10-27T10:00:00.000Z"

describe("NuvemArmazenamento", () => {
  let raiz: string
  let repositorio: MemoriaRepositorio
  let armazem: MemoriaArmazem
  let mesa: Mesa
  let arm: NuvemArmazenamento

  const criar = () => new NuvemArmazenamento({ raiz, repositorio, armazem, mesa, atrasoAgendamentoMs: 0 })
  const manifesto = async () => (await armazem.listarManifesto(SLUG)).map((e) => e.caminho)
  const noDisco = (rel: string) => path.join(raiz, "clientes", SLUG, ...rel.split("/"))

  beforeEach(async () => {
    raiz = await raizTemporaria()
    repositorio = new MemoriaRepositorio()
    armazem = new MemoriaArmazem()
    mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
    arm = criar()
  })

  it("criar prospect: linha no banco, _template no disco e na nuvem", async () => {
    await arm.criarPasta(SLUG)
    expect(await repositorio.existe(SLUG)).toBe(true)
    expect(existsSync(noDisco("contexto/status-planejamento.md"))).toBe(true)
    expect(await manifesto()).toContain("contexto/status-planejamento.md")
    expect(await arm.listarSlugs()).toEqual([SLUG])
    await expect(arm.criarPasta(SLUG)).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("criar prospect grava o criador no repositório; sem criador, null", async () => {
    await arm.criarPasta(SLUG, "ana.souza@boomer.com.br")
    expect(repositorio.criadoPor(SLUG)).toBe("ana.souza@boomer.com.br")
    await arm.excluir(SLUG)
    await arm.criarPasta(SLUG)
    expect(repositorio.criadoPor(SLUG)).toBeNull()
  })

  it("recriar um prospect excluído começa do zero: sem manifesto antigo, sem conversa, template de novo", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarTexto(SLUG, "contexto/velho.md", "velho")
    await arm.gravarEstado(SLUG, estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA))
    await arm.anexarConversa(SLUG, "03", { tipo: "turno_inicio", em: "t1" })
    await arm.gravarComentarios(SLUG, "roteiro-1", [
      { id: "c1", slide: 1, regiao: null, campo: null, texto: "x", criadoEm: AGORA, enviadoEm: null },
    ])
    await mesa.sincronizar(SLUG)
    const sessao = new Uint8Array([1, 2, 3])
    await armazem.enviarSessao(SLUG, "sessao-1", sessao)
    expect(await manifesto()).toContain("contexto/velho.md")
    await arm.excluir(SLUG)

    await arm.criarPasta(SLUG)

    expect(await arm.listarSlugs()).toEqual([SLUG])
    const aposCriar = await manifesto()
    expect(aposCriar).not.toContain("contexto/velho.md")
    expect(aposCriar).toContain("contexto/status-planejamento.md")
    expect(existsSync(noDisco("contexto/velho.md"))).toBe(false)
    expect(existsSync(noDisco("contexto/status-planejamento.md"))).toBe(true)
    expect(await arm.lerEstado(SLUG)).toBeNull()
    expect(await arm.lerConversa(SLUG, "03")).toEqual([])
    expect(await arm.lerComentarios(SLUG, "roteiro-1")).toEqual([])
    expect(await armazem.baixarSessao(SLUG, "sessao-1")).toBeNull()
    await expect(arm.criarPasta(SLUG)).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("criar prospect novo limpa o que sobrou na nuvem para o slug, mesmo sem linha no banco", async () => {
    await armazem.enviar(SLUG, "dados/orfao.csv", new Uint8Array([9]))
    await arm.criarPasta(SLUG)
    expect(await manifesto()).not.toContain("dados/orfao.csv")
  })

  it("criar prospect ativo não apaga nada da nuvem", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarTexto(SLUG, "contexto/notas.md", "oi")
    await mesa.sincronizar(SLUG)
    const apagar = vi.spyOn(armazem, "apagarTudo")
    await expect(arm.criarPasta(SLUG)).rejects.toBeInstanceOf(ErroProspectExistente)
    expect(apagar).not.toHaveBeenCalled()
    expect(await manifesto()).toContain("contexto/notas.md")
  })

  it("estado e conversa vão ao repositório, não ao disco", async () => {
    await arm.criarPasta(SLUG)
    const e = estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA)
    await arm.gravarEstado(SLUG, e)
    await arm.anexarConversa(SLUG, "03", { tipo: "turno_inicio", em: "t1" })

    expect(existsSync(noDisco(".app/estado.json"))).toBe(false)
    expect(existsSync(noDisco(".app/conversas"))).toBe(false)
    expect((await repositorio.lerEstado(SLUG))?.versao).toBe(1)
    expect(await arm.lerEstado(SLUG)).toEqual(e)
    expect((await arm.lerConversa(SLUG, "03")).map((x) => x.tipo)).toEqual(["turno_inicio"])
    expect(await repositorio.lerConversa(SLUG, "03")).toHaveLength(1)
  })

  it("gravar estado de novo usa a versão lida e a anterior gravada", async () => {
    await arm.criarPasta(SLUG)
    const e = estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA)
    await arm.gravarEstado(SLUG, e)
    await arm.gravarEstado(SLUG, { ...e, atualizadoEm: "2026-10-27T11:00:00.000Z" })
    expect((await repositorio.lerEstado(SLUG))?.versao).toBe(2)
  })

  it("lerEstado aplica a normalização de etapas e perguntas", async () => {
    await arm.criarPasta(SLUG)
    const antigo = estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA) as unknown as Record<string, unknown> & {
      etapas: Record<string, unknown>
    }
    delete antigo.perguntas
    delete antigo.etapas["09"]
    await repositorio.gravarEstado(SLUG, antigo as never, 0)
    const lido = await arm.lerEstado(SLUG)
    expect(lido?.perguntas).toEqual([])
    expect(lido?.etapas["09"]?.status).toBe("bloqueada")
  })

  it("gravar arquivo agenda sincronização", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarTexto(SLUG, "contexto/notas.md", "oi")
    await vi.waitFor(async () => expect(await manifesto()).toContain("contexto/notas.md"))
  })

  it("primeira leitura do estado baixa os arquivos que faltam no disco", async () => {
    await arm.criarPasta(SLUG)
    // direto no disco, sem temporizador de sincronização que corra com a limpeza abaixo
    await writeFile(noDisco("dados/Relatório de clientes.csv"), "a,b")
    await mesa.sincronizar(SLUG)
    await arm.gravarEstado(SLUG, estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA))

    await rm(path.join(raiz, "clientes", SLUG), { recursive: true })
    const outra = criar()
    expect(await outra.lerEstado(SLUG)).not.toBeNull()
    expect(await readFile(noDisco("dados/Relatório de clientes.csv"), "utf8")).toBe("a,b")
    expect(existsSync(noDisco("contexto/status-planejamento.md"))).toBe(true)
  })

  it("lerEstado sincroniza uma vez por slug e segue lendo se a sincronização falha", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarEstado(SLUG, estadoInicial({ slug: SLUG, nome: "Acme", site: null }, AGORA))
    const outra = criar()
    const sincronizar = vi.spyOn(mesa, "sincronizar")
    armazem.falharEm = () => true
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await outra.lerEstado(SLUG)).not.toBeNull()
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
    armazem.falharEm = undefined
    await outra.lerEstado(SLUG)
    await outra.lerEstado(SLUG)
    // a primeira falhou (não conta como feita); a segunda passou; a terceira não sincroniza
    expect(sincronizar).toHaveBeenCalledTimes(2)
  })

  it("pasta local sem linha no banco: some da lista e recusa recriar", async () => {
    await mkdir(path.join(raiz, "clientes", "antigo"), { recursive: true })
    await writeFile(path.join(raiz, "clientes", "antigo", "nota.md"), "x")
    expect(await arm.listarSlugs()).not.toContain("antigo")
    expect(await arm.existe("antigo")).toBe(false)
    await expect(arm.criarPasta("antigo")).rejects.toBeInstanceOf(ErroProspectExistente)
    expect(await readFile(path.join(raiz, "clientes", "antigo", "nota.md"), "utf8")).toBe("x")
  })

  it("excluir: some da lista e apaga a pasta local, conteúdo segue na nuvem", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarTexto(SLUG, "contexto/notas.md", "oi")
    await mesa.sincronizar(SLUG)
    // o temporizador da gravação ainda está de pé: excluir tem de cancelá-lo
    await arm.excluir(SLUG)
    // espera um eventual temporizador de sincronização, que não pode trazer a pasta de volta
    await new Promise((r) => setTimeout(r, 20))
    expect(await arm.listarSlugs()).toEqual([])
    expect(existsSync(path.join(raiz, "clientes", SLUG))).toBe(false)
    expect(await manifesto()).toContain("contexto/notas.md")
    await expect(arm.excluir(SLUG)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("falha de sincronização marca pendente e a próxima que passa desmarca", async () => {
    await arm.criarPasta(SLUG)
    const marcar = vi.spyOn(repositorio, "marcarSincronizacao")
    await arm.gravarTexto(SLUG, "contexto/notas.md", "oi")
    armazem.falharEm = (op) => op === "enviar"
    await expect(arm.sincronizar(SLUG)).rejects.toMatchObject({ codigo: "sincronizacao_falhou" })
    expect(marcar).toHaveBeenLastCalledWith(SLUG, true)
    expect(repositorio.sincronizacaoPendente(SLUG)).toBe(true)

    armazem.falharEm = undefined
    await arm.sincronizar(SLUG)
    expect(marcar).toHaveBeenLastCalledWith(SLUG, false)
    expect(repositorio.sincronizacaoPendente(SLUG)).toBe(false)
  })

  it("agendarSincronizacao engole o erro e deixa o prospect pendente", async () => {
    await arm.criarPasta(SLUG)
    armazem.falharEm = (op) => op === "enviar"
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    await arm.gravarTexto(SLUG, "contexto/notas.md", "oi")
    await vi.waitFor(() => expect(repositorio.sincronizacaoPendente(SLUG)).toBe(true))
    erro.mockRestore()
  })

  it("comentários vão ao repositório", async () => {
    await arm.criarPasta(SLUG)
    const c: Comentario = { id: "c1", slide: 1, regiao: null, campo: null, texto: "ajustar", criadoEm: AGORA, enviadoEm: null }
    expect(await arm.lerComentarios(SLUG, "roteiro-1")).toEqual([])
    await arm.gravarComentarios(SLUG, "roteiro-1", [c])
    expect(await arm.lerComentarios(SLUG, "roteiro-1")).toEqual([c])
    expect(await repositorio.lerComentarios(SLUG, "roteiro-1")).toEqual([c])
    expect(existsSync(noDisco(".app/comentarios/roteiro-1.json"))).toBe(false)
  })

  it("moverParaLixeiraNoProspect apaga do disco e a sincronização tira da nuvem", async () => {
    await arm.criarPasta(SLUG)
    await arm.gravarTexto(SLUG, "dados/velho.csv", "x")
    await mesa.sincronizar(SLUG)
    await arm.moverParaLixeiraNoProspect(SLUG, "dados/velho.csv")
    expect(existsSync(noDisco("dados/velho.csv"))).toBe(false)
    await vi.waitFor(async () => expect(await manifesto()).not.toContain("dados/velho.csv"))
    await arm.moverParaLixeiraNoProspect(SLUG, "dados/inexistente.csv")
  })

  it("registrarUso vai ao repositório", async () => {
    await arm.registrarUso({
      slug: SLUG, etapa: "03", autor: null, custoUsd: 0.1, tokensEntrada: 1, tokensSaida: 2,
      inicio: AGORA, fim: AGORA, status: "ok",
    })
    expect(repositorio.usos).toHaveLength(1)
  })
})
