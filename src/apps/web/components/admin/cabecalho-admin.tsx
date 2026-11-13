"use client"

import { usePathname } from "next/navigation"
import { cabecalhoDaAba } from "@/lib/cabecalho-admin"

/** Título grande da aba com a palavra de destaque em serifada, e a frase que explica a aba. */
export function CabecalhoAdmin() {
  const { titulo, destaque, frase } = cabecalhoDaAba(usePathname() ?? "")
  return (
    <header className="surgir">
      <h1 className="text-[40px] leading-[.95] font-medium tracking-[-0.045em] sm:text-[56px]">
        {titulo} {destaque && <em className="text-link-acao font-serif font-normal tracking-[-0.02em] italic">{destaque}</em>}
      </h1>
      {frase && <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">{frase}</p>}
    </header>
  )
}
