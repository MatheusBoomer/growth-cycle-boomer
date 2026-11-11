import Link from "next/link"
import type { ReactNode } from "react"
import { AlternarTema } from "./alternar-tema"
import { LogoBoomer } from "./logo-boomer"
import { LinkAdministracao } from "./link-administracao"
import { MenuConta } from "./menu-conta"
import { BotaoReportar } from "@/components/reports/botao-reportar"

/** Barra fixa no topo: logo (volta ao início), nome da tela, `extra` (o que a tela quiser ter à direita, como o selo de custo), a conta de quem entrou (só no modo google) e o botão de tema. Sem ações de etapa. */
export function BarraTopo({ titulo, subtitulo, extra }: { titulo: string; subtitulo?: string; extra?: ReactNode }) {
  return (
    <header className="bg-background/70 sticky top-0 z-40 flex h-13 shrink-0 items-center gap-1.5 border-b px-2.5 backdrop-blur-xl sm:gap-3.5 sm:px-4">
      <Link href="/" aria-label="Boomer · voltar aos prospects" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <LogoBoomer />
      </Link>
      <div aria-hidden className="bg-border h-4.5 w-px max-sm:hidden" />
      <p className="min-w-0 truncate text-xs font-semibold">
        {titulo}
        {subtitulo && <span className="text-muted-foreground font-medium"> · {subtitulo}</span>}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
        <BotaoReportar />
        <LinkAdministracao />
        {extra}
        <MenuConta />
        <AlternarTema />
      </div>
    </header>
  )
}
