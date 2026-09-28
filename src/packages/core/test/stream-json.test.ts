import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseLinhaStreamJson } from "../src/executor/stream-json"

const SID = "3201404c-ffd2-469d-bfbf-c6dbedbde0d6"
const linhas = readFileSync(new URL("./fixtures/stream-oi.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)

describe("parseLinhaStreamJson", () => {
  it("extrai sessão, delta, texto e fim do stream real", () => {
    expect(linhas.flatMap(parseLinhaStreamJson)).toEqual([
      { tipo: "sessao", sessionId: SID },
      { tipo: "texto_delta", texto: "oi" },
      { tipo: "texto", texto: "oi" },
      { tipo: "fim", ok: true, erro: null, sessionId: SID },
    ])
  })

  it("converte tool_use e tool_result", () => {
    const uso = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: null,
      message: { content: [{ type: "tool_use", id: "t1", name: "mcp__planejamento__propor_entregavel", input: { tipo: "grafico" } }] },
    })
    const resultado = JSON.stringify({
      type: "user",
      parent_tool_use_id: null,
      message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "x" }] },
    })
    expect(parseLinhaStreamJson(uso)).toEqual([
      { tipo: "ferramenta", id: "t1", nome: "mcp__planejamento__propor_entregavel", entrada: { tipo: "grafico" } },
    ])
    expect(parseLinhaStreamJson(resultado)).toEqual([{ tipo: "ferramenta_resultado", id: "t1", erro: true }])
  })

  it("ignora o que vem de subagentes", () => {
    const linha = JSON.stringify({ type: "assistant", parent_tool_use_id: "t9", message: { content: [{ type: "text", text: "interno" }] } })
    expect(parseLinhaStreamJson(linha)).toEqual([])
  })

  it("avisa limite quando o status não é allowed", () => {
    const linha = JSON.stringify({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: 1790651400 } })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "limite", status: "rejected", resetsAt: 1790651400 }])
  })

  it("resultado com erro vira fim com mensagem", () => {
    const linha = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, session_id: SID })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "fim", ok: false, erro: "error_during_execution", sessionId: SID }])
  })

  it("linha que não é JSON é ignorada", () => {
    expect(parseLinhaStreamJson("{quebrado")).toEqual([])
    expect(parseLinhaStreamJson("")).toEqual([])
  })
})
