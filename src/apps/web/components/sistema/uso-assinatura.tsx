"use client"

import { useEffect, useState } from "react"
import type { UsoAssinatura } from "@workspace/core/uso-assinatura"
import { cn } from "@workspace/ui/lib/utils"
import { resumoUso } from "@/lib/uso"

const COR = { ok: "bg-primary", alerta: "bg-amber-500", critico: "bg-destructive" } as const

/**
 * Quanto da assinatura do Claude já foi usado (sessão de 5 h e semana). O número vem do próprio
 * Claude a cada resposta do agente; entre uma resposta e outra, mostra o último conhecido.
 */
export function UsoAssinaturaBarra() {
  const [uso, setUso] = useState<UsoAssinatura | null | undefined>(undefined)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    let ativo = true
    const carregar = () =>
      void fetch("/api/uso", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ uso: UsoAssinatura | null }>) : null))
        .then((d) => {
          if (!ativo || !d) return
          setUso(d.uso)
          setAgora(Date.now())
        })
        .catch(() => {})
    carregar()
    const id = window.setInterval(carregar, 30_000)
    window.addEventListener("focus", carregar)
    return () => {
      ativo = false
      window.clearInterval(id)
      window.removeEventListener("focus", carregar)
    }
  }, [])

  if (uso === undefined) return null
  const linhas = resumoUso(uso, agora)
  const atualizado = uso ? new Date(uso.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null

  return (
    <section aria-label="Uso da assinatura do Claude" className="space-y-2 border-t px-2 pt-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Uso do Claude</p>
      {linhas.length === 0 ? (
        <p className="text-muted-foreground text-xs">Aparece depois da primeira resposta do agente.</p>
      ) : (
        linhas.map((l) => (
          <div key={l.rotulo} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span>{l.rotulo}</span>
              <span className={cn("font-mono tabular-nums", l.nivel === "critico" && "text-destructive font-medium")}>{l.percentual}%</span>
            </div>
            <div
              className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={l.percentual}
              aria-label={l.rotulo}
            >
              <div className={cn("h-full rounded-full transition-all", COR[l.nivel])} style={{ width: `${l.percentual}%` }} />
            </div>
            <p className="text-muted-foreground text-[11px]">{l.renovada ? "Já renovou" : l.renova ? `Renova ${l.renova}` : null}</p>
          </div>
        ))
      )}
      {atualizado && <p className="text-muted-foreground text-[11px]">Atualizado às {atualizado}, na última resposta do agente.</p>}
    </section>
  )
}
