"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api, mensagemDeErro, type RespostaPainel } from "@/lib/api"
import { filtroDeParametros, parametrosDeFiltro, type PeriodoRapido } from "@/lib/painel-filtro"
import { painelParaCsv } from "@/lib/painel-csv"
import { BarraFiltros } from "./painel/barra-filtros"
import { EtapasPainelContext, type EtapaRotulada } from "./painel/comuns"
import { GraficosPainel } from "./painel/graficos-painel"
import { ListaProjetos } from "./painel/lista-projetos"
import { SecaoMediasPorEtapa } from "./painel/medias-por-etapa"
import { NumerosGrandes } from "./painel/numeros-grandes"
import { AvisoAdmin, ehSemNuvem } from "@/components/admin/aviso-admin"
import { EstadoVisualizador } from "@/components/trabalho/barra-visualizador"
import { Button } from "@workspace/ui/components/button"
import { BarChart3Icon } from "lucide-react"

// Reexportados porque o detalhe do projeto e os testes importam daqui.
export { MarcaEstimado, formatarDataHora, type EtapaRotulada } from "./painel/comuns"

const CAMINHO = "/admin/projetos"

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

/** Aba "Projetos": filtros (na URL), números do período, gráficos, a lista de projetos e as médias por etapa (recolhidas). */
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
    setErro(null)
    api
      .painelMetricas(pedido)
      .then((r) => {
        if (ativo) setResposta(r)
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

  const temFiltro = filtro.donos.length + filtro.projetos.length + filtro.etapas.length + filtro.modelos.length > 0 || filtro.incluirTestes

  const alertaDeErro = erro !== null && (
    <AvisoAdmin mensagem={erro} aba="projetos" aoTentarDeNovo={ehSemNuvem(erro) ? undefined : atualizar} />
  )
  // Sem nenhuma resposta ainda não há filtros para mostrar: só o erro (com a nova tentativa) ou o esqueleto.
  if (!resposta) return alertaDeErro || <Skeleton className="h-64 w-full" />

  const { painel, opcoes, avatares } = resposta
  const desatualizado = carregando || erro !== null
  const filtrado = filtro.donos.length + filtro.projetos.length + filtro.etapas.length + filtro.modelos.length > 0
  const semUso = painel.totais.custoUsd === 0 && painel.totais.tempoUtilSeg === 0 && painel.porProjeto.every((p) => p.usd === 0 && p.tempoUtilSeg === 0)

  return (
    <div className="flex flex-col gap-6">
      <BarraFiltros
        filtro={filtro}
        periodo={periodo}
        opcoes={opcoes}
        etapas={etapas}
        aoMudar={gravarNaUrl}
        aoAtualizar={atualizar}
        aoExportar={() => baixarCsv(resposta)}
        atualizando={carregando}
        exportarDesabilitado={erro !== null}
      />
      {alertaDeErro}
      {/* Recarregando, ou com o último pedido em erro: o conteúdo que fica na tela é o antigo, então fica esmaecido. */}
      <div aria-busy={desatualizado} className={desatualizado ? "flex flex-col gap-6 opacity-60 transition-opacity" : "flex flex-col gap-6"}>
        {semUso ? (
          <EstadoVisualizador
            icone={<BarChart3Icon />}
            titulo="Nenhum uso"
            destaque="neste período"
            acao={
              temFiltro && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => gravarNaUrl(parametrosDeFiltro({ ...filtro, donos: [], projetos: [], etapas: [], modelos: [], incluirTestes: false }, periodo))}
                >
                  Limpar filtros
                </Button>
              )
            }
          >
            Troque o período ou limpe os filtros para ver outros dados.
          </EstadoVisualizador>
        ) : (
          <>
            <NumerosGrandes painel={painel} />
            <EtapasPainelContext.Provider value={etapas}>
              <GraficosPainel painel={painel} avatares={avatares} filtro={filtro} aoFiltrar={aoFiltrar} />
            </EtapasPainelContext.Provider>
          </>
        )}
        <ListaProjetos projetos={painel.porProjeto} etapas={etapas} avatares={avatares} filtrado={filtrado} />
      </div>
      <SecaoMediasPorEtapa etapas={etapas} />
    </div>
  )
}
