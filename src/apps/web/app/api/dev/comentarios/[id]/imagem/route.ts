import { ErroNaoEncontrado } from "@workspace/core/erros"
import { respostaDeErro } from "@/lib/http"
import { ErroValidacaoDev } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export const dynamic = "force-dynamic"

/** PNG do comentário: ?tipo=recorte (o bloco) ou ?tipo=tela (a tela inteira, com o bloco contornado). */
export async function GET(req: Request, ctx: RouteContext<"/api/dev/comentarios/[id]/imagem">) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const { id } = await ctx.params
    const tipo = new URL(req.url).searchParams.get("tipo")
    if (tipo !== "recorte" && tipo !== "tela") throw new ErroValidacaoDev("Campo tipo deve ser recorte ou tela.")
    const bytes = await armazenamentoDev().imagem(id, tipo)
    if (!bytes) throw new ErroNaoEncontrado("Este comentário não tem essa imagem.")
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch (e) {
    return respostaDeErro(e)
  }
}
