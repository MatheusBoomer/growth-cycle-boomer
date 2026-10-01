"use client"

import { DownloadIcon, FileCode2Icon, FileSpreadsheetIcon, FileTextIcon, PanelRightOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Markdown } from "@/components/markdown"
import { urlArquivo } from "@/lib/api"

export function PreviaArquivo({
  slug,
  tipo,
  caminho,
  titulo,
  aoAbrir,
}: {
  slug: string
  tipo: TipoEntregavel
  caminho: string
  titulo: string
  aoAbrir?: () => void
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
          <img src={url} alt={titulo} className="w-full rounded-md border bg-white" />
        </button>
        {aoAbrir && (
          <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={aoAbrir}>
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
      <div className="max-h-96 overflow-y-auto rounded-md border p-3">
        <Markdown>{texto}</Markdown>
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
  return (
    <Attachment state="done">
      <AttachmentMedia variant="icon">{tipo === "planilha" ? <FileSpreadsheetIcon /> : <FileTextIcon />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{titulo}</AttachmentTitle>
        <AttachmentDescription>{tipo === "planilha" ? "Planilha Excel" : "Documento Word"} · abra para conferir</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction render={<a href={urlArquivo(slug, caminho, true)} download aria-label="Baixar" />} nativeButton={false}>
          <DownloadIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}
