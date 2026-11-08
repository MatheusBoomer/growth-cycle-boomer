"use client"

import { FRASES_ESFORCO, ROTULOS_ESFORCO, type EscolhaModelo } from "@workspace/core/modelos"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import type { ConfigModelos, EtapaConfiguravel } from "@/lib/api"
import { ROTULOS_ALVO, escolhaAoTrocarModelo, escolhaSalva, esforcosDoModelo, foraDaLista, sugestaoVisivel, textoAlteracao, textoSugestao } from "@/lib/celula-modelo"
import { SeloModelo } from "./selo-modelo"

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
    <section className="flex flex-col gap-2.5" aria-label={rotulo}>
      <h3 className="text-sm font-medium">{rotulo}</h3>
      <Select
        items={itensModelo}
        value={atual.modelo ?? PADRAO}
        disabled={salvando}
        onValueChange={(v) => salvar(etapa.id, alvo, escolhaAoTrocarModelo(atual, v === null || v === PADRAO ? null : v, lista))}
      >
        <SelectTrigger className="w-full" aria-label={`Modelo da ${nomeAgente}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="min-w-72">
          {itensModelo.map((i) => (
            <SelectItem key={i.value} value={i.value} className="items-start py-1.5">
              <span className="flex flex-col items-start gap-1 whitespace-normal">
                {i.label}
                {i.descricao && <span className="text-muted-foreground text-xs">{i.descricao}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
        <div className="bg-muted/60 flex flex-col gap-1.5 rounded-lg px-2.5 py-2 text-xs">
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
              <SheetTitle>{etapa.rotulo}</SheetTitle>
              <SheetDescription>Vale a partir do próximo turno desta etapa. Padrão deixa a escolha com o Claude Code.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-4">
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
