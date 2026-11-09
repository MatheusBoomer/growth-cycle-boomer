"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api, mensagemDeErro, type ProjetoComMetricas, type RespostaPainel } from "@/lib/api"
import { filtroDeParametros, parametrosDeFiltro, type PeriodoRapido } from "@/lib/painel-filtro"
import { painelParaCsv } from "@/lib/painel-csv"
import { BarraFiltros } from "./painel/barra-filtros"
import { TEXTO_SEM_USO, type EtapaRotulada } from "./painel/comuns"
import { GraficosPainel } from "./painel/graficos-painel"
import { ListaProjetos } from "./painel/lista-projetos"
import { NumerosGrandes } from "./painel/numeros-grandes"

// Reexportados porque o detalhe do projeto e os testes importam daqui.
export { MarcaEstimado, formatarDataHora, type EtapaRotulada } from "./painel/comuns"

const CAMINHO = "/admin/projetos"

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

/** Selo da média de uma etapa com poucos projetos na base. */
export const ROTULO_BASE_PEQUENA = "base pequena, menos de 5 projetos"

/** Como o período está na URL: `periodo=` válido, `de`/`ate` aceitos pelo leitor, ou o padrão de 30 dias. */
function periodoDaUrl(p: URLSearchParams, f: FiltroPainel): PeriodoRapido | "custom" {
  const rapido = p.get("periodo")
  if (rapido === "7d" || rapido === "30d" || rapido === "90d" || rapido === "ano") return rapido
  return p.get("de") === f.de && p.get("ate") === f.ate ? "custom" : "30d"
}

function alternar(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
}

function baixarCsv(r: RespostaPainel): void {
  const url = URL.createObjectURL(new Blob([painelParaCsv(r)], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `projetos-${r.painel.periodo.de}_a_${r.painel.periodo.ate}.csv`
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Aba "Projetos": filtros (na URL), números do período, gráficos e a lista de projetos. */
export function PainelProjetos({ etapas }: { etapas: EtapaRotulada[] }) {
  const roteador = useRouter()
  const parametros = useSearchParams()
  const consulta = parametros.toString()
  const { filtro, periodo } = useMemo(() => {
    const p = new URLSearchParams(consulta)
    const f = filtroDeParametros(p, new Date())
    return { filtro: f, periodo: periodoDaUrl(p, f) }
  }, [consulta])

  const [resposta, setResposta] = useState<RespostaPainel | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tentativa, setTentativa] = useState(0)
  const forcarAtualizacao = useRef(false)

  useEffect(() => {
    let ativo = true
    const pedido = parametrosDeFiltro(filtro, periodo)
    if (forcarAtualizacao.current) {
      pedido.set("atualizar", "1")
      forcarAtualizacao.current = false
    }
    setCarregando(true)
    api
      .painelMetricas(pedido)
      .then((r) => {
        if (!ativo) return
        setResposta(r)
        setErro(null)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(mensagemDeErro(e))
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [filtro, periodo, tentativa])

  const gravarNaUrl = useCallback((p: URLSearchParams) => roteador.replace(`${CAMINHO}?${p.toString()}`, { scroll: false }), [roteador])
  const atualizar = useCallback(() => {
    forcarAtualizacao.current = true
    setTentativa((n) => n + 1)
  }, [])
  const aoFiltrar = useCallback(
    ({ etapa, projeto }: { etapa?: string; projeto?: string }) =>
      gravarNaUrl(
        parametrosDeFiltro(
          {
            ...filtro,
            etapas: etapa === undefined ? filtro.etapas : alternar(filtro.etapas, etapa),
            projetos: projeto === undefined ? filtro.projetos : alternar(filtro.projetos, projeto),
          },
          periodo,
        ),
      ),
    [filtro, periodo, gravarNaUrl],
  )

  if (erro) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!resposta) return <Skeleton className="h-64 w-full" />

  const { painel, opcoes, avatares } = resposta
  const semUso = painel.totais.custoUsd === 0 && painel.totais.tempoUtilSeg === 0 && painel.porProjeto.every((p) => p.usd === 0 && p.tempoUtilSeg === 0)

  return (
    <div className="flex flex-col gap-6" aria-busy={carregando}>
      <BarraFiltros
        filtro={filtro}
        periodo={periodo}
        opcoes={opcoes}
        etapas={etapas}
        aoMudar={gravarNaUrl}
        aoAtualizar={atualizar}
        aoExportar={() => baixarCsv(resposta)}
        atualizando={carregando}
      />
      <div className={carregando ? "flex flex-col gap-6 opacity-60 transition-opacity" : "flex flex-col gap-6"}>
        {semUso ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{TEXTO_SEM_USO}</EmptyTitle>
              <EmptyDescription>Troque o período ou limpe os filtros para ver outros dados.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <NumerosGrandes painel={painel} />
            <GraficosPainel painel={painel} avatares={avatares} filtro={filtro} aoFiltrar={aoFiltrar} />
          </>
        )}
        <ListaProjetos projetos={painel.porProjeto} etapas={etapas} avatares={avatares} />
      </div>
    </div>
  )
}
