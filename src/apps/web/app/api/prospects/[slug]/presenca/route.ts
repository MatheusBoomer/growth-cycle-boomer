import { ErroEntrada } from "@workspace/core/erros"
import { ORDEM_ETAPAS, type EtapaId } from "@workspace/core/tipos"
import { lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export const dynamic = "force-dynamic"

const UM_DIA_EM_SEGUNDOS = 86400

/**
 * Aviso de que a tela está aberta na etapa (a cada 30 s). Só o tempo de presença usa isso, e é medido para todos.
 * Sem e-mail (modo off) ou sem banco (modo fs) o aviso é aceito e descartado.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/presenca">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug } = await ctx.params
    const corpo = await lerJson<{ etapa?: unknown; visivel?: unknown; segundosSemInteracao?: unknown }>(req)
    const { etapa, visivel, segundosSemInteracao } = corpo ?? {}
    if (typeof etapa !== "string" || !(ORDEM_ETAPAS as readonly string[]).includes(etapa)) throw new ErroEntrada("Etapa inválida.")
    if (typeof visivel !== "boolean") throw new ErroEntrada("Informe se a tela está visível.")
    if (typeof segundosSemInteracao !== "number" || !Number.isInteger(segundosSemInteracao) || segundosSemInteracao < 0 || segundosSemInteracao > UM_DIA_EM_SEGUNDOS)
      throw new ErroEntrada("O tempo sem interação deve ser um inteiro de 0 a 86400 segundos.")
    const { servico, usuarios } = servidor()
    if (usuario.email === null || usuarios === null) return new Response(null, { status: 204 })
    await servico.registrarPresenca(slug, usuario.email, etapa as EtapaId, visivel, segundosSemInteracao)
    return new Response(null, { status: 204 })
  } catch (e) {
    return respostaDeErro(e)
  }
}
