"use client"

import { LockIcon, PlayIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { CardInsumo } from "@/components/cards/card-insumo"
import { PainelKit } from "@/components/teste/painel-kit"
import { api, mensagemDeErro } from "@/lib/api"
import { passosDoQueEsperar } from "@/lib/o-que-esperar"

export function EtapaLiberada({
  slug,
  etapa,
  dados,
}: {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
}) {
  const [iniciando, setIniciando] = useState(false)
  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!

  if (dados.estado.etapas[etapa].status === "bloqueada") {
    const indice = dados.catalogo.etapas.findIndex((e) => e.id === etapa)
    const anterior = indice > 0 ? dados.catalogo.etapas[indice - 1] : undefined
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-10 text-center">
        <div className="mb-1 grid size-12 place-items-center rounded-2xl border border-border bg-muted/40 text-muted-foreground [&_svg]:size-5">
          <LockIcon />
        </div>
        <h2 className="text-[20px] font-medium tracking-[-0.02em]">
          Etapa <em className="font-serif font-normal text-link-acao italic">bloqueada</em>
        </h2>
        <p className="max-w-[300px] text-[13.5px] text-muted-foreground">
          {anterior?.numero ? `Conclua a Etapa ${anterior.numero} para liberar esta.` : "Conclua a etapa anterior para liberar esta."}
        </p>
      </div>
    )
  }

  async function iniciar() {
    setIniciando(true)
    try {
      await api.acaoEtapa(slug, etapa, "iniciar")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setIniciando(false)
    }
  }

  const passos = passosDoQueEsperar(etapaCat.oQueEsperar)
  const temColunaLateral = etapaCat.insumos.length > 0 || Boolean(dados.estado.teste)
  const etapaOcupada = dados.turnoAtivo === null ? null : dados.catalogo.etapas.find((e) => e.id === dados.turnoAtivo)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* O nome da etapa já está no cabeçalho logo acima; aqui entra o "como vai ser" (protótipo 9). */}
      {/* A coluna da direita só ocupa espaço com conteúdo (o kit do cliente de teste pode não existir na etapa). */}
      <div className="mx-auto grid max-w-2xl gap-8 p-6 sm:p-8 has-[>[data-lateral]>*]:max-w-5xl lg:has-[>[data-lateral]>*]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Antes de começar</p>
          <h2 className="mt-2 text-[26px] leading-[1.15] font-medium tracking-[-0.03em]">
            O que esperar <em className="font-serif font-normal text-link-acao italic">desta etapa</em>
          </h2>
          <ol className="mt-5 grid gap-2.5">
            {passos.map((p, i) => (
              <li key={p} className="flex gap-3 text-[13.5px] leading-normal text-muted-foreground">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border font-mono text-[11px] text-link-acao">
                  {i + 1}
                </span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-3.5">
            <Button size="lg" className="h-11 px-5.5 text-sm" onClick={iniciar} disabled={iniciando || dados.turnoAtivo !== null}>
              {iniciando ? <Spinner /> : <PlayIcon className="fill-current" />} Iniciar etapa
            </Button>
            {dados.turnoAtivo === null && (
              <span className="text-[12.5px] text-muted-foreground">O agente começa já com o dossiê das etapas anteriores.</span>
            )}
          </div>
          {etapaOcupada && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Spinner className="text-link-acao" />
              O agente está respondendo {etapaOcupada.numero ? `na Etapa ${etapaOcupada.numero}` : "em outra etapa"}. Assim que terminar, dá para iniciar.
            </p>
          )}
        </div>
        {temColunaLateral && (
          <div data-lateral className="grid min-w-0 content-start gap-2.5">
            {etapaCat.insumos.length > 0 && (
              <>
                <p className="text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">Arquivos desta etapa</p>
                <p className="text-[13px] leading-normal text-muted-foreground">Pode enviar agora, quando o agente pedir ou anexando no chat.</p>
                {etapaCat.insumos.map((ref) => (
                  <CardInsumo
                    key={ref.id}
                    slug={slug}
                    etapa={etapa}
                    insumo={dados.catalogo.insumos.find((i) => i.id === ref.id)!}
                    obrigatorio={ref.obrigatorio}
                    estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === ref.id) ?? null}
                    temModelo={dados.modelosDisponiveis.includes(ref.id)}
                  />
                ))}
              </>
            )}
            {dados.estado.teste && <PainelKit slug={slug} etapa={etapa} />}
          </div>
        )}
      </div>
    </div>
  )
}
