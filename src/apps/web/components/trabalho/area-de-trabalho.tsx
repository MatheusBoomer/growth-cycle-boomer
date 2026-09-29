"use client"

import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState, type PointerEvent as EventoPonteiro } from "react"
import { entregavelVisivel, htmlParaAbrir } from "@workspace/core/entregaveis"
import { ORDEM_ETAPAS, type Entregavel, type EtapaId, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  usePanelRef,
} from "@workspace/ui/components/resizable"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { ChatEtapa } from "@/components/chat/chat-etapa"
import { useAreaDeTrabalho } from "@/hooks/use-area-de-trabalho"
import { ContextoVisualizador } from "./contexto-visualizador"
import { EtapaLiberada } from "./etapa-liberada"
import { ROTULO_STATUS } from "./icone-status"
import { PainelEtapa } from "./painel-etapa"
import { TrilhaEtapas } from "./trilha-etapas"
import { VisualizadorHtml } from "./visualizador-html"

export function escolherEtapaInicial(estado: Estado): EtapaId {
  const prioridades: StatusEtapa[][] = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
  for (const grupo of prioridades) {
    const id = ORDEM_ETAPAS.find((i) => grupo.includes(estado.etapas[i].status))
    if (id) return id
  }
  return "final"
}

// Larguras das colunas lembradas no navegador. No servidor (render inicial do Next) não há
// localStorage, e em janela anônima ele pode recusar: nos dois casos, vale o layout padrão.
const armazenamentoLayout = {
  getItem(chave: string): string | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(chave)
    } catch {
      return null
    }
  },
  setItem(chave: string, valor: string): void {
    try {
      window.localStorage.setItem(chave, valor)
    } catch {
      // sem armazenamento: o layout só não fica lembrado
    }
  },
}

