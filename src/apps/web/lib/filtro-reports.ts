import type { StatusReport, TipoReport } from "@workspace/core/reports"

/** Status que a aba Reports mostra ao abrir: o que ainda pede atenção. */
export const STATUS_PADRAO: StatusReport[] = ["aberto", "em_andamento"]

/** Query de GET /api/admin/reports. Status vazio = todos (sem parâmetro); tipo null = os dois. */
export function consultaDoFiltro(f: { status: StatusReport[]; tipo: TipoReport | null }): string {
  const partes: string[] = []
  if (f.status.length > 0) partes.push(`status=${f.status.join(",")}`)
  if (f.tipo) partes.push(`tipo=${f.tipo}`)
  return partes.length > 0 ? `?${partes.join("&")}` : ""
}
