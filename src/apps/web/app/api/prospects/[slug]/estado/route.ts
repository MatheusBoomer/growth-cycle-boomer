import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/estado">) {
  try {
    await exigirUsuario()
    const { slug } = await ctx.params
    const { servico, turnos } = servidor()
    return json(await servico.respostaEstado(slug, turnos.ativo(slug)))
  } catch (e) {
    return respostaDeErro(e)
  }
}
