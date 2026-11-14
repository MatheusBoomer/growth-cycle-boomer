import { cn } from "@workspace/ui/lib/utils"

/**
 * Uma barra segmentada, um pedaço por etapa, todos da mesma largura: as concluídas em verde, a próxima em laranja
 * (só quando há uma em andamento; em âmbar se ela aguarda aprovação) e as futuras em cinza visível nos dois temas.
 * Descreve o progresso por texto para leitor de tela.
 */
export function BarraEtapas({ concluidas, total, atual, aguardando = false }: { concluidas: number; total: number; atual: boolean; aguardando?: boolean }) {
  const feitas = Math.min(Math.max(concluidas, 0), total)
  const atualAguarda = atual && aguardando && feitas < total
  const rotulo = `${feitas} de ${total} etapas concluídas${atualAguarda ? ", etapa atual aguardando aprovação" : ""}`
  return (
    <div role="img" aria-label={rotulo} className="flex gap-1">
      {Array.from({ length: total }, (_, i) => {
        const estado = i < feitas ? "concluida" : i === feitas && atual ? (aguardando ? "aguardando" : "atual") : "pendente"
        return (
          <span
            key={i}
            data-estado={estado}
            className={cn(
              "h-1.5 min-w-0 flex-1 rounded-full",
              estado === "concluida" && "bg-chart-3",
              estado === "atual" && "bg-primary motion-safe:animate-pulse",
              estado === "aguardando" && "bg-aviso",
              estado === "pendente" && "bg-foreground/25",
            )}
          />
        )
      })}
    </div>
  )
}
