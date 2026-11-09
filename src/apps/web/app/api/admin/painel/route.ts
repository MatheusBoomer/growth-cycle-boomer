import { limitesDoAmbiente } from "@workspace/core/metricas/tempo"
import { avataresDosDonos } from "@/lib/avatares"
import { json, respostaDeErro } from "@/lib/http"
import { filtroDeParametros } from "@/lib/painel-filtro"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/**
 * Só admin: o painel de métricas com os filtros da query string (`periodo`, `de`/`ate`, `donos`, `projetos`, `etapas`,
 * `modelos`, `testes`). Os dados ficam 30 s em cache no serviço, então trocar o filtro não relê o uso; `?atualizar=1`
 * força a releitura. Parâmetro inválido cai no padrão, nunca vira erro.
 */
export async function GET(req: Request) {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    const params = new URL(req.url).searchParams
    const filtro = filtroDeParametros(params, new Date())
    const { painel, opcoes } = await servidor().servico.painelDeMetricas(filtro, limitesDoAmbiente(process.env), {
      atualizar: params.get("atualizar") === "1",
    })
    return json({ painel, opcoes, avatares: await avataresDosDonos() })
  } catch (e) {
    return respostaDeErro(e)
  }
}
