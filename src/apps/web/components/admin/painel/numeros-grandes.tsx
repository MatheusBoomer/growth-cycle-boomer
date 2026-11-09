import type { ReactNode } from "react"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { MarcaEstimado } from "./comuns"

/**
 * Variação em relação ao período anterior, em percentual inteiro. Só existe quando o valor anterior é um número
 * maior que zero; do contrário o texto é fixo, para a tela nunca mostrar NaN nem Infinity.
 */
export function textoVariacao(atual: number, anterior: number): string {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior <= 0) return "sem período anterior"
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  return `${pct > 0 ? "+" : ""}${pct}% vs. período anterior`
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe: ReactNode }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4">
      <h3 className="text-muted-foreground text-sm font-medium">{rotulo}</h3>
      <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{valor}</p>
      <p className="text-muted-foreground text-xs">{detalhe}</p>
    </div>
  )
}

/** Quatro números do período: custo, tempo útil, custo médio por projeto concluído e situação dos projetos. */
export function NumerosGrandes({ painel }: { painel: PainelMetricas }) {
  const { totais, concluidos, contagem } = painel
  return (
    <section aria-label="Números do período" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Numero
        rotulo="Custo no período"
        valor={
          <>
            {formatarUsd(totais.custoUsd)}
            {totais.estimado && <MarcaEstimado />}
          </>
        }
        detalhe={textoVariacao(totais.custoUsd, totais.custoAnteriorUsd)}
      />
      <Numero
        rotulo="Tempo útil"
        valor={formatarDuracao(totais.tempoUtilSeg)}
        detalhe={
          <>
            {textoVariacao(totais.tempoUtilSeg, totais.tempoUtilAnteriorSeg)}
            {painel.tempoIgnoraModelo && <span className="text-aviso block">tempo não filtra por modelo</span>}
          </>
        }
      />
      <Numero
        rotulo="Custo médio por concluído"
        valor={concluidos.media === null ? "Sem dado" : formatarUsd(concluidos.media)}
        detalhe={
          concluidos.n === 0 || concluidos.mediana === null
            ? "Nenhum concluído no período"
            : `mediana ${formatarUsd(concluidos.mediana)} · ${concluidos.n} ${concluidos.n === 1 ? "concluído" : "concluídos"}`
        }
      />
      <Numero
        rotulo="Projetos"
        valor={`${contagem.ativos} ${contagem.ativos === 1 ? "ativo" : "ativos"}`}
        detalhe={`${contagem.concluidos} ${contagem.concluidos === 1 ? "concluído" : "concluídos"} · ${contagem.comPendencia} com pendências`}
      />
    </section>
  )
}
