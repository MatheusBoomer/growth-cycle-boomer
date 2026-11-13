"use client"

import { useTheme } from "next-themes"
import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { comCoresDoTema, misturar, variaveisMermaid, type CoresFluxo } from "@/lib/tema-mermaid"

let renderizacoes = 0

/** Lê as cores do tema aberto (tokens em hex; o que não for hex cai no valor do tema escuro). */
function coresDoTema(): CoresFluxo {
  const estilo = getComputedStyle(document.documentElement)
  const ler = (nome: string, padrao: string) => {
    const v = estilo.getPropertyValue(nome).trim()
    return /^#[0-9a-f]{6}$/i.test(v) ? v : padrao
  }
  const fundo = ler("--popover", "#141416")
  const texto = ler("--foreground", "#f4f4f5")
  return {
    fundo,
    texto,
    borda: misturar(texto, fundo, 0.18),
    textoApagado: ler("--muted-foreground", "#8b8b93"),
    acento: ler("--primary", "#eb610a"),
    azul: ler("--chart-2", "#5b9df0"),
    verde: ler("--chart-3", "#2fbf8c"),
  }
}

/** Degraus do zoom, em % do tamanho original do desenho. */
export const NIVEIS_ZOOM = [25, 50, 75, 100, 125, 150, 200, 300, 400]

/** Próximo degrau acima (+1) ou abaixo (-1) do zoom atual; nas pontas, fica onde está. */
export function proximoZoom(atual: number, sentido: 1 | -1): number {
  if (sentido === 1) return NIVEIS_ZOOM.find((n) => n > atual) ?? atual
  return [...NIVEIS_ZOOM].reverse().find((n) => n < atual) ?? atual
}

/** Largura natural do desenho (em px), lida do viewBox do SVG gerado pelo Mermaid. */
export function larguraNatural(svg: string): number | null {
  const caixa = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+[\d.]+\s*"/.exec(svg)
  const largura = caixa ? Number(caixa[1]) : NaN
  return Number.isFinite(largura) && largura > 0 ? largura : null
}

/**
 * Desenha um fluxograma Mermaid. A biblioteca só é carregada no navegador (import dinâmico no efeito), com
 * `securityLevel: "strict"`, e acompanha o tema claro/escuro do app. Erro de sintaxe vira um aviso e o resto da tela segue.
 * Clicar no desenho abre uma janela grande com o mesmo fluxograma, para ler com calma.
 */
export function Fluxograma({ codigo }: { codigo: string }) {
  const { resolvedTheme } = useTheme()
  const idBase = `fluxo-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`
  const [svg, setSvg] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const [ampliado, setAmpliado] = useState(false)
  const [zoom, setZoom] = useState(100)
  const area = useRef<HTMLDivElement>(null)
  const natural = svg === null ? null : larguraNatural(svg)

  /** Zoom que faz o desenho caber na largura da janela. */
  function ajustar() {
    const larguraArea = area.current?.clientWidth
    if (!larguraArea || !natural) return setZoom(100)
    setZoom(Math.min(400, Math.max(10, Math.floor((larguraArea / natural) * 100))))
  }

  // Abre já ajustado à janela: a partir daí o analista escolhe o zoom.
  useEffect(() => {
    if (!ampliado) return
    const quadro = requestAnimationFrame(ajustar)
    return () => cancelAnimationFrame(quadro)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [ampliado])

  useEffect(() => {
    // Sem tema resolvido ainda (primeiro render no navegador): espera, para não desenhar no tema errado.
    if (resolvedTheme === undefined) return
    let cancelado = false
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid")
        const cores = coresDoTema()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          // Tema "base" com as cores do app (o "default"/"dark" do Mermaid destoa); as classes do catálogo também.
          theme: "base",
          themeVariables: variaveisMermaid(cores),
          flowchart: { curve: "basis", padding: 14 },
        })
        renderizacoes += 1
        const { svg: desenho } = await mermaid.render(`${idBase}-${renderizacoes}`, comCoresDoTema(codigo, cores))
        if (cancelado) return
        setSvg(desenho)
        setErro(false)
      } catch {
        if (cancelado) return
        setSvg(null)
        setErro(true)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [codigo, resolvedTheme, idBase])

  if (erro) return <p className="text-muted-foreground text-sm">Não foi possível desenhar o fluxograma.</p>
  if (svg === null) return <Skeleton className="h-64 w-full" />
  return (
    <>
      <button
        type="button"
        aria-label="Ampliar fluxograma"
        title="Clique para ampliar"
        onClick={() => setAmpliado(true)}
        className="flex w-full cursor-zoom-in justify-center overflow-x-auto rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span role="img" aria-label="Fluxograma" className="block" dangerouslySetInnerHTML={{ __html: svg }} />
      </button>
      <p className="text-muted-foreground text-xs">Clique no fluxograma para ampliar.</p>
      <Dialog open={ampliado} onOpenChange={setAmpliado}>
        <DialogContent className="max-h-[92vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-[min(96vw,1500px)]">
          <DialogTitle className="sr-only">Fluxograma ampliado</DialogTitle>
          <DialogDescription className="sr-only">Versão ampliada do fluxograma. Use os botões para aproximar, afastar ou escolher o zoom.</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pr-10" role="toolbar" aria-label="Zoom do fluxograma">
            <Button type="button" variant="outline" size="icon" aria-label="Diminuir zoom" onClick={() => setZoom((z) => proximoZoom(z, -1))} disabled={zoom <= NIVEIS_ZOOM[0]!}>
              <ZoomOutIcon />
            </Button>
            <select
              aria-label="Porcentagem de zoom"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm tabular-nums focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {(NIVEIS_ZOOM.includes(zoom) ? NIVEIS_ZOOM : [...NIVEIS_ZOOM, zoom].sort((x, y) => x - y)).map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="icon" aria-label="Aumentar zoom" onClick={() => setZoom((z) => proximoZoom(z, 1))} disabled={zoom >= NIVEIS_ZOOM[NIVEIS_ZOOM.length - 1]!}>
              <ZoomInIcon />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setZoom(100)}>
              100%
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={ajustar}>
              <MaximizeIcon /> Ajustar à janela
            </Button>
          </div>
          <div ref={area} className="min-h-0 overflow-auto rounded-lg border">
            <div
              role="img"
              aria-label="Fluxograma ampliado"
              className="mx-auto [&_svg]:h-auto [&_svg]:max-w-none! [&_svg]:w-full!"
              style={natural ? { width: `${(natural * zoom) / 100}px` } : undefined}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
