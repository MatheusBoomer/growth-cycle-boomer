import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/conversa">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug, etapa } = await ctx.params
    return json({ eventos: await servidor().servico.conversa(slug, validarEtapa(etapa)) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
