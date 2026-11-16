import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { montarRoteiro } from "../src/ensaio/montar"
import { pastaEnsaio, type ChamadaGravada } from "../src/ensaio/roteiro"
import { FakeExecutor } from "../src/executor/fake"
import { GravadorExecutor, type LinhaGravacao } from "../src/executor/gravador"
import type { ContextoTurno, EventoExecutor, PedidoTurno } from "../src/executor/tipos"
import { raizTemporaria } from "./ajuda"

let raiz: string

beforeEach(async () => {
  raiz = await raizTemporaria()
})

function contexto(sobrescrever: Partial<ContextoTurno> = {}): ContextoTurno {
  return { slug: "acme", etapa: "03", fixture: "mini", trecho: null, textoAnalista: "Segue a planilha.", mensagemTurno: "Segue a planilha.", automatica: false, ...sobrescrever }
}

function pedido(ctx: ContextoTurno | undefined): PedidoTurno {
  return { cwd: raiz, mensagem: "prompt de abertura\n\n---\n\nSegue a planilha.", sessionId: null, systemPrompt: "", mcpConfig: "{}", settings: "{}", allowedTools: [], contexto: ctx }
}

async function coletar(it: AsyncIterable<EventoExecutor>): Promise<EventoExecutor[]> {
  const eventos: EventoExecutor[] = []
  for await (const e of it) eventos.push(e)
  return eventos
}

async function existe(arquivo: string): Promise<boolean> {
  return access(arquivo).then(
    () => true,
    () => false,
  )
}

const rascunho = "clientes/acme/.app/rascunhos/g.png"

function turnoComGrafico(nomeFerramenta = "mcp__planejamento__propor_entregavel") {
  return new FakeExecutor(async function* () {
    yield { tipo: "sessao", sessionId: "s1" }
    yield { tipo: "texto", texto: "Aqui está." }
    yield { tipo: "ferramenta", id: "t1", nome: nomeFerramenta, entrada: { tipo: "grafico", arquivo_rascunho: rascunho } }
    yield { tipo: "ferramenta_resultado", id: "t1", erro: false }
    yield { tipo: "fim", ok: true, erro: null, sessionId: "s1" }
  })
}

async function prepararRascunho(): Promise<void> {
  await mkdir(path.join(raiz, "clientes/acme/.app/rascunhos"), { recursive: true })
  await writeFile(path.join(raiz, rascunho), "png")
}

