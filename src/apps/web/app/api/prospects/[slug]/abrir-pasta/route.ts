import { execFile } from "node:child_process"
import { ErroNaoEncontrado } from "@workspace/core/erros"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/abrir-pasta">) {
  try {
    const { slug } = await ctx.params
    const { armazenamento } = servidor()
    if (!(await armazenamento.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não existe.`)
    execFile("open", [armazenamento.pastaProspect(slug)])
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
