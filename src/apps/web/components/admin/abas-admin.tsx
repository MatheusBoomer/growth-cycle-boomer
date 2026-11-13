"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"

const ABAS = [
  { href: "/admin/pessoas", rotulo: "Pessoas" },
  { href: "/admin/projetos", rotulo: "Projetos" },
  { href: "/admin/modelos", rotulo: "Modelos" },
  { href: "/admin/skills", rotulo: "Skills" },
  { href: "/admin/reports", rotulo: "Reports" },
]

/** Abas da administração. São links (cada aba é uma rota). */
export function AbasAdmin() {
  const caminho = usePathname()
  return (
    <nav aria-label="Administração" className="border-border flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full border p-1">
      {ABAS.map((a) => {
        const ativa = caminho === a.href || caminho.startsWith(`${a.href}/`)
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              ativa ? "bg-accent text-foreground shadow-(--sombra-card)" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
