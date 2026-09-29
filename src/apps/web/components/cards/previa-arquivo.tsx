"use client"

import { DownloadIcon, FileCode2Icon, FileSpreadsheetIcon, FileTextIcon, Maximize2Icon, PanelRightOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
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
      <Dialog>
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={url} alt={titulo} className="w-full rounded-md border bg-white" />
          <DialogTrigger render={<Button size="sm" variant="secondary" className="absolute top-2 right-2" />}>
            <Maximize2Icon /> Ampliar
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw]">
          <DialogTitle>{titulo}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={url} alt={titulo} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
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
