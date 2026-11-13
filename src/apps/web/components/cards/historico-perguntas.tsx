import { MessageCircleQuestionIcon } from "lucide-react"
import type { ConjuntoPerguntas } from "@workspace/core/tipos"
import { linhasDoHistorico } from "@/lib/historico-perguntas"

/** Perguntas feitas pelo card antigo do agente, só para leitura: hoje o agente pergunta no chat. */
export function HistoricoPerguntas({ conjunto }: { conjunto: ConjuntoPerguntas }) {
  return (
    <div className="grid max-w-xl gap-2.5 rounded-2xl border border-dashed border-border px-4 py-3.5 text-[13px] text-muted-foreground">
      <p className="flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase">
        <MessageCircleQuestionIcon className="size-3.5" /> Perguntas do agente · histórico
      </p>
      <ol className="grid gap-2.5">
        {linhasDoHistorico(conjunto).map((l, i) => (
          <li key={i}>
            <p className="font-medium text-foreground">{l.enunciado}</p>
            <p className="mt-1 border-l-2 border-border pl-2.5 whitespace-pre-wrap">{l.resposta}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
