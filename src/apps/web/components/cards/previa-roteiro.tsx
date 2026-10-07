"use client"

import { useEffect, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { urlArquivo } from "@/lib/api"
import { resumoDoSlide, type SlideRoteiro } from "@/lib/roteiro"

/** Roteiro da apresentação, um bloco por slide: tipo, título, miniaturas e conclusões. */
export function PreviaRoteiro({ slug, caminho }: { slug: string; caminho: string }) {
  const url = urlArquivo(slug, caminho)
  const [carregado, setCarregado] = useState<{ url: string; slides: SlideRoteiro[] | null } | null>(null)
  const { abrirArquivo } = useVisualizador()
  const slides = carregado?.url === url ? carregado.slides : undefined

  useEffect(() => {
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { slides?: SlideRoteiro[] } | null) => ativo && setCarregado({ url, slides: Array.isArray(j?.slides) ? j.slides : null }))
      .catch(() => ativo && setCarregado({ url, slides: null }))
    return () => {
      ativo = false
    }
  }, [url])

  if (slides === undefined) return <Skeleton className="h-40 w-full" />
  if (slides === null) return <p className="text-destructive text-sm">Não consegui ler o roteiro.</p>
  return (
    <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
      {slides.map((s, i) => {
        const r = resumoDoSlide(s)
        return (
          <li key={i} className={`rounded-md border p-2 text-sm ${s.pendencia ? "border-amber-500/60 bg-amber-500/5" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">{i + 1}</span>
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                {s.tipo}
              </Badge>
              <span className="truncate font-medium">{r.titulo}</span>
            </div>
            {s.pendencia ? (
              <p className="mt-1 ml-8 text-xs text-amber-600">Pendência: {s.pendencia}</p>
            ) : (
              <div className="mt-1 ml-8 flex gap-2">
                {r.imagens.map((img) => (
                  <button key={img} type="button" onClick={() => abrirArquivo(img)} className="shrink-0" title={img}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                    <img src={urlArquivo(slug, img)} alt="" className="h-14 w-auto rounded border bg-white" />
                  </button>
                ))}
                {r.linhas.length > 0 && (
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                    {r.linhas.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {typeof s.fonte === "string" && <p className="text-muted-foreground mt-1 ml-8 font-mono text-[10px]">fonte: {s.fonte}</p>}
          </li>
        )
      })}
    </ol>
  )
}
