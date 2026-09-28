import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/conversa">) {
  try {
    const { slug, etapa } = await ctx.params
    return json({ eventos: await servidor().servico.conversa(slug, validarEtapa(etapa)) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
