// Leitura dos pedidos de ajuste que chegam junto com a mensagem do chat (corpo da requisição, não confiável).
import { ErroEntrada } from "@workspace/core/erros"
import { lerMarcas } from "@workspace/core/marcacoes"
import type { AjusteEnvio } from "@workspace/core/servico-planejamento"

const LIMITE_IMAGEM_BYTES = 8 * 1024 * 1024
const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function lerImagem(valor: unknown): Uint8Array | undefined {
  if (valor === undefined || valor === null) return undefined
  if (typeof valor !== "string") throw new ErroEntrada("A imagem anotada deve vir em base64.")
  const limpo = valor.replace(/^data:image\/png;base64,/, "")
  if (limpo.length > Math.ceil(LIMITE_IMAGEM_BYTES / 3) * 4 + 4) throw new ErroEntrada("A imagem anotada passa de 8 MB.")
  const bytes = Buffer.from(limpo, "base64")
  if (!ASSINATURA_PNG.every((b, i) => bytes[i] === b)) throw new ErroEntrada("A imagem anotada não é um PNG válido.")
  return bytes
}

export function lerAjustes(entrada: unknown): AjusteEnvio[] {
  if (entrada === undefined || entrada === null) return []
  if (!Array.isArray(entrada)) throw new ErroEntrada("Os ajustes devem vir em uma lista.")
  return entrada.map((bruto) => {
    const a = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>
    if (typeof a.entregavelId !== "string" || !a.entregavelId) throw new ErroEntrada("Um dos ajustes não diz qual entregável é.")
    return { entregavelId: a.entregavelId, marcas: lerMarcas(a.marcas), imagem: lerImagem(a.imagem) }
  })
}