export function AreaDeTrabalho({ slug }: { slug: string }) {
  const { dados, erro, conversas, deltas, carregarConversa } = useAreaDeTrabalho(slug)
  const [selecionada, setSelecionada] = useState<EtapaId | null>(null)
  const [trilhaRecolhida, setTrilhaRecolhida] = useState(false)
  const [painelRecolhido, setPainelRecolhido] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [visualizador, setVisualizador] = useState<{ etapa: EtapaId; nomeFinal: string } | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  const [entregaveisVistos, setEntregaveisVistos] = useState<Entregavel[] | null>(null)
  const [abertosSozinhos, setAbertosSozinhos] = useState<ReadonlySet<string>>(new Set())
  const trilhaRef = usePanelRef()
  const painelRef = usePanelRef()
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)
  const visualizadorAberto = visualizador !== null && visualizador.etapa === etapa
  // Um layout salvo por combinação de colunas: abrir um relatório não mexe nas larguras do dia a dia.
  const idsPaineis = visualizadorAberto ? ["trilha", "chat", "visualizador", "painel"] : ["trilha", "chat", "painel"]
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "area-de-trabalho",
    panelIds: idsPaineis,
    storage: armazenamentoLayout,
  })

  // HTML novo proposto na etapa aberta abre o visualizador sozinho, uma vez por nome final.
  // Estado ajustado durante a renderização: é o padrão do React para reagir a dado novo sem efeito.
  if (dados && etapa && dados.estado.entregaveis !== entregaveisVistos) {
    setEntregaveisVistos(dados.estado.entregaveis)
    const nome = htmlParaAbrir(entregaveisVistos, dados.estado.entregaveis, etapa)
    if (nome && !abertosSozinhos.has(`${etapa}/${nome}`)) {
      setAbertosSozinhos(new Set(abertosSozinhos).add(`${etapa}/${nome}`))
      setVisualizador({ etapa, nomeFinal: nome })
    }
  }

  const abrir = useCallback((etapaAlvo: EtapaId, nomeFinal: string) => {
    setAbertosSozinhos((atual) => new Set(atual).add(`${etapaAlvo}/${nomeFinal}`))
    setVisualizador({ etapa: etapaAlvo, nomeFinal })
  }, [])
  const fechar = useCallback(() => {
    setTelaCheia(false)
    setVisualizador(null)
  }, [])
  const alternarTelaCheia = useCallback(() => setTelaCheia((v) => !v), [])

  useEffect(() => {
    if (etapa && dados && conversas[etapa] === undefined) void carregarConversa(etapa)
  }, [etapa, dados, conversas, carregarConversa])

  useEffect(() => {
    if (!arrastando) return
    const soltar = () => setArrastando(false)
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", soltar)
    return () => {
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    }
  }, [arrastando])

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
  const painelVisualizador = visualizadorAberto ? (
    <VisualizadorHtml
      slug={slug}
      entregavel={entregavelVisivel(dados.estado.entregaveis, etapa, visualizador.nomeFinal)}
      telaCheia={telaCheia}
      aoAlternarTelaCheia={alternarTelaCheia}
      aoFechar={fechar}
    />
  ) : null

  // O iframe do visualizador captura o mouse: durante o arraste de uma alça, ele deixa de receber eventos.
  function aoApertar(ev: EventoPonteiro<HTMLDivElement>) {
    if ((ev.target as Element).closest('[data-slot="resizable-handle"]')) setArrastando(true)
  }

  return (
    <ContextoVisualizador.Provider value={{ abrir }}>
      <div className={cn("h-svh", arrastando && "[&_iframe]:pointer-events-none")} onPointerDownCapture={aoApertar}>
        <ResizablePanelGroup
          key={idsPaineis.join(",")}
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePanel
            id="trilha"
            panelRef={trilhaRef}
            defaultSize="240px"
            minSize="180px"
            maxSize="30%"
            collapsible
            collapsedSize="0%"
            onResize={(tamanho) => setTrilhaRecolhida(tamanho.asPercentage === 0)}
          >
            <TrilhaEtapas catalogo={dados.catalogo} estado={dados.estado} selecionada={etapa} aoSelecionar={setSelecionada} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="chat" minSize="360px">
            <main className="flex h-full min-h-0 flex-col">
              <header className="flex items-center gap-3 border-b px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={trilhaRecolhida ? "Mostrar etapas" : "Recolher etapas"}
                  onClick={() => (trilhaRecolhida ? trilhaRef.current?.expand() : trilhaRef.current?.collapse())}
                >
                  {trilhaRecolhida ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                </Button>
                <h1 className="font-semibold">{etapaCat.rotuloStatus}</h1>
                <Badge variant="secondary">{ROTULO_STATUS[estadoEtapa.status]}</Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={painelRecolhido ? "Mostrar painel" : "Recolher painel"}
                  onClick={() => (painelRecolhido ? painelRef.current?.expand() : painelRef.current?.collapse())}
                >
                  {painelRecolhido ? <PanelRightOpenIcon /> : <PanelRightCloseIcon />}
                </Button>
              </header>
              {mostrarChat ? (
                <ChatEtapa slug={slug} etapa={etapa} dados={dados} eventos={conversas[etapa] ?? []} delta={deltas[etapa] ?? ""} />
              ) : (
                <EtapaLiberada slug={slug} etapa={etapa} dados={dados} handoffAnterior={anterior ? dados.estado.etapas[anterior].handoff : null} />
              )}
            </main>
          </ResizablePanel>
          {visualizadorAberto && (
            <>
              <ResizableHandle withHandle />
              {/* Em tela cheia o painel continua montado (vazio) para não trocar o layout salvo. */}
              <ResizablePanel id="visualizador" defaultSize="50%" minSize="320px">
                {telaCheia ? null : painelVisualizador}
              </ResizablePanel>
            </>
          )}
          <ResizableHandle withHandle />
          <ResizablePanel
            id="painel"
            panelRef={painelRef}
            defaultSize="320px"
            minSize="240px"
            maxSize="40%"
            collapsible
            collapsedSize="0%"
            onResize={(tamanho) => setPainelRecolhido(tamanho.asPercentage === 0)}
          >
            <PainelEtapa slug={slug} etapa={etapa} dados={dados} />
          </ResizablePanel>
        </ResizablePanelGroup>
        {visualizadorAberto && telaCheia && <div className="fixed inset-0 z-40">{painelVisualizador}</div>}
      </div>
    </ContextoVisualizador.Provider>
  )
}
