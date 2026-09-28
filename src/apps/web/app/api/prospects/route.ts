import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function GET() {
  try {
    return json(await servidor().servico.listarProspects())
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request) {
  try {
    const { nome, site } = await lerJson<{ nome?: string; site?: string }>(req)
    const slug = await servidor().servico.criarProspect(nome ?? "", site?.trim() || null)
    return json({ slug }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
