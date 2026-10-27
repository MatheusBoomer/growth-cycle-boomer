import { ErroEntrada } from "@workspace/core/erros"
import { lerAjustes } from "@/lib/ajustes-envio"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

/** `ajustes`: entregáveis pendentes citados na mensagem (pedido de ajuste), com as marcações e a imagem anotada. */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/mensagens">) {
  try {
    const usuario = await exigirUsuario()
    const { slug, etapa } = await ctx.params
    const { texto, ajustes } = await lerJson<{ texto?: string; ajustes?: unknown }>(req)
    if (!texto?.trim()) throw new ErroEntrada("Escreva uma mensagem.")
    const lista = lerAjustes(ajustes)
    const { turnos } = servidor()
    if (lista.length > 0) await turnos.enviarMensagemComAjustes(slug, validarEtapa(etapa), texto.trim(), lista, usuario.email)
    else await turnos.enviarMensagem(slug, validarEtapa(etapa), texto.trim(), usuario.email)
    return json({ ok: true }, 202)
  } catch (e) {
    return respostaDeErro(e)
  }
}
