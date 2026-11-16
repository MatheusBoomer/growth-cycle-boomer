"use client"

import type { ReactNode } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import type {
  EtapaId,
  EventoConversa,
  RespostaEstado,
} from "@workspace/core/tipos"
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
import { useEmailDaConta } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro } from "@/lib/api"
import { entregaveisDaConversa } from "@/lib/entregaveis-da-conversa"
import {
  agruparProcesso,
  cardsDepoisDaResposta,
  separarProcessoAoVivo,
} from "@/lib/passos"
import { Compositor } from "./compositor"
import { FimDaEtapa } from "./fim-da-etapa"
import { ItemConversa } from "./item-conversa"
import { ThoughtLine } from "./thought-line"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
  /** Capa da etapa (título grande) no topo da conversa; rola junto com as mensagens. */
  capa?: ReactNode
}

export function ChatEtapa({
  slug,
  etapa,
  dados,
  eventos,
  delta,
  capa,
}: PropsChatEtapa) {
  const meuEmail = useEmailDaConta()
  const estadoEtapa = dados.estado.etapas[etapa]
  const ativoAqui = dados.turnoAtivo === etapa
  const ativoOutra = dados.turnoAtivo !== null && !ativoAqui
  // Outro analista com o turno nesta etapa. Sem login (modo off) turnoPor é sempre null e nada aparece.
  const turnoDeOutro =
    ativoAqui && dados.turnoPor !== null && dados.turnoPor !== meuEmail
      ? dados.turnoPor
      : null
  const somenteLeitura =
    estadoEtapa.status === "concluida" || estadoEtapa.status === "desatualizada"
  const motivo = somenteLeitura
    ? estadoEtapa.status === "concluida"
      ? "Etapa concluída. Para mudar algo, use Reabrir etapa no painel."
      : "Etapa desatualizada. Use Revisar no painel para voltar a conversar."
    : ativoOutra
      ? "O agente está respondendo em outra etapa deste prospect."
      : null

  const separado = separarProcessoAoVivo(
    agruparProcesso(eventos, ativoAqui),
    ativoAqui
  )
  const itens = cardsDepoisDaResposta(separado.itens)
  const aoVivo = separado.aoVivo

  const indiceUltimaResposta = itens.reduce(
    (ultimo, i, posicao) =>
      i.tipo === "evento" && i.evento.tipo === "texto_agente"
        ? posicao
        : ultimo,
    -1
  )

  const pendentes = entregaveisDaConversa(dados.estado.entregaveis, etapa)
    .filter((e) => e.status === "pendente")
    .map((e) => e.id)

  const tentarDeNovo = () =>
    api
      .enviarMensagem(slug, etapa, "Continue de onde parou.")
      .catch((e) => toast.error(mensagemDeErro(e)))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {turnoDeOutro && (
        <p
          role="status"
          className="mt-[46px] border-b bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
        >
          {`${nomeCurto(turnoDeOutro)} está com o agente rodando nesta etapa.`}
        </p>
      )}
      <MessageScrollerProvider autoScroll>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Desfoque nas bordas da rolagem (Progressive Blur): o texto some suave em vez de cortar seco. */}
          <div
            aria-hidden="true"
            data-slot="desfoque-chat"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-(--vidro-1) to-transparent"
          />
          <div
            aria-hidden="true"
            data-slot="desfoque-chat"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-linear-to-t from-(--vidro-2) to-transparent"
          />
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
                {capa}
                {estadoEtapa.origem === "terminal" && eventos.length === 0 && (
                  <MessageScrollerItem messageId="terminal">
                    <Marker variant="separator">
                      <MarkerContent>
                        Conversa feita no terminal. Os arquivos aprovados estão
                        no painel ao lado, em “Aprovados fora da interface”.
                      </MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                )}
                {itens.map((item, posicao) =>
                  item.tipo === "processo" ? (
                    <MessageScrollerItem
                      key={`passos-${item.indice}`}
                      messageId={`evento-${item.indice}`}
                    >
                      <ThoughtLine
                        itens={item.itens}
                        slug={slug}
                        aoVivo={false}
                      />
                    </MessageScrollerItem>
                  ) : (
                    <MessageScrollerItem
                      key={`${item.evento.em}-${item.indice}`}
                      messageId={`evento-${item.indice}`}
                      scrollAnchor={
                        item.evento.tipo === "mensagem_analista" &&
                        !item.evento.automatica
                      }
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
                  )
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
                          // Sem bolha, como a resposta final: o texto não "pula" quando o turno termina.
                          <div className="text-foreground/90 text-[15px] leading-relaxed">
                            {delta ? (
                              <Markdown className="text-[15px]">{delta}</Markdown>
                            ) : (
                              <span className="block shimmer truncate">
                                Pensando…
                              </span>
                            )}
                          </div>
                        )}
                        {aoVivo.length > 0 && (
                          <ThoughtLine itens={aoVivo} slug={slug} aoVivo />
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </div>
      </MessageScrollerProvider>
      <Compositor
        slug={slug}
        etapa={etapa}
        pendentes={pendentes}
        desabilitado={somenteLeitura || ativoOutra || ativoAqui}
        motivo={motivo}
        ativoAqui={ativoAqui}
        ensaio={dados.estado.teste?.ensaio === true}
        semTurno={dados.turnoAtivo === null}
      />
    </div>
  )
}
