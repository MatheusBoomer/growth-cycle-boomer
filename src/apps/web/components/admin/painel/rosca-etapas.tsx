"use client"

import { useMemo, useState } from "react"
import { Cell, Pie, PieChart } from "recharts"
import { formatarUsd } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { GraficoVazio } from "./grafico-vazio"
import { fatiasDaRosca, type FatiaRosca } from "./graficos-dados"

type Visao = "fase" | "etapa"

/** Lado fixo da rosca em px: sempre um quadrado, nunca acompanha a largura do cartão. */
const LADO = 200

export interface PropsRoscaEtapas {
  dados: PainelMetricas["porEtapa"]
  etapasSelecionadas: string[]
  aoFiltrarEtapa: (id: string) => void
}

/** Na visão por etapa, a segunda etapa da mesma fase usa a mesma cor mais clara, para separar as fatias vizinhas. */
function tons(fatias: FatiaRosca[]): number[] {
  const vistas = new Map<string, number>()
  return fatias.map((f) => {
    const n = vistas.get(f.cor) ?? 0
    vistas.set(f.cor, n + 1)
    return n % 2 === 0 ? 1 : 0.6
  })
}

/**
 * Rosca do custo por fase ou por etapa. "Por fase" (padrão) só destaca a fatia; "Por etapa" filtra a página pela
 * etapa clicada. Total no centro e legenda são HTML, para o texto nunca escalar com o gráfico.
 */
export function RoscaEtapas({ dados, etapasSelecionadas, aoFiltrarEtapa }: PropsRoscaEtapas) {
  const [visao, setVisao] = useState<Visao>(etapasSelecionadas.length > 0 ? "etapa" : "fase")
  const [faseDestacada, setFaseDestacada] = useState<string | null>(null)
  const fatias = useMemo(() => fatiasDaRosca(dados, visao), [dados, visao])
  const opacidades = useMemo(() => tons(fatias), [fatias])
  const total = fatias.reduce((a, f) => a + f.usd, 0)

  if (fatias.length === 0) return <GraficoVazio className="h-[248px]" />

  const ativa = (f: FatiaRosca) => (visao === "fase" ? faseDestacada === f.id : !f.agrupada && etapasSelecionadas.includes(f.id))
  const algumaAtiva = fatias.some(ativa)
  const clicar = (f: FatiaRosca) => {
    if (visao === "fase") setFaseDestacada((atual) => (atual === f.id ? null : f.id))
    else if (!f.agrupada) aoFiltrarEtapa(f.id)
  }
  const resumo = fatias.map((f) => `${f.rotulo} ${f.pct}%`).join(", ")

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        aria-label="Agrupar a rosca"
        variant="outline"
        size="sm"
        spacing={0}
        value={[visao]}
        onValueChange={(v) => {
          const nova = v[0] as Visao | undefined
          if (nova) setVisao(nova)
        }}
      >
        <ToggleGroupItem value="fase">Por fase</ToggleGroupItem>
        <ToggleGroupItem value="etapa">Por etapa</ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative size-[200px] shrink-0">
          <ChartContainer
            config={{}}
            className="aspect-square size-[200px]"
            initialDimension={{ width: LADO, height: LADO }}
            role="img"
            aria-label={`Custo por ${visao}, total ${formatarUsd(total)}: ${resumo}`}
          >
            <PieChart accessibilityLayer={false}>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_, __, item) => {
                      const f = item.payload as FatiaRosca
                      return (
                        <div className="flex w-full items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: f.cor }} />
                          <span className="text-muted-foreground">{f.rotulo}</span>
                          <span className="text-foreground ml-auto font-medium tabular-nums">
                            {formatarUsd(f.usd)} · {f.pct}%
                          </span>
                        </div>
                      )
                    }}
                  />
                }
              />
              <Pie
                data={fatias}
                dataKey="usd"
                nameKey="rotulo"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={fatias.length > 1 ? 1 : 0}
                stroke="none"
                isAnimationActive={false}
                onClick={(_, i) => fatias[i] && clicar(fatias[i])}
              >
                {fatias.map((f, i) => (
                  <Cell
                    key={f.id}
                    fill={f.cor}
                    fillOpacity={(algumaAtiva && !ativa(f) ? 0.3 : 1) * opacidades[i]!}
                    className={cn(visao === "fase" || !f.agrupada ? "cursor-pointer" : undefined)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div data-slot="total-rosca" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-xs">Total</span>
            <span className="text-base font-semibold tabular-nums">{formatarUsd(total)}</span>
          </div>
        </div>
        <ul aria-label={visao === "fase" ? "Fases" : "Etapas"} className="flex w-full min-w-0 flex-col gap-0.5 text-sm">
          {fatias.map((f, i) => {
            const conteudo = (
              <>
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: f.cor, opacity: opacidades[i] }} />
                <span className="min-w-0 flex-1 truncate">{f.rotulo}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">{formatarUsd(f.usd)}</span>
                <span data-pct={f.pct} className="w-10 shrink-0 text-right font-medium tabular-nums">
                  {f.pct}%
                </span>
              </>
            )
            const linha = "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left"
            return (
              <li key={f.id} className={cn(algumaAtiva && !ativa(f) && "opacity-60")}>
                {visao === "etapa" && f.agrupada ? (
                  <div className={linha} title={`Etapas abaixo de 3% do total: ${f.etapas.join(", ")}`}>
                    {conteudo}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-pressed={ativa(f)}
                    title={visao === "fase" ? `Destacar ${f.rotulo}` : `Filtrar a página pela etapa ${f.rotulo}`}
                    className={cn(linha, "hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2", ativa(f) && "bg-muted font-medium")}
                    onClick={() => clicar(f)}
                  >
                    {conteudo}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {visao === "fase" && <p className="text-muted-foreground text-xs">Para filtrar a página por uma etapa, use “Por etapa”.</p>}
    </div>
  )
}
