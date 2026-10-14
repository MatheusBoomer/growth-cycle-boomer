import { CircleCheckIcon, CircleDotIcon, CircleIcon, LockIcon, TriangleAlertIcon } from "lucide-react"
import type { StatusEtapa } from "@workspace/core/tipos"
import { cn } from "@workspace/ui/lib/utils"

export const ROTULO_STATUS: Record<StatusEtapa, string> = {
  bloqueada: "Bloqueada",
  liberada: "Liberada",
  em_andamento: "Em andamento",
  pronta: "Pronta para concluir",
  concluida: "Concluída",
  desatualizada: "Desatualizada",
}

export function IconeStatus({ status, className }: { status: StatusEtapa; className?: string }) {
  const classe = cn("size-4 shrink-0", className)
  switch (status) {
    case "concluida":
      return <CircleCheckIcon className={cn(classe, "text-sucesso")} aria-label={ROTULO_STATUS[status]} />
    case "desatualizada":
      return <TriangleAlertIcon className={cn(classe, "text-aviso")} aria-label={ROTULO_STATUS[status]} />
    case "em_andamento":
    case "pronta":
      return <CircleDotIcon className={cn(classe, "text-primary")} aria-label={ROTULO_STATUS[status]} />
    case "liberada":
      return <CircleIcon className={cn(classe, "text-muted-foreground")} aria-label={ROTULO_STATUS[status]} />
    case "bloqueada":
      return <LockIcon className={cn(classe, "text-muted-foreground/60")} aria-label={ROTULO_STATUS[status]} />
  }
}
