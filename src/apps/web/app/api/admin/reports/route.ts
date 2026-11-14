import { ehStatusReport, type FiltroReports, TIPOS_REPORT, type TipoReport } from "@workspace/core/reports"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"

/** Só admin: lista os reports, os mais recentes primeiro. `?status=a,b` e `?tipo=` filtram; valores desconhecidos são ignorados. */
export async function GET(req: Request) {
  try {
    await exigirAdmin()
    const parametros = new URL(req.url).searchParams
    const filtro: FiltroReports = {}
    const status = (parametros.get("status") ?? "").split(",").filter(ehStatusReport)
    if (status.length > 0) filtro.status = status
    const tipo = parametros.get("tipo")
    if (TIPOS_REPORT.includes(tipo as TipoReport)) filtro.tipo = tipo as TipoReport
    return json({ reports: await servidor().servico.listarReports(filtro) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
