"use client"

import { LockIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { semAberturaDeConclusao } from "@workspace/core/handoff"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { CardInsumo } from "@/components/cards/card-insumo"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro } from "@/lib/api"

export function EtapaLiberada({
  slug,
  etapa,
  dados,
  handoffAnterior,
}: {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  handoffAnterior: string | null
}) {
  const [iniciando, setIniciando] = useState(false)
  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!

  if (dados.estado.etapas[etapa].status === "bloqueada") {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>Etapa bloqueada</EmptyTitle>
          <EmptyDescription>Conclua a etapa anterior para liberar esta.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  async function iniciar() {
    setIniciando(true)
    try {
      await api.acaoEtapa(slug, etapa, "iniciar")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setIniciando(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div>
          <p className="text-muted-foreground text-sm">{etapaCat.numero ? `Etapa ${etapaCat.numero}` : "Etapa final"}</p>
          <h2 className="text-2xl font-semibold">{etapaCat.titulo}</h2>
          <p className="text-muted-foreground mt-2">{etapaCat.descricao}</p>
        </div>
        {handoffAnterior && (
          <Card>
            <CardHeader>
              <CardTitle>O que preparar</CardTitle>
              <CardDescription>Pedido deixado pela etapa anterior</CardDescription>
            </CardHeader>
            <CardContent>
              <Markdown>{semAberturaDeConclusao(handoffAnterior)}</Markdown>
            </CardContent>
          </Card>
        )}
        {etapaCat.insumos.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Arquivos desta etapa</h3>
            <p className="text-muted-foreground text-sm">Pode enviar agora ou quando o agente pedir.</p>
            {etapaCat.insumos.map((ref) => (
              <CardInsumo
                key={ref.id}
                slug={slug}
                etapa={etapa}
                insumo={dados.catalogo.insumos.find((i) => i.id === ref.id)!}
                obrigatorio={ref.obrigatorio}
                estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === ref.id) ?? null}
                temModelo={dados.modelosDisponiveis.includes(ref.id)}
              />
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-sm">O agente começa já com o dossiê das etapas anteriores (decisões e entregáveis aprovados).</p>
        <div className="flex items-center gap-3">
          <Button size="lg" onClick={iniciar} disabled={iniciando || dados.turnoAtivo !== null}>
            {iniciando && <Spinner />} Iniciar etapa
          </Button>
          {dados.turnoAtivo !== null && <span className="text-muted-foreground text-sm">O agente está respondendo em outra etapa…</span>}
        </div>
      </div>
    </div>
  )
}
