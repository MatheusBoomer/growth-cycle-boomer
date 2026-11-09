"use client"

import { useTheme } from "next-themes"
import { useEffect, useId, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"

let renderizacoes = 0

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

  useEffect(() => {
    // Sem tema resolvido ainda (primeiro render no navegador): espera, para não desenhar no tema errado.
    if (resolvedTheme === undefined) return
    let cancelado = false
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid")
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          theme: resolvedTheme === "light" ? "default" : "dark",
        })
        renderizacoes += 1
        const { svg: desenho } = await mermaid.render(`${idBase}-${renderizacoes}`, codigo)
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
        <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-[min(96vw,1500px)]">
          <DialogTitle className="sr-only">Fluxograma ampliado</DialogTitle>
          <DialogDescription className="sr-only">Versão ampliada do fluxograma. Role para ver o desenho inteiro.</DialogDescription>
          <div
            role="img"
            aria-label="Fluxograma ampliado"
            className="mx-auto w-full [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none! [&_svg]:w-full!"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
