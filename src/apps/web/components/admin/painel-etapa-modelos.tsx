"use client"

import { FRASES_ESFORCO, ROTULOS_ESFORCO, type EscolhaModelo } from "@workspace/core/modelos"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import type { ConfigModelos, EtapaConfiguravel } from "@/lib/api"
import { ROTULOS_ALVO, escolhaAoTrocarModelo, escolhaSalva, esforcosDoModelo, foraDaLista, sugestaoVisivel, textoAlteracao, textoSugestao } from "@/lib/celula-modelo"
import { SeloModelo } from "./selo-modelo"
import { cn } from "@workspace/ui/lib/utils"
import { TituloDestacado } from "@/components/trabalho/barra-visualizador"

const PADRAO = "__padrao__"
type Salvar = (etapa: EtapaConfiguravel["id"], alvo: string, escolha: EscolhaModelo) => void

interface PropsAgente {
  etapa: EtapaConfiguravel
  alvo: string
  dados: ConfigModelos
  salvando: boolean
  salvar: Salvar
}

/** Modelo e esforço de um agente da etapa, com a sugestão, o atalho para o padrão e o aviso de modelo fora da lista. */
function AgenteNoPainel({ etapa, alvo, dados, salvando, salvar }: PropsAgente) {
  const { lista, config, sugestoes } = dados
  const atual = escolhaSalva(config, etapa.id, alvo)
  const linha = config.find((l) => l.etapa === etapa.id && l.alvo === alvo)
  const sugestao = sugestoes.find((s) => s.etapa === etapa.id && s.alvo === alvo)
  const fora = foraDaLista(lista, atual.modelo)
  const niveis = esforcosDoModelo(lista, atual.modelo)
  const alteracao = textoAlteracao(linha)
  const rotulo = ROTULOS_ALVO[alvo] ?? alvo
  const nomeAgente = `etapa ${etapa.id}, ${rotulo}`

  // O `items` diz ao seletor o que mostrar no campo fechado; o modelo fora da lista entra com o próprio nome, para continuar visível.
  const itensModelo = [
    { value: PADRAO, modelo: null as string | null, descricao: "" },
    ...lista.modelos.map((m) => ({ value: m.value, modelo: m.value as string | null, descricao: m.descricao })),
    ...(fora && atual.modelo !== null ? [{ value: atual.modelo, modelo: atual.modelo as string | null, descricao: "" }] : []),
  ].map((i) => ({ ...i, label: <SeloModelo modelo={i.modelo} lista={lista} /> }))
  const itensEsforco = [
    { value: PADRAO, label: "Padrão" },
    ...niveis.map((n) => ({ value: n as string, label: ROTULOS_ESFORCO[n] })),
  ]

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-border px-3.5 py-3" aria-label={rotulo}>
      <h3 className="text-[13px] font-medium">{rotulo}</h3>
      <div role="radiogroup" aria-label={`Modelo da ${nomeAgente}`} className="flex flex-wrap gap-1 rounded-[18px] border border-border p-[3px]">
        {itensModelo.map((i) => {
          const marcado = (atual.modelo ?? PADRAO) === i.value
          return (
            <button
              key={i.value}
              type="button"
              role="radio"
              aria-checked={marcado}
              disabled={salvando}
              title={i.descricao || undefined}
              onClick={() => !marcado && salvar(etapa.id, alvo, escolhaAoTrocarModelo(atual, i.value === PADRAO ? null : i.value, lista))}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                marcado && "bg-foreground text-background hover:text-background",
              )}
            >
              {i.value === PADRAO ? "Padrão" : <SeloModelo modelo={i.modelo} lista={lista} />}
            </button>
          )
        })}
      </div>
      <Select
        items={itensEsforco}
        value={atual.esforco ?? PADRAO}
        disabled={salvando || niveis.length === 0}
        onValueChange={(v) => salvar(etapa.id, alvo, { modelo: atual.modelo, esforco: v === null || v === PADRAO ? null : (niveis.find((n) => n === v) ?? null) })}
      >
        <SelectTrigger className="w-full" aria-label={`Esforço da ${nomeAgente}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {itensEsforco.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        {niveis.length === 0 ? "Este modelo não aceita esforço." : FRASES_ESFORCO[atual.esforco ?? "padrao"]}
      </p>
      {fora && <p className="text-destructive text-xs">modelo não está mais na lista</p>}
      {sugestao && sugestaoVisivel(sugestao, atual) && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-primary/7 px-3 py-2.5 text-xs">
          <span>{textoSugestao(sugestao, lista)}</span>
          <Button variant="outline" size="xs" className="self-start" disabled={salvando} onClick={() => salvar(etapa.id, alvo, { modelo: sugestao.modelo, esforco: sugestao.esforco })}>
            Aplicar
          </Button>
        </div>
      )}
      {(atual.modelo !== null || atual.esforco !== null) && (
        <Button variant="ghost" size="xs" className="self-start" disabled={salvando} onClick={() => salvar(etapa.id, alvo, { modelo: null, esforco: null })}>
          Voltar ao padrão
        </Button>
      )}
      {alteracao && <p className="text-muted-foreground text-xs">{alteracao}</p>}
    </section>
  )
}

interface Props {
  etapa: EtapaConfiguravel | null
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  dados: ConfigModelos
  emSalvamento: string | null
  salvar: Salvar
}

/** Painel lateral com a edição de modelo e esforço de todos os agentes de uma etapa. Cada mudança salva na hora. */
export function PainelEtapaModelos({ etapa, aberto, aoMudarAberto, dados, emSalvamento, salvar }: Props) {
  return (
    <Sheet open={aberto} onOpenChange={aoMudarAberto}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {etapa && (
          <>
            <SheetHeader>
              <SheetTitle>
                <TituloDestacado texto={etapa.rotulo} />
              </SheetTitle>
              <SheetDescription>Vale a partir do próximo turno desta etapa. Padrão deixa a escolha com o Claude Code.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-6 pb-6">
              {etapa.alvos.map((alvo) => (
                <AgenteNoPainel key={alvo} etapa={etapa} alvo={alvo} dados={dados} salvando={emSalvamento === `${etapa.id}/${alvo}`} salvar={salvar} />
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
