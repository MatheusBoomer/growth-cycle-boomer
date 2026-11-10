"use client"

import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { resumoDoSlide, type Comparacao, type SlideRoteiro } from "@/lib/roteiro"
import { DiferencasDoSlide, EtiquetaMudanca } from "./mudancas-roteiro"

const PONTO = { alterado: "bg-aviso", novo: "bg-sucesso", movido: "bg-muted-foreground", igual: "bg-transparent" } as const

/**
 * O roteiro inteiro, um slide por vez e em tamanho grande. Com `comparacao`, os slides que mudaram em relação à
 * versão anterior ficam marcados e dá para pular de um para o outro. `indice` é a posição aberta (null = fechado).
 */
export function ModalRoteiro({
  slug,
  slides,
  comparacao,
  indice,
  aoMudarIndice,
  comentarios,
}: {
  slug: string
  slides: SlideRoteiro[]
  comparacao: Comparacao | null
  indice: number | null
  aoMudarIndice: (indice: number | null) => void
  /** Bloco de comentários do slide (quando o roteiro ainda aceita ajustes). */
  comentarios?: (numero: number) => ReactNode
}) {
  const aberto = indice !== null
  const atual = Math.min(Math.max(indice ?? 0, 0), Math.max(slides.length - 1, 0))
  const slide = slides[atual]
  const comparado = comparacao?.slides[atual]
  const mudancas = comparacao ? comparacao.slides.filter((s) => s.status !== "igual").map((s) => s.numero - 1) : []
  const proximaMudanca = mudancas.find((i) => i > atual)
  const mudancaAnterior = [...mudancas].reverse().find((i) => i < atual)
  const itemAtivo = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(ev: KeyboardEvent) {
      if (alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (ev.key === "ArrowRight" && atual < slides.length - 1) aoMudarIndice(atual + 1)
      else if (ev.key === "ArrowLeft" && atual > 0) aoMudarIndice(atual - 1)
      else return
      ev.preventDefault()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aberto, atual, slides.length, aoMudarIndice])

  useEffect(() => {
    if (aberto) itemAtivo.current?.scrollIntoView({ block: "nearest" })
  }, [aberto, atual])

  if (!slide) return null
  const r = resumoDoSlide(slide)
  const status = comparado?.status ?? "igual"

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoMudarIndice(null)}>
      <DialogContent className="h-[92vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1500px)]">
        <div className="flex flex-wrap items-center gap-2 border-b py-2 pr-12 pl-4">
          <DialogTitle className="mr-2 font-mono text-sm">
            Slide {atual + 1} / {slides.length}
          </DialogTitle>
          <DialogDescription className="sr-only">Roteiro da apresentação, um slide por vez. Use as setas do teclado para navegar.</DialogDescription>
          <Button size="icon-sm" variant="outline" aria-label="Slide anterior" title="Slide anterior (←)" disabled={atual === 0} onClick={() => aoMudarIndice(atual - 1)}>
            <ChevronLeftIcon />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Próximo slide" title="Próximo slide (→)" disabled={atual >= slides.length - 1} onClick={() => aoMudarIndice(atual + 1)}>
            <ChevronRightIcon />
          </Button>
          {comparacao && (
            <div className="ml-2 flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={mudancaAnterior === undefined} onClick={() => mudancaAnterior !== undefined && aoMudarIndice(mudancaAnterior)}>
                <ChevronsLeftIcon /> Alterado anterior
              </Button>
              <Button size="sm" variant="outline" disabled={proximaMudanca === undefined} onClick={() => proximaMudanca !== undefined && aoMudarIndice(proximaMudanca)}>
                Próximo alterado <ChevronsRightIcon />
              </Button>
              <span className="text-muted-foreground text-xs">
                {mudancas.length === 0 ? "nenhum slide mudou" : `${mudancas.length} ${mudancas.length === 1 ? "slide mudou" : "slides mudaram"}`}
              </span>
            </div>
          )}
        </div>
        <div className="flex min-h-0">
          <nav aria-label="Slides" className="hidden w-60 shrink-0 overflow-y-auto border-r p-2 md:block">
            <ol className="space-y-0.5">
              {slides.map((s, i) => {
                const st = comparacao?.slides[i]?.status ?? "igual"
                return (
                  <li key={i}>
                    <button
                      ref={i === atual ? itemAtivo : undefined}
                      type="button"
                      onClick={() => aoMudarIndice(i)}
                      aria-current={i === atual ? "true" : undefined}
                      className={cn("hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs", i === atual && "bg-accent font-medium")}
                    >
                      <span className="text-muted-foreground w-6 shrink-0 text-right font-mono">{i + 1}</span>
                      <span className="truncate">{resumoDoSlide(s).titulo}</span>
                      <span className={cn("ml-auto size-2 shrink-0 rounded-full", PONTO[st])} title={st === "igual" ? undefined : st} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className={cn("grid gap-6", r.imagens.length > 0 ? "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "mx-auto max-w-3xl")}>
              {r.imagens.length > 0 && (
                <div className="space-y-3">
                  {r.imagens.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
                    <img key={img} src={urlArquivo(slug, img)} alt={r.titulo} title={img} className="bg-papel mx-auto h-auto max-h-[72vh] w-auto max-w-full rounded-md border" />
                  ))}
                </div>
              )}
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {slide.tipo}
                  </Badge>
                  {status !== "igual" && <EtiquetaMudanca status={status} />}
                </div>
                <h2 className="text-lg leading-snug font-semibold">{r.titulo}</h2>
                {slide.pendencia && <p className="border-aviso/60 bg-aviso-fundo text-aviso rounded-md border p-2 text-sm">Pendência: {slide.pendencia}</p>}
                {r.linhas.length > 0 && (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm">
                    {r.linhas.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                )}
                {comparado && comparado.diferencas.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2">
                    <p className="text-xs font-medium">O que mudou neste slide</p>
                    <DiferencasDoSlide diferencas={comparado.diferencas} />
                  </div>
                )}
                {typeof slide.fonte === "string" && <p className="text-muted-foreground font-mono text-[10px]">fonte: {slide.fonte}</p>}
                {comentarios?.(atual + 1)}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
