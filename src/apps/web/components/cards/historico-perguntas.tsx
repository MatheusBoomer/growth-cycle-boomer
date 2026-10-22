import { MessageCircleQuestionIcon } from "lucide-react"
import type { ConjuntoPerguntas } from "@workspace/core/tipos"
import { linhasDoHistorico } from "@/lib/historico-perguntas"

/** Perguntas feitas pelo card antigo do agente, só para leitura: hoje o agente pergunta no chat. */
export function HistoricoPerguntas({ conjunto }: { conjunto: ConjuntoPerguntas }) {
  return (
    <div className="text-muted-foreground max-w-xl space-y-2 rounded-lg border border-dashed p-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <MessageCircleQuestionIcon className="size-3.5" /> Perguntas do agente (histórico)
      </p>
      <ol className="space-y-2">
        {linhasDoHistorico(conjunto).map((l, i) => (
          <li key={i}>
            <p className="text-foreground font-medium">{l.enunciado}</p>
            <p className="whitespace-pre-wrap">{l.resposta}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
