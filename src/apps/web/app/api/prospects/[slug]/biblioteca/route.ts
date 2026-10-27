import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/biblioteca">) {
  try {
    await exigirUsuario()
    const { slug } = await ctx.params
    return json({ itens: await servidor().servico.listarBiblioteca(slug) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

/** Ajuste manual de etapa e título de uma imagem (o arquivo no disco não muda). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/prospects/[slug]/biblioteca">) {
  try {
    await exigirUsuario()
    const { slug } = await ctx.params
    const corpo = await lerJson<{ caminho?: unknown; etapa?: unknown; titulo?: unknown }>(req)
    if (typeof corpo.caminho !== "string" || !corpo.caminho) throw new ErroEntrada("Informe o caminho da imagem.")
    const item = await servidor().servico.ajustarBiblioteca(slug, corpo.caminho, { etapa: corpo.etapa, titulo: corpo.titulo })
    return json({ item })
  } catch (e) {
    return respostaDeErro(e)
  }
}
