import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

/** Kit do analista (arquivos e roteiro) de uma etapa do cliente de teste; `?etapa=NN`, padrão: a etapa de partida. */
export async function GET(req: Request, ctx: RouteContext<"/api/prospects/[slug]/teste">) {
  try {
    const { slug } = await ctx.params
    const bruta = new URL(req.url).searchParams.get("etapa")
    const { servico } = servidor()
    return json(await servico.kitDaEtapa(slug, bruta ? validarEtapa(bruta) : undefined))
  } catch (e) {
    return respostaDeErro(e)
  }
}
