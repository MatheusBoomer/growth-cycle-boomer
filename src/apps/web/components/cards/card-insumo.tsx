"use client"

import { CircleCheckIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon, LinkIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { EstadoInsumo, EtapaId, InsumoCatalogo } from "@workspace/core/tipos"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"

export interface PropsCardInsumo {
  slug: string
  etapa: EtapaId
  insumo: InsumoCatalogo
  obrigatorio: boolean
  estadoInsumo: EstadoInsumo | null
  temModelo: boolean
}

export function CardInsumo({ slug, etapa, insumo, obrigatorio, estadoInsumo, temModelo }: PropsCardInsumo) {
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

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="size-4" /> {insumo.nome}
        </CardTitle>
        <CardDescription>
          {insumo.tipo === "link" ? "Link" : insumo.formatos.join(", ")}
        </CardDescription>
        <CardAction>
          <Badge variant={status === "valido" ? "sucesso" : status === "invalido" ? "perigo" : "outline"}>
            {status === "valido" ? "Recebido" : status === "invalido" ? "Com problemas" : obrigatorio ? "Obrigatório" : "Opcional"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{insumo.descricao}</p>
        <p className="text-muted-foreground">{insumo.instrucao}</p>

        {status === "valido" && (
          <Alert>
            <CircleCheckIcon />
            <AlertTitle>{estadoInsumo?.resumo ?? "Arquivo recebido"}</AlertTitle>
            {estadoInsumo && estadoInsumo.avisos.length > 0 && (
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {estadoInsumo.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}
        {status === "invalido" && estadoInsumo && (
          <Alert variant="destructive">
            <AlertTitle>
              {estadoInsumo.problemas.length} problema{estadoInsumo.problemas.length === 1 ? "" : "s"} na planilha
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {estadoInsumo.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {insumo.tipo === "link" ? (
          <div className="flex gap-2">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label={insumo.nome} />
            <Button onClick={salvarLink} disabled={!url.trim() || enviando}>
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
                "text-muted-foreground flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors",
                arrastando && "border-primary bg-muted",
              )}
            >
              {enviando ? (
                <>
                  <Spinner /> Validando…
                </>
              ) : status === "valido" ? (
                "Enviar outra versão"
              ) : (
                "Arraste o arquivo aqui ou clique para escolher"
              )}
            </div>
          </>
        )}
      </CardContent>
      {temModelo && (
        <CardFooter>
          <Button variant="outline" size="sm" render={<a href={`/api/modelos/${insumo.id}`} download />} nativeButton={false}>
            <DownloadIcon /> Baixar modelo
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
