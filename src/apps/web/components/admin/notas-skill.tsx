"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { NotaSkill } from "@workspace/core/notas-skills"
import { LIMITE_TEXTO_NOTA } from "@workspace/core/notas-skills"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { api, mensagemDeErro } from "@/lib/api"
import { ehErroSemNuvem, MSG_SEM_NUVEM, rotuloAutorEData, rotuloResolvidas, separarNotas } from "@/lib/catalogo-skills-tela"
import { AvisoAdmin } from "@/components/admin/aviso-admin"

interface Props {
  itemId: string
  notas: NotaSkill[]
  /** Verdadeiro quando o servidor já respondeu que as notas só existem com os dados na nuvem (modo fs). */
  semNuvem: boolean
  aoSemNuvem: () => void
  aoCriar: (nota: NotaSkill) => void
  aoAtualizar: (nota: NotaSkill) => void
}

/** Coluna de notas de melhoria do item aberto: nova nota, abertas (mais novas primeiro) e resolvidas recolhidas. */
export function NotasSkill({ itemId, notas, semNuvem, aoSemNuvem, aoCriar, aoAtualizar }: Props) {
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [emAlteracao, setEmAlteracao] = useState<number | null>(null)
  const { abertas, resolvidas } = separarNotas(notas)

  function tratarErro(e: unknown) {
    if (ehErroSemNuvem(e)) aoSemNuvem()
    else toast.error(mensagemDeErro(e))
  }

  async function adicionar() {
    const limpo = texto.trim()
    if (limpo === "" || enviando) return
    setEnviando(true)
    try {
      const { nota } = await api.criarNotaSkill(itemId, limpo)
      aoCriar(nota)
      setTexto("")
    } catch (e) {
      tratarErro(e)
    } finally {
      setEnviando(false)
    }
  }

  async function marcar(nota: NotaSkill, resolvida: boolean) {
    setEmAlteracao(nota.id)
    try {
      aoAtualizar((await api.marcarNotaSkill(nota.id, resolvida)).nota)
    } catch (e) {
      tratarErro(e)
    } finally {
      setEmAlteracao(null)
    }
  }

  if (semNuvem) {
    return (
      <AvisoAdmin mensagem={MSG_SEM_NUVEM} aba="notas" />
    )
  }

  return (
    <section aria-label="Notas de melhoria" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label="Nova nota"
          placeholder="Nova nota"
          className="min-h-20 resize-y text-sm"
          maxLength={LIMITE_TEXTO_NOTA}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Button className="self-end" size="sm" disabled={enviando || texto.trim() === ""} onClick={() => void adicionar()}>
          Adicionar
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {abertas.map((n) => (
          <li key={n.id} className="bg-card flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
            <p className="break-words whitespace-pre-wrap">{n.texto}</p>
            <p className="text-muted-foreground text-xs">{rotuloAutorEData(n)}</p>
            <Button className="self-start" variant="outline" size="xs" disabled={emAlteracao === n.id} onClick={() => void marcar(n, true)}>
              Marcar como resolvida
            </Button>
          </li>
        ))}
      </ul>
      {resolvidas.length > 0 && (
        <details className="group flex flex-col gap-2">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">{rotuloResolvidas(resolvidas.length)}</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {resolvidas.map((n) => (
              <li key={n.id} className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3 text-sm">
                <p className="text-muted-foreground break-words whitespace-pre-wrap">{n.texto}</p>
                <p className="text-muted-foreground text-xs">{rotuloAutorEData(n)}</p>
                <Button className="self-start" variant="outline" size="xs" disabled={emAlteracao === n.id} onClick={() => void marcar(n, false)}>
                  Reabrir
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
