import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]">) {
  try {
    const usuario = await exigirUsuario()
    const { slug, id } = await ctx.params
    const { acao, conteudo } = await lerJson<{ acao?: string; conteudo?: unknown }>(req)
    const { servico } = servidor()
    if (acao === "aprovar") await servico.aprovarEntregavel(slug, id, usuario.email)
    else if (acao === "editar") await servico.editarEntregavel(slug, id, conteudo)
    else throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
