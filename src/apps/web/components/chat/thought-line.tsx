"use client"

import { CheckIcon, ChevronRightIcon, SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { duracaoDoProcesso, type EventoProcesso } from "@/lib/passos"

/** Linha curta de um item do processo: passo sem o prefixo da pasta do prospect, ou a 1ª linha da fala. */
export function linhaDoProcesso(e: EventoProcesso, slug: string): string {
  if (e.tipo === "atividade") return e.detalhe.replaceAll(`clientes/${slug}/`, "")
  return (e.texto.split("\n").find((l) => l.trim()) ?? "").replace(/[*_`#>]/g, "").trim()
}

const segundos = (s: number) => `${s.toFixed(1).replace(".", ",")} s`

/**
 * Processo do agente como Thought Line (React Bits): enquanto trabalha, o ✦ respira, o rótulo mostra o passo atual
 * e o cronômetro corre, com os passos abertos; ao terminar recolhe em "Pensou por X s". Clicar abre e fecha.
 */
export function ThoughtLine({ itens, slug, aoVivo }: { itens: EventoProcesso[]; slug: string; aoVivo: boolean }) {
  const [aberto, setAberto] = useState(aoVivo)
  const [vivoAntes, setVivoAntes] = useState(aoVivo)
  const [agora, setAgora] = useState(() => Date.now())

  // Recolhe sozinho quando o agente termina; abre quando volta a trabalhar (ajuste durante a renderização, sem efeito).
  if (vivoAntes !== aoVivo) {
    setVivoAntes(aoVivo)
    setAberto(aoVivo)
  }
  useEffect(() => {
    if (!aoVivo) return
    const id = setInterval(() => setAgora(Date.now()), 100)
    return () => clearInterval(id)
  }, [aoVivo])

  const duracao = duracaoDoProcesso(itens, aoVivo ? agora : null)
  const passos = itens.filter((e) => e.tipo === "atividade").length
  const ultimo = itens.length - 1
  const rotulo = aoVivo
    ? (itens[ultimo] ? linhaDoProcesso(itens[ultimo], slug) : "Pensando…")
    : duracao !== null
      ? `Pensou por ${segundos(duracao)}`
      : passos === 0
        ? "Processo"
        : `Processo · ${passos === 1 ? "1 passo" : `${passos} passos`}`

  return (
    <div className="text-sm">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full items-center gap-2 rounded-md outline-none focus-visible:ring-3"
      >
        <SparklesIcon aria-hidden="true" className={cn("text-link-acao size-3.5 shrink-0", aoVivo && "motion-safe:animate-pulse")} />
        <span className={cn("truncate", aoVivo && "shimmer")}>{rotulo}</span>
        {aoVivo && duracao !== null && <span className="text-muted-foreground/70 shrink-0 font-mono text-xs tabular-nums">{segundos(duracao)}</span>}
        <ChevronRightIcon aria-hidden="true" className={cn("size-3 shrink-0 transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && (
        <ul className="border-border mt-2.5 ml-1.5 flex flex-col gap-2 border-l py-0.5 pl-3.5">
          {itens.map((e, i) => {
            const atual = aoVivo && i === ultimo
            return (
              <li key={`${e.em}-${i}`} className="surgir text-muted-foreground flex min-w-0 gap-2.5 text-[13px]" style={{ "--i": 0 } as React.CSSProperties}>
                <span
                  aria-hidden="true"
                  className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full", atual ? "" : "bg-sucesso-fundo text-sucesso")}
                >
                  {atual ? <span className="bg-link-acao size-1.5 rounded-full motion-safe:animate-pulse" /> : <CheckIcon className="size-2.5" />}
                </span>
                {e.tipo === "atividade" ? (
                  <span className="min-w-0 truncate" title={e.detalhe}>
                    {linhaDoProcesso(e, slug)}
                  </span>
                ) : (
                  <div className="text-foreground/80 min-w-0">
                    <Markdown>{e.texto}</Markdown>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
