"use client"

import { CircleCheckIcon, CloudUploadIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon, FileXIcon, LinkIcon, XIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { EstadoInsumo, EtapaId, InsumoCatalogo } from "@workspace/core/tipos"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"
import { IconeModal } from "@/components/marca/icone-modal"

export interface PropsCardInsumo {
  slug: string
  etapa: EtapaId
  insumo: InsumoCatalogo
  obrigatorio: boolean
  estadoInsumo: EstadoInsumo | null
  temModelo: boolean
  /** Falso com a etapa concluída ou desatualizada: o envio só pode ser desfeito com a etapa aberta. */
  removivel?: boolean
}

/** "x" do arquivo enviado: confirma e manda o arquivo para a lixeira do sistema. */
function ExcluirEnvio({ nome, aoExcluir }: { nome: string; aoExcluir: () => void }) {
  return (
    <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" size="icon-xs" className="ml-auto text-current hover:bg-current/10" aria-label={`Excluir o arquivo de ${nome}`} />}>
          <XIcon />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <IconeModal tom="perigo">
              <FileXIcon />
            </IconeModal>
            <AlertDialogTitle>
              Excluir este <em>arquivo?</em>
            </AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo de {nome} vai para a Lixeira do computador e sai desta etapa. Depois é só enviar o arquivo certo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={aoExcluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  )
}

export function CardInsumo({ slug, etapa, insumo, obrigatorio, estadoInsumo, temModelo, removivel = true }: PropsCardInsumo) {
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [url, setUrl] = useState(estadoInsumo?.resumo ?? "")
  const entrada = useRef<HTMLInputElement>(null)
  const status = estadoInsumo?.status ?? "pendente"
  const Icone = insumo.tipo === "link" ? LinkIcon : insumo.formatos.includes(".xlsx") ? FileSpreadsheetIcon : FileTextIcon

  async function enviarArquivos(arquivos: FileList | File[] | null) {
    if (!arquivos || arquivos.length === 0) return
    setEnviando(true)
    try {
      for (const arquivo of Array.from(arquivos)) {
        const r = await api.enviarInsumo(slug, etapa, insumo.id, arquivo)
        if (r.ok) toast.success(`${insumo.nome}: recebido`)
        else toast.error(`${insumo.nome}: ${r.problemas.length} problema(s). Veja os detalhes no card.`)
      }
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  async function excluir() {
    setEnviando(true)
    try {
      await api.removerInsumo(slug, etapa, insumo.id)
      toast.success(`${insumo.nome}: arquivo excluído`)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }
  const podeExcluir = removivel && insumo.tipo === "arquivo" && !enviando

  async function salvarLink() {
    setEnviando(true)
    try {
      await api.enviarLink(slug, etapa, insumo.id, url)
      toast.success(`${insumo.nome}: salvo`)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  const tom = status === "valido" ? "text-sucesso" : status === "invalido" ? "text-destructive" : "text-muted-foreground"

  return (
    <div className="grid gap-3 rounded-[18px] border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center gap-3">
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-muted/50 [&_svg]:size-4", tom)}>
          <Icone />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium">{insumo.nome}</h4>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{insumo.tipo === "link" ? "link" : insumo.formatos.join(" · ")}</p>
        </div>
        <Badge className="ml-auto shrink-0" variant={status === "valido" ? "sucesso" : status === "invalido" ? "perigo" : "outline"}>
          {status === "valido" ? "Recebido" : status === "invalido" ? "Com problemas" : obrigatorio ? "Obrigatório" : "Opcional"}
        </Badge>
      </div>
      {status === "pendente" && (
        <div className="space-y-1 text-[13px] leading-normal text-muted-foreground">
          <p>{insumo.descricao}</p>
          {insumo.instrucao && <p>{insumo.instrucao}</p>}
        </div>
      )}

      {status === "valido" && (
        <div className="grid gap-1.5 rounded-[14px] bg-sucesso-fundo px-3 py-2.5 text-[13px] text-sucesso">
          <div className="flex items-center gap-2.5">
            <CircleCheckIcon className="size-4 shrink-0" />
            <span className="min-w-0">{estadoInsumo?.resumo ?? "Arquivo recebido"}</span>
            {podeExcluir && <ExcluirEnvio nome={insumo.nome} aoExcluir={() => void excluir()} />}
          </div>
          {estadoInsumo && estadoInsumo.avisos.length > 0 && (
            <ul className="list-disc pl-[46px] text-[12.5px]">
              {estadoInsumo.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {status === "invalido" && estadoInsumo && (
        <div className="rounded-[14px] bg-perigo-fundo px-3.5 py-3 text-[13px] leading-normal text-destructive">
          <div className="mb-1 flex items-center gap-2">
            <b className="font-medium">
              {estadoInsumo.problemas.length} problema{estadoInsumo.problemas.length === 1 ? "" : "s"} na planilha
            </b>
            {podeExcluir && <ExcluirEnvio nome={insumo.nome} aoExcluir={() => void excluir()} />}
          </div>
          <ul className="list-disc pl-4">
            {estadoInsumo.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {insumo.tipo === "link" ? (
        <div className="flex gap-2">
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label={insumo.nome} />
          <Button size="sm" className="h-9" onClick={salvarLink} disabled={!url.trim() || enviando}>
            {enviando && <Spinner />} Salvar
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={entrada}
            type="file"
            hidden
            multiple={insumo.destino.endsWith("/")}
            accept={insumo.formatos.join(",")}
            onChange={(e) => void enviarArquivos(e.target.files)}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label={`Enviar ${insumo.nome}`}
            onClick={() => entrada.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                entrada.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              void enviarArquivos(e.dataTransfer.files)
            }}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-border text-center text-[13px] text-muted-foreground transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
              status === "pendente" ? "flex-col gap-1.5 p-[18px]" : "p-2.5",
              arrastando && "border-primary bg-primary/7 text-link-acao hover:border-primary",
            )}
          >
            {enviando ? (
              <>
                <Spinner /> Validando…
              </>
            ) : arrastando ? (
              <>
                <CloudUploadIcon />
                <b className="font-medium">Solte para enviar</b>
              </>
            ) : status === "pendente" ? (
              <>
                <CloudUploadIcon />
                <span>
                  <b className="font-medium text-foreground">Arraste o arquivo</b> ou clique para escolher
                </span>
              </>
            ) : (
              <>
                <CloudUploadIcon /> {status === "invalido" ? "Enviar a versão corrigida" : "Enviar outra versão"}
              </>
            )}
          </div>
        </>
      )}
      {temModelo && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" render={<a href={`/api/modelos/${insumo.id}`} download />} nativeButton={false}>
            <DownloadIcon /> Baixar modelo
          </Button>
        </div>
      )}
    </div>
  )
}
