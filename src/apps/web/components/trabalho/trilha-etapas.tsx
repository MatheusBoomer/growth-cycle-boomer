"use client"

import { ImagesIcon } from "lucide-react"
import type { Catalogo, EtapaId, Estado } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { UsoAssinaturaBarra } from "@/components/sistema/uso-assinatura"
import { IconeStatus, ROTULO_STATUS } from "./icone-status"

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
  return (
    <aside className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-3">
      <p className="text-muted-foreground px-2 pt-1 text-[10px] font-medium tracking-[0.14em] uppercase">Prospect</p>
      <h2 className="text-texto-forte px-2 pt-1 pb-3 text-base font-semibold tracking-tight">{estado.prospect.nome}</h2>
      <p className="text-muted-foreground px-2 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">Etapas</p>
      <nav aria-label="Etapas do planejamento" className="flex flex-col gap-0.5">
        {catalogo.etapas.map((e) => {
          const status = estado.etapas[e.id].status
          return (
            <Button
              key={e.id}
              variant="ghost"
              className={cn("text-muted-foreground h-auto justify-start gap-2 rounded-lg px-2 py-1.5 font-normal", selecionada === e.id && "bg-accent text-texto-forte font-medium shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]")}
              disabled={status === "bloqueada"}
              aria-current={selecionada === e.id ? "step" : undefined}
              title={ROTULO_STATUS[status]}
              onClick={() => aoSelecionar(e.id)}
            >
              <IconeStatus status={status} />
              <span className="truncate">
                {e.numero ? `${e.numero} · ` : ""}
                {e.titulo}
              </span>
            </Button>
          )
        })}
      </nav>
      <p className="text-muted-foreground px-2 pt-4 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">Arquivos</p>
      <Button
        variant="ghost"
        className={cn("text-muted-foreground h-auto justify-start gap-2 rounded-lg px-2 py-1.5 font-normal", bibliotecaAberta && "bg-accent text-texto-forte font-medium shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]")}
        aria-pressed={bibliotecaAberta}
        onClick={aoAbrirBiblioteca}
      >
        <ImagesIcon className="size-4" />
        <span className="flex-1 truncate text-left">Biblioteca</span>
        {totalBiblioteca !== null && <span className="text-muted-foreground text-xs tabular-nums">{totalBiblioteca}</span>}
      </Button>
      <div className="mt-auto pt-4">
        <UsoAssinaturaBarra />
      </div>
    </aside>
  )
}
