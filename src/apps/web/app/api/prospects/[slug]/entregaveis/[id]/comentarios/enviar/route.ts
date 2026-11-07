import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export async function POST(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/enviar">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug, id } = await ctx.params
    return json({ enviados: await servidor().comentarios.enviar(slug, id, usuario.email) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
