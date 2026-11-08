"use client"

import { useTheme } from "next-themes"
import { useEffect, useId, useState } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

let renderizacoes = 0

/**
 * Desenha um fluxograma Mermaid. A biblioteca só é carregada no navegador (import dinâmico no efeito), com
 * `securityLevel: "strict"`, e acompanha o tema claro/escuro do app. Erro de sintaxe vira um aviso e o resto da tela segue.
 */
export function Fluxograma({ codigo }: { codigo: string }) {
  const { resolvedTheme } = useTheme()
  const idBase = `fluxo-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`
  const [svg, setSvg] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

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
  return <div role="img" aria-label="Fluxograma" className="flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}
