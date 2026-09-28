"use client"

import { InfoIcon, WrenchIcon } from "lucide-react"
import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { CardEntregavel } from "@/components/cards/card-entregavel"
import { CardInsumo } from "@/components/cards/card-insumo"
import { Markdown } from "@/components/markdown"

function resumoAutomatico(texto: string): string {
  const primeira = texto.split("\n")[0] ?? ""
  return primeira.length > 140 ? `${primeira.slice(0, 140)}…` : primeira
}

export function ItemConversa({
  evento,
  slug,
  etapa,
  dados,
  aoTentarDeNovo,
}: {
  evento: EventoConversa
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  aoTentarDeNovo: () => void
}) {
  switch (evento.tipo) {
    case "turno_inicio":
      return null
    case "mensagem_analista":
      return evento.automatica ? (
        <Marker variant="separator">
          <MarkerContent>{resumoAutomatico(evento.texto)}</MarkerContent>
        </Marker>
      ) : (
        <Message align="end">
          <MessageContent>
            <Bubble variant="default" align="end">
              <BubbleContent className="whitespace-pre-wrap">{evento.texto}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case "texto_agente":
      return (
        <Message align="start">
          <MessageContent>
            <Bubble variant="muted">
              <BubbleContent>
                <Markdown>{evento.texto}</Markdown>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case "atividade":
      return (
        <Marker>
          <MarkerIcon>
            <WrenchIcon />
          </MarkerIcon>
          <MarkerContent className="text-muted-foreground text-xs">{evento.detalhe}</MarkerContent>
        </Marker>
      )
    case "card_entregavel": {
      const entregavel = dados.estado.entregaveis.find((e) => e.id === evento.entregavelId)
      return entregavel ? <CardEntregavel slug={slug} entregavel={entregavel} /> : null
    }
    case "card_insumo": {
      const insumo = dados.catalogo.insumos.find((i) => i.id === evento.insumoId)
      const ref = dados.catalogo.etapas.find((e) => e.id === etapa)?.insumos.find((r) => r.id === evento.insumoId)
      if (!insumo || !ref) return null
      return (
        <div className="max-w-xl">
          <CardInsumo
            slug={slug}
            etapa={etapa}
            insumo={insumo}
            obrigatorio={ref.obrigatorio}
            estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === insumo.id) ?? null}
            temModelo={dados.modelosDisponiveis.includes(insumo.id)}
          />
        </div>
      )
    }
    case "aviso":
      return (
        <Alert variant={evento.nivel === "erro" ? "destructive" : "default"}>
          <InfoIcon />
          <AlertDescription>{evento.texto}</AlertDescription>
        </Alert>
      )
    case "turno_fim":
      if (evento.status === "ok") return null
      return (
        <Alert variant="destructive">
          <AlertTitle>{evento.status === "interrompido" ? "Resposta interrompida" : "O agente encontrou um erro"}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {evento.detalhe && <span>{evento.detalhe}</span>}
            <Button size="sm" variant="outline" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )
  }
}
