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
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-border bg-card text-left transition-[border-color,translate,box-shadow] duration-250 ease-[cubic-bezier(.2,.7,.1,1)] outline-none hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_18px_30px_-22px_rgb(235_97_10/0.55)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0", item.origem === "substituido" && "opacity-55")}
    >
      <div className="bg-papel relative flex aspect-[4/3] items-center justify-center overflow-hidden mx-1.5 mt-1.5 rounded-[13px]">
        {quebrada ? (
          <ImageOffIcon className="size-7 text-muted-foreground" aria-label="Imagem não encontrada" />
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
          <Badge variant="midia" className="absolute right-2 bottom-2 text-[11px] tabular-nums">
            <LayersIcon /> {item.imagens.length}
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.titulo}</span>
          <Badge variant={item.origem === "aprovado" ? "sucesso" : item.origem === "proposta" ? "aviso" : "outline"} className="shrink-0">
            {ROTULO_ORIGEM[item.origem]}
          </Badge>
        </div>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{item.nomeArquivo}</span>
      </div>
    </button>
  )
}
