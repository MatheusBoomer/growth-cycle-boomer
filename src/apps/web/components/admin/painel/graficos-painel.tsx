import type { ReactElement } from "react"
import type { FiltroPainel, PainelMetricas } from "@workspace/core/metricas/painel"

export interface PropsGraficosPainel {
  painel: PainelMetricas
  /** Foto de cada dono, pelo e-mail em minúsculas. */
  avatares: Record<string, string>
  filtro: FiltroPainel
  /** Liga ou desliga (alterna) a etapa ou o projeto no filtro do painel. */
  aoFiltrar: (f: { etapa?: string; projeto?: string }) => void
}

/** Os quatro gráficos do painel (custo e tempo no tempo, etapas, projetos e pessoas). Ainda sem conteúdo: a Task 7b preenche. */
export function GraficosPainel(_props: PropsGraficosPainel): ReactElement | null {
  return null
}
