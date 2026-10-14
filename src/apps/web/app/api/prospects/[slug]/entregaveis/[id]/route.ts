import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]">) {
  try {
    const { slug, id } = await ctx.params
    const { acao, texto, conteudo } = await lerJson<{ acao?: string; texto?: string; conteudo?: unknown }>(req)
    const { servico } = servidor()
    if (acao === "aprovar") await servico.aprovarEntregavel(slug, id)
    else if (acao === "ajuste") await servico.pedirAjuste(slug, id, texto ?? "")
    else if (acao === "editar") await servico.editarEntregavel(slug, id, conteudo)
    else throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
