import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Chamado só pelo servidor MCP "planejamento", com o token do turno em andamento. */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const { turnos, servico } = servidor()
  const ctx = turnos.contextoDoToken(token)
  if (!ctx) return json({ ok: false, mensagem: "Token inválido ou turno já encerrado." }, 401)
  try {
    const { ferramenta, entrada } = await lerJson<{ ferramenta?: string; entrada?: unknown }>(req)
    return json(await servico.ferramenta(ctx, ferramenta ?? "", entrada))
  } catch (e) {
    return respostaDeErro(e)
  }
}
