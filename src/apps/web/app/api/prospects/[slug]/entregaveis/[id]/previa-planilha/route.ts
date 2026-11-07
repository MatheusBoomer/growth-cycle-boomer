import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

/** Gera (uma vez por versão) a página HTML da planilha e devolve o caminho dela. */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/previa-planilha">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug, id } = await ctx.params
    return json(await servidor().comentarios.previaPlanilha(slug, id))
  } catch (e) {
    return respostaDeErro(e)
  }
}
