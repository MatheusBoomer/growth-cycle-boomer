import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AgentSdkExecutor, diretoriosExtrasDoAgente, montarOpcoesSdk, type ConsultaSdk } from "../src/executor/agent-sdk"
import type { EventoExecutor, PedidoTurno } from "../src/executor/tipos"

const pedido = (sessionId: string | null = null): PedidoTurno => ({
  cwd: tmpdir(),
  mensagem: "olá",
  sessionId,
  systemPrompt: "SP",
  mcpConfig: '{"mcpServers":{"planejamento":{"command":"node","args":["s.ts"]}}}',
  settings: '{"hooks":{}}',
  allowedTools: ["Read", "Bash(python3 *)"],
})

async function coletar(it: AsyncIterable<EventoExecutor>) {
  const r: EventoExecutor[] = []
  for await (const e of it) r.push(e)
  return r
}

const mensagens = [
  { type: "system", subtype: "init", session_id: "s1" },
  { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "oi" } } },
  { type: "assistant", message: { content: [{ type: "text", text: "oi" }] } },
  { type: "result", subtype: "success", is_error: false, session_id: "s1", result: "oi" },
]

const consultaCom = (itens: unknown[]): ConsultaSdk =>
  async function* () {
    yield* itens
  }

const chaveOriginal = process.env.ANTHROPIC_API_KEY
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "chave-de-teste"
})
afterEach(() => {
  if (chaveOriginal === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = chaveOriginal
})

describe("montarOpcoesSdk", () => {
  it("traduz o pedido nas opções do SDK e só usa resume com sessão", () => {
    const controle = new AbortController()
    const sem = montarOpcoesSdk(pedido(), controle, {})
    expect(sem.cwd).toBe(tmpdir())
    expect(sem.systemPrompt).toEqual({ type: "preset", preset: "claude_code", append: "SP" })
    expect(sem.mcpServers).toEqual({ planejamento: { command: "node", args: ["s.ts"] } })
    expect(sem.settings).toEqual({ hooks: {} })
    expect(sem.allowedTools).toEqual(["Read", "Bash(python3 *)"])
    expect(sem.includePartialMessages).toBe(true)
    expect(sem.abortController).toBe(controle)
    expect(sem.resume).toBeUndefined()
    expect(montarOpcoesSdk(pedido("abc"), controle, {}).resume).toBe("abc")
  })

  it("sem extras, as opções têm exatamente as chaves de sempre", () => {
    const chaves = Object.keys(montarOpcoesSdk({ ...pedido(), cwd: path.join(tmpdir(), "inexistente-xyz") }, new AbortController(), {}))
    expect(chaves.sort()).toEqual(
      ["abortController", "allowedTools", "cwd", "env", "includePartialMessages", "mcpServers", "settings", "systemPrompt"].sort(),
    )
  })

  it("com modelo, esforço e agentes, acrescenta model, effort e agents", () => {
    const agentes = { "analista-dados": { description: "d", prompt: "p", tools: ["Read"], model: "haiku", effort: "low" as const } }
    const opcoes = montarOpcoesSdk(
      { ...pedido(), modelo: "haiku", esforco: "low", agentes },
      new AbortController(),
      {},
    )
    expect(opcoes.model).toBe("haiku")
    expect(opcoes.effort).toBe("low")
    expect(opcoes.agents).toEqual(agentes)
  })
})

describe("pasta clientes como link (volume da nuvem)", () => {
  let raiz: string
  beforeEach(() => {
    raiz = realpathSync(mkdtempSync(path.join(tmpdir(), "agente-sdk-")))
  })
  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true })
  })

  it("com clientes apontando para outra pasta, libera o caminho real", () => {
    mkdirSync(path.join(raiz, "dados"))
    symlinkSync(path.join(raiz, "dados"), path.join(raiz, "clientes"))
    const real = realpathSync(path.join(raiz, "dados"))
    expect(diretoriosExtrasDoAgente(raiz)).toEqual([real])
    const opcoes = montarOpcoesSdk({ ...pedido(), cwd: raiz }, new AbortController(), {})
    expect(opcoes.additionalDirectories).toEqual([real])
    expect(opcoes.cwd).toBe(raiz)
  })

  it("com clientes como pasta comum, não define a opção", () => {
    mkdirSync(path.join(raiz, "clientes"))
    expect(diretoriosExtrasDoAgente(raiz)).toEqual([])
    const opcoes = montarOpcoesSdk({ ...pedido(), cwd: raiz }, new AbortController(), {})
    expect("additionalDirectories" in opcoes).toBe(false)
  })

  it("sem pasta clientes, não define a opção", () => {
    expect(diretoriosExtrasDoAgente(raiz)).toEqual([])
    const opcoes = montarOpcoesSdk({ ...pedido(), cwd: raiz }, new AbortController(), {})
    expect("additionalDirectories" in opcoes).toBe(false)
  })

  it("com link quebrado, não define a opção", () => {
    symlinkSync(path.join(raiz, "inexistente"), path.join(raiz, "clientes"))
    expect(diretoriosExtrasDoAgente(raiz)).toEqual([])
  })
})

