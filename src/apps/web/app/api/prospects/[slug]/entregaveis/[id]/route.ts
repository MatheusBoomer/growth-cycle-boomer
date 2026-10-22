import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

const LIMITE_IMAGEM_BYTES = 8 * 1024 * 1024
const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function lerImagem(valor: unknown): Uint8Array | undefined {
  if (valor === undefined || valor === null) return undefined
  if (typeof valor !== "string") throw new ErroEntrada("A imagem anotada deve vir em base64.")
  const limpo = valor.replace(/^data:image\/png;base64,/, "")
  if (limpo.length > Math.ceil(LIMITE_IMAGEM_BYTES / 3) * 4 + 4) throw new ErroEntrada("A imagem anotada passa de 8 MB.")
  const bytes = Buffer.from(limpo, "base64")
  if (!ASSINATURA_PNG.every((b, i) => bytes[i] === b)) throw new ErroEntrada("A imagem anotada não é um PNG válido.")
  return bytes
}

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]">) {
  try {
    const { slug, id } = await ctx.params
    const { acao, texto, conteudo, imagem } = await lerJson<{ acao?: string; texto?: string; conteudo?: unknown; imagem?: unknown }>(req)
    const { servico } = servidor()
    if (acao === "aprovar") await servico.aprovarEntregavel(slug, id)
    else if (acao === "ajuste") await servico.pedirAjuste(slug, id, texto ?? "", lerImagem(imagem))
    else if (acao === "editar") await servico.editarEntregavel(slug, id, conteudo)
    else throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
