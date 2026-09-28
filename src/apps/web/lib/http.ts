import { ehErroDominio, ErroEntrada, ErroNaoEncontrado } from "@workspace/core/erros"
import { ORDEM_ETAPAS, type EtapaId } from "@workspace/core/tipos"

export function json(dados: unknown, status = 200): Response {
  return Response.json(dados, { status })
}

export function respostaDeErro(e: unknown): Response {
  if (ehErroDominio(e)) {
    const extra = "slug" in e && typeof e.slug === "string" ? { slug: e.slug } : {}
    return Response.json({ erro: e.message, codigo: e.codigo, ...extra }, { status: e.status })
  }
  console.error(e)
  return Response.json(
    { erro: "Erro inesperado no servidor. Veja o terminal onde o app está rodando.", codigo: "erro_interno" },
    { status: 500 },
  )
}

export async function lerJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ErroEntrada("Corpo da requisição inválido.")
  }
}

export function validarEtapa(etapa: string): EtapaId {
  if (!(ORDEM_ETAPAS as readonly string[]).includes(etapa)) throw new ErroNaoEncontrado(`Etapa desconhecida: ${etapa}`)
  return etapa as EtapaId
}
