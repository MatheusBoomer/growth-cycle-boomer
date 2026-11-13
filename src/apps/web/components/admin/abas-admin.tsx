"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { useResumoAdmin } from "./resumo-admin"

const ABAS = [
  { href: "/admin/pessoas", rotulo: "Pessoas" },
  { href: "/admin/projetos", rotulo: "Projetos" },
  { href: "/admin/modelos", rotulo: "Modelos" },
  { href: "/admin/skills", rotulo: "Skills" },
  { href: "/admin/reports", rotulo: "Reports" },
]

/** Abas da administração. São links (cada aba é uma rota). Reports mostra quantos pedem atenção (aberto ou em andamento). */
export function AbasAdmin() {
  const caminho = usePathname()
  const abertos = useResumoAdmin()?.reportsAbertos ?? 0
  const ativaRef = useRef<HTMLAnchorElement>(null)

  // No celular as cinco pílulas passam da largura: a aba ativa rola para dentro da tela.
  useEffect(() => {
    ativaRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [caminho])

  return (
    <nav aria-label="Administração" className="border-border flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full border p-1">
      {ABAS.map((a) => {
        const ativa = caminho === a.href || caminho.startsWith(`${a.href}/`)
        const contagem = a.href === "/admin/reports" && abertos > 0 ? abertos : 0
        return (
          <Link
            key={a.href}
            ref={ativa ? ativaRef : undefined}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            aria-label={contagem > 0 ? `${a.rotulo}, ${contagem} ${contagem === 1 ? "aberto" : "abertos"}` : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              ativa ? "bg-accent text-foreground shadow-(--sombra-card)" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
            {contagem > 0 && (
              <span data-contagem aria-hidden className="bg-aviso-fundo text-aviso rounded-full px-1.5 font-mono text-[11px] leading-[18px] font-medium tabular-nums">
                {contagem}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
