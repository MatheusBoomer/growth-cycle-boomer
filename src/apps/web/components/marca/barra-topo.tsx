import Link from "next/link"
import type { ReactNode } from "react"
import { LogoBoomer } from "./logo-boomer"
import { MenuConta } from "./menu-conta"
import { NavegacaoPrincipal } from "./navegacao-principal"
import { BotaoReportar } from "@/components/reports/botao-reportar"

/**
 * Barra transparente no topo: logo (volta ao início) e nome da tela; no meio, o menu em pílula (só admin); à direita,
 * uma ilha só, no mesmo vidro da navegação: Reportar, `extra` (como o selo de custo) e o avatar, que abre o menu da conta
 * (quem entrou, horário de São Paulo, tema e Sair). Sem ações de etapa.
 */
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
      <div data-ilha-topo className="border-border bg-background/60 ml-auto flex shrink-0 items-center gap-0.5 rounded-full border p-[3px] backdrop-blur-xl">
        <BotaoReportar />
        {extra && (
          <>
            <Divisor />
            {extra}
          </>
        )}
        <Divisor />
        <MenuConta />
      </div>
    </header>
  )
}

const Divisor = () => <span aria-hidden="true" className="bg-border mx-0.5 h-4 w-px" />
