"use client"

import { CheckIcon, DownloadIcon, ExternalLinkIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import type { Marca } from "@/lib/anotacoes"
import { MarcadorImagem } from "./marcador-imagem"
import { ZOOM_MAX, ZOOM_MIN, larguraAjustada, limitarZoom, proximoZoom } from "./zoom"

/** Marcação em andamento deste entregável (o card passa quando o analista clicou em "Pedir ajuste…"). */
export interface MarcacaoNoModal {
  marcas: Marca[]
  primeiroNumero: number
  aoMudar: (marcas: Marca[]) => void
  /** Encerra a marcação; as marcas continuam na referência do chat. */
  aoConcluir: () => void
}

/**
 * Gráfico ou tabela ampliado num modal, como o roteiro: imagem grande com zoom, abrir em nova aba e baixar. Com o
 * entregável pendente, Aprovar e Pedir ajuste também ficam aqui, com as mesmas regras do card. "Pedir ajuste…"
 * não fecha o modal: a imagem vira o marcador ali mesmo, e "Concluir marcação" fecha e leva o foco ao campo de
 * mensagem, onde o analista escreve o que mudar em cada número.
 */
export function ModalGrafico({
  aberto,
  aoMudarAberto,
  titulo,
  urlImagem,
  urlDownload,
  pendente,
  aprovarDesabilitado,
  motivoAprovarDesabilitado,
  ocupado,
  aoAprovar,
  aoPedirAjuste,
  marcacao = null,
  focoAoPedirAjuste,
}: {
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  titulo: string
  urlImagem: string
  urlDownload: string
  pendente: boolean
  aprovarDesabilitado: boolean
  motivoAprovarDesabilitado?: string
  ocupado: boolean
  /** Devolve `true` se aprovou; o modal só fecha nesse caso (com erro, o card já mostrou o aviso). */
  aoAprovar: () => Promise<boolean>
  aoPedirAjuste: () => void
  marcacao?: MarcacaoNoModal | null
  /**
   * Para onde o foco vai quando o modal fecha depois de "Pedir ajuste…": a prévia que abriu o modal é desmontada (dá
   * lugar ao marcador no card), então não há botão para devolver o foco e ele cairia no corpo da página. Sem isto
   * vale o comportamento padrão.
   */
  focoAoPedirAjuste?: () => HTMLElement | null
}) {
  const pediuAjuste = useRef(false)
  // 1 = imagem ajustada à área do modal; o zoom é relativo a esse tamanho.
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    if (aberto) pediuAjuste.current = false
  }, [aberto])
  // Fechar volta o zoom ao ajustado: a próxima abertura começa com a imagem inteira à vista.
  function mudarAberto(novo: boolean) {
    if (!novo) setZoom(1)
    aoMudarAberto(novo)
  }

  // + e − ampliam e reduzem, 0 volta ao tamanho ajustado (fora de campos de texto).
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || campoDeTexto(document.activeElement)) return
      if (ev.key === "+" || ev.key === "=") setZoom((z) => proximoZoom(z, 1))
      else if (ev.key === "-") setZoom((z) => proximoZoom(z, -1))
      else if (ev.key === "0") setZoom(1)
      else return
      ev.preventDefault()
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [aberto])

  async function aprovar() {
    if (await aoAprovar()) mudarAberto(false)
  }
  function pedirAjuste() {
    pediuAjuste.current = true
    aoPedirAjuste()
  }
  function concluirMarcacao() {
    marcacao?.aoConcluir()
    mudarAberto(false)
  }

  const marcando = pendente && marcacao !== null

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogContent
        finalFocus={() => (pediuAjuste.current ? (focoAoPedirAjuste?.() ?? true) : true)}
        className="h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1500px)]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b py-2 pr-12 pl-4">
          <DialogTitle className="mr-2 min-w-0 flex-1 truncate font-serif text-base font-normal italic">{titulo}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada do entregável.</DialogDescription>
          <ControleZoom zoom={zoom} aoMudar={setZoom} />
          <Button size="sm" variant="outline" render={<a href={urlImagem} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <ExternalLinkIcon /> Abrir em nova aba
          </Button>
          <Button size="sm" variant="outline" render={<a href={urlDownload} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
        </div>
        {marcando ? (
          <MarcadorImagem
            className="flex min-h-0 flex-col px-4 pt-3 pb-2"
            titulo={titulo}
            urlImagem={urlImagem}
            marcas={marcacao.marcas}
            primeiroNumero={marcacao.primeiroNumero}
            aoMudar={marcacao.aoMudar}
            envolverArea={(area) => (
              <Palco url={urlImagem} zoom={zoom} aoMudarZoom={setZoom} className="-mx-4 min-h-0 flex-1 rounded-none">
                {(largura) => <div style={{ width: largura ?? undefined }}>{area}</div>}
              </Palco>
            )}
            instrucao="Escolha a forma e marque na imagem. Ao concluir, escreva na mensagem do chat o que mudar em cada número (ex.: “1: eixo X em meses por extenso”)."
          />
        ) : (
          <Palco url={urlImagem} zoom={zoom} aoMudarZoom={setZoom}>
            {(largura) => (
              // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
              <img
                src={urlImagem}
                alt={titulo}
                style={{ width: largura ?? undefined }}
                className={cn("bg-papel block rounded-md border", largura === null ? "max-w-full" : "max-w-none")}
              />
            )}
          </Palco>
        )}
        {pendente && (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            {marcando ? (
              <>
                <Button onClick={concluirMarcacao}>
                  <CheckIcon /> Concluir marcação
                </Button>
                <span className="text-muted-foreground text-sm">Depois escreva no chat o que mudar em cada número e envie.</span>
              </>
            ) : (
              <>
                <Button
                  className="brilho-passa"
                  onClick={() => void aprovar()}
                  disabled={ocupado || aprovarDesabilitado}
                  title={aprovarDesabilitado ? motivoAprovarDesabilitado : undefined}
                >
                  {ocupado ? <Spinner /> : <CheckIcon />} Aprovar
                </Button>
                <Button variant="outline" onClick={pedirAjuste} disabled={ocupado}>
                  Pedir ajuste…
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Foco num campo onde + − 0 são texto. Não usa `alvoDeDigitacao` do layout: aquele trata qualquer coisa dentro de um
 * diálogo como digitação (para o Esc do visualizador não fechar por baixo do modal), e aqui o foco está sempre no modal.
 */
function campoDeTexto(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable
}

function ControleZoom({ zoom, aoMudar }: { zoom: number; aoMudar: (zoom: number) => void }) {
  return (
    <div className="flex items-center rounded-full border" role="group" aria-label="Zoom">
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label="Diminuir zoom"
        title="Diminuir zoom (−)"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => aoMudar(proximoZoom(zoom, -1))}
      >
        <ZoomOutIcon />
      </Button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground min-w-12 text-center text-xs tabular-nums"
        title="Ajustar à tela (0)"
        aria-label={`Zoom em ${Math.round(zoom * 100)}%. Ajustar à tela`}
        onClick={() => aoMudar(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label="Aumentar zoom"
        title="Aumentar zoom (+)"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => aoMudar(proximoZoom(zoom, 1))}
      >
        <ZoomInIcon />
      </Button>
    </div>
  )
}

/**
 * Área rolável onde a imagem fica: mede o espaço disponível e o tamanho real da imagem e entrega a largura em px
 * para o zoom atual. Maior que a área, a imagem rola; menor, fica centralizada. Pinça no trackpad (ou Ctrl + roda)
 * também muda o zoom.
 */
function Palco({
  url,
  zoom,
  aoMudarZoom,
  className,
  children,
}: {
  url: string
  zoom: number
  aoMudarZoom: (zoom: number) => void
  className?: string
  /** `largura` é null enquanto a imagem e a área não foram medidas: a imagem aparece no tamanho natural limitado à área. */
  children: (largura: number | null) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [caixa, setCaixa] = useState<{ w: number; h: number } | null>(null)
  const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null)
  // O ouvinte da roda é registrado uma vez; lê o zoom e o callback atuais por refs.
  const zoomRef = useRef(zoom)
  const mudarRef = useRef(aoMudarZoom)
  useEffect(() => {
    zoomRef.current = zoom
    mudarRef.current = aoMudarZoom
  })

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setCaixa({ w: entrada.contentRect.width, h: entrada.contentRect.height })
    })
    observador.observe(el)
    // Pinça do trackpad chega como roda com Ctrl; só um ouvinte não passivo consegue impedir o zoom da página.
    function aoRolar(ev: WheelEvent) {
      if (!ev.ctrlKey) return
      ev.preventDefault()
      mudarRef.current(limitarZoom(zoomRef.current * Math.exp(-ev.deltaY * 0.01)))
    }
    el.addEventListener("wheel", aoRolar, { passive: false })
    return () => {
      observador.disconnect()
      el.removeEventListener("wheel", aoRolar)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    const img = new Image()
    img.onload = () => ativo && setNatural({ url, w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => {
      ativo = false
    }
  }, [url])

  const medida = natural?.url === url ? natural : null
  const largura = caixa && medida ? larguraAjustada(caixa, medida) * zoom : null

  return (
    <div ref={ref} className={cn("bg-muted flex min-h-0 overflow-auto p-4", className)} data-testid="palco-zoom">
      {/* m-auto centraliza enquanto cabe e deixa rolar a partir da borda quando não cabe. */}
      <div className="m-auto shrink-0">{children(largura)}</div>
    </div>
  )
}
