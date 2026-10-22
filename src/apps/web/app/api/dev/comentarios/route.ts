import { json, lerJson, respostaDeErro } from "@/lib/http"
import { decodificarPng } from "@/lib/modo-dev/armazenamento"
import { ErroValidacaoDev, validarNovo } from "@/lib/modo-dev/nucleo"
import { armazenamentoDev, foraDoDesenvolvimento } from "@/lib/modo-dev/rota"

export const dynamic = "force-dynamic"

function lerPng(corpo: Record<string, unknown>, campo: "png" | "pngTela"): Buffer | null {
  const valor = corpo[campo]
  if (valor !== undefined && valor !== null && typeof valor !== "string") {
    throw new ErroValidacaoDev(`Campo ${campo} deve ser texto em base64 ou null.`)
  }
  return valor ? decodificarPng(valor) : null
}

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
    const bytes = lerPng(corpo, "png")
    const bytesTela = lerPng(corpo, "pngTela")
    return json({ comentario: await armazenamentoDev().criar(novo, bytes, bytesTela) }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
