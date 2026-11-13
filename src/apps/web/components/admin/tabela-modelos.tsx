"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { EscolhaModelo } from "@workspace/core/modelos"
import type { EtapaId } from "@workspace/core/tipos"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api, mensagemDeErro, type ConfigModelos } from "@/lib/api"
import { CartaoEtapaModelos } from "./cartao-etapa-modelos"
import { PainelEtapaModelos } from "./painel-etapa-modelos"

/** Aba "Modelos": modelo e esforço do agente principal e dos subagentes de cada etapa, salvos na hora. */
export function TabelaModelos() {
  const [dados, setDados] = useState<ConfigModelos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [emSalvamento, setEmSalvamento] = useState<string | null>(null)
  // A etapa do painel fica guardada ao fechar, para o conteúdo não sumir durante a animação de saída.
  const [etapaDoPainel, setEtapaDoPainel] = useState<EtapaId | null>(null)
  const [painelAberto, setPainelAberto] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.configModelos())
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function salvar(etapa: EtapaId, alvo: string, escolha: EscolhaModelo) {
    setEmSalvamento(`${etapa}/${alvo}`)
    try {
      await api.salvarModelo(etapa, alvo, escolha)
      toast.success(escolha.modelo === null && escolha.esforco === null ? "Voltou ao padrão." : "Modelo salvo. Vale a partir do próximo turno.")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEmSalvamento(null)
    }
    await carregar()
  }

  if (erro && !dados) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!dados) return <Skeleton className="h-64 w-full" />

  return (
    <section className="flex flex-col gap-4">
      {!dados.lista.completa && (
        <Alert>
          <AlertDescription>lista completa indisponível agora: só Haiku, Sonnet e Opus (mais recentes) aparecem.</AlertDescription>
        </Alert>
      )}
      {erro && (
        <Alert>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dados.etapas.map((e) => (
          <CartaoEtapaModelos
            key={e.id}
            etapa={e}
            dados={dados}
            emSalvamento={emSalvamento}
            abrir={() => {
              setEtapaDoPainel(e.id)
              setPainelAberto(true)
            }}
            salvar={(...a) => void salvar(...a)}
          />
        ))}
      </div>
      <PainelEtapaModelos
        etapa={dados.etapas.find((e) => e.id === etapaDoPainel) ?? null}
        aberto={painelAberto}
        aoMudarAberto={setPainelAberto}
        dados={dados}
        emSalvamento={emSalvamento}
        salvar={(...a) => void salvar(...a)}
      />
      <p className="text-sm">
        <Link href="/admin/projetos" className="text-muted-foreground hover:text-foreground underline underline-offset-2">
          Ver o custo por modelo em Projetos
        </Link>
      </p>
    </section>
  )
}
