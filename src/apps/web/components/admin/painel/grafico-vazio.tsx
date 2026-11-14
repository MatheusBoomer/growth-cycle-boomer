import { cn } from "@workspace/ui/lib/utils"
import { TEXTO_SEM_USO } from "./comuns"

/** Lugar do gráfico sem dados: o mesmo texto do painel, com a altura do gráfico para a página não "pular". */
export function GraficoVazio({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full items-center justify-center rounded-[14px] border border-dashed border-border px-4 text-center text-[13px] text-muted-foreground", className)}>
      {TEXTO_SEM_USO}
    </div>
  )
}
