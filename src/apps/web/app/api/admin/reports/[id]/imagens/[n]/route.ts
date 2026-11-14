import { ErroNaoEncontrado } from "@workspace/core/erros"
import { respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { idInteiro } from "../../../id-do-report"

/** Só admin: bytes da n-ésima imagem do report (0 é o print da tela, quando existe). */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/reports/[id]/imagens/[n]">) {
  try {
    await exigirAdmin()
    const { id: brutoId, n: brutoN } = await ctx.params
    const id = idInteiro(brutoId, "Report não encontrado.")
    const n = /^\d+$/.test(brutoN) ? Number(brutoN) : Number.NaN
    if (!Number.isSafeInteger(n)) throw new ErroNaoEncontrado("Imagem não encontrada.")
    const { bytes, contentType } = await servidor().servico.imagemReport(id, n)
    return new Response(new Blob([bytes as BlobPart]), {
      headers: { "content-type": contentType, "cache-control": "private, max-age=3600" },
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
