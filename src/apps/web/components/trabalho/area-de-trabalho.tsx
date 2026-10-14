"use client"

import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from "react"
import { toast } from "sonner"
import { entregavelVisivel, htmlParaAbrir } from "@workspace/core/entregaveis"
import { ORDEM_ETAPAS, type Entregavel, type EtapaId, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useGroupRef,
  usePanelRef,
} from "@workspace/ui/components/resizable"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { Biblioteca } from "@/components/biblioteca/biblioteca"
import { BarraTopo } from "@/components/marca/barra-topo"
import { ChatEtapa } from "@/components/chat/chat-etapa"
import { useAreaDeTrabalho } from "@/hooks/use-area-de-trabalho"
import { useBiblioteca } from "@/hooks/use-biblioteca"
import { totalVisivel } from "@/lib/biblioteca"
import { CHAVE_COLUNA_DIREITA, chaveColunas, layoutParaVisualizador, lerLayout, salvarLayout, type Layout } from "@/lib/layout-colunas"
import { ContextoVisualizador } from "./contexto-visualizador"
import { EtapaLiberada } from "./etapa-liberada"
import { ROTULO_STATUS } from "./icone-status"
import { PainelEtapa } from "./painel-etapa"
import { TrilhaEtapas } from "./trilha-etapas"
import { VisualizadorArquivo } from "./visualizador-arquivo"
import { VisualizadorApresentacao } from "./visualizador-apresentacao"
import { VisualizadorHtml } from "./visualizador-html"

export function escolherEtapaInicial(estado: Estado): EtapaId {
  const prioridades: StatusEtapa[][] = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
  for (const grupo of prioridades) {
    const id = ORDEM_ETAPAS.find((i) => grupo.includes(estado.etapas[i].status))
    if (id) return id
  }
  return "final"
}

