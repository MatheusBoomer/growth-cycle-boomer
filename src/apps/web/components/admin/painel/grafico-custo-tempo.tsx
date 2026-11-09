"use client"

import { useMemo } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { formatarUsd } from "@workspace/core/metricas/formato"
import type { PontoSerie } from "@workspace/core/metricas/painel"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { GraficoVazio } from "./grafico-vazio"
import { modelosDaSerie, type LinhaSerie } from "./graficos-dados"

/** Texto do eixo em px fixos: o SVG do Recharts tem o tamanho real do cartão, então o texto não escala. */
const TICK = { fontSize: 12 }
const ALTURA = 260

/** `US$ 12` no eixo (sem centavos acima de 10, para caber na largura fixa). */
function rotuloEixoUsd(v: number): string {
  if (v === 0) return "US$ 0"
  return v >= 10 ? `US$ ${Math.round(v).toLocaleString("pt-BR")}` : `US$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
}

/** Área empilhada do custo por modelo ao longo do tempo; com um ponto só, barras (área de um ponto não aparece). */
export function GraficoCustoTempo({ serie, granularidade = "semana" }: { serie: PontoSerie[]; granularidade?: "dia" | "semana" }) {
  const { series, linhas, total } = useMemo(() => modelosDaSerie(serie), [serie])
  const config = useMemo(
    () => Object.fromEntries(series.map((s) => [s.chave, { label: s.rotulo, color: s.cor }])) satisfies ChartConfig,
    [series],
  )

  if (series.length === 0 || total <= 0) return <GraficoVazio className="h-[300px]" />

  const prefixo = granularidade === "semana" ? "Semana de " : ""
  const tooltip = (
    <ChartTooltip
      cursor={linhas.length > 1}
      content={
        <ChartTooltipContent
          className="min-w-44"
          labelFormatter={(_, payload) => {
            const linha = payload?.[0]?.payload as LinhaSerie | undefined
            return linha ? (
              <div className="flex justify-between gap-3">
                <span>
                  {prefixo}
                  {linha.rotulo}
                </span>
                <span className="tabular-nums">{formatarUsd(linha.total)}</span>
              </div>
            ) : null
          }}
          formatter={(valor, nome) =>
            Number(valor) <= 0 ? null : (
            <div className="flex w-full items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${String(nome)})` }} />
              <span className="text-muted-foreground">{config[String(nome)]?.label}</span>
              <span className="text-foreground ml-auto font-medium tabular-nums">{formatarUsd(Number(valor))}</span>
            </div>
            )
          }
        />
      }
    />
  )
  const eixos = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tick={TICK} />
      <YAxis width={64} tickLine={false} axisLine={false} tickMargin={4} tick={TICK} tickFormatter={rotuloEixoUsd} />
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer
        config={config}
        className="aspect-auto h-[260px] w-full"
        initialDimension={{ width: 640, height: ALTURA }}
        role="img"
        aria-label={`Custo por modelo ao longo do tempo, total ${formatarUsd(total)}`}
      >
        {linhas.length === 1 ? (
          <BarChart data={linhas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            {eixos}
            {tooltip}
            {series.map((s, i) => (
              <Bar key={s.chave} dataKey={s.chave} stackId="custo" fill={`var(--color-${s.chave})`} maxBarSize={56} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : (
          <AreaChart data={linhas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            {eixos}
            {tooltip}
            {series.map((s) => (
              <Area
                key={s.chave}
                dataKey={s.chave}
                type="monotone"
                stackId="custo"
                stroke={`var(--color-${s.chave})`}
                strokeWidth={1.5}
                fill={`var(--color-${s.chave})`}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
      <ul aria-label="Modelos" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {series.map((s) => (
          <li key={s.chave} className="flex min-w-0 items-center gap-1.5" title={s.ids.join(", ")}>
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: s.cor }} />
            <span className="truncate">{s.rotulo}</span>
            <span className="text-muted-foreground tabular-nums">{formatarUsd(s.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
