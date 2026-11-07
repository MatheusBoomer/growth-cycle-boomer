"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import { compararComMedia, type MediaEtapa, type MetricasEtapa } from "@workspace/core/metricas/resumo"
import { tempoUtil } from "@workspace/core/metricas/tempo"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { api, mensagemDeErro, type DetalheProjeto as Detalhe } from "@/lib/api"
import { formatarDataHora, MarcaEstimado, type EtapaRotulada } from "./painel-projetos"

/** Comparação do custo e do tempo útil da etapa com a média das etapas concluídas; null quando não há como comparar. */
export function comparacoesDaEtapa(m: MetricasEtapa, media: MediaEtapa | undefined): { custo: string | null; tempo: string | null } {
  if (!media) return { custo: null, tempo: null }
  return {
    custo: m.custo.usd > 0 ? compararComMedia(m.custo.usd, media.custo?.media) : null,
    // Sem aviso de presença o tempo é só o do agente: compará-lo com uma média de pessoas enganaria.
    tempo: m.temPresenca ? compararComMedia(tempoUtil(m.tempo), media.tempoUtil?.media) : null,
  }
}

function Numero({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <dt className="text-muted-foreground text-xs font-medium">{rotulo}</dt>
      <dd className="text-xl font-semibold tracking-tight tabular-nums">{children}</dd>
    </div>
  )
}

/** Detalhe de um projeto: os quatro totais, o custo e o tempo por etapa (com a comparação com a média) e por pessoa. */
export function DetalheProjeto({ slug, etapas }: { slug: string; etapas: EtapaRotulada[] }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    // As médias entram aqui (a comparação por etapa precisa delas); o selo da barra as dispensa.
    api
      .metricasDoProjeto(slug, { medias: true })
      .then((d) => {
        if (ativo) setDetalhe(d)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(mensagemDeErro(e))
      })
    return () => {
      ativo = false
    }
  }, [slug])

  if (erro) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!detalhe) return <Skeleton className="h-64 w-full" />

  const { projeto, metricas, medias } = detalhe
  const semUso = metricas.ultimaAtividade === null
  const linhas = etapas.flatMap((e) => {
    const m = metricas.porEtapa[e.id]
    return m ? [{ etapa: e, m }] : []
  })

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/projetos" className="text-muted-foreground hover:text-foreground text-xs font-medium">
              Todos os projetos
            </Link>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{projeto.nome}</h2>
            <p className="text-muted-foreground text-sm">
              {projeto.dono ? nomeCurto(projeto.dono) : "Sem dono"} · {projeto.rotuloEtapaAtual} · última atividade {formatarDataHora(metricas.ultimaAtividade).toLowerCase()}
            </p>
          </div>
          <Button render={<Link href={`/prospects/${encodeURIComponent(slug)}`} />} nativeButton={false}>
            Abrir projeto
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo="Custo total">
            {formatarUsd(metricas.custoUsd)}
            {metricas.estimado && <MarcaEstimado />}
          </Numero>
          <Numero rotulo="Tempo útil">{formatarDuracao(tempoUtil(metricas.tempo))}</Numero>
          <Numero rotulo="Tempo aberto">{formatarDuracao(tempoUtil(metricas.tempo) + metricas.tempo.ocioso)}</Numero>
          <Numero rotulo="Descartado">{formatarDuracao(metricas.tempo.descartado)}</Numero>
        </dl>
      </section>

      {semUso ? (
        <p className="text-muted-foreground text-sm">Sem uso registrado ainda</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold tracking-tight">Por etapa</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Turnos</TableHead>
                  <TableHead>Modelos</TableHead>
                  <TableHead className="text-right">Agente</TableHead>
                  <TableHead className="text-right">Analista ativo</TableHead>
                  <TableHead className="text-right">Ocioso</TableHead>
                  <TableHead>Comparação com a média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map(({ etapa, m }) => {
                  const comparacao = comparacoesDaEtapa(m, medias?.[etapa.id])
                  const modelos = Object.entries(m.custo.modelos)
                  return (
                    <TableRow key={etapa.id}>
                      <TableCell className="font-medium">{etapa.rotulo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatarUsd(m.custo.usd)}
                        {m.custo.estimado && <MarcaEstimado />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.custo.turnos}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {modelos.length === 0 ? "Sem detalhe" : modelos.map(([modelo, usd]) => <div key={modelo}>{modelo}: {formatarUsd(usd)}</div>)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(m.tempo.agente)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(m.tempo.ativo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(m.tempo.ocioso)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {comparacao.custo && <div>Custo: {comparacao.custo}</div>}
                        {comparacao.tempo && <div>Tempo útil: {comparacao.tempo}</div>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold tracking-tight">Por pessoa</h2>
            {metricas.porPessoa.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma pessoa registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead className="text-right">Custo dos turnos</TableHead>
                    <TableHead className="text-right">Tempo ativo</TableHead>
                    <TableHead className="text-right">Ocioso</TableHead>
                    <TableHead className="text-right">Descartado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricas.porPessoa.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell className="font-medium">{nomeCurto(p.email)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarUsd(p.custoUsd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(p.tempo.ativo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(p.tempo.ocioso)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarDuracao(p.tempo.descartado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
