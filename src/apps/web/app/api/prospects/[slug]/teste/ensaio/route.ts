import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/** Gatilho do trecho do roteiro de ensaio que a etapa vai tocar agora (`?etapa=NN`); `null` quando o roteiro acabou. */
export async function GET(req: Request, ctx: RouteContext<"/api/prospects/[slug]/teste/ensaio">) {
  try {
    await exigirAdmin()
    const { slug } = await ctx.params
    const bruta = new URL(req.url).searchParams.get("etapa")
    if (!bruta) throw new ErroEntrada("Informe a etapa.")
    return json(await servidor().servico.gatilhoEnsaio(slug, validarEtapa(bruta)))
  } catch (e) {
    return respostaDeErro(e)
  }
}

/** Avançar ensaio: aprova os entregáveis pendentes da etapa um a um, tocando os trechos gravados até o roteiro acabar. */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/teste/ensaio">) {
  try {
    const usuario = await exigirAdmin()
    const { slug } = await ctx.params
    const { etapa } = await lerJson<{ etapa?: unknown }>(req)
    if (typeof etapa !== "string") throw new ErroEntrada("Informe a etapa.")
    await servidor().servico.avancarEnsaio(slug, validarEtapa(etapa), usuario.email)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
