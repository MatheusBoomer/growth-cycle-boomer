"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { normalizarEmail } from "@workspace/core/papeis"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { api, mensagemDeErro, type PessoaComProjetos } from "@/lib/api"

/** Só para admin: passa o prospect para outra pessoa que já entrou no app. */
export function DialogoTrocarDono({
  prospect,
  aberto,
  aoMudar,
}: {
  prospect: ResumoProspect
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  const router = useRouter()
  const [pessoas, setPessoas] = useState<PessoaComProjetos[] | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setPessoas(null)
    setErro(null)
    setEscolhido(null)
    api
      .listarPessoas()
      .then((r) => {
        if (!ativo) return
        setPessoas(r.pessoas)
        const atual = prospect.dono === null ? undefined : r.pessoas.find((p) => normalizarEmail(p.email) === normalizarEmail(prospect.dono!))
        setEscolhido(atual?.email ?? null)
      })
      .catch((e) => ativo && setErro(mensagemDeErro(e)))
    return () => {
      ativo = false
    }
  }, [aberto, prospect.dono])

  const mudou = escolhido !== null && (prospect.dono === null || normalizarEmail(escolhido) !== normalizarEmail(prospect.dono))

  async function confirmar() {
    if (escolhido === null) return
    setSalvando(true)
    setErro(null)
    try {
      await api.trocarDono(prospect.slug, escolhido)
      toast.success(`${prospect.nome} agora é de ${nomeCurto(escolhido)}.`)
      aoMudar(false)
      router.refresh()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar dono de “{prospect.nome}”</DialogTitle>
          <DialogDescription>
            {prospect.dono ? `Hoje é de ${nomeCurto(prospect.dono)}.` : "Hoje não tem dono."} Quem recebe passa a ver este prospect.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Novo dono</FieldLabel>
          <Select
            value={escolhido}
            onValueChange={(v) => setEscolhido(v)}
            items={(pessoas ?? []).map((p) => ({ value: p.email, label: `${nomeCurto(p.email)} (${p.email})` }))}
            disabled={pessoas === null}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={pessoas === null && !erro ? "Carregando…" : "Escolha uma pessoa"} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {(pessoas ?? []).map((p) => (
                <SelectItem key={p.email} value={p.email}>
                  {nomeCurto(p.email)} ({p.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => aoMudar(false)}>
            Cancelar
          </Button>
          <Button disabled={!mudou || salvando} onClick={() => void confirmar()}>
            Trocar dono
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