describe("GravadorExecutor", () => {
  it("repassa todos os eventos, grava uma linha em gravacao.jsonl e copia o rascunho citado", async () => {
    await prepararRascunho()
    let agora = 1000
    const gravador = new GravadorExecutor(turnoComGrafico(), { raiz, agora: () => (agora += 10) })
    const eventos = await coletar(gravador.executar(pedido(contexto()), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto", "ferramenta", "ferramenta_resultado", "fim"])

    const pasta = pastaEnsaio(raiz, "mini", "03")
    const linhas = (await readFile(path.join(pasta, "gravacao.jsonl"), "utf8")).trim().split("\n")
    expect(linhas).toHaveLength(1)
    const linha = JSON.parse(linhas[0]!) as LinhaGravacao
    expect(linha.mensagem).toBe("Segue a planilha.")
    expect(linha.automatica).toBe(false)
    expect(linha.textoAnalista).toBe("Segue a planilha.")
    expect(linha.eventos.map((e) => e.evento.tipo)).toEqual(["sessao", "texto", "ferramenta", "ferramenta_resultado", "fim"])
    expect(linha.eventos.map((e) => e.tMs)).toEqual([10, 20, 30, 40, 50])
    expect(await readFile(path.join(pasta, "arquivos/1-g.png"), "utf8")).toBe("png")
  })

  it("copia o rascunho também de propor_validacao_cliente", async () => {
    await prepararRascunho()
    const gravador = new GravadorExecutor(turnoComGrafico("mcp__planejamento__propor_validacao_cliente"), { raiz })
    await coletar(gravador.executar(pedido(contexto()), new AbortController().signal))
    expect(await existe(path.join(pastaEnsaio(raiz, "mini", "03"), "arquivos/1-g.png"))).toBe(true)
  })

  it("acrescenta uma linha por turno", async () => {
    await prepararRascunho()
    const gravador = new GravadorExecutor(turnoComGrafico(), { raiz })
    await coletar(gravador.executar(pedido(contexto()), new AbortController().signal))
    await coletar(gravador.executar(pedido(contexto({ mensagemTurno: "Outra.", textoAnalista: "Outra." })), new AbortController().signal))
    const linhas = (await readFile(path.join(pastaEnsaio(raiz, "mini", "03"), "gravacao.jsonl"), "utf8")).trim().split("\n")
    expect(linhas.map((l) => (JSON.parse(l) as LinhaGravacao).mensagem)).toEqual(["Segue a planilha.", "Outra."])
  })

  it("rascunhos de mesmo nome em turnos diferentes ganham cópias distintas, e cada linha aponta para a sua", async () => {
    const gravador = new GravadorExecutor(turnoComGrafico(), { raiz })
    const pasta = pastaEnsaio(raiz, "mini", "03")
    await mkdir(path.join(raiz, "clientes/acme/.app/rascunhos"), { recursive: true })
    await writeFile(path.join(raiz, rascunho), "versao 1")
    await coletar(gravador.executar(pedido(contexto()), new AbortController().signal))
    await writeFile(path.join(raiz, rascunho), "versao 2")
    // outra instância: o contador sai do que já está na pasta, não da memória
    const eventos = await coletar(
      new GravadorExecutor(turnoComGrafico(), { raiz }).executar(
        pedido(contexto({ mensagemTurno: "AJUSTE no entregável “G”: troque a cor", textoAnalista: "troque a cor" })),
        new AbortController().signal,
      ),
    )
    expect(await readFile(path.join(pasta, "arquivos/1-g.png"), "utf8")).toBe("versao 1")
    expect(await readFile(path.join(pasta, "arquivos/2-g.png"), "utf8")).toBe("versao 2")
    // o evento repassado ao app segue com o caminho original
    expect(eventos[2]).toMatchObject({ entrada: { arquivo_rascunho: rascunho } })

    const linhas = (await readFile(path.join(pasta, "gravacao.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l) as LinhaGravacao)
    const rascunhosGravados = linhas.map((l) => {
      const ev = l.eventos.find((e) => e.evento.tipo === "ferramenta")!.evento as Extract<EventoExecutor, { tipo: "ferramenta" }>
      return (ev.entrada as { arquivo_rascunho: string }).arquivo_rascunho
    })
    expect(rascunhosGravados).toEqual(["clientes/acme/.app/rascunhos/1-g.png", "clientes/acme/.app/rascunhos/2-g.png"])

    const roteiro = montarRoteiro("03", linhas)
    const nomes = roteiro.trechos.map((t) => (t.passos.find((p) => "ferramenta" in p) as ChamadaGravada).entrada.arquivo_rascunho)
    expect(nomes).toEqual(["1-g.png", "2-g.png"])
  })

  it("turno de abertura: mensagem vazia, automática e sem texto do analista", async () => {
    const gravador = new GravadorExecutor(turnoComGrafico("Read"), { raiz })
    await coletar(gravador.executar(pedido(contexto({ mensagemTurno: null, textoAnalista: null, automatica: true })), new AbortController().signal))
    const linha = JSON.parse((await readFile(path.join(pastaEnsaio(raiz, "mini", "03"), "gravacao.jsonl"), "utf8")).trim()) as LinhaGravacao
    expect(linha).toMatchObject({ mensagem: "", automatica: true, textoAnalista: null })
  })

  it("sem contexto.fixture, repassa os eventos e não grava nada", async () => {
    await prepararRascunho()
    const gravador = new GravadorExecutor(turnoComGrafico(), { raiz })
    const eventos = await coletar(gravador.executar(pedido(contexto({ fixture: null })), new AbortController().signal))
    expect(eventos).toHaveLength(5)
    expect(await existe(path.join(raiz, "clientes/_fixtures"))).toBe(false)
    const semContexto = await coletar(gravador.executar(pedido(undefined), new AbortController().signal))
    expect(semContexto).toHaveLength(5)
    expect(await existe(path.join(raiz, "clientes/_fixtures"))).toBe(false)
  })

  it("não grava a reprodução de um trecho de ensaio", async () => {
    const trecho = { gatilho: "mensagem" as const, textoPreenchido: null, passos: [] }
    const gravador = new GravadorExecutor(turnoComGrafico("Read"), { raiz })
    await coletar(gravador.executar(pedido(contexto({ trecho })), new AbortController().signal))
    expect(await existe(path.join(pastaEnsaio(raiz, "mini", "03"), "gravacao.jsonl"))).toBe(false)
  })

  it("não grava turno que terminou com erro nem turno abortado", async () => {
    const falho = new FakeExecutor(async function* () {
      yield { tipo: "fim", ok: false, erro: "falhou", sessionId: null }
    })
    await coletar(new GravadorExecutor(falho, { raiz }).executar(pedido(contexto()), new AbortController().signal))
    const abortado = new AbortController()
    abortado.abort()
    await coletar(new GravadorExecutor(turnoComGrafico("Read"), { raiz }).executar(pedido(contexto()), abortado.signal))
    expect(await existe(path.join(pastaEnsaio(raiz, "mini", "03"), "gravacao.jsonl"))).toBe(false)
  })

  it("rascunho que não existe ou que está fora da pasta do prospect não derruba o turno nem é copiado", async () => {
    const fora = new FakeExecutor(async function* () {
      yield { tipo: "ferramenta", id: "t1", nome: "mcp__planejamento__propor_entregavel", entrada: { arquivo_rascunho: "../../fora.png" } }
      yield { tipo: "ferramenta", id: "t2", nome: "mcp__planejamento__propor_entregavel", entrada: { arquivo_rascunho: "clientes/acme/.app/rascunhos/nao-existe.png" } }
      yield { tipo: "fim", ok: true, erro: null, sessionId: null }
    })
    const eventos = await coletar(new GravadorExecutor(fora, { raiz }).executar(pedido(contexto()), new AbortController().signal))
    expect(eventos).toHaveLength(3)
    const pasta = pastaEnsaio(raiz, "mini", "03")
    expect(await existe(path.join(pasta, "arquivos/fora.png"))).toBe(false)
    expect(await existe(path.join(pasta, "arquivos/nao-existe.png"))).toBe(false)
    expect(await existe(path.join(pasta, "gravacao.jsonl"))).toBe(true)
  })
})
