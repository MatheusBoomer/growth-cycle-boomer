"use client"

import { DownloadIcon, FileCode2Icon, FileSpreadsheetIcon, FileTextIcon, PanelRightOpenIcon, PresentationIcon, ZoomInIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Markdown } from "@/components/markdown"
import { urlArquivo } from "@/lib/api"
import { PreviaRoteiro } from "./previa-roteiro"

export function PreviaArquivo({
  slug,
  tipo,
  caminho,
  titulo,
  aoAbrir,
  entregavelId,
  podeComentar,
  caminhoAnterior,
}: {
  slug: string
  tipo: TipoEntregavel
  caminho: string
  titulo: string
  aoAbrir?: () => void
  entregavelId?: string
  podeComentar?: boolean
  /** Roteiro: arquivo da versão anterior, para mostrar só o que mudou. */
  caminhoAnterior?: string
}) {
  const url = urlArquivo(slug, caminho)
  const [texto, setTexto] = useState<string | null>(null)

  useEffect(() => {
    if (tipo !== "secao") return
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => r.text())
      .then((t) => ativo && setTexto(t))
    return () => {
      ativo = false
    }
  }, [tipo, url])

  if (tipo === "grafico" || tipo === "tabela") {
    return (
      <div className="group relative">
        <button type="button" className="block w-full cursor-zoom-in" onClick={aoAbrir} aria-label={`Abrir ${titulo}`} disabled={!aoAbrir}>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={url} alt={titulo} className="w-full rounded-2xl border border-border bg-papel" />
        </button>
        {aoAbrir && (
          <Button size="sm" variant="midia" className="absolute top-2.5 right-2.5 h-[30px] px-3 text-xs" onClick={aoAbrir}>
            <ZoomInIcon /> Ampliar
          </Button>
        )}
      </div>
    )
  }
  if (tipo === "secao") {
    return texto === null ? (
      <Skeleton className="h-24 w-full" />
    ) : (
      <div className="relative">
        <div className="max-h-96 overflow-y-auto rounded-2xl border border-border bg-card p-4">
          <Markdown>{texto}</Markdown>
        </div>
        {aoAbrir && (
          <Button size="sm" variant="midia" className="absolute top-2.5 right-2.5 h-[30px] px-3 text-xs" onClick={aoAbrir}>
            <PanelRightOpenIcon /> Expandir
          </Button>
        )}
      </div>
    )
  }
  if (tipo === "html") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-aviso-fundo text-aviso [&_svg]:size-4">
          <FileCode2Icon />
        </div>
        <div className="min-w-[140px] flex-1">
          <b className="block truncate text-[13.5px] font-medium">{titulo}</b>
          <small className="text-xs text-muted-foreground">Relatório HTML · abra para conferir</small>
        </div>
        {aoAbrir && (
          <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={aoAbrir}>
            Abrir
          </Button>
        )}
      </div>
    )
  }
  if (tipo === "roteiro") return <PreviaRoteiro slug={slug} caminho={caminho} caminhoAnterior={caminhoAnterior} entregavelId={entregavelId} podeComentar={podeComentar} />
  if (tipo === "apresentacao") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-link-acao [&_svg]:size-4">
          <PresentationIcon />
        </div>
        <div className="min-w-[140px] flex-1">
          <b className="block truncate text-[13.5px] font-medium">{titulo}</b>
          <small className="text-xs text-muted-foreground">Abra no Google Slides (Arquivo → Importar slides) ou no PowerPoint</small>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {aoAbrir && (
            <Button size="sm" variant="ghost" onClick={aoAbrir}>
              Abrir prévia
            </Button>
          )}
          <Button size="sm" variant="outline" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2.5">
      <div
        className={
          tipo === "planilha"
            ? "grid size-10 shrink-0 place-items-center rounded-xl bg-sucesso-fundo text-sucesso [&_svg]:size-4"
            : "grid size-10 shrink-0 place-items-center rounded-xl bg-selo-sonnet-fundo text-selo-sonnet [&_svg]:size-4"
        }
      >
        {tipo === "planilha" ? <FileSpreadsheetIcon /> : <FileTextIcon />}
      </div>
      <div className="min-w-[140px] flex-1">
        <b className="block truncate text-[13.5px] font-medium">{titulo}</b>
        <small className="text-xs text-muted-foreground">{tipo === "planilha" ? "Planilha Excel · veja a prévia sem baixar" : "Documento Word · abra para conferir"}</small>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {tipo === "planilha" && aoAbrir && (
          <Button size="sm" variant="ghost" onClick={aoAbrir}>
            Ver prévia
          </Button>
        )}
        <Button size="sm" variant="outline" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
          <DownloadIcon /> Baixar
        </Button>
      </div>
    </div>
  )
}
