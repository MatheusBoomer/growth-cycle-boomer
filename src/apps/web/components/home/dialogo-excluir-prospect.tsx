"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ResumoProspect } from "@workspace/core/tipos"
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
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { api, mensagemDeErro } from "@/lib/api"

export function DialogoExcluirProspect({
  prospect,
  aberto,
  aoMudar,
}: {
  prospect: ResumoProspect
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  const router = useRouter()
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    try {
      await api.excluirProspect(prospect.slug, confirmacao)
      toast.success(`${prospect.nome} foi para a Lixeira.`)
      aoMudar(false)
      router.refresh()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudar(v)
        if (!v) {
          setConfirmacao("")
          setErro(null)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{prospect.nome}”?</AlertDialogTitle>
          <AlertDialogDescription>
            A pasta do prospect, com insumos, conversas e entregáveis aprovados, vai para a Lixeira do macOS. Dá para recuperar por lá.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`confirmar-${prospect.slug}`}>
            Digite <code className="font-mono">{prospect.slug}</code> para confirmar
          </FieldLabel>
          <Input id={`confirmar-${prospect.slug}`} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={confirmacao.trim() !== prospect.slug || excluindo} onClick={excluir}>
            Excluir prospect
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
