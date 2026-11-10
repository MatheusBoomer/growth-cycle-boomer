"use client"

import { DownloadIcon, FileCode2Icon, FileSpreadsheetIcon, FileTextIcon, PanelRightOpenIcon, PresentationIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment"
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
          <img src={url} alt={titulo} className="w-full rounded-md border bg-papel" />
        </button>
        {aoAbrir && (
          <Button size="sm" variant="midia" className="absolute top-2 right-2" onClick={aoAbrir}>
            <PanelRightOpenIcon /> Abrir
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
        <div className="max-h-96 overflow-y-auto rounded-md border p-3">
          <Markdown>{texto}</Markdown>
        </div>
        {aoAbrir && (
          <Button size="sm" variant="midia" className="absolute top-2 right-2" onClick={aoAbrir}>
            <PanelRightOpenIcon /> Expandir
          </Button>
        )}
      </div>
    )
  }
  if (tipo === "html") {
    return (
      <Attachment state="done">
        <AttachmentMedia variant="icon">
          <FileCode2Icon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{titulo}</AttachmentTitle>
          <AttachmentDescription>Relatório HTML · abra para conferir</AttachmentDescription>
        </AttachmentContent>
        {aoAbrir && (
          <AttachmentActions>
            <Button size="sm" variant="outline" onClick={aoAbrir}>
              <PanelRightOpenIcon /> Abrir
            </Button>
          </AttachmentActions>
        )}
      </Attachment>
    )
  }
  if (tipo === "roteiro") return <PreviaRoteiro slug={slug} caminho={caminho} caminhoAnterior={caminhoAnterior} entregavelId={entregavelId} podeComentar={podeComentar} />
  if (tipo === "apresentacao") {
    return (
      <Attachment state="done">
        <AttachmentMedia variant="icon">
          <PresentationIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{titulo}</AttachmentTitle>
          <AttachmentDescription>PowerPoint · abra no Google Slides (Arquivo → Importar slides) ou no PowerPoint</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          {aoAbrir && (
            <Button size="sm" variant="outline" onClick={aoAbrir}>
              <PanelRightOpenIcon /> Abrir prévia
            </Button>
          )}
          <AttachmentAction render={<a href={urlArquivo(slug, caminho, true)} download aria-label="Baixar" />} nativeButton={false}>
            <DownloadIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    )
  }
  return (
    <Attachment state="done">
      <AttachmentMedia variant="icon">{tipo === "planilha" ? <FileSpreadsheetIcon /> : <FileTextIcon />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{titulo}</AttachmentTitle>
        <AttachmentDescription>{tipo === "planilha" ? "Planilha Excel · veja a prévia sem baixar" : "Documento Word · abra para conferir"}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        {tipo === "planilha" && aoAbrir && (
          <Button size="sm" variant="outline" onClick={aoAbrir}>
            <PanelRightOpenIcon /> Ver prévia
          </Button>
        )}
        <AttachmentAction render={<a href={urlArquivo(slug, caminho, true)} download aria-label="Baixar" />} nativeButton={false}>
          <DownloadIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}
