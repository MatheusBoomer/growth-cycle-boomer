import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Arquivos do prospect para abrir no visualizador e mencionar no chat (caminhos relativos à pasta do prospect). */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/arquivos">) {
  try {
    const { slug } = await ctx.params
    return json({ arquivos: await servidor().armazenamento.listarArquivosDoProspect(slug) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
