"use client"

import { ImagesIcon } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import type { Catalogo, EtapaId, Estado } from "@workspace/core/tipos"
import { cn } from "@workspace/ui/lib/utils"
import { AnelCiclo } from "@/components/home/anel-ciclo"
import { UsoAssinaturaBarra } from "@/components/sistema/uso-assinatura"
import { fasesDaTrilha } from "@/lib/trilha"
import { IconeStatus, ROTULO_STATUS } from "./icone-status"

/**
 * Trilha de etapas em árvore por fase (Branched Menu da React Bits): cada fase do catálogo é um ramo que abre e fecha;
 * as etapas saem dele com uma curva fina, e um marcador laranja desliza no tronco até a etapa aberta.
 */
export function TrilhaEtapas({
  catalogo,
  estado,
  selecionada,
  aoSelecionar,
  bibliotecaAberta,
  totalBiblioteca,
  aoAbrirBiblioteca,
}: {
  catalogo: Catalogo
  estado: Estado
  selecionada: EtapaId
  aoSelecionar: (etapa: EtapaId) => void
  bibliotecaAberta: boolean
  /** null enquanto a lista não carregou. */
  totalBiblioteca: number | null
  aoAbrirBiblioteca: () => void
}) {
  const fases = fasesDaTrilha(catalogo.etapas, estado)
  const faseSelecionada = fases.find((f) => f.etapas.some((e) => e.id === selecionada))?.fase ?? null
  const [abertas, setAbertas] = useState<Set<string>>(
    () => new Set(fases.filter((f) => f.situacao !== "" || f.fase === faseSelecionada).map((f) => f.fase)),
  )
  // Trocou de etapa (ex.: "Concluir e ir para" a próxima fase): abre a fase dela, sem esperar um clique.
  const [faseVista, setFaseVista] = useState(faseSelecionada)
  if (faseVista !== faseSelecionada) {
    setFaseVista(faseSelecionada)
    if (faseSelecionada && !abertas.has(faseSelecionada)) setAbertas(new Set([...abertas, faseSelecionada]))
  }
  const alternar = (fase: string) =>
    setAbertas((atual) => {
      const nova = new Set(atual)
      if (nova.has(fase)) nova.delete(fase)
      else nova.add(fase)
      return nova
    })

  const todas = fases.flatMap((f) => f.etapas)
  const concluidas = todas.filter((e) => e.status === "concluida").length

  // Marcador no tronco: acompanha a etapa aberta; some se a fase dela estiver fechada.
  const arvore = useRef<HTMLDivElement>(null)
  const [topoMarcador, setTopoMarcador] = useState<number | null>(null)
  useLayoutEffect(() => {
    const alvo = arvore.current?.querySelector<HTMLElement>('[aria-current="step"]')
    setTopoMarcador(alvo ? alvo.offsetTop + alvo.offsetHeight / 2 - 11 : null)
  }, [selecionada, abertas])

  return (
    <aside className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-4">
      <p className="text-muted-foreground text-[10.5px] tracking-[0.14em] uppercase">Prospect</p>
      <h2 className="text-texto-forte mt-1 truncate text-[22px] font-medium tracking-[-0.03em]" title={estado.prospect.nome}>
        {estado.prospect.nome}
      </h2>
      <div className="text-muted-foreground mt-2 flex items-center gap-2.5 text-xs">
        <AnelCiclo concluidas={concluidas} total={todas.length} atual={concluidas < todas.length} tamanho={26} />
        <span>
          {concluidas} de {todas.length} etapas{faseSelecionada && <span className="text-foreground"> · em {faseSelecionada}</span>}
        </span>
      </div>

      <nav aria-label="Etapas do planejamento" className="mt-5">
        <div ref={arvore} className="relative">
          <span aria-hidden="true" className="bg-border absolute top-1.5 bottom-1.5 left-[9px] w-px" />
          {topoMarcador !== null && (
            <span
              aria-hidden="true"
              className="bg-primary absolute left-2 h-[22px] w-[3px] rounded-full shadow-[0_0_12px_var(--primary)] transition-[top] duration-500 ease-[cubic-bezier(.6,.1,.2,1)]"
              style={{ top: topoMarcador }}
            />
          )}
          {fases.map((f) => {
            const aberta = abertas.has(f.fase)
            return (
              <div key={f.fase}>
                <button
                  type="button"
                  aria-expanded={aberta}
                  onClick={() => alternar(f.fase)}
                  className="text-muted-foreground hover:text-foreground relative flex w-full items-center justify-between py-1.5 pr-1 pl-[26px] text-left text-[11.5px]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-background border-input absolute top-1/2 left-1.5 size-[7px] -translate-y-1/2 rounded-full border",
                      f.situacao === "feita" && "bg-sucesso border-sucesso",
                      f.situacao === "atual" && "bg-primary border-primary",
                    )}
                  />
                  <span>{f.fase}</span>
                  <span className="text-muted-foreground/70 font-mono text-[10.5px]">
                    {f.feitas}/{f.etapas.length}
                  </span>
                </button>
                {aberta &&
                  f.etapas.map((e) => {
                    const atual = e.id === selecionada
                    return (
                      <button
                        key={e.id}
                        type="button"
                        disabled={e.status === "bloqueada"}
                        aria-current={atual ? "step" : undefined}
                        title={ROTULO_STATUS[e.status]}
                        onClick={() => aoSelecionar(e.id)}
                        className={cn(
                          "text-muted-foreground hover:text-foreground relative flex h-8 w-full items-center gap-2 rounded-[10px] pr-2 pl-10 text-left text-[13.5px] transition-colors disabled:cursor-default disabled:opacity-60",
                          atual && "bg-accent text-texto-forte shadow-(--sombra-card)",
                        )}
                      >
                        <svg aria-hidden="true" width="30" height="30" className="absolute -top-3.5 left-[9px] overflow-visible">
                          <path d="M0 0 V14 Q0 30 16 30 H28" fill="none" strokeWidth={atual ? 1.5 : 1} className={atual ? "stroke-primary" : "stroke-border"} />
                        </svg>
                        <IconeStatus status={e.status} className={cn("size-3.5", (e.status === "em_andamento" || e.status === "pronta") && "motion-safe:animate-pulse")} />
                        {e.numero && <span className="text-muted-foreground/70 w-[18px] font-mono text-[11px]">{e.numero}</span>}
                        <span className="truncate">{e.titulo}</span>
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </nav>

      <div className="border-border mt-4 border-t pt-3">
        <p className="text-muted-foreground px-2 pb-1 text-[10.5px] tracking-[0.14em] uppercase">Arquivos</p>
        <button
          type="button"
          aria-pressed={bibliotecaAberta}
          onClick={aoAbrirBiblioteca}
          className={cn(
            "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[13.5px]",
            bibliotecaAberta && "bg-accent text-texto-forte",
          )}
        >
          <ImagesIcon className="size-4" />
          <span className="flex-1 truncate">Biblioteca</span>
          {totalBiblioteca !== null && <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{totalBiblioteca}</span>}
        </button>
      </div>
      <div className="mt-auto pt-4">
        <UsoAssinaturaBarra />
      </div>
    </aside>
  )
}
