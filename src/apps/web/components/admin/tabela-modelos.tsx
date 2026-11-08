"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { ALVO_PRINCIPAL, NIVEIS_ESFORCO, SUBAGENTES_CONFIGURAVEIS, type EscolhaModelo, type NivelEsforco, type Sugestao } from "@workspace/core/modelos"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"
import type { EtapaId } from "@workspace/core/tipos"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { api, mensagemDeErro, type ConfigModelos, type EtapaConfiguravel } from "@/lib/api"
import { escolhaAoTrocarModelo, esforcosDoModelo, foraDaLista, textoAlteracao } from "@/lib/celula-modelo"

const PADRAO = "__padrao__"
const COLUNAS = [
  { alvo: ALVO_PRINCIPAL, rotulo: "Agente principal" },
  ...SUBAGENTES_CONFIGURAVEIS.map((s) => ({ alvo: s as string, rotulo: s as string })),
]

function esforcoValido(valor: string | null): NivelEsforco | null {
  return (NIVEIS_ESFORCO as readonly string[]).includes(valor ?? "") ? (valor as NivelEsforco) : null
}

interface PropsCelula {
  etapa: EtapaId
  alvo: string
  dados: ConfigModelos
  salvando: boolean
  salvar: (etapa: EtapaId, alvo: string, escolha: EscolhaModelo) => void
}

function CelulaModelo({ etapa, alvo, dados, salvando, salvar }: PropsCelula) {
  const { lista, config, sugestoes } = dados
  const linha: LinhaConfigModelo | undefined = config.find((l) => l.etapa === etapa && l.alvo === alvo)
  const atual: EscolhaModelo = { modelo: linha?.modelo ?? null, esforco: esforcoValido(linha?.esforco ?? null) }
  const sugestao: Sugestao | undefined = sugestoes.find((s) => s.etapa === etapa && s.alvo === alvo)
  const sugestaoJaAplicada = sugestao !== undefined && sugestao.modelo === atual.modelo && sugestao.esforco === atual.esforco
  const fora = foraDaLista(lista, atual.modelo)
  const niveis = esforcosDoModelo(lista, atual.modelo)
  const alteracao = textoAlteracao(linha)
  const nomeEtapa = `etapa ${etapa}, ${alvo}`

  // O `items` diz ao seletor o rótulo de cada valor; o modelo fora da lista entra com o próprio nome, para continuar visível.
  const itensModelo = [
    { value: PADRAO, label: "Padrão" },
    ...lista.modelos.map((m) => ({ value: m.value, label: m.nome })),
    ...(fora && atual.modelo !== null ? [{ value: atual.modelo, label: atual.modelo }] : []),
  ]
  const itensEsforco = [{ value: PADRAO, label: "Padrão" }, ...niveis.map((n) => ({ value: n as string, label: n as string }))]

  return (
    <div className="flex min-w-44 flex-col gap-1.5">
      <Select
        items={itensModelo}
        value={atual.modelo ?? PADRAO}
        disabled={salvando}
        onValueChange={(v) => salvar(etapa, alvo, escolhaAoTrocarModelo(atual, v === null || v === PADRAO ? null : v, lista))}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={`Modelo da ${nomeEtapa}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {itensModelo.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={itensEsforco}
        value={atual.esforco ?? PADRAO}
        disabled={salvando || niveis.length === 0}
        onValueChange={(v) => salvar(etapa, alvo, { modelo: atual.modelo, esforco: v === null || v === PADRAO ? null : esforcoValido(v) })}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={`Esforço da ${nomeEtapa}`}>
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
      {niveis.length === 0 && <p className="text-muted-foreground text-xs">Este modelo não aceita esforço.</p>}
      {fora && <p className="text-destructive text-xs">modelo não está mais na lista</p>}
      {sugestao && !sugestaoJaAplicada && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2" />}>
              Sugestão: {sugestao.modelo}
              {sugestao.esforco ? ` (${sugestao.esforco})` : ""}
            </TooltipTrigger>
            <TooltipContent>{sugestao.motivo}</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="xs" disabled={salvando} onClick={() => salvar(etapa, alvo, { modelo: sugestao.modelo, esforco: sugestao.esforco })}>
            Aplicar
          </Button>
        </div>
      )}
      {(atual.modelo !== null || atual.esforco !== null) && (
        <Button variant="ghost" size="xs" className="self-start" disabled={salvando} onClick={() => salvar(etapa, alvo, { modelo: null, esforco: null })}>
          Voltar ao padrão
        </Button>
      )}
      {alteracao && <p className="text-muted-foreground text-xs">{alteracao}</p>}
    </div>
  )
}

interface PropsLinha {
  etapa: EtapaConfiguravel
  dados: ConfigModelos
  emSalvamento: string | null
  salvar: PropsCelula["salvar"]
}

function LinhaDaEtapa({ etapa, dados, emSalvamento, salvar }: PropsLinha) {
  return (
    <TableRow>
      <TableCell className="align-top font-medium">{etapa.rotulo}</TableCell>
      {COLUNAS.map((c) => (
        <TableCell key={c.alvo} className="align-top">
          {etapa.alvos.includes(c.alvo) ? (
            <CelulaModelo etapa={etapa.id} alvo={c.alvo} dados={dados} salvando={emSalvamento === `${etapa.id}/${c.alvo}`} salvar={salvar} />
          ) : (
            <span className="text-muted-foreground text-sm">não usa</span>
          )}
        </TableCell>
      ))}
    </TableRow>
  )
}

/** Aba "Modelos": modelo e esforço do agente principal e dos subagentes de cada etapa, salvos na hora. */
export function TabelaModelos() {
  const [dados, setDados] = useState<ConfigModelos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [emSalvamento, setEmSalvamento] = useState<string | null>(null)

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
      <p className="text-muted-foreground text-sm">Vale a partir do próximo turno de cada etapa. Padrão deixa a escolha com o Claude Code.</p>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etapa</TableHead>
            {COLUNAS.map((c) => (
              <TableHead key={c.alvo}>{c.rotulo}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.etapas.map((e) => (
            <LinhaDaEtapa key={e.id} etapa={e} dados={dados} salvar={(...a) => void salvar(...a)} emSalvamento={emSalvamento} />
          ))}
        </TableBody>
      </Table>
      <p className="text-sm">
        <Link href="/admin/projetos" className="text-muted-foreground hover:text-foreground underline underline-offset-2">
          Ver o custo por modelo em Projetos
        </Link>
      </p>
    </section>
  )
}
