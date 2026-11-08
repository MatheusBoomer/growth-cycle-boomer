import { lerItemDoCatalogo } from "@workspace/core/catalogo-skills"
import { ErroNaoEncontrado } from "@workspace/core/erros"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { idDoItem, MSG_ITEM_NAO_ENCONTRADO } from "../id-do-item"

export const dynamic = "force-dynamic"

/**
 * Só admin: o texto, o fluxo e as notas de um item do catálogo. Id fora da tabela fixa dá 404 sem ler nada do disco;
 * arquivo ausente deixa `texto` ou `fluxo` nulos. Funciona também no modo fs, com `notas: []` e `notasDisponiveis: false`.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/skills/[id]">) {
  try {
    await exigirAdmin()
    const id = idDoItem((await ctx.params).id)
    const { raiz, catalogo, servico, usuarios } = servidor()
    const item = lerItemDoCatalogo(raiz, catalogo, id)
    if (item === null) throw new ErroNaoEncontrado(MSG_ITEM_NAO_ENCONTRADO)
    return json({ ...item, notas: await servico.notasDoItem(id), notasDisponiveis: usuarios !== null })
  } catch (e) {
    return respostaDeErro(e)
  }
}
