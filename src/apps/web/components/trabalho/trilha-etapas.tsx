"use client"

import { ArrowLeftIcon, ImagesIcon } from "lucide-react"
import Link from "next/link"
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
    <aside className="flex min-h-0 flex-col gap-1 overflow-y-auto p-3">
      <Button variant="ghost" size="sm" className="justify-start" render={<Link href="/" />} nativeButton={false}>
        <ArrowLeftIcon /> Prospects
      </Button>
      <h2 className="px-2 pt-2 pb-3 font-semibold">{estado.prospect.nome}</h2>
      <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">Etapas</p>
      <nav aria-label="Etapas do planejamento" className="flex flex-col gap-0.5">
        {catalogo.etapas.map((e) => {
          const status = estado.etapas[e.id].status
          return (
            <Button
              key={e.id}
              variant="ghost"
              className={cn("h-auto justify-start gap-2 px-2 py-1.5 font-normal", selecionada === e.id && "bg-muted font-medium")}
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
      <p className="text-muted-foreground px-2 pt-4 pb-1 text-xs font-medium tracking-wide uppercase">Arquivos</p>
      <Button
        variant="ghost"
        className={cn("h-auto justify-start gap-2 px-2 py-1.5 font-normal", bibliotecaAberta && "bg-muted font-medium")}
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
