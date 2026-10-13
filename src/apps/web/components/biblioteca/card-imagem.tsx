"use client"

import { ImageOffIcon, LayersIcon } from "lucide-react"
import { useState } from "react"
import type { ItemBiblioteca } from "@workspace/core/biblioteca"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { urlArquivo } from "@/lib/api"
import { ROTULO_ORIGEM } from "@/lib/biblioteca"

export function CardImagem({ slug, item, aoAbrir }: { slug: string; item: ItemBiblioteca; aoAbrir: () => void }) {
  const [quebrada, setQuebrada] = useState(false)
  return (
    <button
      type="button"
      onClick={aoAbrir}
      title={item.caminho}
      className="bg-card hover:border-primary/50 focus-visible:ring-ring/50 flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="bg-muted relative flex aspect-[4/3] items-center justify-center overflow-hidden">
        {quebrada ? (
          <ImageOffIcon className="text-muted-foreground size-8" aria-label="Imagem não encontrada" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
          <img
            src={urlArquivo(slug, item.capa)}
            alt={item.titulo}
            loading="lazy"
            decoding="async"
            onError={() => setQuebrada(true)}
            className="h-full w-full object-contain"
          />
        )}
        {item.imagens.length > 1 && (
          <Badge variant="secondary" className="absolute right-2 bottom-2 tabular-nums">
            <LayersIcon /> {item.imagens.length}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.titulo}</span>
          <Badge variant={item.origem === "aprovado" ? "default" : "outline"} className={cn(item.origem === "substituido" && "opacity-60")}>
            {ROTULO_ORIGEM[item.origem]}
          </Badge>
        </div>
        <span className="text-muted-foreground truncate font-mono text-xs">{item.nomeArquivo}</span>
      </div>
    </button>
  )
}
