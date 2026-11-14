"use client"

import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ORDEM_ETAPAS, type EtapaId, type RespostaEstado } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro } from "@/lib/api"
import { celebrarEtapaConcluida } from "@/lib/confete"
import { concluirUmaVez, estadoDoConcluir } from "@/lib/concluir"

/**
 * Atalho no fim da conversa quando o agente encerra a etapa: concluir (a mesma ação e as mesmas
 * condições do botão do painel) e abrir a próxima etapa, sem precisar procurar o botão nem
 * escrever mensagem. Com a etapa já concluída, só leva para a próxima.
 */
export function FimDaEtapa({ slug, etapa, dados }: { slug: string; etapa: EtapaId; dados: RespostaEstado }) {
  const { irParaEtapa } = useVisualizador()
  const [concluindo, setConcluindo] = useState(false)
  const estadoEtapa = dados.estado.etapas[etapa]
  const condicoes = dados.condicoes[etapa]
  const proxima: EtapaId | null = ORDEM_ETAPAS[ORDEM_ETAPAS.indexOf(etapa) + 1] ?? null
  const rotuloProxima = proxima ? dados.catalogo.etapas.find((e) => e.id === proxima)!.rotuloStatus : null

  if (estadoEtapa.status === "concluida") {
    if (!proxima || !rotuloProxima) return null
    return (
      <div className="flex justify-start">
        <Button variant="outline" onClick={() => irParaEtapa(proxima)}>
          Ir para {rotuloProxima} <ArrowRightIcon />
        </Button>
      </div>
    )
  }

  const aberta = estadoEtapa.status === "em_andamento" || estadoEtapa.status === "pronta"
  // Regra do usuário: o botão só aparece com tudo pronto; antes disso, nada (os contadores do painel mostram o que falta).
  if (!aberta || estadoDoConcluir({
      condicoes,
      sinalizada: estadoEtapa.sinalizada === true,
      turnoAtivoAqui: dados.turnoAtivo === etapa,
      temEntregaveis: dados.estado.entregaveis.some((e) => e.etapa === etapa && e.status !== "substituido"),
    }) !== "pronto") return null

  async function concluirEIr() {
    setConcluindo(true)
    try {
      if (!(await concluirUmaVez(`${slug}:${etapa}`, () => api.acaoEtapa(slug, etapa, "concluir")))) return
      celebrarEtapaConcluida(proxima !== null)
      if (proxima) irParaEtapa(proxima)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setConcluindo(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button className="surgir" onClick={() => void concluirEIr()} disabled={concluindo}>
        {concluindo && <Spinner />}
        {proxima && rotuloProxima ? `Concluir etapa e ir para ${rotuloProxima}` : "Concluir etapa"}
        {proxima && !concluindo && <ArrowRightIcon />}
      </Button>
    </div>
  )
}
