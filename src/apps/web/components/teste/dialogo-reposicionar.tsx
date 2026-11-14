"use client"

import { RotateCcwIcon } from "lucide-react"
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
import { api, mensagemDeErro } from "@/lib/api"
import { CaixaAviso, IconeModal } from "@/components/marca/icone-modal"
import { EscolhaEtapa } from "@/components/home/escolha-etapa"

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
          <IconeModal tom="aviso">
            <RotateCcwIcon />
          </IconeModal>
          <AlertDialogTitle>
            Em qual etapa o <em>teste</em> começa<em>?</em>
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription render={<div />}>
          <CaixaAviso>
            Isto apaga o que você fez neste cliente e volta ao início da etapa escolhida. As etapas anteriores ficam concluídas.
          </CaixaAviso>
        </AlertDialogDescription>
        <EscolhaEtapa
          etapas={catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus, fase: e.fase }))}
          valor={escolhida}
          aoEscolher={setEscolhida}
          rotulo="Etapa de partida"
        />
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
