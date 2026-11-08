"use client"

import { useEffect, useRef } from "react"
import type { EtapaId } from "@workspace/core/tipos"
import { api } from "@/lib/api"
import { criarMedidorPresenca, ehMensagemDeInteracao, focoFoiParaIframe } from "@/lib/presenca"

const INTERVALO_AVISO_MS = 30_000
/** `pointermove` dispara dezenas de vezes por segundo; um registro a cada 5 s basta para saber que há alguém. */
const INTERVALO_MOVIMENTO_MS = 5_000

/**
 * Mede a presença de quem trabalha na tela do projeto: avisa o servidor logo ao abrir, ao trocar de etapa, a cada
 * 30 s e a cada vez que a aba aparece ou se esconde. Interação dentro dos visualizadores (iframes com sandbox, que
 * não repassam eventos ao `window`) chega por mensagem do script injetado no `srcDoc`, ou, para iframes que não dá
 * para instrumentar (PDF), pela janela perdendo o foco para o iframe. Não mostra nada; uma falha de envio é ignorada
 * em silêncio. `etapa` é a etapa aberta.
 */
export function AvisoPresenca({ slug, etapa }: { slug: string; etapa: EtapaId }) {
  // A etapa muda sem desmontar o componente: o medidor e os temporizadores não podem reiniciar por isso.
  const etapaRef = useRef(etapa)
  const avisarRef = useRef<(() => void) | null>(null)
  const primeiraEtapa = useRef(true)
  useEffect(() => {
    etapaRef.current = etapa
    // Na montagem quem avisa é o efeito principal; aqui só as trocas de etapa.
    if (primeiraEtapa.current) primeiraEtapa.current = false
    else avisarRef.current?.()
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
    const aoReceberMensagem = (ev: MessageEvent) => {
      const janelas = Array.from(document.querySelectorAll("iframe"), (f) => f.contentWindow)
      if (ehMensagemDeInteracao(ev.data, ev.source, janelas)) medidor.registrarInteracao()
    }
    const aoPerderFoco = () => {
      if (focoFoiParaIframe(document.activeElement)) medidor.registrarInteracao()
    }
    const avisar = () => void api.enviarPresenca(slug, medidor.corpo(etapaRef.current, document.visibilityState === "visible"))
    avisarRef.current = avisar

    const eventos = ["keydown", "pointerdown", "wheel", "scroll"] as const
    for (const e of eventos) window.addEventListener(e, registrar, { capture: true, passive: true })
    window.addEventListener("pointermove", aoMover, { passive: true })
    window.addEventListener("message", aoReceberMensagem)
    window.addEventListener("blur", aoPerderFoco)
    document.addEventListener("visibilitychange", avisar)
    const relogio = window.setInterval(avisar, INTERVALO_AVISO_MS)
    avisar()
    return () => {
      for (const e of eventos) window.removeEventListener(e, registrar, { capture: true })
      window.removeEventListener("pointermove", aoMover)
      window.removeEventListener("message", aoReceberMensagem)
      window.removeEventListener("blur", aoPerderFoco)
      document.removeEventListener("visibilitychange", avisar)
      window.clearInterval(relogio)
      avisarRef.current = null
    }
  }, [slug])

  return null
}
