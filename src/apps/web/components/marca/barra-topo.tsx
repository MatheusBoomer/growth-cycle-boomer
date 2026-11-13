import Link from "next/link"
import type { ReactNode } from "react"
import { AlternarTema } from "./alternar-tema"
import { LogoBoomer } from "./logo-boomer"
import { MenuConta } from "./menu-conta"
import { NavegacaoPrincipal } from "./navegacao-principal"
import { Relogio } from "./relogio"
import { BotaoReportar } from "@/components/reports/botao-reportar"

/** Barra transparente no topo (o fundo fica só na navegação e nos controles): logo (volta ao início) e nome da tela; no meio, o menu em pílula (só admin); à direita, Reportar, `extra` (como o selo de custo), relógio, a conta de quem entrou (só no modo google) e o botão de tema. Sem ações de etapa. */
export function BarraTopo({ titulo, subtitulo, extra }: { titulo: string; subtitulo?: string; extra?: ReactNode }) {
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-1.5 px-2.5 sm:gap-3.5 sm:px-5">
      <Link href="/" aria-label="Boomer · voltar aos prospects" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <LogoBoomer />
      </Link>
      <div aria-hidden className="bg-border h-4.5 w-px max-sm:hidden" />
      <p className="min-w-0 truncate text-xs font-semibold">
        {titulo}
        {subtitulo && <span className="text-muted-foreground font-medium"> · {subtitulo}</span>}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
        <NavegacaoPrincipal />
      </div>
      {/* A barra é transparente; o fundo de vidro fica só nos controles (e na navegação, no meio). */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2 [&_[data-slot=button]:not([data-reportar])]:bg-background/60 [&_[data-slot=button]]:backdrop-blur-xl">
        <BotaoReportar />
        {extra}
        <Relogio />
        <MenuConta />
        <AlternarTema />
      </div>
    </header>
  )
}
