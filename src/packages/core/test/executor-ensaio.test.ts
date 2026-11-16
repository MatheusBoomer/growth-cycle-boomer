import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { pastaEnsaio, type TrechoEnsaio } from "../src/ensaio/roteiro"
import { criarExecutorEnsaio, FATOR_TEMPO, ESPERA_MAXIMA_MS } from "../src/executor/ensaio"
import type { EventoExecutor, PedidoTurno } from "../src/executor/tipos"
import { raizTemporaria } from "./ajuda"

const FIM_DO_ROTEIRO = "O ensaio desta etapa terminou. Use Concluir etapa, ou o seletor de etapa para recomeçar."

let raiz: string

beforeEach(async () => {
  raiz = await raizTemporaria()
})

function pedido(trecho: TrechoEnsaio | null): PedidoTurno {
  return {
    cwd: raiz,
    mensagem: "oi",
    sessionId: null,
    systemPrompt: "",
    mcpConfig: "{}",
    settings: "{}",
    allowedTools: [],
    contexto: { slug: "acme", etapa: "03", fixture: "mini", trecho, textoAnalista: null, mensagemTurno: null, automatica: true },
  }
}

async function coletar(it: AsyncIterable<EventoExecutor>): Promise<EventoExecutor[]> {
  const eventos: EventoExecutor[] = []
  for await (const e of it) eventos.push(e)
  return eventos
}

const trechoComChamada: TrechoEnsaio = {
  gatilho: "mensagem",
  textoPreenchido: null,
  passos: [
    { dtMs: 400, evento: { tipo: "texto_delta", texto: "Olá" } },
    { dtMs: 10000, evento: { tipo: "texto", texto: "Olá, analista" } },
    { dtMs: 100, ferramenta: "propor_entregavel", entrada: { tipo: "grafico", arquivo_rascunho: "/qualquer/lugar/grafico.png" } },
  ],
}

async function gravarArquivoDoPacote(nome: string): Promise<void> {
  const pasta = path.join(pastaEnsaio(raiz, "mini", "03"), "arquivos")
  await mkdir(pasta, { recursive: true })
  await writeFile(path.join(pasta, nome), "conteudo")
}

