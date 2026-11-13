"use client"

import { BarChart3Icon, FileIcon, FileSpreadsheetIcon, FileTextIcon, GlobeIcon, ImageIcon, PresentationIcon, TableIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

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
  numeros,
}: {
  nome: string
  estado?: "uploading" | "done" | "error"
  erro?: string | null
  aoRemover?: () => void
  aoAbrir?: () => void
  /** Ícone no lugar do que o nome do arquivo sugere (referência de ajuste). */
  icone?: ReactNode
  /** Texto extra (ex.: "marcações 1 a 2"); aparece ao passar o mouse e para leitores de tela. */
  detalhe?: string
  /** Números das marcações desta referência, no círculo laranja (ex.: "1" ou "1-2"). */
  numeros?: string
}) {
  const dica = erro ?? (detalhe ? `${nome} · ${detalhe}` : nome)
  return (
    <span
      data-slot="etiqueta-anexo"
      data-state={estado}
      title={dica}
      className={cn(
        "relative inline-flex max-w-[260px] min-w-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-1.5 pl-2.5 text-[12.5px] text-card-foreground transition-colors has-[>button[data-abrir]]:hover:bg-muted/50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        estado === "error" && "border-destructive/40 text-destructive",
        !aoRemover && "pr-2.5",
      )}
    >
      {numeros && (
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10.5px] font-semibold text-primary-foreground">
          {numeros}
        </span>
      )}
      {estado === "uploading" ? <Spinner /> : (icone ?? <IconeDoArquivo nome={nome} />)}
      <span className="min-w-0 truncate">{nome}</span>
      {(erro ?? detalhe) && <span className="sr-only">{erro ?? detalhe}</span>}
      {aoAbrir && <button type="button" data-abrir aria-label={`Abrir ${nome}`} onClick={aoAbrir} className="absolute inset-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}
      {aoRemover && (
        <button
          type="button"
          aria-label={`Remover ${nome}`}
          onClick={aoRemover}
          className="relative grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
        >
          <XIcon />
        </button>
      )}
    </span>
  )
}
