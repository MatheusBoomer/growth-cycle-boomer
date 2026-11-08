import type { EventoExecutor, JanelaUso } from "./tipos"

// O stream-json do Claude Code é um formato externo e sem tipos publicados: lemos como JSON solto
// e validamos campo a campo.
type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string | null => (typeof v === "string" ? v : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
// modelUsage: { [modelo]: { costUSD, ... } }. Entradas sem custo numérico ficam de fora.
const modelos = (v: unknown): Record<string, number> | null => {
  const custos = Object.entries(obj(v) ?? {}).flatMap(([modelo, m]): [string, number][] => {
    const custo = num(obj(m)?.costUSD)
    return custo === null ? [] : [[modelo, custo]]
  })
  return custos.length > 0 ? Object.fromEntries(custos) : null
}

export function parseLinhaStreamJson(linha: string): EventoExecutor[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(linha)
  } catch {
    return []
  }
  return eventosDaMensagem(bruto)
}

/** Converte uma mensagem já decodificada (linha do CLI ou mensagem do Agent SDK, que têm o mesmo formato). */
export function eventosDaMensagem(bruto: unknown): EventoExecutor[] {
  const o = obj(bruto)
  if (!o || o.parent_tool_use_id) return []

  switch (o.type) {
    case "system": {
      const sid = str(o.session_id)
      return o.subtype === "init" && sid ? [{ tipo: "sessao", sessionId: sid }] : []
    }
    case "stream_event": {
      const e = obj(o.event)
      const delta = obj(e?.delta)
      const texto = str(delta?.text)
      return e?.type === "content_block_delta" && delta?.type === "text_delta" && texto !== null
        ? [{ tipo: "texto_delta", texto }]
        : []
    }
    case "assistant": {
      const conteudo = obj(o.message)?.content
      if (!Array.isArray(conteudo)) return []
      return conteudo.flatMap((b): EventoExecutor[] => {
        const bloco = obj(b)
        if (bloco?.type === "text" && typeof bloco.text === "string") return [{ tipo: "texto", texto: bloco.text }]
        if (bloco?.type === "tool_use") {
          return [{ tipo: "ferramenta", id: String(bloco.id), nome: String(bloco.name), entrada: bloco.input ?? {} }]
        }
        return []
      })
    }
    case "user": {
      const conteudo = obj(o.message)?.content
      if (!Array.isArray(conteudo)) return []
      return conteudo.flatMap((b): EventoExecutor[] => {
        const bloco = obj(b)
        return bloco?.type === "tool_result"
          ? [{ tipo: "ferramenta_resultado", id: String(bloco.tool_use_id), erro: bloco.is_error === true }]
          : []
      })
    }
    case "rate_limit_event": {
      const info = obj(o.rate_limit_info)
      const eventos: EventoExecutor[] = []
      const janelas = Object.entries(obj(info?.unifiedWindows) ?? {}).flatMap(([janela, v]): JanelaUso[] => {
        const j = obj(v)
        return typeof j?.utilization === "number"
          ? [{ janela, utilizacao: j.utilization, resetsAt: typeof j.resetsAt === "number" ? j.resetsAt : null }]
          : []
      })
      if (janelas.length > 0) eventos.push({ tipo: "uso", janelas })
      const status = str(info?.status)
      if (status && status !== "allowed") eventos.push({ tipo: "limite", status, resetsAt: typeof info?.resetsAt === "number" ? info.resetsAt : null })
      return eventos
    }
    case "result": {
      const ok = o.subtype === "success" && o.is_error !== true
      const usage = obj(o.usage)
      // só leva `uso` quando o result trouxe custo ou tokens (um result sem nenhum dos dois não tem o que registrar)
      const trouxeUso = "total_cost_usd" in o || usage !== null
      return [
        {
          tipo: "fim",
          ok,
          erro: ok ? null : (str(o.result) || str(o.subtype) || "erro desconhecido"),
          sessionId: str(o.session_id),
          ...(trouxeUso
            ? {
                uso: {
                  custoUsd: num(o.total_cost_usd),
                  tokensEntrada: num(usage?.input_tokens),
                  tokensSaida: num(usage?.output_tokens),
                  modelos: modelos(o.modelUsage),
                },
              }
            : {}),
        },
      ]
    }
    default:
      return []
  }
}
