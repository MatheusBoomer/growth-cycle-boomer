"use client"

import { BarChart3Icon, FileIcon, FileSpreadsheetIcon, FileTextIcon, GlobeIcon, ImageIcon, PresentationIcon, TableIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
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

const ICONE_POR_TIPO: Record<TipoEntregavel, ReactNode> = {
  grafico: <BarChart3Icon />,
  tabela: <TableIcon />,
  secao: <FileTextIcon />,
  planilha: <FileSpreadsheetIcon />,
  documento: <FileTextIcon />,
  html: <GlobeIcon />,
  roteiro: <PresentationIcon />,
  apresentacao: <PresentationIcon />,
}

/** Ícone do tipo de entregável, para a etiqueta de referência de ajuste. */
export const iconeDoTipo = (tipo: TipoEntregavel): ReactNode => ICONE_POR_TIPO[tipo]

export function EtiquetaAnexo({
  nome,
  estado = "done",
  erro = null,
  aoRemover,
  aoAbrir,
  icone,
  detalhe,
}: {
  nome: string
  estado?: "uploading" | "done" | "error"
  erro?: string | null
  aoRemover?: () => void
  aoAbrir?: () => void
  /** Ícone no lugar do que o nome do arquivo sugere (referência de ajuste). */
  icone?: ReactNode
  /** Linha extra abaixo do nome, ex.: "marcações 1 a 2". */
  detalhe?: string
}) {
  return (
    <Attachment size="sm" state={estado} title={erro ?? nome} className="min-w-0">
      <AttachmentMedia>{estado === "uploading" ? <Spinner /> : (icone ?? <IconeDoArquivo nome={nome} />)}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{nome}</AttachmentTitle>
        {(erro ?? detalhe) && <AttachmentDescription>{erro ?? detalhe}</AttachmentDescription>}
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
