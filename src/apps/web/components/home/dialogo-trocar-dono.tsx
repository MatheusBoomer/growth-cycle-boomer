"use client"

import { ArrowLeftRightIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { normalizarEmail } from "@workspace/core/papeis"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { FieldError } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"
import { AvatarPessoa } from "@/components/marca/avatar-pessoa"
import { IconeModal } from "@/components/marca/icone-modal"
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
          <IconeModal tom="acao">
            <ArrowLeftRightIcon />
          </IconeModal>
          <DialogTitle>
            Trocar dono de <em>{prospect.nome}</em>
          </DialogTitle>
          <DialogDescription>
            {prospect.dono ? `Hoje é de ${nomeCurto(prospect.dono)}.` : "Hoje não tem dono."} Quem recebe passa a ver este prospect.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <span id="novo-dono" className="text-[13px] font-medium">
            Novo dono
          </span>
          <div
            role="radiogroup"
            aria-labelledby="novo-dono"
            aria-busy={pessoas === null && !erro}
            className="grid max-h-[168px] gap-0.5 overflow-y-auto rounded-2xl border border-border p-1"
          >
            {pessoas === null && !erro && <p className="px-2.5 py-2 text-[13px] text-muted-foreground">Carregando…</p>}
            {(pessoas ?? []).map((p) => {
              const marcada = escolhido !== null && normalizarEmail(escolhido) === normalizarEmail(p.email)
              const atual = prospect.dono !== null && normalizarEmail(prospect.dono) === normalizarEmail(p.email)
              return (
                <button
                  key={p.email}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  onClick={() => setEscolhido(p.email)}
                  className={cn(
                    "flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    marcada && "bg-muted",
                  )}
                >
                  <AvatarPessoa email={p.email} nome={nomeCurto(p.email)} tamanho="sm" />
                  <span className="min-w-0 truncate">{nomeCurto(p.email)}</span>
                  {atual && <small className="ml-auto shrink-0 text-xs text-muted-foreground">dono atual</small>}
                </button>
              )
            })}
          </div>
          {erro && <FieldError>{erro}</FieldError>}
        </div>
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
