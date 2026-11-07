import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"
import type { Regiao } from "@workspace/core/comentarios"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug, id } = await ctx.params
    return json({ comentarios: await servidor().comentarios.listar(slug, id) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]/comentarios">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug, id } = await ctx.params
    const d = await lerJson<{ slide?: number; regiao?: Regiao | null; texto?: string }>(req)
    const c = await servidor().comentarios.criar(slug, id, { slide: Number(d.slide), regiao: d.regiao ?? null, texto: d.texto ?? "" }, usuario.email)
    return json({ comentario: c }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
