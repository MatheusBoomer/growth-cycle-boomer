"use client"

import { useEffect, useRef } from "react"
import type { EtapaId } from "@workspace/core/tipos"
import { api } from "@/lib/api"
import { criarMedidorPresenca } from "@/lib/presenca"

const INTERVALO_AVISO_MS = 30_000
/** `pointermove` dispara dezenas de vezes por segundo; um registro a cada 5 s basta para saber que há alguém. */
const INTERVALO_MOVIMENTO_MS = 5_000

/**
 * Mede a presença de quem trabalha na tela do projeto: avisa o servidor a cada 30 s e a cada vez que a aba
 * aparece ou se esconde. Não mostra nada; uma falha de envio é ignorada em silêncio. `etapa` é a etapa aberta.
 */
export function AvisoPresenca({ slug, etapa }: { slug: string; etapa: EtapaId }) {
  // A etapa muda sem desmontar o componente: o medidor e os temporizadores não podem reiniciar por isso.
  const etapaRef = useRef(etapa)
  useEffect(() => {
    etapaRef.current = etapa
  }, [etapa])

  useEffect(() => {
    const medidor = criarMedidorPresenca(() => Date.now())
    let ultimoMovimento = 0
    const registrar = () => medidor.registrarInteracao()
    const aoMover = () => {
      const agora = Date.now()
      if (agora - ultimoMovimento < INTERVALO_MOVIMENTO_MS) return
      ultimoMovimento = agora
      medidor.registrarInteracao()
    }
    const avisar = () => void api.enviarPresenca(slug, medidor.corpo(etapaRef.current, document.visibilityState === "visible"))

    const eventos = ["keydown", "pointerdown", "wheel", "scroll"] as const
    for (const e of eventos) window.addEventListener(e, registrar, { capture: true, passive: true })
    window.addEventListener("pointermove", aoMover, { passive: true })
    document.addEventListener("visibilitychange", avisar)
    const relogio = window.setInterval(avisar, INTERVALO_AVISO_MS)
    return () => {
      for (const e of eventos) window.removeEventListener(e, registrar, { capture: true })
      window.removeEventListener("pointermove", aoMover)
      document.removeEventListener("visibilitychange", avisar)
      window.clearInterval(relogio)
    }
  }, [slug])

  return null
}
