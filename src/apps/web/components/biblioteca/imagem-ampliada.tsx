"use client"

import { AtSignIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FolderOpenIcon, ImageOffIcon, PencilIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ORDEM_BIBLIOTECA, type AjusteBiblioteca, type EtapaBiblioteca, type ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { ROTULO_ORIGEM, rotuloEtapa } from "@/lib/biblioteca"

interface Props {
  slug: string
  catalogo: Catalogo
  itens: ItemBiblioteca[]
  indice: number | null
  aoMudarIndice: (indice: number | null) => void
  aoAjustar: (caminho: string, mudanca: AjusteBiblioteca) => void
  aoMencionar: (caminho: string) => void
}

export function ImagemAmpliada(props: Props) {
  const item = props.indice === null ? null : (props.itens[props.indice] ?? null)
  return (
    <Dialog open={item !== null} onOpenChange={(aberto) => !aberto && props.aoMudarIndice(null)}>
      <DialogContent className="h-[90vh] gap-0 p-0 sm:max-w-[min(1200px,95vw)]">
        {/* key: outro item zera a imagem do grupo e a edição do título. */}
        {item && props.indice !== null && <Conteudo key={item.id} {...props} item={item} indice={props.indice} />}
      </DialogContent>
    </Dialog>
  )
}

function Conteudo({ slug, catalogo, itens, indice, item, aoMudarIndice, aoAjustar, aoMencionar }: Props & { item: ItemBiblioteca; indice: number }) {
  const [sub, setSub] = useState(0)
  const [titulo, setTitulo] = useState<string | null>(null)
  const [quebrada, setQuebrada] = useState<string | null>(null)
  const atual = item.imagens[sub] ?? item.capa

  const temAnterior = sub > 0 || indice > 0
  const temProxima = sub < item.imagens.length - 1 || indice < itens.length - 1
  function ir(delta: 1 | -1) {
    const proxSub = sub + delta
    if (proxSub >= 0 && proxSub < item.imagens.length) return setSub(proxSub)
    const prox = indice + delta
    if (prox >= 0 && prox < itens.length) aoMudarIndice(prox)
  }

  // No document: o foco some quando o item troca (Conteudo remonta) e o teclado precisa continuar valendo.
  useEffect(() => {
    function aoTeclar(ev: globalThis.KeyboardEvent) {
      const alvo = ev.target as HTMLElement | null
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT")) return
      if (ev.key === "ArrowRight") {
        ev.preventDefault()
        ir(1)
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault()
        ir(-1)
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  })

  // Esc descarta e Enter já salvou: o blur que vem do desmonte do input não salva de novo.
  const encerrada = useRef(false)
  function salvarTitulo() {
    if (encerrada.current) {
      encerrada.current = false
      return
    }
    if (titulo !== null && titulo.trim() !== item.titulo) aoAjustar(item.caminho, { titulo: titulo.trim() })
    setTitulo(null)
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] md:grid-cols-[1fr_300px] md:grid-rows-1">
      <div className="bg-muted relative flex min-h-0 items-center justify-center overflow-hidden rounded-l-xl p-4">
        {quebrada === atual ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <ImageOffIcon className="size-8" aria-hidden /> Não consegui abrir esta imagem.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
          <img key={atual} src={urlArquivo(slug, atual)} alt={item.titulo} onError={() => setQuebrada(atual)} className="max-h-full max-w-full rounded-md bg-white object-contain" />
        )}
        <Button variant="secondary" size="icon" className="absolute top-1/2 left-3 -translate-y-1/2" aria-label="Anterior" disabled={!temAnterior} onClick={() => ir(-1)}>
          <ChevronLeftIcon />
        </Button>
        <Button variant="secondary" size="icon" className="absolute top-1/2 right-3 -translate-y-1/2" aria-label="Próxima" disabled={!temProxima} onClick={() => ir(1)}>
          <ChevronRightIcon />
        </Button>
        {item.imagens.length > 1 && (
          <Badge variant="secondary" className="absolute bottom-3 left-1/2 -translate-x-1/2 tabular-nums">
            {sub + 1} de {item.imagens.length}
          </Badge>
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t p-4 md:border-t-0 md:border-l">
        {titulo === null ? (
          <div className="flex items-start gap-1 pr-8">
            <DialogTitle className="min-w-0 flex-1 text-base break-words">{item.titulo}</DialogTitle>
            <Button variant="ghost" size="icon-sm" aria-label="Editar título" title="Editar título" onClick={() => {
                encerrada.current = false
                setTitulo(item.titulo)
              }}>
              <PencilIcon />
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-1 pr-8"
            onSubmit={(ev) => {
              ev.preventDefault()
              salvarTitulo()
              encerrada.current = true
            }}
          >
            <DialogTitle className="sr-only">{item.titulo}</DialogTitle>
            <Input
              autoFocus
              aria-label="Título"
              value={titulo}
              onChange={(ev) => setTitulo(ev.target.value)}
              onBlur={salvarTitulo}
              onKeyDown={(ev) => {
                if (ev.key === "Escape") {
                  ev.preventDefault()
                  ev.stopPropagation()
                  encerrada.current = true
                  setTitulo(null)
                }
              }}
            />
            <p className="text-muted-foreground text-xs">Enter salva. Vazio volta ao título automático.</p>
          </form>
        )}
        <DialogDescription className="sr-only">Imagem ampliada da biblioteca do prospect.</DialogDescription>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground text-xs font-medium">Etapa</span>
          <select
            value={item.etapa}
            onChange={(ev) => aoAjustar(item.caminho, { etapa: ev.target.value as EtapaBiblioteca })}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          >
            {ORDEM_BIBLIOTECA.map((e) => (
              <option key={e} value={e}>
                {rotuloEtapa(catalogo, e)}
              </option>
            ))}
          </select>
        </label>

        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Origem</dt>
            <dd>
              <Badge variant="outline">{ROTULO_ORIGEM[item.origem]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Arquivo</dt>
            <dd className="font-mono text-xs break-all">{atual}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={() => aoMencionar(atual)}>
            <AtSignIcon /> Mencionar no chat
          </Button>
          <Button variant="outline" render={<a href={urlArquivo(slug, atual, true)} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
          <Button variant="outline" onClick={() => void api.mostrarNoFinder(slug, atual).catch((e) => toast.error(mensagemDeErro(e)))}>
            <FolderOpenIcon /> Mostrar no Finder
          </Button>
        </div>
      </aside>
    </div>
  )
}
