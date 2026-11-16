"use client"

import { FastForwardIcon, FlaskConicalIcon, RotateCcwIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { IconeModal } from "@/components/marca/icone-modal"
import { api, mensagemDeErro } from "@/lib/api"
import { DialogoReposicionar } from "./dialogo-reposicionar"
import { PainelKit } from "./painel-kit"

/** Faixa no topo da área de trabalho de um cliente de teste; some em qualquer outro prospect. */
export function FaixaTeste({ slug, dados, etapa }: { slug: string; dados: RespostaEstado; etapa: EtapaId }) {
  const [reposicionando, setReposicionando] = useState(false)
  const [kitAberto, setKitAberto] = useState(false)
  const teste = dados.estado.teste
  const ensaio = teste?.ensaio === true
  const turnoAtivo = dados.turnoAtivo !== null
  const trechosTocados = teste?.trechos?.[etapa] ?? 0
  // Há trecho a tocar nesta etapa? Começa como "não" até a resposta chegar; `null` do servidor = roteiro acabou.
  const [temTrecho, setTemTrecho] = useState(false)
  const [avancando, setAvancando] = useState(false)

  useEffect(() => {
    if (!ensaio) return
    let cancelado = false
    api
      .gatilhoEnsaio(slug, etapa)
      .then((g) => !cancelado && setTemTrecho(g !== null))
      .catch(() => !cancelado && setTemTrecho(false))
    return () => {
      cancelado = true
    }
  }, [ensaio, slug, etapa, turnoAtivo, trechosTocados])

  async function avancar() {
    setAvancando(true)
    try {
      await api.avancarEnsaio(slug, etapa)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setAvancando(false)
    }
  }

  // Logo depois de criar ou reposicionar (endereço com ?kit=1), o kit da etapa abre sozinho uma vez.
  useEffect(() => {
    if (!teste) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("kit") !== "1") return
    setKitAberto(true)
    url.searchParams.delete("kit")
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
  }, [teste])

  if (!teste) return null
  const rotulo = dados.catalogo.etapas.find((e) => e.id === etapa)?.rotuloStatus ?? etapa
  const etapaInicial = dados.catalogo.etapas.find((e) => e.id === teste.etapaInicial)
  const inicio = etapaInicial ? (etapaInicial.numero ? `Etapa ${etapaInicial.numero}` : etapaInicial.titulo) : null

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--aviso)_9%,transparent)_0_10px,transparent_10px_20px)] dark:bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--aviso)_4%,transparent)_0_10px,transparent_10px_20px)] py-2 pr-2.5 pl-3.5 text-[12.5px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-aviso-fundo py-1 pr-2.75 pl-2.25 font-medium text-aviso [&_svg]:size-3.5">
        <FlaskConicalIcon /> Cliente de teste
      </span>
      {ensaio && <Badge variant="outline">Ensaio</Badge>}
      <span className="text-muted-foreground">
        Dados fictícios.{" "}
        {inicio ? (
          <>
            Começou na <b className="font-medium text-foreground">{inicio}</b>; reposicione para começar de outra.
          </>
        ) : (
          "Reposicione para começar de outra etapa."
        )}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {ensaio && (
          <Button size="sm" onClick={() => void avancar()} disabled={turnoAtivo || !temTrecho || avancando}>
            <FastForwardIcon /> Avançar ensaio
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setKitAberto(true)}>
          <FlaskConicalIcon /> Kit da etapa
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReposicionando(true)}>
          <RotateCcwIcon /> Reposicionar
        </Button>
      </div>
      <Dialog open={kitAberto} onOpenChange={setKitAberto}>
        <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogHeader>
            <IconeModal tom="aviso">
              <FlaskConicalIcon />
            </IconeModal>
            <DialogTitle>
              Kit <em>da etapa</em>
            </DialogTitle>
            <DialogDescription>{rotulo}</DialogDescription>
          </DialogHeader>
          {/* A rolagem fica dentro do corpo: na janela inteira a barra vazaria pelo canto arredondado. */}
          <div className="-mx-6 min-h-0 overflow-y-auto px-6 pb-1">
            <PainelKit slug={slug} etapa={etapa} semMoldura mensagemVazia="Esta etapa não pede arquivo novo: o agente trabalha com o que as etapas anteriores deixaram pronto." />
          </div>
        </DialogContent>
      </Dialog>
      <DialogoReposicionar
        slug={slug}
        catalogo={dados.catalogo}
        etapaAtual={teste.etapaInicial}
        aberto={reposicionando}
        aoMudar={setReposicionando}
      />
    </div>
  )
}
