"use client"

import { ChevronRightIcon, WrenchIcon } from "lucide-react"
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
import { agruparPassos, separarPassosAoVivo, type Passo } from "@/lib/passos"
import { Compositor } from "./compositor"
import { ItemConversa } from "./item-conversa"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

/** Detalhe do passo sem o prefixo da pasta do prospect, para caber numa linha. */
function textoDoPasso(passo: Passo, slug: string): string {
  return passo.detalhe.replaceAll(`clientes/${slug}/`, "")
}

/** Histórico de passos de um trecho do turno: uma linha recolhida que expande a lista. */
function ListaDePassos({ passos, slug, resumo }: { passos: Passo[]; slug: string; resumo: string }) {
  return (
    <details className="group text-muted-foreground text-xs">
      <summary className="hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 select-none">
        <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
        <WrenchIcon className="size-3.5" />
        {resumo}
      </summary>
      <ol className="mt-2 ml-5 space-y-1 border-l pl-3">
        {passos.map((p, i) => (
          <li key={`${p.em}-${i}`} className="truncate" title={p.detalhe}>
            {textoDoPasso(p, slug)}
          </li>
        ))}
      </ol>
    </details>
  )
}

const executados = (n: number) => (n === 1 ? "1 passo executado" : `${n} passos executados`)

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

  const { itens, aoVivo } = separarPassosAoVivo(agruparPassos(eventos), ativoAqui)
  const passoAtual = aoVivo.at(-1)

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
                    <MarkerContent>Conversa feita no terminal. Os arquivos aprovados estão no painel ao lado, em “Aprovados fora da interface”.</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}
              {itens.map((item) =>
                item.tipo === "passos" ? (
                  <MessageScrollerItem key={`passos-${item.indice}`} messageId={`evento-${item.indice}`}>
                    <ListaDePassos passos={item.passos} slug={slug} resumo={executados(item.passos.length)} />
                  </MessageScrollerItem>
                ) : (
                  <MessageScrollerItem
                    key={`${item.evento.em}-${item.indice}`}
                    messageId={`evento-${item.indice}`}
                    scrollAnchor={item.evento.tipo === "mensagem_analista" && !item.evento.automatica}
                  >
                    <ItemConversa evento={item.evento} slug={slug} etapa={etapa} dados={dados} aoTentarDeNovo={tentarDeNovo} />
                  </MessageScrollerItem>
                ),
              )}
              {ativoAqui && (
                <MessageScrollerItem messageId="ao-vivo">
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent>
                          {delta ? (
                            <Markdown>{delta}</Markdown>
                          ) : (
                            <span className="shimmer block truncate" title={passoAtual?.detalhe}>
                              {passoAtual ? `${textoDoPasso(passoAtual, slug)}…` : "Pensando…"}
                            </span>
                          )}
                        </BubbleContent>
                      </Bubble>
                      {aoVivo.length > 0 && <ListaDePassos passos={aoVivo} slug={slug} resumo={`Ver passos (${aoVivo.length})`} />}
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
