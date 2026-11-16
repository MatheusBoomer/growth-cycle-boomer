"use client"

import { FlaskConicalIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { EtapaId } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { api, ErroApi, mensagemDeErro } from "@/lib/api"
import { IconeModal } from "@/components/marca/icone-modal"
import { EscolhaEtapa, type EtapaParaEscolher } from "./escolha-etapa"

/** Endereço do prospect com o kit da etapa já aberto (ver FaixaTeste). */
export function enderecoComKit(slug: string): string {
  return `/prospects/${slug}?kit=1`
}

/** Cria o cliente de teste (dados fictícios do modelo Verdeluz) a partir da etapa escolhida. */
export function DialogoClienteTeste({ etapas }: { etapas: EtapaParaEscolher[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [escolhida, setEscolhida] = useState<EtapaId>("01")
  const [erro, setErro] = useState<string | null>(null)
  const [existente, setExistente] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ensaio, setEnsaio] = useState(false)

  async function criar() {
    setErro(null)
    setExistente(null)
    setEnviando(true)
    try {
      const { slug } = await api.criarClienteTeste(escolhida, ensaio)
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <IconeModal tom="acao">
            <FlaskConicalIcon />
          </IconeModal>
          <DialogTitle>
            Criar cliente <em>de teste</em>
          </DialogTitle>
          <DialogDescription>
            Monta um prospect com dados fictícios, como se o planejamento já tivesse passado pelas etapas anteriores. Ao abrir, o kit
            da etapa aparece com as planilhas e o roteiro de respostas.
          </DialogDescription>
        </DialogHeader>
        <EscolhaEtapa etapas={etapas} valor={escolhida} aoEscolher={setEscolhida} rotulo="Etapa de partida" />
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={ensaio}
            onChange={(ev) => setEnsaio(ev.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
          />
          <span className="grid gap-0.5">
            <span className="font-medium">Modo ensaiado</span>
            <span className="text-muted-foreground text-[12.5px]">O agente é substituído pela rodada gravada; nada chama o Claude.</span>
          </span>
        </label>
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
