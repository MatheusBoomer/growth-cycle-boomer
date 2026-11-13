import type { ReactNode } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

/** Título com a última palavra em serifada itálica laranja (protótipo 9). Com `mono`, é um caminho de arquivo. */
export function TituloDestacado({ texto, mono = false }: { texto: string; mono?: boolean }) {
  if (mono) return <span className="font-mono text-[12.5px]">{texto}</span>
  const i = texto.trimEnd().lastIndexOf(" ")
  if (i === -1) return <>{texto}</>
  return (
    <>
      {texto.slice(0, i + 1)}
      <em className="font-serif text-[16px] font-normal text-link-acao italic">{texto.slice(i + 1)}</em>
    </>
  )
}

/** A barra única do topo dos visualizadores: título, selo e as ações à direita. */
export function BarraVisualizador({
  titulo,
  dica,
  mono = false,
  selo,
  children,
}: {
  titulo: string
  dica?: string
  mono?: boolean
  selo?: ReactNode
  children: ReactNode
}) {
  return (
    <header className="flex items-center gap-2 border-b border-border py-2.5 pr-2.5 pl-4">
      <h2 className="min-w-0 truncate text-sm font-medium" title={dica ?? titulo}>
        <TituloDestacado texto={titulo} mono={mono} />
      </h2>
      {selo}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">{children}</div>
    </header>
  )
}

/** Estado vazio ou de erro dos visualizadores: ícone em quadrado, título com destaque e a explicação. */
export function EstadoVisualizador({
  icone,
  titulo,
  destaque,
  children,
  acao,
}: {
  icone: ReactNode
  titulo: string
  destaque: string
  children: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[13px] text-muted-foreground">
      <div className="mb-1.5 grid size-11 place-items-center rounded-[14px] border border-border [&_svg]:size-4.5">{icone}</div>
      <h3 className="text-base font-medium text-foreground">
        {titulo} <em className="font-serif text-lg font-normal text-link-acao italic">{destaque}</em>
      </h3>
      <p className="max-w-sm">{children}</p>
      {acao && <div className="mt-2.5">{acao}</div>}
    </div>
  )
}

/** Carregando: o giro laranja e o que está acontecendo. */
export function CarregandoVisualizador({ texto, className }: { texto?: string; className?: string }) {
  return (
    <div className={cn("flex flex-1 items-center justify-center gap-2.5 text-[13px] text-muted-foreground", className)}>
      <Spinner className="text-link-acao" />
      {texto}
    </div>
  )
}