describe("AgentSdkExecutor", () => {
  it("converte as mensagens do SDK nos mesmos eventos do CLI", async () => {
    const exec = new AgentSdkExecutor({ consulta: consultaCom(mensagens) })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto_delta", "texto", "fim"])
    expect(eventos.at(-1)).toEqual({ tipo: "fim", ok: true, erro: null, sessionId: "s1" })
  })

  it("passa a mensagem e a chave de API para o SDK", async () => {
    let recebido: Parameters<ConsultaSdk>[0] | undefined
    const exec = new AgentSdkExecutor({
      consulta: (entrada) => {
        recebido = entrada
        return consultaCom(mensagens)(entrada)
      },
    })
    await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(recebido?.prompt).toBe("olá")
    expect(recebido?.options.env?.ANTHROPIC_API_KEY).toBe("chave-de-teste")
  })

  it("o subprocesso do agente não recebe nenhuma chave SUPABASE_* nem segredo fora da lista", async () => {
    const originais = { ...process.env }
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    process.env.SUPABASE_URL = "https://x.supabase.co"
    process.env.PLANEJAMENTO_APP_URL = "https://app.exemplo.com"
    process.env.DATABASE_URL = "postgres://x"
    try {
      let recebido: Parameters<ConsultaSdk>[0] | undefined
      const exec = new AgentSdkExecutor({
        consulta: (entrada) => {
          recebido = entrada
          return consultaCom(mensagens)(entrada)
        },
      })
      await coletar(exec.executar(pedido(), new AbortController().signal))
      const chaves = Object.keys(recebido?.options.env ?? {})
      expect(chaves.filter((c) => c.startsWith("SUPABASE_"))).toEqual([])
      expect(chaves).not.toContain("PLANEJAMENTO_APP_URL")
      expect(chaves).not.toContain("DATABASE_URL")
      expect(recebido?.options.env?.ANTHROPIC_API_KEY).toBe("chave-de-teste")
    } finally {
      for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "PLANEJAMENTO_APP_URL", "DATABASE_URL"]) {
        if (originais[k] === undefined) delete process.env[k]
        else process.env[k] = originais[k]
      }
    }
  })

  it("sem chave de API, falha antes de chamar o SDK com mensagem legível", async () => {
    delete process.env.ANTHROPIC_API_KEY
    let chamou = false
    const exec = new AgentSdkExecutor({
      consulta: (entrada) => {
        chamou = true
        return consultaCom([])(entrada)
      },
    })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(chamou).toBe(false)
    expect(eventos).toEqual([
      { tipo: "fim", ok: false, erro: expect.stringContaining("ANTHROPIC_API_KEY"), sessionId: null },
    ])
  })

  it("erro lançado pelo SDK vira evento fim com a mensagem", async () => {
    const exec = new AgentSdkExecutor({
      consulta: async function* () {
        yield mensagens[0]
        throw new Error("credit balance is too low")
      },
    })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(eventos.at(-1)).toEqual({ tipo: "fim", ok: false, erro: "credit balance is too low", sessionId: null })
  })

  it("stream que termina sem result gera fim de erro", async () => {
    const exec = new AgentSdkExecutor({ consulta: consultaCom(mensagens.slice(0, 2)) })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", ok: false })
  })

  it("abortar repassa o sinal ao SDK e encerra como interrompido", async () => {
    const controle = new AbortController()
    const exec = new AgentSdkExecutor({
      consulta: ({ options }) =>
        (async function* () {
          yield mensagens[0]
          await new Promise<void>((_, rejeitar) => {
            options.abortController?.signal.addEventListener("abort", () => rejeitar(new Error("aborted")))
          })
        })(),
    })
    setTimeout(() => controle.abort(), 50)
    const eventos = await coletar(exec.executar(pedido(), controle.signal))
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", ok: false, erro: "Interrompido pelo analista." })
  })
})
