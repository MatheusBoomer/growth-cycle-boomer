"use client"

import { DownloadIcon, FileIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaTeste } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
    return mensagemVazia ? <p className="text-muted-foreground text-sm">{mensagemVazia}</p> : null
  }

  const conteudo = (
    <div className="space-y-4">
      {kit.arquivos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Arquivos para enviar</h4>
          <ul className="space-y-2">
            {kit.arquivos.map((caminho) => (
              <li key={caminho} className="flex items-center gap-2 text-sm">
                <FileIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{caminho.split("/").pop()}</span>
                <Button variant="outline" size="sm" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
                  <DownloadIcon /> Baixar
                </Button>
                {!nuvem && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => api.mostrarNoFinder(slug, caminho).catch((e) => toast.error(mensagemDeErro(e)))}
                  >
                    Mostrar no Finder
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kit.roteiro && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Roteiro de respostas</h4>
          <Markdown>{kit.roteiro}</Markdown>
        </div>
      )}
    </div>
  )

  if (semMoldura) return conteudo
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kit desta etapa</CardTitle>
        <CardDescription>Material do cliente de teste: baixe os arquivos, envie quando o agente pedir e use o roteiro para responder.</CardDescription>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  )
}
