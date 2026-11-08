import { itensDoCatalogo } from "@workspace/core/catalogo-skills"
import { ErroEntrada, ErroNaoEncontrado } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../../usuarios-da-nuvem"
import { idDoItem, MSG_ITEM_NAO_ENCONTRADO } from "../../id-do-item"

/**
 * Só admin: cria uma nota de melhoria no item do catálogo, com o e-mail do admin como autor. Item fora do catálogo dá
 * 404; texto vazio ou com mais de 2000 caracteres, 400.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/skills/[id]/notas">) {
  try {
    const usuario = await exigirAdmin()
    usuariosDaNuvem()
    // Com repositório de usuários sempre há sessão com e-mail; o modo sem login (e-mail nulo) não chega aqui.
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está anotando.")
    const id = idDoItem((await ctx.params).id)
    const { raiz, catalogo, servico } = servidor()
    if (!itensDoCatalogo(raiz, catalogo).some((i) => i.id === id)) throw new ErroNaoEncontrado(MSG_ITEM_NAO_ENCONTRADO)
    const { texto } = await lerJson<{ texto?: unknown }>(req)
    return json({ nota: await servico.criarNota(id, texto as string, usuario.email) }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
