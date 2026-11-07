"use client"

import Link from "next/link"
import { buttonVariants } from "@workspace/ui/components/button"
import { usePapel } from "./conta-contexto"

/** Atalho para a administração, só para admin. O servidor confere o papel de novo em /admin e nas rotas. */
export function LinkAdministracao() {
  if (usePapel() !== "admin") return null
  return (
    <Link href="/admin/pessoas" className={buttonVariants({ variant: "ghost", size: "sm" })}>
      Administração
    </Link>
  )
}
