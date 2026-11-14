"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { cabecalhoDaAba } from "@/lib/cabecalho-admin"
import { seloDaAba } from "@/lib/resumo-admin"
import { useResumoAdmin } from "./resumo-admin"

/** Selo de contexto, título grande da aba com a palavra de destaque em serifada, e a frase que explica a aba. */
export function CabecalhoAdmin() {
  const caminho = usePathname() ?? ""
  const params = useSearchParams()
  const resumo = useResumoAdmin()
  const { titulo, destaque, frase } = cabecalhoDaAba(caminho)
  const selo = seloDaAba(caminho, resumo, new URLSearchParams(params?.toString() ?? ""))
  return (
    <header className="surgir">
      {selo && (
        <span data-selo-contexto className="text-muted-foreground border-border mb-3.5 inline-flex items-center rounded-full border px-[11px] py-1 text-xs">
          {selo}
        </span>
      )}
      <h1 className="text-texto-forte text-[40px] leading-[1.05] font-medium tracking-[-0.045em] sm:text-[56px]">
        {titulo} {destaque && <em className="text-link-acao font-serif font-normal tracking-[-0.02em] italic">{destaque}</em>}
      </h1>
      {frase && <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">{frase}</p>}
    </header>
  )
}
