"use client"

import { SettingsIcon } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@workspace/ui/components/button"
import { usePapel } from "./conta-contexto"

/**
 * Atalho para a administração, só para admin. O servidor confere o papel de novo em /admin e nas rotas.
 * Abaixo de `sm` vira só o ícone (o texto fica para leitor de tela), para o nome da tela caber na barra do topo.
 */
export function LinkAdministracao() {
  if (usePapel() !== "admin") return null
  return (
    <Link href="/admin/pessoas" className={buttonVariants({ variant: "ghost", size: "sm" })}>
      <SettingsIcon aria-hidden="true" className="sm:hidden" />
      <span className="max-sm:sr-only">Administração</span>
    </Link>
  )
}
