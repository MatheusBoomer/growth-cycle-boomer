import { json, lerJson, respostaDeErro } from "@/lib/http"
import { validarEdicao } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export async function PATCH(req: Request, ctx: RouteContext<"/api/dev/comentarios/[id]">) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const { id } = await ctx.params
    const comentario = validarEdicao(await lerJson(req))
    return json({ comentario: await armazenamentoDev().editar(id, comentario) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/dev/comentarios/[id]">) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const { id } = await ctx.params
    await armazenamentoDev().apagar(id)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