const IDS_COLUNAS = ["chat", "painel", "trilha", "visualizador"]

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
  const grupoRef = useGroupRef()
  const trilhaRef = usePanelRef()
  const painelRef = usePanelRef()
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)
  const visualizadorAberto = visualizador !== null && visualizador.etapa === etapa
  const [arquivoAberto, setArquivoAberto] = useState<string | null>(null)
  const colunaDireitaRef = useGroupRef()
  const inserirNoCompositor = useRef<((texto: string) => void) | null>(null)
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false)
  // `dados` muda a cada evento de estado (aprovação, anexo, ajuste): a biblioteca recarrega junto.
  const biblioteca = useBiblioteca(slug, dados)
  const trilhaCaixaRef = useRef<HTMLDivElement>(null)
  const [larguraTrilha, setLarguraTrilha] = useState(0)
  const carregado = dados !== null

  // HTML ou apresentação nova proposta na etapa aberta abre o visualizador sozinho, uma vez por nome final.
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
  const abrirArquivo = useCallback(
    (caminho: string) => {
      if (painelRef.current?.isCollapsed()) painelRef.current.expand()
      setArquivoAberto(caminho)
    },
    [painelRef],
  )
  const fecharArquivo = useCallback(() => setArquivoAberto(null), [])
  const mencionar = useCallback((caminho: string) => inserirNoCompositor.current?.(`@${caminho} `), [])
  const inserirTexto = useCallback((texto: string) => inserirNoCompositor.current?.(texto), [])
  const registrarCompositor = useCallback((inserir: ((texto: string) => void) | null) => {
    inserirNoCompositor.current = inserir
  }, [])
  const selecionarEtapa = useCallback((id: EtapaId) => {
    setBibliotecaAberta(false)
    setSelecionada(id)
  }, [])
  const fecharBiblioteca = useCallback(() => setBibliotecaAberta(false), [])
  // Menciona no chat da etapa selecionada na trilha (não na etapa da imagem): o chat fica montado por baixo da biblioteca.
  const mencionarDaBiblioteca = useCallback((caminho: string) => {
    setBibliotecaAberta(false)
    if (!inserirNoCompositor.current) {
      toast.error("Abra uma etapa com chat para mencionar a imagem.")
      return
    }
    inserirNoCompositor.current(`@${caminho} `)
  }, [])

  // A biblioteca cobre tudo à direita da trilha; a largura da trilha muda quando o analista arrasta a alça.
  useEffect(() => {
    const el = trilhaCaixaRef.current
    if (!el) return
    const observador = new ResizeObserver(([entrada]) => setLarguraTrilha(entrada?.contentRect.width ?? 0))
    observador.observe(el)
    return () => observador.disconnect()
  }, [carregado])
  const controle = useMemo(
    () => ({ abrir, abrirArquivo, mencionar, inserirNoCompositor: inserirTexto, registrarCompositor }),
    [abrir, abrirArquivo, mencionar, inserirTexto, registrarCompositor],
  )

  // Arquivo aberto (janela embaixo do painel da etapa): mesmo princípio do visualizador de
  // relatório, painel sempre montado e altura lembrada no navegador.
  const temArquivo = arquivoAberto !== null
  useEffect(() => {
    const grupo = colunaDireitaRef.current
    if (!grupo) return
    try {
      const salvo = lerLayout(CHAVE_COLUNA_DIREITA)
      const aberto = salvo && (salvo.arquivo ?? 0) > 0 && (salvo.etapa ?? 0) > 0 ? salvo : { etapa: 45, arquivo: 55 }
      grupo.setLayout(temArquivo ? aberto : { etapa: 100, arquivo: 0 })
    } catch {
      // grupo ainda montando: vale o layout que ele tiver
    }
  }, [temArquivo, colunaDireitaRef])

  useEffect(() => {
    if (etapa && dados && conversas[etapa] === undefined) void carregarConversa(etapa)
  }, [etapa, dados, conversas, carregarConversa])

  // O visualizador fica sempre montado (recolhido quando fechado): abrir ou fechar não remonta o
  // chat nem os cards, então o que o analista está digitando não se perde. Cada estado (com e sem
  // relatório) tem suas larguras lembradas, aplicadas aqui pela API do grupo.
  useEffect(() => {
    const grupo = grupoRef.current
    if (!grupo) return
    try {
      grupo.setLayout(layoutParaVisualizador(grupo.getLayout(), lerLayout(chaveColunas(visualizadorAberto)), visualizadorAberto))
    } catch {
      // grupo ainda montando ou já desmontado: vale o layout que ele tiver
    }
  }, [visualizadorAberto, grupoRef])

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
  const salvoInicial = lerLayout(chaveColunas(false))
  const layoutInicial = salvoInicial && Object.keys(salvoInicial).sort().join() === IDS_COLUNAS.join() ? salvoInicial : undefined
  function aoMudarLayout(layout: Layout) {
    // Só grava quando o layout corresponde ao estado atual (não no meio de uma troca).
    if ((layout.visualizador ?? 0) > 0 === visualizadorAberto) salvarLayout(chaveColunas(visualizadorAberto), layout)
  }
  const aberto = visualizadorAberto ? entregavelVisivel(dados.estado.entregaveis, etapa, visualizador.nomeFinal) : null
  const Visualizador = aberto?.tipo === "apresentacao" ? VisualizadorApresentacao : VisualizadorHtml
  const painelVisualizador = visualizadorAberto ? (
    // key: versão nova remonta o visualizador, sem levar rascunho de comentário da anterior.
    <Visualizador key={aberto?.id ?? "nenhum"} slug={slug} entregavel={aberto} telaCheia={telaCheia} aoAlternarTelaCheia={alternarTelaCheia} aoFechar={fechar} />
  ) : null

  // O iframe do visualizador captura o mouse: durante o arraste de uma alça, ele deixa de receber eventos.
  function aoApertar(ev: EventoPonteiro<HTMLDivElement>) {
    if ((ev.target as Element).closest('[data-slot="resizable-handle"]')) setArrastando(true)
  }

  return (
    <ContextoVisualizador.Provider value={controle}>
      <div className="flex h-svh flex-col">
        <BarraTopo titulo="Planejamento estratégico" subtitulo={dados.estado.prospect.nome} />
        <div className={cn("relative min-h-0 flex-1 p-3", arrastando && "[&_iframe]:pointer-events-none")} onPointerDownCapture={aoApertar}>
          <ResizablePanelGroup groupRef={grupoRef} orientation="horizontal" defaultLayout={layoutInicial} onLayoutChanged={aoMudarLayout}>
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
              <div ref={trilhaCaixaRef} className="vidro h-full overflow-hidden rounded-2xl">
                <TrilhaEtapas
                  catalogo={dados.catalogo}
                  estado={dados.estado}
                  selecionada={etapa}
                  aoSelecionar={selecionarEtapa}
                  bibliotecaAberta={bibliotecaAberta}
                  totalBiblioteca={biblioteca.itens ? totalVisivel(biblioteca.itens) : null}
                  aoAbrirBiblioteca={() => {
                    setBibliotecaAberta(true)
                    void biblioteca.recarregar()
                  }}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="chat" minSize="360px">
              <main className="vidro flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
                <header className="flex items-center gap-3 border-b px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={trilhaRecolhida ? "Mostrar etapas" : "Recolher etapas"}
                    onClick={() => (trilhaRecolhida ? trilhaRef.current?.expand() : trilhaRef.current?.collapse())}
                  >
                    {trilhaRecolhida ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
                  </Button>
                  <h1 className="text-sm font-semibold tracking-tight">{etapaCat.rotuloStatus}</h1>
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
            <ResizableHandle withHandle className={cn(!visualizadorAberto && "hidden")} />
            <ResizablePanel
              id="visualizador"
              defaultSize="0%"
              minSize="320px"
              collapsible
              collapsedSize="0%"
              onResize={(tamanho) => {
                // Arrastar o visualizador até sumir é o mesmo que fechá-lo.
                if (tamanho.asPercentage === 0 && visualizadorAberto) fechar()
              }}
            >
              {/* Em tela cheia o conteúdo vai para a camada fixa abaixo; o painel fica vazio. */}
              {telaCheia ? null : <div className="vidro h-full overflow-hidden rounded-2xl">{painelVisualizador}</div>}
            </ResizablePanel>
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
              <ResizablePanelGroup
                groupRef={colunaDireitaRef}
                orientation="vertical"
                onLayoutChanged={(layout: Layout) => {
                  if (temArquivo && (layout.arquivo ?? 0) > 0) salvarLayout(CHAVE_COLUNA_DIREITA, layout)
                }}
              >
                <ResizablePanel id="etapa" minSize="120px">
                  <div className="vidro h-full overflow-hidden rounded-2xl">
                    <PainelEtapa slug={slug} etapa={etapa} dados={dados} />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle className={cn(!temArquivo && "hidden")} />
                <ResizablePanel
                  id="arquivo"
                  defaultSize="0%"
                  minSize="160px"
                  collapsible
                  collapsedSize="0%"
                  onResize={(tamanho) => {
                    // Arrastar a janela do arquivo até sumir é o mesmo que fechá-la.
                    if (tamanho.asPercentage === 0 && temArquivo) fecharArquivo()
                  }}
                >
                  {arquivoAberto && (
                    <div className="vidro h-full overflow-hidden rounded-2xl">
                      <VisualizadorArquivo
                        slug={slug}
                        caminho={arquivoAberto}
                        aoMencionar={() => mencionar(arquivoAberto)}
                        aoFechar={fecharArquivo}
                      />
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
          {bibliotecaAberta && (
            <div
              className="vidro bg-background/95 absolute inset-y-3 right-3 z-30 overflow-hidden rounded-2xl backdrop-blur-xl"
              // 12 px de borda externa + largura do card da trilha + 12 px da alça.
              style={{ left: larguraTrilha > 0 ? larguraTrilha + 24 : 12 }}
            >
              <Biblioteca
                slug={slug}
                catalogo={dados.catalogo}
                itens={biblioteca.itens}
                erro={biblioteca.erro}
                aoAjustar={(caminho, mudanca) => void biblioteca.ajustar(caminho, mudanca)}
                aoMencionar={mencionarDaBiblioteca}
                aoFechar={fecharBiblioteca}
              />
            </div>
          )}
          {visualizadorAberto && telaCheia && <div className="bg-background fixed inset-0 z-40">{painelVisualizador}</div>}
        </div>
      </div>
    </ContextoVisualizador.Provider>
  )
}
