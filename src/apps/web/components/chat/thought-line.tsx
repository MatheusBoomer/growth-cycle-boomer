"use client"

import { CheckIcon, ChevronRightIcon, SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { fraseDoPasso } from "@/lib/frases-do-agente"
import { duracaoDoProcesso, type EventoProcesso } from "@/lib/passos"

/** Linha curta de um item do processo: passo sem o prefixo da pasta do prospect, ou a 1ª linha da fala. */
function linhaDoProcesso(e: EventoProcesso, slug: string): string {
  if (e.tipo === "atividade") return e.detalhe.replaceAll(`clientes/${slug}/`, "")
  return (e.texto.split("\n").find((l) => l.trim()) ?? "").replace(/[*_`#>]/g, "").trim()
}

/** "4,3 s" até um minuto; depois "12 min 34 s" e, passando de uma hora, "1 h 2 min" (754,3 s não se lê de relance). */
export function duracaoLegivel(s: number): string {
  if (s < 59.95) return `${s.toFixed(1).replace(".", ",")} s`
  const total = Math.round(s)
  const h = Math.floor(total / 3600)
  const min = Math.floor((total % 3600) / 60)
  const seg = total % 60
  if (h > 0) return min > 0 ? `${h} h ${min} min` : `${h} h`
  return seg > 0 ? `${min} min ${seg} s` : `${min} min`
}

/**
 * Processo do agente como Thought Line (React Bits): recolhido por padrão, inclusive enquanto trabalha. Ao vivo, o ✦
 * respira, o rótulo mostra o passo atual em frase amigável e o cronômetro corre; ao terminar vira "Pensou por X s".
 * Só o clique abre e fecha a lista: nada muda sozinho. O texto técnico de cada passo fica no tooltip.
 */
export function ThoughtLine({ itens, slug, aoVivo }: { itens: EventoProcesso[]; slug: string; aoVivo: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!aoVivo) return
    const id = setInterval(() => setAgora(Date.now()), 100)
    return () => clearInterval(id)
  }, [aoVivo])

  const duracao = duracaoDoProcesso(itens, aoVivo ? agora : null)
  const passos = itens.filter((e) => e.tipo === "atividade").length
  const ultimo = itens.length - 1
  const atual = itens[ultimo]
  const rotulo = aoVivo
    ? (atual ? (atual.tipo === "atividade" ? fraseDoPasso(atual, ultimo) : linhaDoProcesso(atual, slug)) : "Pensando…")
    : duracao !== null
      ? `Pensou por ${duracaoLegivel(duracao)}`
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
        {aoVivo && duracao !== null && <span className="text-muted-foreground/70 shrink-0 font-mono text-xs tabular-nums">{duracaoLegivel(duracao)}</span>}
        <ChevronRightIcon aria-hidden="true" className={cn("size-3 shrink-0 transition-transform", aberto && "rotate-90")} />
      </button>
      {aberto && (
        <ul className="border-border mt-2.5 ml-1.5 flex flex-col gap-2 border-l py-0.5 pl-3.5">
          {itens.map((e, i) => {
            const emCurso = aoVivo && i === ultimo
            return (
              <li key={`${e.em}-${i}`} className="surgir text-muted-foreground flex min-w-0 gap-2.5 text-[13px]" style={{ "--i": 0 } as React.CSSProperties}>
                <span
                  aria-hidden="true"
                  className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full", emCurso ? "" : "bg-sucesso-fundo text-sucesso")}
                >
                  {emCurso ? <span className="bg-link-acao size-1.5 rounded-full motion-safe:animate-pulse" /> : <CheckIcon className="size-2.5" />}
                </span>
                {e.tipo === "atividade" ? (
                  <span className="min-w-0 truncate" title={e.detalhe}>
                    {fraseDoPasso(e, i)}
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
