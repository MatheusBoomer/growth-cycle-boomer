import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/acoes">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug, etapa: bruta } = await ctx.params
    const etapa = validarEtapa(bruta)
    const { acao } = await lerJson<{ acao?: string }>(req)
    const { servico, turnos } = servidor()
    switch (acao) {
      case "iniciar":
        await turnos.iniciar(slug, etapa, usuario.email)
        break
      case "concluir":
        await servico.concluirEtapa(slug, etapa)
        break
      case "reabrir":
        await servico.reabrirEtapa(slug, etapa)
        break
      case "confirmar":
        await servico.confirmarValida(slug, etapa)
        break
      case "revisar":
        await servico.revisarEtapa(slug, etapa)
        break
      case "confirmar-validacao-cliente":
        await servico.confirmarValidacaoCliente(slug, usuario.email)
        break
      case "parar":
        turnos.parar(slug)
        break
      default:
        throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    }
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
