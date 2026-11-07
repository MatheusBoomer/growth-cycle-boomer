"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { Catalogo, EtapaId } from "@workspace/core/tipos"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"

export function DialogoReposicionar({
  slug,
  catalogo,
  etapaAtual,
  aberto,
  aoMudar,
}: {
  slug: string
  catalogo: Catalogo
  etapaAtual: EtapaId
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  const [escolhida, setEscolhida] = useState<EtapaId>(etapaAtual)
  const [reposicionando, setReposicionando] = useState(false)

  async function reposicionar() {
    setReposicionando(true)
    try {
      await api.reposicionarTeste(slug, escolhida)
      toast.success("Cliente de teste reposicionado.")
      aoMudar(false)
      // As conversas ficam em cache na tela; recarregar garante que nada da versão anterior sobra.
      // O ?kit=1 abre o kit da nova etapa assim que a página volta (ver FaixaTeste).
      window.location.assign(`${window.location.pathname}?kit=1`)
    } catch (e) {
      toast.error(mensagemDeErro(e))
      setReposicionando(false)
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={aoMudar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Em qual etapa o teste começa?</AlertDialogTitle>
          <AlertDialogDescription>
            Isto apaga o que você fez neste cliente e volta ao início da etapa escolhida. As etapas anteriores ficam concluídas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5" role="radiogroup" aria-label="Etapa de partida">
          {catalogo.etapas.map((e) => (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={escolhida === e.id}
              onClick={() => setEscolhida(e.id)}
              className={cn(
                "hover:bg-muted rounded-lg border px-3 py-2 text-left text-sm transition",
                escolhida === e.id && "border-primary bg-muted font-medium",
              )}
            >
              {e.rotuloStatus}
            </button>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={reposicionando} onClick={reposicionar}>
            {reposicionando && <Spinner />} Reposicionar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
