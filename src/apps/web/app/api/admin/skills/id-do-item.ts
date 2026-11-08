import { ErroNaoEncontrado } from "@workspace/core/erros"

export const MSG_ITEM_NAO_ENCONTRADO = "Item não encontrado."

/** O `[id]` chega codificado na URL (ex.: `etapa%3A03`). Uma codificação inválida é um item que não existe (404). */
export function idDoItem(bruto: string): string {
  try {
    return decodeURIComponent(bruto)
  } catch {
    throw new ErroNaoEncontrado(MSG_ITEM_NAO_ENCONTRADO)
  }
}
