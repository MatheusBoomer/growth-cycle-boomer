"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarDuracao } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { normalizarEmail } from "@workspace/core/papeis"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { Termo } from "@/components/admin/legenda-termos"
import { AvatarPessoa } from "@/components/marca/avatar-pessoa"
import { GraficoVazio } from "./grafico-vazio"
import { ALTURA_EIXO, ALTURA_LINHA, alturaBarras, pessoasDoGrafico, ticksDeTempo } from "./graficos-dados"

const TICK = { fontSize: 12 }
const EIXO_X = 24

/** Os três tempos do gráfico; a explicação de cada um vem do `Termo` compartilhado (legenda-termos.tsx). */
const TERMOS = [
  { chave: "agente", rotulo: "Agente", cor: "var(--chart-1)" },
  { chave: "ativo", rotulo: "Analista ativo", cor: "var(--chart-2)" },
  // Ocioso é tempo parado: fica cinza, fora da paleta das séries.
  { chave: "ocioso", rotulo: "Ocioso", cor: "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" },
] as const

const CONFIG = Object.fromEntries(TERMOS.map((t) => [t.chave, { label: t.rotulo, color: t.cor }])) satisfies ChartConfig

export interface PropsBarrasPessoas {
  tempo: PainelMetricas["tempoPorPessoa"]
  avatares: Record<string, string>
  tempoIgnoraModelo: boolean
}

/** Rótulo das marcas de `ticksDeTempo`: horas redondas (`6h`) ou minutos (`15 min`). */
function rotuloEixoTempo(seg: number): string {
  if (seg <= 0) return "0"
  return seg % 3600 === 0 ? `${seg / 3600}h` : formatarDuracao(seg)
}

/**
 * Tempo de quem trabalhou (agente, analista ativo e ocioso), empilhado por pessoa. Clicar só destaca a pessoa e
 * mostra o detalhe; não filtra a página.
 */
export function BarrasPessoas({ tempo, avatares, tempoIgnoraModelo }: PropsBarrasPessoas) {
  const [destacada, setDestacada] = useState<string | null>(null)
  const pessoas = useMemo(
    () =>
      pessoasDoGrafico(tempo).map((p) => ({
        email: p.email,
        nome: nomeCurto(p.email),
        agente: p.agenteSeg,
        ativo: p.ativoSeg,
        ocioso: p.ociosoSeg,
        total: p.agenteSeg + p.ativoSeg + p.ociosoSeg,
      })),
    [tempo],
  )

  const nota = tempoIgnoraModelo && <p className="text-aviso text-xs">Tempo não filtra por modelo</p>
  if (pessoas.length === 0)
    return (
      <div className="flex flex-col gap-2">
        <GraficoVazio className="h-[120px]" />
        {nota}
      </div>
    )

  const altura = alturaBarras(pessoas.length)
  const ticks = ticksDeTempo(Math.max(...pessoas.map((p) => p.total)))
  const alternar = (email: string) => setDestacada((atual) => (atual === email ? null : email))
  const detalhe = pessoas.find((p) => p.email === destacada)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <ul aria-label="Pessoas" className="flex flex-col" style={{ paddingBottom: ALTURA_EIXO }}>
          {pessoas.map((p) => {
            const ativa = destacada === p.email
            return (
              <li key={p.email} style={{ height: ALTURA_LINHA }} className="flex items-center">
                <button
                  type="button"
                  aria-pressed={ativa}
                  title={`${p.nome}: ${formatarDuracao(p.total)}`}
                  onClick={() => alternar(p.email)}
                  className={cn(
                    "hover:bg-muted focus-visible:ring-ring flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                    ativa && "bg-muted font-medium",
                    destacada !== null && !ativa && "text-muted-foreground",
                  )}
                >
                  <AvatarPessoa email={p.email} nome={p.nome} fotoUrl={avatares[normalizarEmail(p.email)]} tamanho="sm" />
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ChartContainer
          config={CONFIG}
          className="aspect-auto w-full"
          style={{ height: altura }}
          initialDimension={{ width: 360, height: altura }}
          role="img"
          aria-label={`Tempo por pessoa: ${pessoas.map((p) => `${p.nome} ${formatarDuracao(p.total)}`).join(", ")}`}
        >
          <BarChart data={pessoas} layout="vertical" margin={{ top: 0, right: 20, bottom: ALTURA_EIXO - EIXO_X, left: 12 }} barCategoryGap={8} accessibilityLayer={false}>
            <CartesianGrid horizontal={false} />
            <YAxis type="category" dataKey="email" hide />
            <XAxis
              type="number"
              height={EIXO_X}
              domain={[0, ticks.at(-1) ?? 0]}
              ticks={ticks}
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={TICK}
              tickFormatter={rotuloEixoTempo}
            />
            <ChartTooltip
              cursor={{ fillOpacity: 0.5 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { nome: string; total: number } | undefined
                    return p ? `${p.nome} · ${formatarDuracao(p.total)}` : null
                  }}
                  formatter={(valor, nome) => (
                    <div className="flex w-full items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${String(nome)})` }} />
                      <span className="text-muted-foreground">{CONFIG[String(nome)]?.label}</span>
                      <span className="text-foreground ml-auto font-medium tabular-nums">{formatarDuracao(Number(valor))}</span>
                    </div>
                  )}
                />
              }
            />
            {TERMOS.map((t) => (
              <Bar
                key={t.chave}
                dataKey={t.chave}
                stackId="tempo"
                fill={`var(--color-${t.chave})`}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={(_, i) => {
                  const p = pessoas[i]
                  if (p) alternar(p.email)
                }}
              >
                {pessoas.map((p) => (
                  <Cell key={p.email} fillOpacity={destacada !== null && destacada !== p.email ? 0.3 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </div>
      <ul aria-label="Tipos de tempo" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {TERMOS.map((t) => (
          <li key={t.chave} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ background: t.cor }} />
            <Termo id={t.chave}>{t.rotulo}</Termo>
          </li>
        ))}
      </ul>
      {detalhe && (
        <p data-slot="detalhe-pessoa" aria-live="polite" className="bg-muted rounded-md px-3 py-2 text-xs">
          <span className="font-medium">{detalhe.nome}</span>: Agente {formatarDuracao(detalhe.agente)} · Analista ativo {formatarDuracao(detalhe.ativo)} · Ocioso{" "}
          {formatarDuracao(detalhe.ocioso)} · total {formatarDuracao(detalhe.total)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {nota}
        <p className="text-muted-foreground text-xs">Turnos antigos sem autor não entram no tempo do agente.</p>
      </div>
    </div>
  )
}
