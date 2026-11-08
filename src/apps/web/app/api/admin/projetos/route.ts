import { limitesDoAmbiente } from "@workspace/core/metricas/tempo"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/** Só admin: custo e tempo de cada projeto ativo, mais a média por etapa concluída. */
export async function GET() {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    return json(await servidor().servico.metricasGerais(limitesDoAmbiente(process.env)))
  } catch (e) {
    return respostaDeErro(e)
  }
}
