"use client"

import { CircleCheckIcon, CircleDashedIcon, DownloadIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, ValidacaoCliente } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"
import { dataDeGeracao } from "@/lib/data-geracao"
import { passosValidacao } from "@/lib/passos-validacao"

export interface PropsCardValidacaoCliente {
  slug: string
  etapa: EtapaId
  validacao: ValidacaoCliente | undefined
  /** Gráfico, tabela ou seção aprovados depois do PDF: o documento não reflete mais o que foi aprovado. */
  defasado: boolean
}

function Passo({ feito, rotulo }: { feito: boolean; rotulo: string }) {
  const Icone = feito ? CircleCheckIcon : CircleDashedIcon
  return (
    <li className={cn("flex items-center gap-2", !feito && "text-muted-foreground")}>
      <Icone className={cn("size-4 shrink-0", feito && "text-sucesso")} aria-hidden />
      <span>{rotulo}</span>
      <span className="sr-only">{feito ? "(feito)" : "(pendente)"}</span>
    </li>
  )
}

/** O documento que o cliente confere antes da etapa 04 seguir: gerado pelo agente, baixado e confirmado pelo analista. */
export function CardValidacaoCliente({ slug, etapa, validacao, defasado }: PropsCardValidacaoCliente) {
  const [ocupado, setOcupado] = useState(false)
  const passos = passosValidacao(validacao, defasado)
  const geradoEm = validacao ? dataDeGeracao(validacao.geradoEm) : ""

  async function confirmar() {
    setOcupado(true)
    try {
      await api.acaoEtapa(slug, etapa, "confirmar-validacao-cliente")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card size="sm" className="max-w-xl">
      <CardHeader>
        <CardTitle>Documento de validação do cliente</CardTitle>
        {geradoEm && <CardDescription>Gerado em {geradoEm}</CardDescription>}
        <CardAction>
          <Badge variant={passos.confirmado ? "sucesso" : defasado ? "aviso" : "outline"}>
            {passos.confirmado ? "Confirmado" : defasado ? "Desatualizado" : "Em validação"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1.5" aria-label="Passos da validação">
          <Passo feito={passos.gerado} rotulo="Gerado" />
          <Passo feito={passos.baixado} rotulo="Baixado" />
          <Passo feito={passos.confirmado} rotulo="Cliente confirmou" />
        </ol>
        {passos.aviso && <CardDescription>{passos.aviso}</CardDescription>}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {passos.gerado ? (
          <Button variant="outline" size="sm" render={<a href={`/api/prospects/${slug}/validacao-cliente/download`} download />} nativeButton={false}>
            <DownloadIcon /> Baixar PDF
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <DownloadIcon /> Baixar PDF
          </Button>
        )}
        <Button size="sm" onClick={() => void confirmar()} disabled={!passos.podeConfirmar || ocupado}>
          {ocupado && <Spinner />} Cliente confirmou, sem alterações
        </Button>
      </CardFooter>
    </Card>
  )
}
