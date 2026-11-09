"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import { normalizarEmail } from "@workspace/core/papeis"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { AvatarPessoa } from "@/components/marca/avatar-pessoa"
import { formatarDataHora, type EtapaRotulada } from "./comuns"

type Linha = PainelMetricas["porProjeto"][number]
type Aba = "andamento" | "concluidos" | "todos"
type Coluna = "nome" | "dono" | "etapa" | "usd" | "tempo" | "atividade"
interface Ordem {
  coluna: Coluna
  sentido: "asc" | "desc"
}

/** Primeiro clique: texto e etapa de A a Z, números e datas do maior para o menor. */
const SENTIDO_INICIAL: Record<Coluna, Ordem["sentido"]> = { nome: "asc", dono: "asc", etapa: "asc", usd: "desc", tempo: "desc", atividade: "desc" }

const COLUNAS: Array<{ coluna: Coluna; rotulo: string; direita?: boolean }> = [
  { coluna: "nome", rotulo: "Projeto" },
  { coluna: "dono", rotulo: "Analista" },
  { coluna: "etapa", rotulo: "Etapa atual" },
  { coluna: "usd", rotulo: "Custo", direita: true },
  { coluna: "tempo", rotulo: "Tempo útil", direita: true },
  { coluna: "atividade", rotulo: "Atividade" },
]

const ABAS: Array<{ valor: Aba; rotulo: string; vale: (p: Linha) => boolean }> = [
  { valor: "andamento", rotulo: "Em andamento", vale: (p) => p.ativo },
  { valor: "concluidos", rotulo: "Concluídos", vale: (p) => !p.ativo },
  { valor: "todos", rotulo: "Todos", vale: () => true },
]

