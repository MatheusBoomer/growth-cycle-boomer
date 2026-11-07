import { ErroEntrada } from "@workspace/core/erros"
import { papelValido } from "@workspace/core/nuvem/usuarios"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../usuarios-da-nuvem"

/** Troca o papel de uma pessoa. O admin pode rebaixar a si mesmo, desde que reste outro admin (senão, 409). */
export async function POST(req: Request) {
  try {
    const usuario = await exigirAdmin()
    const usuarios = usuariosDaNuvem()
    // Com repositório de usuários sempre há sessão com e-mail; o modo sem login (e-mail nulo) não chega aqui.
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está alterando.")
    const { email, papel } = await lerJson<{ email?: unknown; papel?: unknown }>(req)
    if (typeof email !== "string" || email.trim() === "") throw new ErroEntrada("Informe o e-mail da pessoa.")
    if (!papelValido(papel)) throw new ErroEntrada("Papel inválido.")
    await usuarios.alterarPapel(email, papel, usuario.email)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
