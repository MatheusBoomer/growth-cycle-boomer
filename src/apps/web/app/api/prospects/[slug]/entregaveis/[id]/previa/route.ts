import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

/** Gera (uma vez por versão) e devolve as imagens dos slides e o mapa de campos. */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/previa">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug, id } = await ctx.params
    return json(await servidor().comentarios.previa(slug, id))
  } catch (e) {
    return respostaDeErro(e)
  }
}
