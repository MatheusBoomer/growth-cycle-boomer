"use client"

import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon, FlaskConicalIcon, FolderOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaTeste } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Markdown } from "@/components/markdown"
import { useAmbiente } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"

/** Kit do analista no cliente de teste: arquivos para enviar e roteiro de respostas. Não aparece fora de cliente de teste. */
export function PainelKit({
  slug,
  etapa,
  semMoldura = false,
  mensagemVazia,
}: {
  slug: string
  etapa: EtapaId
  semMoldura?: boolean
  /** Texto mostrado quando a etapa não tem kit; sem ele, o painel some. */
  mensagemVazia?: string
}) {
  const { nuvem } = useAmbiente()
  const [kit, setKit] = useState<RespostaTeste | null>(null)

  useEffect(() => {
    let cancelado = false
    api
      .kitTeste(slug, etapa)
      .then((r) => !cancelado && setKit(r))
      .catch(() => !cancelado && setKit(null))
    return () => {
      cancelado = true
    }
  }, [slug, etapa])

  if (!kit?.teste || kit.etapa !== etapa) return null
  if (kit.arquivos.length === 0 && !kit.roteiro) {
    return mensagemVazia ? (
      <p className="rounded-[14px] border border-dashed border-border p-3.5 text-[13px] leading-normal text-muted-foreground">{mensagemVazia}</p>
    ) : null
  }

  const olho = "text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase"
  const arquivos = kit.arquivos.length > 0 && (
    <div className="grid gap-2">
      <h4 className={olho}>Arquivos para enviar</h4>
      <ul className="grid gap-2">
        {kit.arquivos.map((caminho) => (
          <li key={caminho} className="flex items-center gap-2.5 rounded-[14px] border border-border py-2 pr-2 pl-2.5 text-[13px]">
            {/\.(xlsx|xls|csv)$/i.test(caminho) ? (
              <span className="grid size-7.5 shrink-0 place-items-center rounded-[10px] bg-sucesso-fundo text-sucesso [&_svg]:size-3.5">
                <FileSpreadsheetIcon />
              </span>
            ) : (
              <span className="grid size-7.5 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground [&_svg]:size-3.5">
                <FileTextIcon />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{caminho.split("/").pop()}</span>
            <Button variant="ghost" size="xs" className="text-muted-foreground" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
              <DownloadIcon /> Baixar
            </Button>
            {!nuvem && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mostrar no Finder"
                title="Mostrar no Finder"
                className="text-muted-foreground"
                onClick={() => api.mostrarNoFinder(slug, caminho).catch((e) => toast.error(mensagemDeErro(e)))}
              >
                <FolderOpenIcon />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
  const roteiro = kit.roteiro && (
    <div className="grid gap-2">
      <h4 className={olho}>Roteiro de respostas</h4>
      <div className="border-l-2 border-aviso/45 pl-3 text-[13px] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        <Markdown>{kit.roteiro}</Markdown>
      </div>
    </div>
  )

  if (semMoldura)
    return (
      <div className="grid gap-3.5">
        {arquivos}
        {roteiro}
      </div>
    )
  return (
    <div className="overflow-hidden rounded-[18px] border border-aviso/30 bg-card">
      <div className="flex items-center gap-3 border-b border-dashed border-border px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-aviso-fundo text-aviso [&_svg]:size-4">
          <FlaskConicalIcon />
        </span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-medium">
            Kit <em className="font-serif text-[17px] font-normal text-link-acao italic">desta etapa</em>
          </h4>
          <p className="text-xs text-muted-foreground">Baixe, envie quando o agente pedir e use o roteiro para responder.</p>
        </div>
      </div>
      {arquivos && <div className="px-4 py-3.5">{arquivos}</div>}
      {roteiro && <div className="border-t border-border px-4 py-3.5">{roteiro}</div>}
    </div>
  )
}
