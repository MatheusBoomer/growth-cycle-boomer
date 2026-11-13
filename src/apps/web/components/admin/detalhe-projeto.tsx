"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { ListaDeModelos } from "@workspace/core/modelos"
import { compararComMedia, type MediaEtapa, type MetricasEtapa } from "@workspace/core/metricas/resumo"
import { tempoUtil } from "@workspace/core/metricas/tempo"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { api, mensagemDeErro, type DetalheProjeto as Detalhe } from "@/lib/api"
import { Termo } from "./legenda-termos"
import { formatarDataHora, MarcaEstimado, type EtapaRotulada } from "./painel-projetos"
import { SeloModelo } from "./selo-modelo"
import { AvisoAdmin } from "@/components/admin/aviso-admin"
import { TituloDestacado } from "@/components/trabalho/barra-visualizador"
import { partesDoRotulo } from "@/lib/home"

/** O que a coluna de modelos mostra quando a etapa não tem custo por modelo: custo só estimado (linhas antigas) ou sem o detalhe. */
export function textoSemModelos(m: MetricasEtapa): string {
  return m.custo.estimado ? "não registrado" : "Sem detalhe"
}

/** Comparação do custo e do tempo útil da etapa com a média das etapas concluídas; null quando não há como comparar. */
export function comparacoesDaEtapa(m: MetricasEtapa, media: MediaEtapa | undefined): { custo: string | null; tempo: string | null } {
  if (!media) return { custo: null, tempo: null }
  return {
    custo: m.custo.usd > 0 ? compararComMedia(m.custo.usd, media.custo?.media) : null,
    // Sem aviso de presença o tempo é só o do agente: compará-lo com uma média de pessoas enganaria.
    tempo: m.temPresenca ? compararComMedia(tempoUtil(m.tempo), media.tempoUtil?.media) : null,
  }
}

/** Enquanto a lista de modelos não chega (ou se falhar), o selo se vira com o id do modelo. */
const SEM_LISTA: ListaDeModelos = { modelos: [], padrao: null, completa: false }

/** Largura da barra em %: a fração do maior valor; 0 quando não há maior (tudo zerado). */
export function larguraDaBarra(valor: number, maior: number): number {
  return maior > 0 ? Math.min(100, Math.max(0, (valor / maior) * 100)) : 0
}

/** Barra fina e decorativa ao lado de um número; o número continua no texto, para quem não enxerga a barra. */
function BarraCusto({ tipo, valor, maior }: { tipo: "custo-etapa" | "custo-pessoa"; valor: number; maior: number }) {
  return (
    <div aria-hidden="true" className="bg-muted mt-1 ml-auto h-1 w-24 overflow-hidden rounded-full">
      <div data-barra={tipo} className="bg-primary h-full rounded-full" style={{ width: `${larguraDaBarra(valor, maior)}%` }} />
    </div>
  )
}

function Numero({ rotulo, children }: { rotulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[18px] border border-border bg-muted/30 px-4 py-3.5">
      <dt className="text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-1.5 text-[30px] leading-none font-medium tracking-[-0.03em] tabular-nums">{children}</dd>
    </div>
  )
}

