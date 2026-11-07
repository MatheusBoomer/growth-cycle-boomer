"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { Estatistica, MediaEtapa } from "@workspace/core/metricas/resumo"
import { tempoUtil } from "@workspace/core/metricas/tempo"
import type { EtapaId } from "@workspace/core/tipos"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { api, mensagemDeErro, type MediasPorEtapa, type ProjetoComMetricas } from "@/lib/api"

export interface EtapaRotulada {
  id: EtapaId
  rotulo: string
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "Sem atividade"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "Sem atividade" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** Mais recente primeiro; projetos sem atividade no fim (por nome). Puro, para testar sem tela. */
export function ordenarPorAtividade(lista: ProjetoComMetricas[]): ProjetoComMetricas[] {
  const instante = (p: ProjetoComMetricas) => {
    const ms = p.metricas.ultimaAtividade ? Date.parse(p.metricas.ultimaAtividade) : Number.NaN
    return Number.isNaN(ms) ? null : ms
  }
  return [...lista].sort((a, b) => {
    const ia = instante(a)
    const ib = instante(b)
    if (ia === null && ib === null) return a.nome.localeCompare(b.nome, "pt-BR")
    if (ia === null) return 1
    if (ib === null) return -1
    return ib - ia
  })
}

/** Busca por nome, sem distinguir maiúsculas. */
export function filtrarPorNome(lista: ProjetoComMetricas[], busca: string): ProjetoComMetricas[] {
  const termo = busca.trim().toLowerCase()
  return lista.filter((p) => p.nome.toLowerCase().includes(termo))
}

export function MarcaEstimado() {
  return <span className="text-muted-foreground ml-1 text-xs font-normal">estimado</span>
}

function Estat({ e, formatar }: { e: Estatistica | null; formatar: (v: number) => string }) {
  if (!e) return <span className="text-muted-foreground">Sem dados</span>
  return (
    <div className="tabular-nums">
      <div className="font-medium">{formatar(e.media)}</div>
      <div className="text-muted-foreground text-xs">
        mediana {formatar(e.mediana)} · {formatar(e.min)} a {formatar(e.max)} · {e.n} {e.n === 1 ? "projeto" : "projetos"}
      </div>
    </div>
  )
}

function MediasPorEtapaTabela({ medias, etapas }: { medias: MediasPorEtapa; etapas: EtapaRotulada[] }) {
  const linhas = etapas.flatMap((e) => {
    const m: MediaEtapa | undefined = medias[e.id]
    return m ? [{ etapa: e, media: m }] : []
  })
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Médias por etapa</h2>
        <p className="text-muted-foreground text-sm">Etapas concluídas de projetos ativos, sem os clientes de teste.</p>
      </div>
      {linhas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ainda não há etapa concluída para calcular médias.</p>
      ) : (
        <>
          {linhas.some((l) => l.media.basePequena) && (
            <Alert>
              <AlertDescription>Base pequena: as etapas marcadas têm menos de 5 projetos em alguma das médias, então vale pouco como referência.</AlertDescription>
            </Alert>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Tempo útil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ etapa, media }) => (
                <TableRow key={etapa.id}>
                  <TableCell className="font-medium">
                    {etapa.rotulo}
                    {media.basePequena && (
                      <Badge variant="secondary" className="ml-2">
                        base pequena
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Estat e={media.custo} formatar={formatarUsd} />
                  </TableCell>
                  <TableCell>
                    <Estat e={media.tempoUtil} formatar={formatarDuracao} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </section>
  )
}

interface Dados {
  projetos: ProjetoComMetricas[]
  medias: MediasPorEtapa
}

/** Aba "Projetos": médias por etapa e a lista de projetos com custo, tempo útil e última atividade. */
export function PainelProjetos({ etapas }: { etapas: EtapaRotulada[] }) {
  const roteador = useRouter()
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")

  useEffect(() => {
    let ativo = true
    api
      .metricasGerais()
      .then((d) => {
        if (ativo) setDados(d)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(mensagemDeErro(e))
      })
    return () => {
      ativo = false
    }
  }, [])

  const projetos = useMemo(() => (dados ? filtrarPorNome(ordenarPorAtividade(dados.projetos), busca) : []), [dados, busca])

  if (erro) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!dados) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-8">
      <MediasPorEtapaTabela medias={dados.medias} etapas={etapas} />
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Projetos</h2>
          <Input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar por nome" aria-label="Buscar projeto por nome" className="max-w-64" />
        </div>
        {projetos.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dados.projetos.length === 0 ? "Nenhum projeto ainda." : "Nenhum projeto com esse nome."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Dono</TableHead>
                <TableHead>Etapa atual</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right">Tempo útil</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos.map((p) => (
                <TableRow key={p.slug} className="cursor-pointer" onClick={() => roteador.push(`/admin/projetos/${encodeURIComponent(p.slug)}`)}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/projetos/${encodeURIComponent(p.slug)}`}
                      onClick={(ev) => ev.stopPropagation()}
                      className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {p.nome}
                    </Link>
                    {p.teste && (
                      <Badge variant="secondary" className="ml-2">
                        teste
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.dono ? nomeCurto(p.dono) : "Sem dono"}</TableCell>
                  <TableCell>{p.rotuloEtapaAtual}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarUsd(p.metricas.custoUsd)}
                    {p.metricas.estimado && <MarcaEstimado />}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatarDuracao(tempoUtil(p.metricas.tempo))}</TableCell>
                  <TableCell className="text-muted-foreground">{formatarDataHora(p.metricas.ultimaAtividade)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
