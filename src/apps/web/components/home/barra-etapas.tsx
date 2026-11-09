import { cn } from "@workspace/ui/lib/utils"

/**
 * Uma barra segmentada, um pedaço por etapa: as concluídas em verde, a próxima em laranja (só quando há uma em
 * andamento) e as demais neutras. Descreve o progresso por texto para leitor de tela.
 */
export function BarraEtapas({ concluidas, total, atual }: { concluidas: number; total: number; atual: boolean }) {
  const feitas = Math.min(Math.max(concluidas, 0), total)
  return (
    <div role="img" aria-label={`${feitas} de ${total} etapas concluídas`} className="flex gap-1">
      {Array.from({ length: total }, (_, i) => {
        const estado = i < feitas ? "concluida" : i === feitas && atual ? "atual" : "pendente"
        return (
          <span
            key={i}
            data-estado={estado}
            className={cn(
              "h-1.5 min-w-0 flex-1 rounded-full",
              estado === "concluida" && "bg-sucesso",
              estado === "atual" && "bg-primary",
              estado === "pendente" && "bg-foreground/10",
            )}
          />
        )
      })}
    </div>
  )
}
