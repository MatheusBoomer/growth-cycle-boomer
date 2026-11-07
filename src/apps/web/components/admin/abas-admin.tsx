"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"

const ABAS = [
  { href: "/admin/pessoas", rotulo: "Pessoas" },
  { href: "/admin/projetos", rotulo: "Projetos" },
]

/** Abas da administração. São links (cada aba é uma rota). */
export function AbasAdmin() {
  const caminho = usePathname()
  return (
    <nav aria-label="Administração" className="flex gap-1 border-b">
      {ABAS.map((a) => {
        const ativa = caminho === a.href || caminho.startsWith(`${a.href}/`)
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              ativa ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
