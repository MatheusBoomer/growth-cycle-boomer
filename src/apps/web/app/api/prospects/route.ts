import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export async function GET() {
  try {
    await exigirUsuario()
    return json(await servidor().servico.listarProspects())
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request) {
  try {
    const usuario = await exigirUsuario()
    const { nome, site } = await lerJson<{ nome?: string; site?: string }>(req)
    const slug = await servidor().servico.criarProspect(nome ?? "", site?.trim() || null, usuario.email)
    return json({ slug }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