describe("criarExecutorEnsaio", () => {
  it("usa fator de 25% e espera máxima de 2000 ms", () => {
    expect(FATOR_TEMPO).toBe(0.25)
    expect(ESPERA_MAXIMA_MS).toBe(2000)
  })

  it("reemite os eventos na ordem, com as esperas reduzidas e limitadas", async () => {
    await gravarArquivoDoPacote("grafico.png")
    const esperas: number[] = []
    const chamadas: { nome: string; entrada: unknown }[] = []
    const executor = criarExecutorEnsaio({
      dormir: async (ms) => void esperas.push(ms),
      chamarFerramenta: async (_p, nome, entrada) => {
        chamadas.push({ nome, entrada })
        return "ok"
      },
    })
    const eventos = await coletar(executor.executar(pedido(trechoComChamada), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto_delta", "texto", "ferramenta", "ferramenta_resultado", "fim"])
    expect(esperas).toEqual([100, 2000, 25])
    expect(eventos[0]).toEqual({ tipo: "sessao", sessionId: "ensaio-acme-03" })
    const ferramenta = eventos[3] as Extract<EventoExecutor, { tipo: "ferramenta" }>
    expect(ferramenta.nome).toBe("mcp__planejamento__propor_entregavel")
    const resultado = eventos[4] as Extract<EventoExecutor, { tipo: "ferramenta_resultado" }>
    expect(resultado.id).toBe(ferramenta.id)
    expect(resultado.erro).toBe(false)
    expect(eventos[5]).toEqual({ tipo: "fim", ok: true, erro: null, sessionId: "ensaio-acme-03" })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.nome).toBe("propor_entregavel")
  })

  it("copia o arquivo do pacote para os rascunhos do prospect antes de chamar a ferramenta", async () => {
    await gravarArquivoDoPacote("grafico.png")
    const relativo = path.join("clientes", "acme", ".app", "rascunhos", "grafico.png")
    let existiaNaChamada = false
    let recebida: Record<string, unknown> = {}
    const executor = criarExecutorEnsaio({
      dormir: async () => {},
      chamarFerramenta: async (_p, _nome, entrada) => {
        recebida = entrada as Record<string, unknown>
        await access(path.join(raiz, relativo)).then(() => (existiaNaChamada = true))
        return "ok"
      },
    })
    const eventos = await coletar(executor.executar(pedido(trechoComChamada), new AbortController().signal))
    expect(existiaNaChamada).toBe(true)
    expect(recebida.arquivo_rascunho).toBe(relativo)
    expect(recebida.tipo).toBe("grafico")
    const ferramenta = eventos.find((e) => e.tipo === "ferramenta") as Extract<EventoExecutor, { tipo: "ferramenta" }>
    expect((ferramenta.entrada as Record<string, unknown>).arquivo_rascunho).toBe(relativo)
  })

  it("sem trecho, responde que o roteiro acabou e não chama ferramenta", async () => {
    let chamou = false
    const executor = criarExecutorEnsaio({
      dormir: async () => {},
      chamarFerramenta: async () => {
        chamou = true
        return "ok"
      },
    })
    const eventos = await coletar(executor.executar(pedido(null), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto", "fim"])
    expect(eventos[1]).toEqual({ tipo: "texto", texto: FIM_DO_ROTEIRO })
    expect(eventos[2]).toMatchObject({ tipo: "fim", ok: true })
    expect(chamou).toBe(false)
  })

  it("arquivo ausente no pacote termina com erro citando o caminho", async () => {
    const executor = criarExecutorEnsaio({ dormir: async () => {}, chamarFerramenta: async () => "ok" })
    const eventos = await coletar(executor.executar(pedido(trechoComChamada), new AbortController().signal))
    const ultimo = eventos[eventos.length - 1] as Extract<EventoExecutor, { tipo: "fim" }>
    expect(ultimo.tipo).toBe("fim")
    expect(ultimo.ok).toBe(false)
    expect(ultimo.erro).toContain("arquivos/grafico.png")
    expect(eventos.some((e) => e.tipo === "ferramenta")).toBe(false)
  })

  it("marca o resultado como erro quando a chamada da ferramenta falha", async () => {
    await gravarArquivoDoPacote("grafico.png")
    const executor = criarExecutorEnsaio({
      dormir: async () => {},
      chamarFerramenta: async () => {
        throw new Error("sem conexão")
      },
    })
    const eventos = await coletar(executor.executar(pedido(trechoComChamada), new AbortController().signal))
    const resultado = eventos.find((e) => e.tipo === "ferramenta_resultado") as Extract<EventoExecutor, { tipo: "ferramenta_resultado" }>
    expect(resultado.erro).toBe(true)
    expect(eventos[eventos.length - 1]).toMatchObject({ tipo: "fim", ok: true })
  })

  it("sem contexto de ensaio, termina com erro explicativo", async () => {
    const semContexto = { ...pedido(null), contexto: undefined }
    const executor = criarExecutorEnsaio({ dormir: async () => {} })
    const eventos = await coletar(executor.executar(semContexto, new AbortController().signal))
    const ultimo = eventos[eventos.length - 1] as Extract<EventoExecutor, { tipo: "fim" }>
    expect(ultimo).toMatchObject({ tipo: "fim", ok: false })
    expect(ultimo.erro).toContain("ensaio")
    const semFixture = pedido(null)
    semFixture.contexto = { ...semFixture.contexto!, fixture: null }
    const eventos2 = await coletar(executor.executar(semFixture, new AbortController().signal))
    expect(eventos2[eventos2.length - 1]).toMatchObject({ tipo: "fim", ok: false })
  })
})
