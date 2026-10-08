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
import { CardPerguntas } from "@/components/cards/card-perguntas"
import { Markdown } from "@/components/markdown"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { partesComMencoes, semRodape } from "@/lib/mencoes"

/** Mensagem do analista com as menções "@arquivo" como etiquetas que abrem o arquivo. */
function TextoComMencoes({ texto }: { texto: string }) {
  const { abrirArquivo } = useVisualizador()
  return (
    <>
      {partesComMencoes(semRodape(texto)).map((p, i) =>
        p.tipo === "texto" ? (
          <span key={i}>{p.valor}</span>
        ) : (
          <button
            key={i}
            type="button"
            title={p.caminho}
            onClick={() => abrirArquivo(p.caminho)}
            className="bg-primary-foreground/15 hover:bg-primary-foreground/25 mx-0.5 inline rounded px-1 font-mono text-[0.85em] underline-offset-2 hover:underline"
          >
            @{p.caminho.split("/").pop()}
          </button>
        ),
      )}
    </>
  )
}

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
              <BubbleContent className="whitespace-pre-wrap">
                <TextoComMencoes texto={evento.texto} />
              </BubbleContent>
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
    case "card_perguntas": {
      const conjunto = dados.estado.perguntas.find((c) => c.id === evento.conjuntoId)
      if (!conjunto) return null
      const status = dados.estado.etapas[etapa].status
      const bloqueado =
        status === "concluida" || status === "desatualizada"
          ? "Etapa fechada para conversa. Use Reabrir ou Revisar no painel para responder."
          : null
      return <CardPerguntas slug={slug} conjunto={conjunto} bloqueado={bloqueado} />
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
