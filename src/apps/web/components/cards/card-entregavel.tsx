"use client"

import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { destinoAprovado } from "@workspace/core/entregaveis"
import type { Entregavel, StatusEntregavel, TipoEntregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro } from "@/lib/api"
import { PreviaArquivo } from "./previa-arquivo"

const ROTULO_TIPO: Record<TipoEntregavel, string> = {
  grafico: "Gráfico",
  tabela: "Tabela",
  secao: "Seção de texto",
  planilha: "Planilha",
  documento: "Documento",
  html: "Relatório HTML",
}
export const ROTULO_STATUS_ENTREGAVEL: Record<StatusEntregavel, string> = { pendente: "Aguardando aprovação", aprovado: "Aprovado", substituido: "Substituído" }

export function CardEntregavel({ slug, entregavel: e }: { slug: string; entregavel: Entregavel }) {
  const { abrir } = useVisualizador()
  const [ajusteAberto, setAjusteAberto] = useState(false)
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const nomeNaApresentacao = destinoAprovado(e).split("/").pop()

  async function aprovar() {
    setOcupado(true)
    try {
      await api.aprovar(slug, e.id)
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  async function enviarAjuste() {
    setOcupado(true)
    try {
      await api.pedirAjuste(slug, e.id, texto)
      setAjusteAberto(false)
      setTexto("")
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card className={cn("max-w-2xl", e.status === "substituido" && "opacity-60")}>
      <CardHeader>
        <CardTitle>{e.titulo}</CardTitle>
        <CardDescription>
          {ROTULO_TIPO[e.tipo]} · vai para a apresentação como <code className="font-mono">{nomeNaApresentacao}</code>
        </CardDescription>
        <CardAction>
          <Badge variant={e.status === "aprovado" ? "default" : e.status === "pendente" ? "outline" : "secondary"}>
            {ROTULO_STATUS_ENTREGAVEL[e.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <PreviaArquivo
          slug={slug}
          tipo={e.tipo}
          caminho={e.arquivoRascunho}
          titulo={e.titulo}
          aoAbrir={e.tipo === "html" ? () => abrir(e.etapa, e.nomeFinal) : undefined}
        />
        {(e.tipo === "grafico" || e.tipo === "tabela") && e.status === "pendente" && (
          <p className="text-sm">Confirme se os valores representados no gráfico correspondem exatamente aos dados enviados.</p>
        )}
        {e.ajustePedido && e.status === "pendente" && (
          <p className="text-muted-foreground text-sm">Ajuste pedido: “{e.ajustePedido}”. Aguardando a nova versão do agente.</p>
        )}
        {ajusteAberto && (
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Ex.: trocar para barras, incluir a linha de média"
              aria-label="Descreva o ajuste"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={enviarAjuste} disabled={!texto.trim() || ocupado}>
                {ocupado && <Spinner />} Enviar ajuste
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAjusteAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      {e.status === "pendente" && !ajusteAberto && (
        <CardFooter className="gap-2">
          <Button onClick={aprovar} disabled={ocupado}>
            {ocupado ? <Spinner /> : <CheckIcon />} Aprovar
          </Button>
          <Button variant="outline" onClick={() => setAjusteAberto(true)} disabled={ocupado}>
            Pedir ajuste…
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
