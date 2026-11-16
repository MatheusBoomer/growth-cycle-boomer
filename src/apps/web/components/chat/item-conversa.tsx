"use client"

import { InfoIcon, WrenchIcon } from "lucide-react"
import { versaoAnterior } from "@workspace/core/entregaveis"
import type { EtapaId, EventoConversa, ReferenciaAjuste, RespostaEstado } from "@workspace/core/tipos"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { AttachmentGroup } from "@workspace/ui/components/attachment"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { CardEntregavel } from "@/components/cards/card-entregavel"
import { CardInsumo } from "@/components/cards/card-insumo"
import { CardValidacaoCliente } from "@/components/cards/card-validacao-cliente"
import { HistoricoPerguntas } from "@/components/cards/historico-perguntas"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { faixaDeMarcacoes } from "@/lib/anotacoes"
import { caminhoNoProspect, extrairAnexos, nomeDoAnexo, partesComMencoes, semRodape } from "@/lib/mencoes"
import { EtiquetaAnexo, iconeDoTipo } from "./etiqueta-anexo"
import { RespostaAgente } from "./resposta-agente"

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
            className="bg-foreground/8 hover:bg-foreground/15 mx-0.5 inline rounded px-1 font-mono text-[0.85em] underline-offset-2 hover:underline"
          >
            @{p.caminho.split("/").pop()}
          </button>
        ),
      )}
    </>
  )
}

/** Anexos enviados junto com a mensagem; clicar abre o arquivo na lateral. */
function AnexosDaMensagem({ texto, slug }: { texto: string; slug: string }) {
  const { abrirArquivo } = useVisualizador()
  const anexos = extrairAnexos(texto)
  if (anexos.length === 0) return null
  return (
    <AttachmentGroup className="justify-end">
      {anexos.map((c) => (
        <EtiquetaAnexo key={c} nome={nomeDoAnexo(c)} aoAbrir={() => abrirArquivo(caminhoNoProspect(c, slug))} />
      ))}
    </AttachmentGroup>
  )
}

/** Entregáveis citados na mensagem (pedido de ajuste), com a faixa de marcações de cada um. */
function ReferenciasDaMensagem({ referencias, dados }: { referencias: ReferenciaAjuste[]; dados: RespostaEstado }) {
  return (
    <AttachmentGroup className="justify-end">
      {referencias.map((r) => {
        const tipo = dados.estado.entregaveis.find((e) => e.id === r.entregavelId)?.tipo
        return (
          <EtiquetaAnexo
            key={r.entregavelId}
            nome={r.titulo}
            icone={tipo ? iconeDoTipo(tipo) : undefined}
            detalhe={faixaDeMarcacoes(r.primeiraMarcacao, r.marcacoes) || "ajuste pedido"}
          />
        )
      })}
    </AttachmentGroup>
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
  ultima = false,
}: {
  evento: EventoConversa
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  aoTentarDeNovo: () => void
  ultima?: boolean
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
            {semRodape(evento.texto).trim() && (
              <Bubble variant="tinted" align="end">
                <BubbleContent className="whitespace-pre-wrap">
                  <TextoComMencoes texto={evento.texto} />
                </BubbleContent>
              </Bubble>
            )}
            {evento.referencias && evento.referencias.length > 0 && <ReferenciasDaMensagem referencias={evento.referencias} dados={dados} />}
            <AnexosDaMensagem texto={evento.texto} slug={slug} />
          </MessageContent>
        </Message>
      )
    case "texto_agente":
      return <RespostaAgente texto={evento.texto} ultima={ultima} />
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
      return entregavel ? <CardEntregavel slug={slug} entregavel={entregavel} anterior={versaoAnterior(dados.estado.entregaveis, entregavel)} /> : null
    }
    case "card_insumo": {
      // O insumo pode ser de outra etapa (a 04 pede de volta o da 03): catálogo, estado e envio são da etapa dona.
      const etapaDona = evento.etapaInsumo ?? etapa
      const insumo = dados.catalogo.insumos.find((i) => i.id === evento.insumoId)
      const ref = dados.catalogo.etapas.find((e) => e.id === etapaDona)?.insumos.find((r) => r.id === evento.insumoId)
      if (!insumo || !ref) return null
      const statusDona = dados.estado.etapas[etapaDona].status
      return (
        <div className="max-w-xl">
          <CardInsumo
            slug={slug}
            etapa={etapaDona}
            insumo={insumo}
            obrigatorio={ref.obrigatorio}
            estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapaDona && i.insumoId === insumo.id) ?? null}
            temModelo={dados.modelosDisponiveis.includes(insumo.id)}
            removivel={etapaDona === etapa || (statusDona !== "concluida" && statusDona !== "desatualizada")}
          />
        </div>
      )
    }
    case "card_validacao_cliente":
      // A confirmação é uma ação da etapa 04, que é onde este card aparece.
      return dados.estado.validacaoCliente ? (
        <CardValidacaoCliente slug={slug} etapa="04" validacao={dados.estado.validacaoCliente} defasado={dados.validacaoDefasada} />
      ) : null
    case "card_perguntas": {
      const conjunto = dados.estado.perguntas.find((c) => c.id === evento.conjuntoId)
      if (!conjunto) return null
      return <HistoricoPerguntas conjunto={conjunto} />
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
