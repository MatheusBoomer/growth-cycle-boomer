"use client"

import type { ReactElement, ReactNode } from "react"
import type { FiltroPainel, PainelMetricas } from "@workspace/core/metricas/painel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { BarrasPessoas } from "./barras-pessoas"
import { BarrasProjetos } from "./barras-projetos"
import { GraficoCustoTempo } from "./grafico-custo-tempo"
import { RoscaEtapas } from "./rosca-etapas"

export interface PropsGraficosPainel {
  painel: PainelMetricas
  /** Foto de cada dono, pelo e-mail em minúsculas. */
  avatares: Record<string, string>
  filtro: FiltroPainel
  /** Liga ou desliga (alterna) a etapa ou o projeto no filtro do painel. */
  aoFiltrar: (f: { etapa?: string; projeto?: string }) => void
}

function Cartao({ titulo, descricao, className, children }: { titulo: string; descricao: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription className="truncate">{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

/**
 * Os quatro gráficos do painel: custo no tempo (linha inteira), rosca por etapa e barras por projeto (lado a lado a
 * partir de `lg`) e tempo por pessoa (linha inteira). Cada gráfico zerado mostra o texto de vazio no lugar.
 */
export function GraficosPainel({ painel, avatares, filtro, aoFiltrar }: PropsGraficosPainel): ReactElement | null {
  const semana = painel.periodo.granularidade === "semana"
  return (
    <section aria-label="Gráficos do período" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao titulo="Custo ao longo do tempo" descricao={`Por ${semana ? "semana" : "dia"}, empilhado por modelo`} className="lg:col-span-2">
        <GraficoCustoTempo serie={painel.serie} granularidade={painel.periodo.granularidade} />
      </Cartao>
      <Cartao titulo="Custo por etapa" descricao="Fatias por fase ou por etapa">
        <RoscaEtapas dados={painel.porEtapa} etapasSelecionadas={filtro.etapas} aoFiltrarEtapa={(etapa) => aoFiltrar({ etapa })} />
      </Cartao>
      <Cartao titulo="Custo por projeto" descricao="Os 8 maiores, empilhados por fase">
        <BarrasProjetos projetos={painel.porProjeto} projetosSelecionados={filtro.projetos} aoFiltrarProjeto={(projeto) => aoFiltrar({ projeto })} />
      </Cartao>
      <Cartao titulo="Tempo por pessoa" descricao="Quem trabalhou: agente, analista ativo e ocioso" className="lg:col-span-2">
        <BarrasPessoas tempo={painel.tempoPorPessoa} avatares={avatares} tempoIgnoraModelo={painel.tempoIgnoraModelo} />
      </Cartao>
    </section>
  )
}
