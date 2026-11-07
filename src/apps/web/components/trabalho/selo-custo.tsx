"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { MetricasProjeto } from "@workspace/core/metricas/resumo"
import { tempoUtil } from "@workspace/core/metricas/tempo"
import type { EtapaId } from "@workspace/core/tipos"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { api } from "@/lib/api"

const INTERVALO_MS = 60_000

/** Texto do tooltip: custo e tempo útil da etapa aberta. Puro, para ler e testar sem tela. */
export function textoDaEtapa(metricas: MetricasProjeto, etapa: EtapaId): string {
  const m = metricas.porEtapa[etapa]
  if (!m) return "Sem uso registrado nesta etapa"
  const estimado = m.custo.estimado ? " (estimado)" : ""
  return `Esta etapa: ${formatarUsd(m.custo.usd)}${estimado} · ${formatarDuracao(tempoUtil(m.tempo))} úteis`
}

/**
 * Selo da barra do topo, só para admin: custo e tempo útil do projeto, atualizado a cada minuto (sem as médias,
 * que são caras). Leva ao detalhe. Uma falha ao carregar esconde o selo, sem mostrar erro.
 */
export function SeloCusto({ slug, etapa }: { slug: string; etapa: EtapaId }) {
  const [metricas, setMetricas] = useState<MetricasProjeto | null>(null)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const detalhe = await api.metricasDoProjeto(slug)
        if (ativo) setMetricas(detalhe.metricas)
      } catch {
        if (ativo) setMetricas(null)
      }
    }
    void carregar()
    const relogio = window.setInterval(() => void carregar(), INTERVALO_MS)
    return () => {
      ativo = false
      window.clearInterval(relogio)
    }
  }, [slug])

  if (!metricas) return null
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/admin/projetos/${encodeURIComponent(slug)}`}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        {formatarUsd(metricas.custoUsd)} · {formatarDuracao(tempoUtil(metricas.tempo))} úteis
      </TooltipTrigger>
      <TooltipContent>{textoDaEtapa(metricas, etapa)}</TooltipContent>
    </Tooltip>
  )
}
