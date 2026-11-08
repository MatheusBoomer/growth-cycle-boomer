import { ErroEntrada, ErroNaoEncontrado } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../../usuarios-da-nuvem"

/**
 * Só admin: resolve ou reabre uma nota. `resolvida` precisa ser booleano (400). Nota que não existe, ou `notaId` que
 * não é um inteiro positivo, dá 404 sem chegar ao serviço.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/skills/notas/[notaId]">) {
  try {
    const usuario = await exigirAdmin()
    usuariosDaNuvem()
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está alterando.")
    const bruto = (await ctx.params).notaId
    const notaId = bruto.trim() === "" ? Number.NaN : Number(bruto)
    if (!Number.isSafeInteger(notaId) || notaId <= 0) throw new ErroNaoEncontrado("Nota não encontrada.")
    const { resolvida } = await lerJson<{ resolvida?: unknown }>(req)
    if (typeof resolvida !== "boolean") throw new ErroEntrada("Informe se a nota está resolvida (true ou false).")
    return json({ nota: await servidor().servico.marcarNota(notaId, resolvida, usuario.email) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
