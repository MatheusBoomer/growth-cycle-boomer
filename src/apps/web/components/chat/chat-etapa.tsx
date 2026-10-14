"use client"

import {
  BotIcon,
  FileTextIcon,
  GlobeIcon,
  MessageSquareTextIcon,
  PencilLineIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from "@workspace/ui/components/chain-of-thought"
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
import { agruparProcesso, iconeDoPasso, separarProcessoAoVivo, statusDosPassos, type EventoProcesso, type IconePasso } from "@/lib/passos"
import { Compositor } from "./compositor"
import { FimDaEtapa } from "./fim-da-etapa"
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

const ICONES: Record<IconePasso, LucideIcon> = {
  ler: FileTextIcon,
  escrever: PencilLineIcon,
  script: TerminalIcon,
  busca: SearchIcon,
  web: GlobeIcon,
  skill: SparklesIcon,
  subagente: BotIcon,
  fala: MessageSquareTextIcon,
  outro: WrenchIcon,
}

/**
 * Processo de um trecho do turno (passos + falas intermediárias). Ao vivo, abre expandido com o
 * último passo ativo. Recolhido, mostra o resumo e logo abaixo só a última linha (o que está sendo
 * feito agora, ou o último passo); expandir mostra todos.
 */
function ListaDeProcesso({ itens, slug, resumo, aoVivo = false }: { itens: EventoProcesso[]; slug: string; resumo: string; aoVivo?: boolean }) {
  const [aberto, setAberto] = useState(aoVivo)
  const status = statusDosPassos(itens.length, aoVivo)
  // Compacto: a linha recolhida mostra até uma fala como uma linha só.
  const passo = (e: EventoProcesso, i: number, compacto = false) => (
    <ChainOfThoughtStep
      key={`${e.em}-${i}`}
      icon={ICONES[iconeDoPasso(e)]}
      status={status[i]}
      label={
        e.tipo === "atividade" || compacto ? (
          <span className="block truncate" title={e.tipo === "atividade" ? e.detalhe : undefined}>
            {linhaDoProcesso(e, slug)}
          </span>
        ) : (
          <div className="text-foreground/80 text-sm">
            <Markdown>{e.texto}</Markdown>
          </div>
        )
      }
    />
  )
  const ultimo = itens.length - 1
  return (
    <ChainOfThought open={aberto} onOpenChange={setAberto}>
      <ChainOfThoughtHeader icon={WrenchIcon}>{resumo}</ChainOfThoughtHeader>
      {!aberto && ultimo >= 0 && (
        <button
          type="button"
          className="mt-2 block w-full cursor-pointer pl-0.5 text-left [&_[data-slot=chain-of-thought-step]>div:last-child]:pb-0"
          aria-label="Mostrar todos os passos"
          onClick={() => setAberto(true)}
        >
          {passo(itens[ultimo]!, ultimo, true)}
        </button>
      )}
      <ChainOfThoughtContent className="pl-0.5">{itens.map((e, i) => passo(e, i))}</ChainOfThoughtContent>
    </ChainOfThought>
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

  const indiceUltimaResposta = itens.reduce(
    (ultimo, i, posicao) => (i.tipo === "evento" && i.evento.tipo === "texto_agente" ? posicao : ultimo),
    -1,
  )

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
              {itens.map((item, posicao) =>
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
                    <ItemConversa
                      evento={item.evento}
                      slug={slug}
                      etapa={etapa}
                      dados={dados}
                      aoTentarDeNovo={tentarDeNovo}
                      ultima={posicao === indiceUltimaResposta}
                    />
                  </MessageScrollerItem>
                ),
              )}
              {!ativoAqui && (
                <MessageScrollerItem messageId="fim-da-etapa">
                  <FimDaEtapa slug={slug} etapa={etapa} dados={dados} />
                </MessageScrollerItem>
              )}
              {ativoAqui && (
                <MessageScrollerItem messageId="ao-vivo">
                  <Message align="start">
                    <MessageContent>
                      {(delta || aoVivo.length === 0) && (
                        <Bubble variant="muted">
                          <BubbleContent>
                            {delta ? <Markdown>{delta}</Markdown> : <span className="shimmer block truncate">Pensando…</span>}
                          </BubbleContent>
                        </Bubble>
                      )}
                      {aoVivo.length > 0 && <ListaDeProcesso itens={aoVivo} slug={slug} resumo={resumoDoProcesso(aoVivo)} aoVivo />}
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
