import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { idInteiro } from "../id-do-report"

/** Só admin: muda o status e/ou a nota interna do report, registrando quem mudou. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  try {
    const usuario = await exigirAdmin()
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está alterando.")
    const id = idInteiro((await ctx.params).id, "Report não encontrado.")
    const mudanca = await lerJson<unknown>(req)
    return json({ report: await servidor().servico.atualizarReport(id, mudanca, usuario.email) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
