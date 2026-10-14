import Link from "next/link"
import { AlternarTema } from "./alternar-tema"
import { LogoBoomer } from "./logo-boomer"

/** Barra fixa no topo: logo (volta ao início), nome da tela e o botão de tema. Sem ações de etapa. */
export function BarraTopo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="bg-background/70 sticky top-0 z-40 flex h-13 shrink-0 items-center gap-3.5 border-b px-4 backdrop-blur-xl">
      <Link href="/" aria-label="Boomer · voltar aos prospects" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <LogoBoomer />
      </Link>
      <div aria-hidden className="bg-border h-4.5 w-px" />
      <p className="min-w-0 truncate text-xs font-semibold">
        {titulo}
        {subtitulo && <span className="text-muted-foreground font-medium"> · {subtitulo}</span>}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <AlternarTema />
      </div>
    </header>
  )
}
