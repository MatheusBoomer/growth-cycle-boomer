import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/mensagens">) {
  try {
    const { slug, etapa } = await ctx.params
    const { texto } = await lerJson<{ texto?: string }>(req)
    if (!texto?.trim()) throw new ErroEntrada("Escreva uma mensagem.")
    await servidor().turnos.enviarMensagem(slug, validarEtapa(etapa), texto.trim())
    return json({ ok: true }, 202)
  } catch (e) {
    return respostaDeErro(e)
  }
}
