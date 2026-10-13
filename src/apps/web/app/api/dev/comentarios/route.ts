import { json, lerJson, respostaDeErro } from "@/lib/http"
import { decodificarPng } from "@/lib/modo-dev/armazenamento"
import { ErroValidacaoDev, validarNovo } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const pagina = new URL(req.url).searchParams.get("pagina") ?? undefined
    return json({ comentarios: await armazenamentoDev().listar(pagina) })
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request) {
  const bloqueio = foraDoDesenvolvimento()
  if (bloqueio) return bloqueio
  try {
    const corpo = await lerJson<Record<string, unknown>>(req)
    const novo = validarNovo(corpo)
    const { png } = corpo
    if (png !== undefined && png !== null && typeof png !== "string") {
      throw new ErroValidacaoDev("Campo png deve ser texto em base64 ou null.")
    }
    const bytes = png ? decodificarPng(png) : null
    return json({ comentario: await armazenamentoDev().criar(novo, bytes) }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
