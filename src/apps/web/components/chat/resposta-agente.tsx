"use client"

import { CheckIcon, CopyIcon, QuoteIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Message, MessageContent, MessageFooter } from "@workspace/ui/components/message"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { citacao, primeiroParagrafo } from "@/lib/citacao"

/** Resposta do agente com Copiar e Responder a este trecho (aparecem no hover; sempre na última). */
export function RespostaAgente({ texto, ultima }: { texto: string; ultima: boolean }) {
  const { inserirNoCompositor } = useVisualizador()
  const corpo = useRef<HTMLDivElement>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 2000)
    return () => clearTimeout(t)
  }, [copiado])

  function copiar() {
    navigator.clipboard.writeText(texto).then(
      () => setCopiado(true),
      () => toast.error("Não consegui copiar."),
    )
  }

  function citar() {
    const sel = window.getSelection()
    const el = corpo.current
    const dentro = sel && !sel.isCollapsed && el && el.contains(sel.anchorNode) && el.contains(sel.focusNode)
    const trecho = dentro ? sel.toString() : primeiroParagrafo(texto)
    if (trecho.trim()) inserirNoCompositor(citacao(trecho))
  }

  return (
    <Message align="start">
      <MessageContent>
        <div ref={corpo}>
          <Bubble variant="muted">
            <BubbleContent>
              <Markdown>{texto}</Markdown>
            </BubbleContent>
          </Bubble>
        </div>
        <MessageFooter
          className={cn(
            "gap-0.5 px-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100",
            ultima && "opacity-100",
          )}
        >
          <Button variant="ghost" size="icon-xs" title="Copiar" aria-label="Copiar resposta" onClick={copiar}>
            {copiado ? <CheckIcon /> : <CopyIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Responder a este trecho (cita o texto selecionado ou o primeiro parágrafo)"
            aria-label="Responder a este trecho"
            onMouseDown={(e) => e.preventDefault()}
            onClick={citar}
          >
            <QuoteIcon />
          </Button>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}
