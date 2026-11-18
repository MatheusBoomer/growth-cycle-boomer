"use client"

import { CheckIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"

/**
 * Gráfico ou tabela ampliado num modal, como o roteiro: imagem grande, abrir em nova aba (a imagem inteira na tela)
 * e baixar. Com o entregável pendente, Aprovar e Pedir ajuste também ficam aqui, com as mesmas regras do card.
 */
export function ModalGrafico({
  aberto,
  aoMudarAberto,
  titulo,
  urlImagem,
  urlDownload,
  pendente,
  aprovarDesabilitado,
  motivoAprovarDesabilitado,
  ocupado,
  aoAprovar,
  aoPedirAjuste,
  focoAoPedirAjuste,
}: {
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  titulo: string
  urlImagem: string
  urlDownload: string
  pendente: boolean
  aprovarDesabilitado: boolean
  motivoAprovarDesabilitado?: string
  ocupado: boolean
  /** Devolve `true` se aprovou; o modal só fecha nesse caso (com erro, o card já mostrou o aviso). */
  aoAprovar: () => Promise<boolean>
  aoPedirAjuste: () => void
  /**
   * Para onde o foco vai depois de "Pedir ajuste…": a prévia que abriu o modal é desmontada (dá lugar ao marcador),
   * então não há botão para devolver o foco e ele cairia no corpo da página. Sem isto vale o comportamento padrão.
   */
  focoAoPedirAjuste?: () => HTMLElement | null
}) {
  const pediuAjuste = useRef(false)
  useEffect(() => {
    if (aberto) pediuAjuste.current = false
  }, [aberto])
  async function aprovar() {
    if (await aoAprovar()) aoMudarAberto(false)
  }
  function pedirAjuste() {
    pediuAjuste.current = true
    aoPedirAjuste()
    aoMudarAberto(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent
        finalFocus={() => (pediuAjuste.current ? (focoAoPedirAjuste?.() ?? true) : true)}
        className="h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1500px)]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b py-2 pr-12 pl-4">
          <DialogTitle className="mr-2 min-w-0 flex-1 truncate font-serif text-base font-normal italic">{titulo}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada do entregável.</DialogDescription>
          <Button size="sm" variant="outline" render={<a href={urlImagem} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <ExternalLinkIcon /> Abrir em nova aba
          </Button>
          <Button size="sm" variant="outline" render={<a href={urlDownload} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
        </div>
        <div className="bg-muted flex min-h-0 items-center justify-center overflow-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={urlImagem} alt={titulo} className="bg-papel max-h-full max-w-full rounded-md border object-contain" />
        </div>
        {pendente && (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Button
              className="brilho-passa"
              onClick={() => void aprovar()}
              disabled={ocupado || aprovarDesabilitado}
              title={aprovarDesabilitado ? motivoAprovarDesabilitado : undefined}
            >
              {ocupado ? <Spinner /> : <CheckIcon />} Aprovar
            </Button>
            <Button variant="outline" onClick={pedirAjuste} disabled={ocupado}>
              Pedir ajuste…
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
