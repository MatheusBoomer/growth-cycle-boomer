import { limitesDoAmbiente } from "@workspace/core/metricas/tempo"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/**
 * Só admin: o resumo e as métricas de um projeto, lendo só os dados dele (a tela consulta isso a cada minuto).
 * As médias por etapa exigem varrer a base inteira, então só vêm com `?medias=1`; sem isso `medias` é null.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/projetos/[slug]">) {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    const { slug } = await ctx.params
    const limites = limitesDoAmbiente(process.env)
    const { servico } = servidor()
    const { projeto, metricas } = await servico.detalheDoProjeto(slug, limites)
    const medias = new URL(req.url).searchParams.get("medias") === "1" ? (await servico.metricasGerais(limites)).medias : null
    return json({ projeto, metricas, medias })
  } catch (e) {
    return respostaDeErro(e)
  }
}
