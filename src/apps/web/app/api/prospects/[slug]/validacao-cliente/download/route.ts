import { readFile } from "node:fs/promises"
import { ErroNaoEncontrado } from "@workspace/core/erros"
import { respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

/** Entrega o PDF de validação do cliente e registra o download (condição para o analista confirmar a validação). */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/validacao-cliente/download">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug } = await ctx.params
    const { servico, armazenamento } = servidor()
    const rel = await servico.registrarDownloadValidacao(slug, usuario.email)
    let dados: Buffer
    try {
      dados = await readFile(armazenamento.caminhoAbsoluto(slug, rel))
    } catch {
      throw new ErroNaoEncontrado("O documento de validação ainda não foi gerado.")
    }
    return new Response(new Uint8Array(dados), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`validacao-${slug}.pdf`)}`,
        "cache-control": "no-store",
      },
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
