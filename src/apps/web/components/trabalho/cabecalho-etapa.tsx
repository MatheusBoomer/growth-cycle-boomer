"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

export interface InfoEtapa {
  numero: string | null
  fase: string | null
  titulo: string
  /** O agente está rodando nesta etapa: mostra o selo "Agente trabalhando". */
  trabalhando: boolean
  /** Selo de status (Concluída, Desatualizada…), quando a etapa não está em andamento. */
  selo?: ReactNode
}

/** Altura da barra compacta; a capa usa para saber quando o título grande já passou por baixo dela. */
export const ALTURA_BARRA_ETAPA = 46

function Trabalhando() {
  return (
    <span className="border-primary/35 text-link-acao inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap">
      <i aria-hidden="true" className="bg-primary size-1.5 rounded-full motion-safe:animate-pulse" />
      Agente trabalhando
    </span>
  )
}

function Numero({ numero }: { numero: string }) {
  return <span className="border-border text-muted-foreground rounded-md border px-1.5 font-mono text-[11px] leading-[18px]">{numero}</span>
}

/**
 * Barra da etapa sobre a conversa. Com a capa à vista (`compacto` falso) ela é transparente e só mostra os botões dos
 * painéis (`antes` e `depois`) nos cantos; quando o título grande passa por baixo dela, vira uma barra de uma linha com
 * número, nome e fase da etapa (variação C do protótipo do chat).
 */
export function CabecalhoEtapa({
  numero,
  fase,
  titulo,
  trabalhando,
  selo,
  compacto,
  antes,
  depois,
}: InfoEtapa & { compacto: boolean; antes?: ReactNode; depois?: ReactNode }) {
  return (
    <header
      data-compacto={compacto || undefined}
      style={{ height: ALTURA_BARRA_ETAPA }}
      className={cn(
        "absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b px-2 transition-[background-color,border-color,backdrop-filter] duration-200",
        compacto ? "border-border bg-(--vidro-1)/90 backdrop-blur-xl" : "border-transparent",
      )}
    >
      {antes}
      <div
        aria-hidden={!compacto}
        className={cn(
          "flex min-w-0 items-center gap-2 transition-[opacity,translate] duration-200 motion-reduce:transition-none",
          compacto ? "opacity-100" : "pointer-events-none invisible -translate-y-1 opacity-0",
        )}
      >
        {numero && <Numero numero={numero} />}
        <h2 className="text-texto-forte min-w-0 truncate pr-1 font-serif text-[21px] leading-[1.2] italic">{titulo}</h2>
        {fase && <span className="text-muted-foreground text-xs whitespace-nowrap max-md:hidden">{fase}</span>}
        {selo}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {compacto && trabalhando && <Trabalhando />}
        {depois}
      </div>
    </header>
  )
}

/**
 * Capa da etapa no topo da conversa: número e fase pequenos e o nome grande em serifada. Avisa (`aoMudarVisivel`) quando
 * o título some por baixo da barra compacta, para a barra ganhar o nome da etapa.
 */
export function CapaEtapa({
  numero,
  fase,
  titulo,
  trabalhando,
  selo,
  aoMudarVisivel,
}: InfoEtapa & { aoMudarVisivel?: (visivel: boolean) => void }) {
  const tituloRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const el = tituloRef.current
    if (!el || !aoMudarVisivel || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(([e]) => aoMudarVisivel(e!.isIntersecting), {
      rootMargin: `-${ALTURA_BARRA_ETAPA}px 0px 0px 0px`,
    })
    obs.observe(el)
    return () => {
      obs.disconnect()
      aoMudarVisivel(false)
    }
  }, [aoMudarVisivel])
  return (
    <div data-capa-etapa className="pt-8 pb-2">
      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {numero && <Numero numero={numero} />}
        {fase}
        {selo}
        {trabalhando && <Trabalhando />}
      </p>
      <h1 className="text-texto-forte mt-1.5 font-serif text-[34px] leading-[1.1] tracking-[-0.01em] italic sm:text-[40px]" ref={tituloRef}>
        {titulo}
      </h1>
    </div>
  )
}
