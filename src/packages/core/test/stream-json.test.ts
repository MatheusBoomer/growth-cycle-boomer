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
      { tipo: "fim", ok: true, erro: null, sessionId: SID, uso: { custoUsd: 0.07, tokensEntrada: null, tokensSaida: null, modelos: null } },
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

  it("lê o uso da assinatura por janela (5 horas e semana), mesmo com status allowed", () => {
    const linha = JSON.stringify({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "allowed",
        resetsAt: 1790651400,
        rateLimitType: "five_hour",
        unifiedWindows: { five_hour: { utilization: 0.82, resetsAt: 1790651400 }, seven_day: { utilization: 0.4, resetsAt: 1791219600 }, lixo: "x" },
      },
    })
    expect(parseLinhaStreamJson(linha)).toEqual([
      {
        tipo: "uso",
        janelas: [
          { janela: "five_hour", utilizacao: 0.82, resetsAt: 1790651400 },
          { janela: "seven_day", utilizacao: 0.4, resetsAt: 1791219600 },
        ],
      },
    ])
  })

  it("resultado com erro vira fim com mensagem", () => {
    const linha = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, session_id: SID })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "fim", ok: false, erro: "error_during_execution", sessionId: SID }])
  })

  it("result traz custo e tokens", () => {
    const linha = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: SID,
      total_cost_usd: 0.42,
      usage: { input_tokens: 1000, output_tokens: 200 },
    })
    expect(parseLinhaStreamJson(linha)).toEqual([
      { tipo: "fim", ok: true, erro: null, sessionId: SID, uso: { custoUsd: 0.42, tokensEntrada: 1000, tokensSaida: 200, modelos: null } },
    ])
  })

  it("result sem custo traz uso com nulos", () => {
    const linha = JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: SID, usage: {} })
    expect(parseLinhaStreamJson(linha)).toEqual([
      { tipo: "fim", ok: true, erro: null, sessionId: SID, uso: { custoUsd: null, tokensEntrada: null, tokensSaida: null, modelos: null } },
    ])
  })

  it("result sem custo nem usage não leva uso", () => {
    const linha = JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: SID })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "fim", ok: true, erro: null, sessionId: SID }])
  })

  it("result leva o custo acumulado por modelo de modelUsage", () => {
    const linha = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: SID,
      total_cost_usd: 0.5,
      usage: { input_tokens: 10, output_tokens: 5 },
      modelUsage: {
        "claude-sonnet-5-5": { costUSD: 0.45 },
        "claude-haiku-5-5": { costUSD: 0.05 },
        x: { inputTokens: 1 },
      },
    })
    expect(parseLinhaStreamJson(linha)).toEqual([
      {
        tipo: "fim",
        ok: true,
        erro: null,
        sessionId: SID,
        uso: { custoUsd: 0.5, tokensEntrada: 10, tokensSaida: 5, modelos: { "claude-sonnet-5-5": 0.45, "claude-haiku-5-5": 0.05 } },
      },
    ])
  })

  it("sem modelUsage, modelos é null", () => {
    const linha = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: SID,
      total_cost_usd: 0.5,
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const [fim] = parseLinhaStreamJson(linha)
    expect(fim).toMatchObject({ tipo: "fim", uso: { custoUsd: 0.5, modelos: null } })
  })

  it("linha que não é JSON é ignorada", () => {
    expect(parseLinhaStreamJson("{quebrado")).toEqual([])
    expect(parseLinhaStreamJson("")).toEqual([])
  })
})