/** Detalhe de um projeto: os quatro totais, o custo e o tempo por etapa (com a comparação com a média) e por pessoa. */
export function DetalheProjeto({ slug, etapas }: { slug: string; etapas: EtapaRotulada[] }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lista, setLista] = useState<ListaDeModelos | null>(null)

  useEffect(() => {
    let ativo = true
    // Só para rotular o selo do modelo; sem a lista (falha ou conta sem acesso) o selo mostra o id.
    api
      .configModelos()
      .then((c) => {
        if (ativo) setLista(c.lista)
      })
      .catch(() => {})
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
      <AvisoAdmin mensagem={erro} aba="detalhe" />
    )
  }
  if (!detalhe) return <Skeleton className="h-64 w-full" />

  const { projeto, metricas, medias } = detalhe
  const semUso = metricas.ultimaAtividade === null
  const linhas = etapas.flatMap((e) => {
    const m = metricas.porEtapa[e.id]
    return m ? [{ etapa: e, m }] : []
  })

  const maiorCustoEtapa = Math.max(0, ...linhas.map(({ m }) => m.custo.usd))
  const maiorCustoPessoa = Math.max(0, ...metricas.porPessoa.map((p) => p.custoUsd))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/projetos" className="text-muted-foreground hover:text-foreground text-xs font-medium">
              Todos os projetos
            </Link>
            <h2 className="mt-1 text-[30px] leading-[1.1] font-medium tracking-[-0.03em] [&_em]:text-[33px]">
              <TituloDestacado texto={projeto.nome} />
            </h2>
            <p className="text-muted-foreground text-sm">
              {projeto.dono ? nomeCurto(projeto.dono) : "Sem dono"} · {projeto.rotuloEtapaAtual} · última atividade {formatarDataHora(metricas.ultimaAtividade).toLowerCase()}
            </p>
          </div>
          <Button variant="outline" render={<Link href={`/prospects/${encodeURIComponent(slug)}`} />} nativeButton={false}>
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
          <Numero rotulo={<Termo id="descartado">Descartado</Termo>}>{formatarDuracao(metricas.tempo.descartado)}</Numero>
        </dl>
      </section>

      {semUso ? (
        <p className="rounded-[18px] border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">Sem uso registrado ainda</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-medium">
              Por <em className="font-serif text-[17px] font-normal text-link-acao italic">etapa</em>
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Turnos</TableHead>
                  <TableHead>Modelos</TableHead>
                  <TableHead className="text-right">
                    <Termo id="agente">Agente</Termo>
                  </TableHead>
                  <TableHead className="text-right">
                    <Termo id="ativo">Analista ativo</Termo>
                  </TableHead>
                  <TableHead className="text-right">
                    <Termo id="ocioso">Ocioso</Termo>
                  </TableHead>
                  <TableHead>Comparação com a média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map(({ etapa, m }) => {
                  const comparacao = comparacoesDaEtapa(m, medias?.[etapa.id])
                  const modelos = Object.entries(m.custo.modelos)
                  return (
                    <TableRow key={etapa.id}>
                      <TableCell className="font-medium">
                        <EtapaComNumero rotulo={etapa.rotulo} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">
                        {formatarUsd(m.custo.usd)}
                        {m.custo.estimado && <MarcaEstimado />}
                        <BarraCusto tipo="custo-etapa" valor={m.custo.usd} maior={maiorCustoEtapa} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{m.custo.turnos}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {modelos.length === 0 ? textoSemModelos(m) : modelos.map(([modelo, usd]) => (
                          <div key={modelo} className="flex items-center gap-1.5 py-0.5">
                            <SeloModelo modelo={modelo} lista={lista ?? SEM_LISTA} />
                            <span className="font-mono tabular-nums">{formatarUsd(usd)}</span>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(m.tempo.agente)}</TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(m.tempo.ativo)}</TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(m.tempo.ocioso)}</TableCell>
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
            <h2 className="text-[15px] font-medium">
              Por <em className="font-serif text-[17px] font-normal text-link-acao italic">pessoa</em>
            </h2>
            {metricas.porPessoa.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma pessoa registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead className="text-right">Custo dos turnos</TableHead>
                    <TableHead className="text-right">
                      <Termo id="ativo">Tempo ativo</Termo>
                    </TableHead>
                    <TableHead className="text-right">
                      <Termo id="ocioso">Ocioso</Termo>
                    </TableHead>
                    <TableHead className="text-right">
                      <Termo id="descartado">Descartado</Termo>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricas.porPessoa.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell className="font-medium">{nomeCurto(p.email)}</TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">
                        {formatarUsd(p.custoUsd)}
                        <BarraCusto tipo="custo-pessoa" valor={p.custoUsd} maior={maiorCustoPessoa} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(p.tempo.ativo)}</TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(p.tempo.ocioso)}</TableCell>
                      <TableCell className="text-right font-mono text-[12.5px] tabular-nums">{formatarDuracao(p.tempo.descartado)}</TableCell>
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

/** "03 · Diagnóstico de performance" com o número em mono e apagado. */
function EtapaComNumero({ rotulo }: { rotulo: string }) {
  const { numero, titulo } = partesDoRotulo(rotulo)
  return (
    <>
      {numero && <span className="mr-1.5 font-mono text-[11px] font-normal text-muted-foreground">{numero}</span>}
      {titulo}
    </>
  )
}
