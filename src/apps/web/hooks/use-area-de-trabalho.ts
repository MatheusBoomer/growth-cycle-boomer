"use client"

import { useCallback, useEffect, useState } from "react"
import type { EtapaId, EventoConversa, EventoTempoReal, RespostaEstado } from "@workspace/core/tipos"

export function useAreaDeTrabalho(slug: string) {
  const [dados, setDados] = useState<RespostaEstado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [conversas, setConversas] = useState<Partial<Record<EtapaId, EventoConversa[]>>>({})
  const [deltas, setDeltas] = useState<Partial<Record<EtapaId, string>>>({})

  const recarregar = useCallback(async () => {
    const r = await fetch(`/api/prospects/${encodeURIComponent(slug)}/estado`, { cache: "no-store" })
    if (!r.ok) {
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? `Erro ${r.status}`)
      return
    }
    setErro(null)
    setDados((await r.json()) as RespostaEstado)
  }, [slug])

  const carregarConversa = useCallback(
    async (etapa: EtapaId) => {
      const r = await fetch(`/api/prospects/${encodeURIComponent(slug)}/etapas/${etapa}/conversa`, { cache: "no-store" })
      if (!r.ok) return
      const { eventos } = (await r.json()) as { eventos: EventoConversa[] }
      setConversas((c) => ({ ...c, [etapa]: eventos }))
    },
    [slug],
  )

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const fonte = new EventSource(`/api/prospects/${encodeURIComponent(slug)}/eventos`)
    fonte.onmessage = (m) => {
      const ev = JSON.parse(m.data) as EventoTempoReal
      if (ev.tipo === "estado") {
        void recarregar()
      } else if (ev.tipo === "turno") {
        void recarregar()
        if (!ev.ativo) {
          setDeltas((d) => ({ ...d, [ev.etapa]: "" }))
          void carregarConversa(ev.etapa)
        }
      } else if (ev.tipo === "delta") {
        setDeltas((d) => ({ ...d, [ev.etapa]: (d[ev.etapa] ?? "") + ev.texto }))
      } else if (ev.tipo === "conversa") {
        setConversas((c) => {
          const atual = c[ev.etapa]
          return atual ? { ...c, [ev.etapa]: [...atual, ev.evento] } : c
        })
        if (ev.evento.tipo === "texto_agente") setDeltas((d) => ({ ...d, [ev.etapa]: "" }))
      }
    }
    // o EventSource reconecta sozinho; ao voltar, o estado é recarregado pelo próximo evento
    return () => fonte.close()
  }, [slug, recarregar, carregarConversa])

  return { dados, erro, conversas, deltas, recarregar, carregarConversa }
}
