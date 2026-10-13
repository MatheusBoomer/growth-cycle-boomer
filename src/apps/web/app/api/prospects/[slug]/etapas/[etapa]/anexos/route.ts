import { ErroEntrada } from "@workspace/core/erros"
import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/anexos">) {
  try {
    const { slug, etapa } = await ctx.params
    const id = validarEtapa(etapa)
    const arquivo = (await req.formData()).get("arquivo")
    if (!(arquivo instanceof File)) throw new ErroEntrada("Nenhum arquivo enviado.")
    const caminho = await servidor().servico.salvarAnexo(slug, id, arquivo.name, new Uint8Array(await arquivo.arrayBuffer()))
    return json({ caminho })
  } catch (e) {
    return respostaDeErro(e)
  }
}
