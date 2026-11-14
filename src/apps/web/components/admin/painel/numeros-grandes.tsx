import type { ReactNode } from "react"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { cn } from "@workspace/ui/lib/utils"
import { tomDaVariacao } from "@/lib/numeros-pessoas"
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

/** Cartão de número grande da administração: rótulo, valor em serifada e um detalhe. */
export function CartaoNumero({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe: ReactNode }) {
  return (
    <div className="vidro flex min-w-0 flex-col gap-1 rounded-[18px] border p-[18px]">
      <h3 className="text-muted-foreground text-[12.5px] font-normal">{rotulo}</h3>
      <p className="mt-1.5 truncate font-serif text-[40px] leading-none tracking-[-0.01em] tabular-nums sm:text-[46px]">{valor}</p>
      <div className="text-muted-foreground mt-2 text-xs">{detalhe}</div>
    </div>
  )
}

/** Variação contra o período anterior numa pílula com a cor do tom (âmbar quando piora, verde quando melhora). */
function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const tom = tomDaVariacao(atual, anterior, true)
  return (
    <span
      data-tom={tom}
      className={cn("rounded-full", tom === "ruim" && "bg-aviso-fundo text-aviso px-2 py-0.5", tom === "bom" && "bg-sucesso-fundo text-sucesso px-2 py-0.5")}
    >
      {textoVariacao(atual, anterior)}
    </span>
  )
}

const Numero = CartaoNumero

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
        detalhe={<Variacao atual={totais.custoUsd} anterior={totais.custoAnteriorUsd} />}
      />
      <Numero
        rotulo="Tempo útil"
        valor={formatarDuracao(totais.tempoUtilSeg)}
        detalhe={
          <>
            <Variacao atual={totais.tempoUtilSeg} anterior={totais.tempoUtilAnteriorSeg} />
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
        detalhe={`${contagem.concluidos} ${contagem.concluidos === 1 ? "concluído" : "concluídos"} · ${contagem.comPendencia} com ${contagem.comPendencia === 1 ? "pendência" : "pendências"}`}
      />
    </section>
  )
}