function instante(iso: string | null): number | null {
  const ms = iso === null ? Number.NaN : Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/** Valor de ordenação da coluna; `null` (sem dono, sem etapa, sem atividade) vai sempre para o fim. */
function chaveDaColuna(p: Linha, coluna: Coluna, ordemDasEtapas: string[]): string | number | null {
  switch (coluna) {
    case "nome":
      return p.nome
    case "dono":
      return p.dono === null ? null : nomeCurto(p.dono)
    case "etapa": {
      const i = p.etapaAtual === null ? -1 : ordemDasEtapas.indexOf(p.etapaAtual)
      return i < 0 ? null : i
    }
    case "usd":
      return p.usd
    case "tempo":
      return p.tempoUtilSeg
    case "atividade":
      return instante(p.ultimaAtividade)
  }
}

export function ordenarLinhas(lista: Linha[], { coluna, sentido }: Ordem, ordemDasEtapas: string[]): Linha[] {
  const fator = sentido === "asc" ? 1 : -1
  return [...lista].sort((a, b) => {
    const ka = chaveDaColuna(a, coluna, ordemDasEtapas)
    const kb = chaveDaColuna(b, coluna, ordemDasEtapas)
    if (ka === null && kb === null) return a.nome.localeCompare(b.nome, "pt-BR")
    if (ka === null) return 1
    if (kb === null) return -1
    const cmp = typeof ka === "string" && typeof kb === "string" ? ka.localeCompare(kb, "pt-BR") : (ka as number) - (kb as number)
    return cmp * fator || a.nome.localeCompare(b.nome, "pt-BR")
  })
}

interface Props {
  projetos: Linha[]
  etapas: EtapaRotulada[]
  /** Foto de cada dono, pelo e-mail em minúsculas. */
  avatares: Record<string, string>
  /** Há filtro de analista, projeto, etapa ou modelo no painel: a mensagem de lista vazia fala dos filtros. */
  filtrado?: boolean
}

/** Lista de projetos do painel, em abas, com busca e ordenação; a linha leva ao detalhe do projeto. */
export function ListaProjetos({ projetos, etapas, avatares, filtrado = false }: Props) {
  const roteador = useRouter()
  const [aba, setAba] = useState<Aba>("andamento")
  const [busca, setBusca] = useState("")
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "atividade", sentido: "desc" })
  const ordemDasEtapas = useMemo(() => etapas.map((e) => e.id as string), [etapas])
  const rotuloDaEtapa = (id: string) => etapas.find((e) => e.id === id)?.rotulo ?? id

  const termo = busca.trim().toLowerCase()
  const visiveis = (valor: Aba) => {
    const vale = ABAS.find((a) => a.valor === valor)!.vale
    return ordenarLinhas(
      projetos.filter((p) => vale(p) && p.nome.toLowerCase().includes(termo)),
      ordem,
      ordemDasEtapas,
    )
  }

  const ordenarPor = (coluna: Coluna) =>
    setOrdem((atual) => (atual.coluna === coluna ? { coluna, sentido: atual.sentido === "asc" ? "desc" : "asc" } : { coluna, sentido: SENTIDO_INICIAL[coluna] }))

  const ir = (slug: string) => roteador.push(`/admin/projetos/${encodeURIComponent(slug)}`)

  const tabela = (linhas: Linha[]) => {
    if (linhas.length === 0) {
      const comFiltro = filtrado || termo !== ""
      const mensagem = comFiltro ? "Nenhum projeto com esses filtros." : projetos.length === 0 ? "Nenhum projeto ainda." : "Nenhum projeto nesta aba."
      return <p className="text-muted-foreground py-6 text-sm">{mensagem}</p>
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {COLUNAS.map((c) => {
              const ativa = ordem.coluna === c.coluna
              return (
                <TableHead key={c.coluna} aria-sort={ativa ? (ordem.sentido === "asc" ? "ascending" : "descending") : "none"} className={c.direita ? "text-right" : undefined}>
                  <button
                    type="button"
                    onClick={() => ordenarPor(c.coluna)}
                    className="hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none focus-visible:ring-3"
                  >
                    {c.rotulo}
                    {ativa && (ordem.sentido === "asc" ? <ArrowUpIcon className="size-3" aria-hidden="true" /> : <ArrowDownIcon className="size-3" aria-hidden="true" />)}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((p) => {
            const nomeDono = p.dono ? nomeCurto(p.dono) : "Sem dono"
            return (
              <TableRow key={p.slug} className="cursor-pointer" onClick={() => ir(p.slug)}>
                <TableCell className="font-medium">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/admin/projetos/${encodeURIComponent(p.slug)}`}
                      onClick={(ev) => ev.stopPropagation()}
                      title={p.nome}
                      className="focus-visible:ring-ring/50 block max-w-64 truncate rounded-sm hover:underline focus-visible:ring-3 focus-visible:outline-none"
                    >
                      {p.nome}
                    </Link>
                    {p.teste && (
                      <Badge variant="secondary" className="shrink-0">
                        teste
                      </Badge>
                    )}
                    {p.pendencias > 0 && <Badge variant="aviso" className="shrink-0">{p.pendencias === 1 ? "1 pendência" : `${p.pendencias} pendências`}</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <AvatarPessoa email={p.dono} nome={nomeDono} fotoUrl={p.dono === null ? undefined : avatares[normalizarEmail(p.dono)]} tamanho="sm" />
                    <span className="max-w-40 truncate">{nomeDono}</span>
                  </div>
                </TableCell>
                <TableCell>{p.etapaAtual === null ? <span className="text-muted-foreground">Concluído</span> : rotuloDaEtapa(p.etapaAtual)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarUsd(p.usd)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarDuracao(p.tempoUtilSeg)}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatarDataHora(p.ultimaAtividade)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <section aria-label="Projetos" className="flex flex-col gap-3">
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <TabsList>
            {ABAS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                {a.rotulo}
                <span className="text-muted-foreground tabular-nums">{projetos.filter(a.vale).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar por nome" aria-label="Buscar projeto por nome" className="max-w-64" />
        </div>
        {ABAS.map((a) => (
          <TabsContent key={a.valor} value={a.valor}>
            {a.valor === aba && tabela(visiveis(a.valor))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
