import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Devolve o cliente de teste ao início da etapa escolhida, apagando o que foi feito nele. */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/teste/reposicionar">) {
  try {
    const { slug } = await ctx.params
    const { etapa } = await lerJson<{ etapa?: unknown }>(req)
    if (typeof etapa !== "string") throw new ErroEntrada("Informe a etapa.")
    await servidor().servico.reposicionarTeste(slug, validarEtapa(etapa))
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
