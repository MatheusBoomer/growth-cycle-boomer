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
import { agruparProcesso, separarProcessoAoVivo, type EventoProcesso } from "@/lib/passos"
import { Compositor } from "./compositor"
import { ItemConversa } from "./item-conversa"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

/** Linha curta de um item do processo: passo sem o prefixo da pasta do prospect, ou a 1ª linha da fala. */
function linhaDoProcesso(e: EventoProcesso, slug: string): string {
  if (e.tipo === "atividade") return e.detalhe.replaceAll(`clientes/${slug}/`, "")
  return (e.texto.split("\n").find((l) => l.trim()) ?? "").replace(/[*_`#>]/g, "").trim()
}

/** Processo de um trecho do turno (passos + falas intermediárias): uma linha recolhida que expande. */
function ListaDeProcesso({ itens, slug, resumo }: { itens: EventoProcesso[]; slug: string; resumo: string }) {
  return (
    <details className="group text-muted-foreground text-xs">
      <summary className="hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 select-none">
        <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
        <WrenchIcon className="size-3.5" />
        {resumo}
      </summary>
      <ol className="mt-2 ml-5 space-y-1.5 border-l pl-3">
        {itens.map((e, i) =>
          e.tipo === "atividade" ? (
            <li key={`${e.em}-${i}`} className="truncate" title={e.detalhe}>
              {linhaDoProcesso(e, slug)}
            </li>
          ) : (
            <li key={`${e.em}-${i}`} className="text-foreground/80 text-sm">
              <Markdown>{e.texto}</Markdown>
            </li>
          ),
        )}
      </ol>
    </details>
  )
}

function resumoDoProcesso(itens: EventoProcesso[]): string {
  const passos = itens.filter((e) => e.tipo === "atividade").length
  if (passos === 0) return "Processo"
  return `Processo · ${passos === 1 ? "1 passo" : `${passos} passos`}`
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

  const { itens, aoVivo } = separarProcessoAoVivo(agruparProcesso(eventos, ativoAqui), ativoAqui)
  const atual = aoVivo.at(-1)

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
                item.tipo === "processo" ? (
                  <MessageScrollerItem key={`passos-${item.indice}`} messageId={`evento-${item.indice}`}>
                    <ListaDeProcesso itens={item.itens} slug={slug} resumo={resumoDoProcesso(item.itens)} />
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
                            <span className="shimmer block truncate">
                              {atual ? `${linhaDoProcesso(atual, slug)}…` : "Pensando…"}
                            </span>
                          )}
                        </BubbleContent>
                      </Bubble>
                      {aoVivo.length > 0 && <ListaDeProcesso itens={aoVivo} slug={slug} resumo={`Ver processo (${aoVivo.length})`} />}
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
