import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export async function PATCH(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/[cid]">) {
  try {
    await exigirUsuario()
    const { slug, id, cid } = await ctx.params
    const { texto } = await lerJson<{ texto?: string }>(req)
    await servidor().comentarios.editar(slug, id, cid, texto ?? "")
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios/[cid]">) {
  try {
    await exigirUsuario()
    const { slug, id, cid } = await ctx.params
    await servidor().comentarios.apagar(slug, id, cid)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
