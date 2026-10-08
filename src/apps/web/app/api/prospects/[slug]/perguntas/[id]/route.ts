import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/perguntas/[id]">) {
  try {
    const { slug, id } = await ctx.params
    const { respostas } = await lerJson<{ respostas?: unknown }>(req)
    await servidor().servico.responderPerguntas(slug, id, respostas)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
