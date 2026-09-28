"use client"

import { toast } from "sonner"
import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Marker, MarkerContent } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro } from "@/lib/api"
import { Compositor } from "./compositor"
import { ItemConversa } from "./item-conversa"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

export function ChatEtapa({ slug, etapa, dados, eventos, delta }: PropsChatEtapa) {
  const estadoEtapa = dados.estado.etapas[etapa]
  const ativoAqui = dados.turnoAtivo === etapa
  const ativoOutra = dados.turnoAtivo !== null && !ativoAqui
  const somenteLeitura = estadoEtapa.status === "concluida" || estadoEtapa.status === "desatualizada"
  const motivo = somenteLeitura
    ? estadoEtapa.status === "concluida"
      ? "Etapa concluída. Para mudar algo, use Reabrir etapa no painel."
      : "Etapa desatualizada. Use Revisar no painel para voltar a conversar."
    : ativoOutra
      ? "O agente está respondendo em outra etapa deste prospect."
      : null

  const tentarDeNovo = () =>
    api.enviarMensagem(slug, etapa, "Continue de onde parou.").catch((e) => toast.error(mensagemDeErro(e)))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
              {estadoEtapa.origem === "terminal" && eventos.length === 0 && (
                <MessageScrollerItem messageId="terminal">
                  <Marker variant="separator">
                    <MarkerContent>Conversa feita no terminal. Os entregáveis aprovados estão no painel ao lado.</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}
              {eventos.map((evento, i) => (
                <MessageScrollerItem
                  key={`${evento.em}-${i}`}
                  messageId={`evento-${i}`}
                  scrollAnchor={evento.tipo === "mensagem_analista" && !evento.automatica}
                >
                  <ItemConversa evento={evento} slug={slug} etapa={etapa} dados={dados} aoTentarDeNovo={tentarDeNovo} />
                </MessageScrollerItem>
              ))}
              {ativoAqui && (
                <MessageScrollerItem messageId="ao-vivo">
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent>{delta ? <Markdown>{delta}</Markdown> : <span className="shimmer">Pensando…</span>}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <Compositor slug={slug} etapa={etapa} desabilitado={somenteLeitura || ativoOutra || ativoAqui} motivo={motivo} ativoAqui={ativoAqui} />
    </div>
  )
}
