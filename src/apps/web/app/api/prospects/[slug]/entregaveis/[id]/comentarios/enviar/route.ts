import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/enviar">) {
  try {
    const { slug, id } = await ctx.params
    return json({ enviados: await servidor().comentarios.enviar(slug, id) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
