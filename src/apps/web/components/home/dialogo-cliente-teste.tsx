"use client"

import { FlaskConicalIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { EtapaId } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, ErroApi, mensagemDeErro } from "@/lib/api"

/** Endereço do prospect com o kit da etapa já aberto (ver FaixaTeste). */
export function enderecoComKit(slug: string): string {
  return `/prospects/${slug}?kit=1`
}

/** Cria o cliente de teste (dados fictícios do modelo Verdeluz) a partir da etapa escolhida. */
export function DialogoClienteTeste({ etapas }: { etapas: { id: EtapaId; rotulo: string }[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [escolhida, setEscolhida] = useState<EtapaId>("01")
  const [erro, setErro] = useState<string | null>(null)
  const [existente, setExistente] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function criar() {
    setErro(null)
    setExistente(null)
    setEnviando(true)
    try {
      const { slug } = await api.criarClienteTeste(escolhida)
      router.push(enderecoComKit(slug))
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "prospect_existente") setExistente(String(e.dados.slug))
      else setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FlaskConicalIcon /> Cliente de teste
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar cliente de teste</DialogTitle>
          <DialogDescription>
            Monta um prospect com dados fictícios, como se o planejamento já tivesse passado pelas etapas anteriores. Ao abrir, o kit
            da etapa aparece com as planilhas e o roteiro de respostas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5" role="radiogroup" aria-label="Etapa de partida">
          {etapas.map((e) => (
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
              {e.rotulo}
            </button>
          ))}
        </div>
        {erro && <FieldError>{erro}</FieldError>}
        {existente && (
          <FieldError>
            O cliente de teste já existe.{" "}
            <button type="button" className="underline" onClick={() => router.push(`/prospects/${existente}`)}>
              Abrir o existente
            </button>{" "}
            e use “Reposicionar” para escolher outra etapa.
          </FieldError>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={enviando} onClick={criar}>
            {enviando && <Spinner />} Criar e abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
