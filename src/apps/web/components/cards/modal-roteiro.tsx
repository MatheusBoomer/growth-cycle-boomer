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
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border py-3 pr-14 pl-5">
          <DialogTitle className="text-[15px] tracking-normal">
            Roteiro <em>slide a slide</em>
          </DialogTitle>
          <DialogDescription className="sr-only">Roteiro da apresentação, um slide por vez. Use as setas do teclado para navegar.</DialogDescription>
          {comparacao && (
            <div className="flex items-center gap-1">
              <Badge variant={mudancas.length === 0 ? "outline" : "aviso"}>
                {mudancas.length === 0 ? "nenhuma mudança" : `${mudancas.length} ${mudancas.length === 1 ? "mudança" : "mudanças"}`}
              </Badge>
              <Button size="icon-sm" variant="ghost" aria-label="Alterado anterior" title="Alterado anterior" disabled={mudancaAnterior === undefined} onClick={() => mudancaAnterior !== undefined && aoMudarIndice(mudancaAnterior)}>
                <ChevronsLeftIcon />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Próximo alterado" title="Próximo alterado" disabled={proximaMudanca === undefined} onClick={() => proximaMudanca !== undefined && aoMudarIndice(proximaMudanca)}>
                <ChevronsRightIcon />
              </Button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Button size="icon-sm" variant="ghost" aria-label="Slide anterior" title="Slide anterior (←)" disabled={atual === 0} onClick={() => aoMudarIndice(atual - 1)}>
              <ChevronLeftIcon />
            </Button>
            <span aria-live="polite">
              {atual + 1} / {slides.length}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Próximo slide" title="Próximo slide (→)" disabled={atual >= slides.length - 1} onClick={() => aoMudarIndice(atual + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0">
          <nav aria-label="Slides" className="hidden w-[210px] shrink-0 overflow-y-auto border-r border-border p-2 md:block">
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
                      className={cn("flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground", i === atual && "bg-muted font-medium text-foreground")}
                    >
                      <span className="w-[18px] shrink-0 text-right font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate">{resumoDoSlide(s).titulo}</span>
                      <span className={cn("ml-auto size-[7px] shrink-0 rounded-full", PONTO[st])} title={st === "igual" ? undefined : st} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            <div className={cn("grid gap-6", r.imagens.length > 0 ? "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "mx-auto max-w-3xl")}>
              {r.imagens.length > 0 && (
                <div className="space-y-3">
                  {r.imagens.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
                    <img key={img} src={urlArquivo(slug, img)} alt={r.titulo} title={img} className="mx-auto h-auto max-h-[72vh] w-auto max-w-full rounded-xl border border-border bg-papel" />
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
                <h2 className="text-[19px] leading-[1.2] font-medium tracking-[-0.02em]">{r.titulo}</h2>
                {slide.pendencia && <p className="rounded-[14px] bg-aviso-fundo px-3.5 py-3 text-[13px] text-aviso">Pendência: {slide.pendencia}</p>}
                {r.linhas.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-[13px] leading-normal text-muted-foreground">
                    {r.linhas.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                )}
                {comparado && comparado.diferencas.length > 0 && (
                  <div className="grid gap-2 rounded-2xl border border-border p-3.5">
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
