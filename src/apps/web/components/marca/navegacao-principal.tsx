"use client"

import { LayoutGridIcon, SettingsIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { usePapel } from "./conta-contexto"

const ITENS: { rotulo: string; href: string; icone: LucideIcon; ativo: (caminho: string) => boolean }[] = [
  { rotulo: "Prospects", href: "/", icone: LayoutGridIcon, ativo: (c) => !c.startsWith("/admin") },
  { rotulo: "Administração", href: "/admin/pessoas", icone: SettingsIcon, ativo: (c) => c.startsWith("/admin") },
]

/**
 * Menu em pílula da barra do topo, só para admin (quem não é admin só tem a tela de prospects). O servidor confere o
 * papel de novo em /admin e nas rotas. Abaixo de `lg` (celular, tablet, meia tela) cada item vira só o ícone, com o nome para leitor de tela.
 */
export function NavegacaoPrincipal() {
  const papel = usePapel()
  const caminho = usePathname() ?? "/"
  if (papel !== "admin") return null
  return (
    <nav aria-label="Navegação principal" className="border-border flex items-center gap-0.5 rounded-full border p-1 text-sm">
      {ITENS.map(({ rotulo, href, icone: Icone, ativo }) => {
        const atual = ativo(caminho)
        return (
          <Link
            key={href}
            href={href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-full px-3 transition-colors outline-none focus-visible:ring-3 max-lg:px-2",
              atual && "bg-accent text-foreground shadow-(--sombra-card)",
            )}
          >
            <Icone aria-hidden="true" className="size-4 lg:hidden" />
            <span className="max-lg:sr-only">{rotulo}</span>
          </Link>
        )
      })}
    </nav>
  )
}
