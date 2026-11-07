import { ErroNaoEncontrado } from "@workspace/core/erros"
import { limitesDoAmbiente } from "@workspace/core/metricas/tempo"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/** Só admin: o resumo, as métricas e as médias de um projeto (as médias servem de comparação na tela de detalhe). */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/projetos/[slug]">) {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    const { slug } = await ctx.params
    const { projetos, medias } = await servidor().servico.metricasGerais(limitesDoAmbiente(process.env))
    const achado = projetos.find((p) => p.slug === slug)
    if (!achado) throw new ErroNaoEncontrado("Projeto não encontrado.")
    const { metricas, ...projeto } = achado
    return json({ projeto, metricas, medias })
  } catch (e) {
    return respostaDeErro(e)
  }
}
