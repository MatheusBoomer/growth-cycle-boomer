import { execFile } from "node:child_process"
import { ErroNaoEncontrado } from "@workspace/core/erros"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Abre a pasta do prospect no Finder; com { caminho }, mostra esse arquivo selecionado. */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/abrir-pasta">) {
  try {
    const { slug } = await ctx.params
    const { armazenamento } = servidor()
    if (!(await armazenamento.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não existe.`)
    const { caminho } = (await req.json().catch(() => ({}))) as { caminho?: string }
    if (caminho) execFile("open", ["-R", armazenamento.caminhoAbsoluto(slug, caminho)])
    else execFile("open", [armazenamento.pastaProspect(slug)])
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
