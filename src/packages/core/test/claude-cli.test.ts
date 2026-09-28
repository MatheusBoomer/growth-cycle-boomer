import { readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { ClaudeCliExecutor, montarArgsClaude } from "../src/executor/claude-cli"
import type { EventoExecutor, PedidoTurno } from "../src/executor/tipos"

const FALSO = fileURLToPath(new URL("./fixtures/claude-falso.mjs", import.meta.url))
const FIXTURE = fileURLToPath(new URL("./fixtures/stream-oi.jsonl", import.meta.url))

const pedido = (sessionId: string | null = null): PedidoTurno => ({
  cwd: tmpdir(),
  mensagem: "olá",
  sessionId,
  systemPrompt: "SP",
  mcpConfig: '{"mcpServers":{}}',
  settings: '{"hooks":{}}',
  allowedTools: ["Read", "Bash(python3 *)"],
})

async function coletar(it: AsyncIterable<EventoExecutor>) {
  const r: EventoExecutor[] = []
  for await (const e of it) r.push(e)
  return r
}

const falso = () => new ClaudeCliExecutor({ comando: process.execPath, prefixoArgs: [FALSO] })

afterEach(() => {
  for (const v of ["FIXTURE", "DORMIR_MS", "ARGS_SAIDA", "STDERR", "SAIDA"]) delete process.env[v]
})

describe("montarArgsClaude", () => {
  it("monta print + stream-json e só usa --resume com sessão", () => {
    const sem = montarArgsClaude(pedido())
    expect(sem.slice(0, 5)).toEqual(["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"])
    expect(sem).toContain("--mcp-config")
    expect(sem[sem.indexOf("--allowedTools") + 1]).toBe("Read,Bash(python3 *)")
    expect(sem).not.toContain("--resume")
    const com = montarArgsClaude(pedido("abc"))
    expect(com.slice(-2)).toEqual(["--resume", "abc"])
  })
})

describe("ClaudeCliExecutor", () => {
  it("passa a mensagem pelo stdin e converte o stdout em eventos", async () => {
    const saida = path.join(await mkdtemp(path.join(tmpdir(), "cli-")), "args.json")
    process.env.FIXTURE = FIXTURE
    process.env.ARGS_SAIDA = saida
    const eventos = await coletar(falso().executar(pedido(), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto_delta", "texto", "fim"])
    const recebido = JSON.parse(readFileSync(saida, "utf8")) as { argv: string[]; entrada: string }
    expect(recebido.entrada).toBe("olá")
    expect(recebido.argv).toContain("--append-system-prompt")
  })

  it("sem evento result, gera fim com o stderr", async () => {
    process.env.STDERR = "falhou feio"
    process.env.SAIDA = "1"
    const eventos = await coletar(falso().executar(pedido(), new AbortController().signal))
    expect(eventos).toEqual([{ tipo: "fim", ok: false, erro: "falhou feio", sessionId: null }])
  })

  it("abortar mata o processo e encerra como interrompido", async () => {
    process.env.DORMIR_MS = "5000"
    process.env.FIXTURE = FIXTURE
    const controle = new AbortController()
    setTimeout(() => controle.abort(), 200)
    const inicio = Date.now()
    const eventos = await coletar(falso().executar(pedido(), controle.signal))
    expect(Date.now() - inicio).toBeLessThan(3000)
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", ok: false, erro: "Interrompido pelo analista." })
  })

  it("comando inexistente vira erro legível", async () => {
    const exec = new ClaudeCliExecutor({ comando: "comando-que-nao-existe-xyz" })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(eventos).toEqual([
      { tipo: "fim", ok: false, erro: expect.stringContaining("Claude Code não encontrado"), sessionId: null },
    ])
  })
})
