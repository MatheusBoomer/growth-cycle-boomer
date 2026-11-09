"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { formatarUsd } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { GraficoVazio } from "./grafico-vazio"
import { ALTURA_EIXO, ALTURA_LINHA, alturaBarras, corDaFase, FASE_ARQUIVADA, fasesOrdenadas, ROTULO_ARQUIVADA, topProjetos } from "./graficos-dados"

const TICK = { fontSize: 12 }
/** Altura do eixo X; o resto de ALTURA_EIXO fica de margem embaixo. A faixa de cada barra fica com ALTURA_LINHA px. */
const EIXO_X = 24

export interface PropsBarrasProjetos {
  projetos: PainelMetricas["porProjeto"]
  projetosSelecionados: string[]
  aoFiltrarProjeto: (slug: string) => void
}

function rotuloEixoUsd(v: number): string {
  return `US$ ${Math.round(v).toLocaleString("pt-BR")}`
}

/**
 * Barras horizontais do custo dos 8 projetos mais caros, empilhadas por fase. Os nomes são botões HTML numa coluna
 * de largura fixa, alinhados às barras (cada faixa tem 36 px); clicar no nome ou na barra filtra pelo projeto.
 */
export function BarrasProjetos({ projetos, projetosSelecionados, aoFiltrarProjeto }: PropsBarrasProjetos) {
  const { linhas, aMais } = useMemo(() => topProjetos(projetos), [projetos])
  const fases = useMemo(() => fasesOrdenadas(linhas.flatMap((p) => Object.keys(p.porFase).filter((f) => (p.porFase[f] ?? 0) > 0))), [linhas])
  const config = useMemo(
    () => Object.fromEntries(fases.map((f, i) => [`f${i}`, { label: f === FASE_ARQUIVADA ? ROTULO_ARQUIVADA : f, color: corDaFase(f) }])) satisfies ChartConfig,
    [fases],
  )
  const dados = useMemo(
    () => linhas.map((p) => ({ slug: p.slug, nome: p.nome, usd: p.usd, ...Object.fromEntries(fases.map((f, i) => [`f${i}`, p.porFase[f] ?? 0])) })),
    [linhas, fases],
  )

  if (linhas.length === 0) return <GraficoVazio className="h-[156px]" />

  const altura = alturaBarras(linhas.length)
  const algumSelecionado = linhas.some((p) => projetosSelecionados.includes(p.slug))
  const apagado = (slug: string) => algumSelecionado && !projetosSelecionados.includes(slug)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <ul aria-label="Projetos" className="flex flex-col" style={{ paddingBottom: ALTURA_EIXO }}>
          {linhas.map((p) => {
            const selecionado = projetosSelecionados.includes(p.slug)
            return (
              <li key={p.slug} style={{ height: ALTURA_LINHA }} className="flex items-center">
                <button
                  type="button"
                  aria-pressed={selecionado}
                  aria-label={`${p.nome}, ${formatarUsd(p.usd)}`}
                  title={p.nome}
                  onClick={() => aoFiltrarProjeto(p.slug)}
                  className={cn(
                    "hover:bg-muted focus-visible:ring-ring flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                    selecionado && "bg-muted font-medium",
                    apagado(p.slug) && "text-muted-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ChartContainer
          config={config}
          className="aspect-auto w-full"
          style={{ height: altura }}
          initialDimension={{ width: 360, height: altura }}
          role="img"
          aria-label={`Custo por projeto, ${linhas.length} maiores: ${linhas.map((p) => `${p.nome} ${formatarUsd(p.usd)}`).join(", ")}`}
        >
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 12, bottom: ALTURA_EIXO - EIXO_X, left: 0 }} barCategoryGap={8} accessibilityLayer={false}>
            <CartesianGrid horizontal={false} />
            <YAxis type="category" dataKey="slug" hide />
            <XAxis type="number" height={EIXO_X} tickLine={false} axisLine={false} tick={TICK} tickFormatter={rotuloEixoUsd} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.5 }}
              content={
                <ChartTooltipContent
                  className="max-w-64"
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { nome: string; usd: number } | undefined
                    return p ? (
                      <div className="flex flex-col">
                        <span className="truncate">{p.nome}</span>
                        <span className="text-muted-foreground font-normal tabular-nums">{formatarUsd(p.usd)}</span>
                      </div>
                    ) : null
                  }}
                  formatter={(valor, nome) =>
                    Number(valor) > 0 ? (
                      <div className="flex w-full items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${String(nome)})` }} />
                        <span className="text-muted-foreground">{config[String(nome)]?.label}</span>
                        <span className="text-foreground ml-auto font-medium tabular-nums">{formatarUsd(Number(valor))}</span>
                      </div>
                    ) : null
                  }
                />
              }
            />
            {fases.map((_, i) => (
              <Bar
                key={i}
                dataKey={`f${i}`}
                stackId="fase"
                fill={`var(--color-f${i})`}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={(_, indice) => {
                  const p = linhas[indice]
                  if (p) aoFiltrarProjeto(p.slug)
                }}
              >
                {dados.map((d) => (
                  <Cell key={d.slug} fillOpacity={apagado(d.slug) ? 0.3 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </div>
      <ul aria-label="Fases" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {fases.map((f, i) => (
          <li key={f} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: corDaFase(f) }} />
            {config[`f${i}`]?.label}
          </li>
        ))}
      </ul>
      {aMais > 0 && (
        <p className="text-muted-foreground text-xs">
          {aMais === 1 ? "1 projeto a mais na lista abaixo" : `${aMais} projetos a mais na lista abaixo`}
        </p>
      )}
    </div>
  )
}
