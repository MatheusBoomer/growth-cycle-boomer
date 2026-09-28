"use client"

import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ORDEM_ETAPAS, type EtapaId, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { ChatEtapa } from "@/components/chat/chat-etapa"
import { useAreaDeTrabalho } from "@/hooks/use-area-de-trabalho"
import { EtapaLiberada } from "./etapa-liberada"
import { ROTULO_STATUS } from "./icone-status"
import { PainelEtapa } from "./painel-etapa"
import { TrilhaEtapas } from "./trilha-etapas"

export function escolherEtapaInicial(estado: Estado): EtapaId {
  const prioridades: StatusEtapa[][] = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
  for (const grupo of prioridades) {
    const id = ORDEM_ETAPAS.find((i) => grupo.includes(estado.etapas[i].status))
    if (id) return id
  }
  return "final"
}

export function AreaDeTrabalho({ slug }: { slug: string }) {
  const { dados, erro, conversas, deltas, carregarConversa } = useAreaDeTrabalho(slug)
  const [selecionada, setSelecionada] = useState<EtapaId | null>(null)
  const [painelAberto, setPainelAberto] = useState(true)
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)

  useEffect(() => {
    if (etapa && dados && conversas[etapa] === undefined) void carregarConversa(etapa)
  }, [etapa, dados, conversas, carregarConversa])

  if (erro) {
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyTitle>Não consegui abrir este prospect</EmptyTitle>
          <EmptyDescription>{erro}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/" />} nativeButton={false}>
            Voltar para os prospects
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (!dados || !etapa) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!
  const estadoEtapa = dados.estado.etapas[etapa]
  const indice = ORDEM_ETAPAS.indexOf(etapa)
  const anterior = indice > 0 ? ORDEM_ETAPAS[indice - 1]! : null
  const mostrarChat = estadoEtapa.status !== "liberada" && estadoEtapa.status !== "bloqueada"

  return (
    <div className={cn("grid h-svh", painelAberto ? "grid-cols-[240px_minmax(0,1fr)_320px]" : "grid-cols-[240px_minmax(0,1fr)]")}>
      <TrilhaEtapas catalogo={dados.catalogo} estado={dados.estado} selecionada={etapa} aoSelecionar={setSelecionada} />
      <main className="flex min-h-0 flex-col border-x">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <h1 className="font-semibold">{etapaCat.rotuloStatus}</h1>
          <Badge variant="secondary">{ROTULO_STATUS[estadoEtapa.status]}</Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={painelAberto ? "Recolher painel" : "Mostrar painel"}
            onClick={() => setPainelAberto((v) => !v)}
          >
            {painelAberto ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
          </Button>
        </header>
        {mostrarChat ? (
          <ChatEtapa slug={slug} etapa={etapa} dados={dados} eventos={conversas[etapa] ?? []} delta={deltas[etapa] ?? ""} />
        ) : (
          <EtapaLiberada slug={slug} etapa={etapa} dados={dados} handoffAnterior={anterior ? dados.estado.etapas[anterior].handoff : null} />
        )}
      </main>
      {painelAberto && <PainelEtapa slug={slug} etapa={etapa} dados={dados} />}
    </div>
  )
}
