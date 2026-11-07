import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../../usuarios-da-nuvem"

/** Passa o prospect para outra pessoa que já entrou no app (o e-mail é normalizado ao gravar). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/prospects/[slug]/dono">) {
  try {
    await exigirAdmin()
    const usuarios = usuariosDaNuvem()
    const { slug } = await ctx.params
    const { email } = await lerJson<{ email?: unknown }>(req)
    if (typeof email !== "string" || email.trim() === "") throw new ErroEntrada("Informe o e-mail do novo dono.")
    if (!(await usuarios.existe(email))) throw new ErroEntrada("Essa pessoa ainda não entrou no app.")
    await servidor().servico.trocarDono(slug, email)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
