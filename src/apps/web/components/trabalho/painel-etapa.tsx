"use client"

import { DownloadIcon, FolderOpenIcon, LockOpenIcon, PresentationIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { apresentacaoFinal, TIPOS_VISUALIZADOR } from "@workspace/core/entregaveis"
import type { EtapaId, RespostaEstado, StatusEntregavel } from "@workspace/core/tipos"
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
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { CardInsumo } from "@/components/cards/card-insumo"
import { useAmbiente } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro, urlArquivo, type AcaoEtapa } from "@/lib/api"
import { celebrarEtapaConcluida } from "@/lib/confete"
import { concluirUmaVez, contagemInsumos, estadoDoConcluir } from "@/lib/concluir"
import { entregaveisDaConversa } from "@/lib/entregaveis-da-conversa"
import { useVisualizador } from "./contexto-visualizador"
import { CaixaAviso, IconeModal } from "@/components/marca/icone-modal"

const COR: Record<StatusEntregavel, string> = { pendente: "bg-aviso", aprovado: "bg-sucesso", substituido: "bg-muted-foreground/40" }

export function PainelEtapa({ slug, etapa, dados }: { slug: string; etapa: EtapaId; dados: RespostaEstado }) {
  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!
  const estadoEtapa = dados.estado.etapas[etapa]
  const entregaveis = entregaveisDaConversa(dados.estado.entregaveis, etapa).filter((e) => e.status !== "substituido")
  const condicoes = dados.condicoes[etapa]
  const insumos = contagemInsumos(etapaCat.insumos, dados.estado.insumos, etapa)
  const concluir = estadoDoConcluir({ condicoes, sinalizada: estadoEtapa.sinalizada === true, turnoAtivoAqui: dados.turnoAtivo === etapa, temEntregaveis: entregaveis.length > 0 })
  const indice = dados.catalogo.etapas.findIndex((e) => e.id === etapa)
  const rotuloProxima = dados.catalogo.etapas[indice + 1]?.rotuloStatus ?? null
  const [ocupado, setOcupado] = useState<AcaoEtapa | null>(null)
  const { nuvem } = useAmbiente()
  const { abrir, abrirArquivo, irParaEtapa } = useVisualizador()
  const final = apresentacaoFinal(entregaveisDaConversa(dados.estado.entregaveis, etapa))

  async function executar(acao: AcaoEtapa, sucesso: string) {
    setOcupado(acao)
    try {
      if (acao === "concluir") {
        // O fim da conversa também tem "Concluir etapa": o segundo clique, num ou noutro, não dispara outro pedido.
        if (!(await concluirUmaVez(`${slug}:${etapa}`, () => api.acaoEtapa(slug, etapa, acao)))) return
        celebrarEtapaConcluida(dados.catalogo.etapas.at(-1)?.id !== etapa)
        // O botão promete "e ir para <próxima>": abre a próxima etapa, como o fim de etapa do chat.
        const proxima = dados.catalogo.etapas[dados.catalogo.etapas.findIndex((e) => e.id === etapa) + 1]?.id
        if (proxima) irParaEtapa(proxima)
      } else {
        await api.acaoEtapa(slug, etapa, acao)
        toast.success(sucesso)
      }
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(null)
    }
  }

  const posterioresConcluidas = dados.catalogo.etapas
    .slice(dados.catalogo.etapas.findIndex((e) => e.id === etapa) + 1)
    .filter((e) => dados.estado.etapas[e.id].status === "concluida")

  return (
    <aside className="flex min-h-0 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {final && (
          <section className="space-y-2 rounded-md border p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <PresentationIcon className="size-4" /> Apresentação pronta
            </h3>
            <p className="text-muted-foreground text-xs">Abra no Google Slides (Arquivo → Importar slides) ou no PowerPoint.</p>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="outline" onClick={() => abrir(final.entregavel.etapa, final.entregavel.nomeFinal)}>
                <PresentationIcon /> Ver prévia
              </Button>
              <Button
                size="sm"
                render={<a href={urlArquivo(slug, final.caminho, true, `Growth Cycle - ${dados.estado.prospect.nome}`)} download />}
                nativeButton={false}
              >
                <DownloadIcon /> Baixar .pptx
              </Button>
              {!nuvem && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void api.mostrarNoFinder(slug, final.caminho).catch((e) => toast.error(mensagemDeErro(e)))}
                >
                  <FolderOpenIcon /> Mostrar no Finder
                </Button>
              )}
            </div>
          </section>
        )}
        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-medium tracking-tight">
            Entregáveis da etapa
            <span className="text-muted-foreground font-mono text-[11px] font-normal">
              {entregaveis.filter((x) => x.status === "aprovado").length}/{entregaveis.length}
            </span>
          </h3>
          {entregaveis.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nada proposto ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {entregaveis.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", COR[e.status])} aria-hidden />
                  {TIPOS_VISUALIZADOR.includes(e.tipo) ? (
                    <button type="button" className="truncate text-left hover:underline" onClick={() => abrir(e.etapa, e.nomeFinal)}>
                      {e.titulo}
                    </button>
                  ) : (
                    <button type="button" className="truncate text-left hover:underline" onClick={() => abrirArquivo(e.arquivoRascunho)}>
                      {e.titulo}
                    </button>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">{e.status === "pendente" ? "aguardando" : "aprovado"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {dados.aprovadosForaDaInterface.length > 0 && (
          <section>
            <details>
              <summary className="text-muted-foreground cursor-pointer text-[10px] font-medium tracking-[0.14em] uppercase">
                Aprovados fora da interface ({dados.aprovadosForaDaInterface.length})
              </summary>
              <p className="text-muted-foreground mt-2 text-xs">
                Estão em ativos aprovados, mas não passaram por um card daqui: foram feitos no terminal ou gravados direto na pasta.
              </p>
              <ul className="mt-2 space-y-1">
                {dados.aprovadosForaDaInterface.map((caminho) => (
                  <li key={caminho} className="truncate text-sm">
                    <button type="button" className="max-w-full truncate text-left hover:underline" onClick={() => abrirArquivo(caminho)} title={caminho}>
                      {caminho.replace("entrega/ativos-aprovados/", "")}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-medium tracking-tight">
            Insumos
            {/* Só opcionais: "0/0" sugeriria que falta algo. */}
            {insumos.total > 0 && (
              <span className="text-muted-foreground font-mono text-[11px] font-normal">
                {insumos.recebidos}/{insumos.total}
              </span>
            )}
          </h3>
          {etapaCat.insumos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Esta etapa não pede arquivos.</p>
          ) : (
            <div className="space-y-3">
              {etapaCat.insumos.map((ref) => (
                <CardInsumo
                  key={ref.id}
                  slug={slug}
                  etapa={etapa}
                  insumo={dados.catalogo.insumos.find((i) => i.id === ref.id)!}
                  obrigatorio={ref.obrigatorio}
                  estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === ref.id) ?? null}
                  temModelo={dados.modelosDisponiveis.includes(ref.id)}
                  removivel={estadoEtapa.status !== "concluida" && estadoEtapa.status !== "desatualizada"}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-2 border-t p-4">
        {(estadoEtapa.status === "em_andamento" || estadoEtapa.status === "pronta") && concluir === "esperando-agente" && (
          <p className="text-muted-foreground text-xs">✓ Tudo aprovado · esperando o agente fechar a etapa</p>
        )}
        {(estadoEtapa.status === "em_andamento" || estadoEtapa.status === "pronta") && concluir === "pronto" && (
          <div className="surgir space-y-2.5">
            <p className="text-sucesso text-xs">✓ Tudo aprovado nesta etapa</p>
            <Button className="w-full" disabled={ocupado !== null} onClick={() => executar("concluir", "")}>
              {ocupado === "concluir" && <Spinner />}
              {rotuloProxima ? `Concluir etapa e ir para ${rotuloProxima} →` : "Concluir etapa"}
            </Button>
          </div>
        )}
        {estadoEtapa.status === "concluida" && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" className="w-full" />}>Reabrir etapa</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <IconeModal tom="aviso">
                  <LockOpenIcon />
                </IconeModal>
                <AlertDialogTitle>
                  Reabrir <em>{etapaCat.titulo}?</em>
                </AlertDialogTitle>
                <AlertDialogDescription>O chat desta etapa volta a aceitar mensagens.</AlertDialogDescription>
              </AlertDialogHeader>
              {posterioresConcluidas.length > 0 && (
                <CaixaAviso>
                  {posterioresConcluidas.length === 1 ? "A etapa " : "As etapas "}
                  {posterioresConcluidas.map((e) => e.numero || e.titulo).join(", ")}
                  {posterioresConcluidas.length === 1 ? " fica desatualizada" : " ficam desatualizadas"} até você revisar ou confirmar cada uma.
                </CaixaAviso>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => executar("reabrir", "Etapa reaberta.")}>Reabrir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {estadoEtapa.status === "desatualizada" && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Uma etapa anterior foi reaberta. Revise esta ou confirme que continua valendo.</p>
            <Button className="w-full" variant="outline" disabled={ocupado !== null} onClick={() => executar("revisar", "Etapa reaberta para revisão.")}>
              Revisar
            </Button>
            <Button className="w-full" disabled={ocupado !== null} onClick={() => executar("confirmar", "Etapa confirmada.")}>
              Confirmar que continua válida
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
