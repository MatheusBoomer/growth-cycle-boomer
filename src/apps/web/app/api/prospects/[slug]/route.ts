import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export async function DELETE(req: Request, ctx: RouteContext<"/api/prospects/[slug]">) {
  try {
    await exigirUsuario()
    const { slug } = await ctx.params
    const { confirmacao } = await lerJson<{ confirmacao?: string }>(req)
    await servidor().servico.excluirProspect(slug, confirmacao ?? "")
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
