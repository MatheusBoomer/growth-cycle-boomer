"use client"

import { ALVO_PRINCIPAL, type EscolhaModelo } from "@workspace/core/modelos"
import { Button } from "@workspace/ui/components/button"
import type { ConfigModelos, EtapaConfiguravel } from "@/lib/api"
import { ROTULOS_ALVO, escolhaSalva, sugestaoVisivel, textoRodape, textoSelo, textoSugestao } from "@/lib/celula-modelo"
import { BarraEsforco } from "./barra-esforco"
import { SeloModelo } from "./selo-modelo"

interface Props {
  etapa: EtapaConfiguravel
  dados: ConfigModelos
  /** Chave `<etapa>/<alvo>` do salvamento em andamento, ou nulo. */
  emSalvamento: string | null
  abrir: () => void
  salvar: (etapa: EtapaConfiguravel["id"], alvo: string, escolha: EscolhaModelo) => void
}

/** Cartão de uma etapa: selo e esforço de cada agente, sugestões pendentes e o resumo de uso. O cartão inteiro abre o painel. */
export function CartaoEtapaModelos({ etapa, dados, emSalvamento, abrir, salvar }: Props) {
  const { lista, sugestoes, uso } = dados
  const rodape = textoRodape(uso[etapa.id], lista)
  const pendentes = etapa.alvos.flatMap((alvo) => {
    const sugestao = sugestoes.find((s) => s.etapa === etapa.id && s.alvo === alvo)
    return sugestao && sugestaoVisivel(sugestao, escolhaSalva(dados.config, etapa.id, alvo)) ? [{ alvo, sugestao }] : []
  })

  return (
    <div className="bg-card text-card-foreground hover:border-foreground/30 focus-within:ring-ring/50 relative flex flex-col gap-3 rounded-xl border p-4 transition-colors focus-within:ring-3">
      <h3 className="font-heading text-sm font-medium">
        {/* O botão cobre o cartão todo (after:absolute); a sugestão fica acima dele (z-10) para o Aplicar continuar clicável. */}
        <button type="button" onClick={abrir} className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl" aria-label={`Editar modelos da etapa ${etapa.rotulo}`}>
          {etapa.rotulo}
        </button>
      </h3>
      <ul className="flex flex-col gap-2.5">
        {etapa.alvos.map((alvo) => {
          const salvo = escolhaSalva(dados.config, etapa.id, alvo)
          return (
            <li key={alvo} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{ROTULOS_ALVO[alvo] ?? alvo}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <SeloModelo modelo={salvo.modelo} lista={lista} />
                <BarraEsforco esforco={salvo.esforco} />
              </span>
            </li>
          )
        })}
      </ul>
      {pendentes.map(({ alvo, sugestao }) => (
        <div key={alvo} className="bg-muted/60 relative z-10 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs">
          <span>
            {textoSugestao(sugestao, lista, alvo === ALVO_PRINCIPAL ? undefined : (ROTULOS_ALVO[alvo] ?? alvo).split(" · ")[0])}
          </span>
          <Button variant="outline" size="xs" disabled={emSalvamento === `${etapa.id}/${alvo}`} onClick={() => salvar(etapa.id, alvo, { modelo: sugestao.modelo, esforco: sugestao.esforco })}>
            Aplicar
          </Button>
        </div>
      ))}
      <div className="text-muted-foreground mt-auto flex flex-col border-t pt-2 text-xs">
        {rodape.map((linha) => (
          <span key={linha}>{linha}</span>
        ))}
      </div>
    </div>
  )
}
