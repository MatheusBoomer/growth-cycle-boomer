"use client"

import { AtSignIcon, CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { destinoAprovado } from "@workspace/core/entregaveis"
import { etapaDaConversa } from "@workspace/core/validacao-cliente"
import type { Entregavel, StatusEntregavel, TipoEntregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { useReferencias } from "@/components/chat/contexto-referencias"
import { numerar } from "@/lib/referencias"
import { MarcadorImagem } from "./marcador-imagem"
import { ModalGrafico } from "./modal-grafico"
import { PreviaArquivo } from "./previa-arquivo"

const ROTULO_TIPO: Record<TipoEntregavel, string> = {
  grafico: "Gráfico",
  tabela: "Tabela",
  secao: "Seção de texto",
  planilha: "Planilha",
  documento: "Documento",
  html: "Relatório HTML",
  roteiro: "Roteiro da apresentação",
  apresentacao: "Apresentação (.pptx)",
}
export const ROTULO_STATUS_ENTREGAVEL: Record<StatusEntregavel, string> = { pendente: "Aguardando aprovação", aprovado: "Aprovado", substituido: "Substituído" }

/** `anterior`: a versão anterior do mesmo entregável (null na primeira); o roteiro a usa para mostrar só o que mudou. */
export function CardEntregavel({ slug, entregavel: e, anterior = null }: { slug: string; entregavel: Entregavel; anterior?: Entregavel | null }) {
  const { abrir, abrirSecao, abrirPlanilha, mencionar } = useVisualizador()
  const [ocupado, setOcupado] = useState(false)
  const [ampliado, setAmpliado] = useState(false)
  const refs = useReferencias(etapaDaConversa(e))
  const nomeNaApresentacao = destinoAprovado(e).split("/").pop()
  // Com ajuste pedido, a versão atual está superada: só a nova versão do agente libera a aprovação.
  const aguardandoNovaVersao = e.status === "pendente" && !!e.ajustePedido
  // Gráfico e tabela são imagens: o ajuste é feito marcando áreas e números direto nelas.
  const ehImagem = e.tipo === "grafico" || e.tipo === "tabela"
  const referencia = refs.referencias.find((r) => r.entregavelId === e.id)
  const ajusteNaImagem = ehImagem && referencia !== undefined && refs.marcando === e.id

  /** Devolve se aprovou: o modal do "Ampliar" só fecha com a aprovação feita. */
  async function aprovar(): Promise<boolean> {
    setOcupado(true)
    try {
      await api.aprovar(slug, e.id)
      return true
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
      return false
    } finally {
      setOcupado(false)
    }
  }

  /** "Pedir ajuste…" coloca o entregável no chat como referência; o pedido é escrito na caixa de mensagem. */
  function pedirAjuste() {
    refs.adicionar({ entregavelId: e.id, titulo: e.titulo, tipo: e.tipo, urlImagem: ehImagem ? urlArquivo(slug, e.arquivoRascunho) : null, marcas: [] })
    if (ehImagem) refs.iniciarMarcacao(e.id)
  }

  return (
    <Card
      className={cn(
        "max-w-2xl",
        e.status === "substituido" && "opacity-60",
        e.status === "pendente" && "borda-correndo",
        e.status === "aprovado" && "ring-1 ring-sucesso/30",
      )}
    >
      <CardHeader>
        <CardTitle className="font-serif text-[20px] leading-snug font-normal italic">{e.titulo}</CardTitle>
        <CardDescription>
          {ROTULO_TIPO[e.tipo]} · vai para a apresentação como <code className="font-mono">{nomeNaApresentacao}</code>
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mencionar no chat"
            title="Mencionar no chat"
            onClick={() => mencionar(e.arquivoRascunho)}
          >
            <AtSignIcon />
          </Button>
          <Badge variant={e.status === "aprovado" ? "sucesso" : e.status === "pendente" ? "aviso" : "secondary"}>
            {ROTULO_STATUS_ENTREGAVEL[e.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ajusteNaImagem && (
          <PreviaArquivo
            // Edição do analista no visualizador: a prévia recarrega o texto salvo.
            key={e.editadoEm ?? "original"}
            slug={slug}
            tipo={e.tipo}
            caminho={e.arquivoRascunho}
            caminhoAnterior={anterior?.arquivoRascunho}
            entregavelId={e.id}
            podeComentar={e.status === "pendente"}
            titulo={e.titulo}
            aoAmpliar={ehImagem ? () => setAmpliado(true) : undefined}
            aoAbrir={
              e.tipo === "html" || e.tipo === "apresentacao"
                ? () => abrir(e.etapa, e.nomeFinal)
                : e.tipo === "secao"
                  ? () => abrirSecao(e.etapa, e.nomeFinal)
                  : e.tipo === "planilha"
                    ? () => abrirPlanilha(e.etapa, e.nomeFinal)
                    : undefined
            }
          />
        )}
        {!ajusteNaImagem && (e.tipo === "grafico" || e.tipo === "tabela") && e.status === "pendente" && (
          <p className="text-sm">Confirme se os valores representados no gráfico correspondem exatamente aos dados enviados.</p>
        )}
        {e.tipo === "grafico" && e.status === "aprovado" && e.avisoPendente && (
          <p className="text-muted-foreground text-sm">Aprovado. O agente só é avisado quando você escrever no chat, depois de decidir todos os gráficos.</p>
        )}
        {e.ajustePedido && e.status === "pendente" && (
          <p className="text-muted-foreground text-sm whitespace-pre-line">Ajuste pedido: “{e.ajustePedido}”. Aguardando a nova versão do agente.</p>
        )}
        {ajusteNaImagem && referencia?.urlImagem && (
          <MarcadorImagem
            titulo={e.titulo}
            urlImagem={referencia.urlImagem}
            marcas={referencia.marcas}
            primeiroNumero={numerar(refs.referencias).find((n) => n.entregavelId === e.id)!.primeira}
            aoMudar={(marcas) => refs.mudarMarcas(e.id, marcas)}
            aoFechar={refs.terminarMarcacao}
          />
        )}
      </CardContent>
      {e.status === "pendente" && !ajusteNaImagem && (
        <CardFooter className="gap-2 border-0 bg-transparent pt-0">
          <Button
            className="brilho-passa"
            onClick={aprovar}
            disabled={ocupado || aguardandoNovaVersao}
            title={aguardandoNovaVersao ? "Disponível quando o agente gerar a nova versão com o ajuste" : undefined}
          >
            {ocupado ? <Spinner /> : <CheckIcon />} Aprovar
          </Button>
          <Button variant="outline" onClick={pedirAjuste} disabled={ocupado}>
            Pedir ajuste…
          </Button>
        </CardFooter>
      )}
      {ehImagem && (
        <ModalGrafico
          aberto={ampliado}
          aoMudarAberto={setAmpliado}
          titulo={e.titulo}
          urlImagem={urlArquivo(slug, e.arquivoRascunho)}
          urlDownload={urlArquivo(slug, e.arquivoRascunho, true)}
          pendente={e.status === "pendente"}
          aprovarDesabilitado={aguardandoNovaVersao}
          motivoAprovarDesabilitado="Disponível quando o agente gerar a nova versão com o ajuste"
          ocupado={ocupado}
          aoAprovar={aprovar}
          aoPedirAjuste={pedirAjuste}
        />
      )}
    </Card>
  )
}
