"use client"

import { FileIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon, XIcon } from "lucide-react"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@workspace/ui/components/attachment"
import { Spinner } from "@workspace/ui/components/spinner"

function IconeDoArquivo({ nome }: { nome: string }) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return <ImageIcon />
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheetIcon />
  if (["pdf", "docx", "doc", "md", "txt"].includes(ext)) return <FileTextIcon />
  return <FileIcon />
}

export function EtiquetaAnexo({
  nome,
  estado = "done",
  erro = null,
  aoRemover,
  aoAbrir,
}: {
  nome: string
  estado?: "uploading" | "done" | "error"
  erro?: string | null
  aoRemover?: () => void
  aoAbrir?: () => void
}) {
  return (
    <Attachment size="sm" state={estado} title={erro ?? nome} className="min-w-0">
      <AttachmentMedia>{estado === "uploading" ? <Spinner /> : <IconeDoArquivo nome={nome} />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{nome}</AttachmentTitle>
        {erro && <AttachmentDescription>{erro}</AttachmentDescription>}
      </AttachmentContent>
      {aoAbrir && <AttachmentTrigger aria-label={`Abrir ${nome}`} onClick={aoAbrir} />}
      {aoRemover && (
        <AttachmentActions>
          <AttachmentAction aria-label={`Remover ${nome}`} onClick={aoRemover}>
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}
