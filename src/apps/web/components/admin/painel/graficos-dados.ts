/** Lógica pura dos gráficos do painel de Projetos (sem React): agrupamentos, percentuais, cores e rótulos. */
import type { PainelMetricas, PontoSerie } from "@workspace/core/metricas/painel"
import { rotuloModelo } from "./comuns"

/** Abaixo disto (US$ 0,00 na tela) um total conta como zero: é ruído de arredondamento. */
const ZERO_USD = 0.005
/** Máximo de séries com cor própria (`--chart-1..5`). */
const MAXIMO_CORES = 5
/** Fatias abaixo desta fração do total agrupam em "Outras". */
const FRACAO_PEQUENA = 0.03

export const ETAPA_ARQUIVADA = "briefing-benchmark"
export const FASE_ARQUIVADA = "Arquivada"
export const ROTULO_ARQUIVADA = "Briefing e benchmark (arquivada)"

/** Fases na ordem fixa de `etapas.json`, mais a arquivada no fim. */
export const ORDEM_FASES = ["Contexto", "Diagnóstico", "Soluções e metas", "Mídia e ação", "Apresentação", FASE_ARQUIVADA] as const

/** Só tokens do tema. A arquivada e "Outras" usam tons fora da paleta de séries, sempre com rótulo ao lado. */
const COR_FASE: Record<string, string> = {
  Contexto: "var(--chart-1)",
  Diagnóstico: "var(--chart-2)",
  "Soluções e metas": "var(--chart-3)",
  "Mídia e ação": "var(--chart-4)",
  Apresentação: "var(--chart-5)",
  [FASE_ARQUIVADA]: "var(--selo-opus)",
}
export const COR_OUTRAS = "var(--muted-foreground)"

export function corDaFase(fase: string): string {
  return COR_FASE[fase] ?? COR_OUTRAS
}

/** Fases que aparecem nos dados, na ordem fixa; fases desconhecidas vão para o fim, em ordem alfabética. */
export function fasesOrdenadas(fases: Iterable<string>): string[] {
  const presentes = new Set(fases)
  const conhecidas = ORDEM_FASES.filter((f) => presentes.has(f))
  const outras = [...presentes].filter((f) => !(ORDEM_FASES as readonly string[]).includes(f)).sort((a, b) => a.localeCompare(b, "pt-BR"))
  return [...conhecidas, ...outras]
}

const DIA_MES = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })

/** Data ISO como `dd/MM` no fuso de Brasília; inválida vira texto vazio. */
export function formatarDiaMes(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : DIA_MES.format(d)
}

/** Percentuais inteiros que somam 100 (método do maior resto). Total zero ou inválido dá zeros. */
export function percentuaisMaiorResto(valores: number[]): number[] {
  const total = valores.reduce((a, v) => a + (Number.isFinite(v) && v > 0 ? v : 0), 0)
  if (total <= 0) return valores.map(() => 0)
  const brutos = valores.map((v) => (Number.isFinite(v) && v > 0 ? (v / total) * 100 : 0))
  const pisos = brutos.map(Math.floor)
  let falta = 100 - pisos.reduce((a, b) => a + b, 0)
  const ordem = brutos.map((b, i) => ({ i, resto: b - pisos[i]! })).sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (const { i } of ordem) {
    if (falta <= 0) break
    pisos[i]! += 1
    falta -= 1
  }
  return pisos
}

// ---------------------------------------------------------------- Custo no tempo

export interface SerieModelo {
  /** Chave segura para CSS e Recharts (`m0`..`m4`); ids de modelo têm pontos e hífens. */
  chave: string
  rotulo: string
  cor: string
  /** Ids crus somados nesta série. */
  ids: string[]
  total: number
}

export type LinhaSerie = { inicio: string; rotulo: string; total: number } & Record<string, number | string>

/**
 * Séries por modelo da área empilhada: tira modelos zerados no período, ordena pelo total, e acima de 5 modelos
 * mantém os 4 maiores e soma o resto em "Outros modelos".
 */
export function modelosDaSerie(serie: PontoSerie[]): { series: SerieModelo[]; linhas: LinhaSerie[]; total: number } {
  const totais = new Map<string, number>()
  for (const p of serie) for (const [id, v] of Object.entries(p.porModelo)) totais.set(id, (totais.get(id) ?? 0) + v)
  const ids = [...totais.entries()].filter(([, v]) => v >= ZERO_USD).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const grupos: Array<{ rotulo: string; ids: string[] }> =
    ids.length > MAXIMO_CORES
      ? [...ids.slice(0, MAXIMO_CORES - 1).map(([id]) => ({ rotulo: rotuloModelo(id), ids: [id] })), { rotulo: "Outros modelos", ids: ids.slice(MAXIMO_CORES - 1).map(([id]) => id) }]
      : ids.map(([id]) => ({ rotulo: rotuloModelo(id), ids: [id] }))
  const series = grupos.map((g, i) => ({
    chave: `m${i}`,
    rotulo: g.rotulo,
    cor: `var(--chart-${i + 1})`,
    ids: g.ids,
    total: arredondar(g.ids.reduce((a, id) => a + (totais.get(id) ?? 0), 0)),
  }))
  if (series.length === 0) return { series: [], linhas: [], total: 0 }
  const linhas = serie.map((p) => {
    const linha: LinhaSerie = { inicio: p.inicio, rotulo: formatarDiaMes(p.inicio), total: p.total }
    for (const s of series) linha[s.chave] = arredondar(s.ids.reduce((a, id) => a + (p.porModelo[id] ?? 0), 0))
    return linha
  })
  return { series, linhas, total: arredondar(series.reduce((a, s) => a + s.total, 0)) }
}

function arredondar(v: number): number {
  return Math.round(v * 10000) / 10000
}

// ---------------------------------------------------------------- Rosca

export interface FatiaRosca {
  /** Fase, id da etapa, ou "outras". */
  id: string
  rotulo: string
  usd: number
  pct: number
  cor: string
  /** Etapas somadas na fatia. */
  etapas: string[]
  /** Fatia que agrupa várias pequenas. */
  agrupada: boolean
}

/** Rótulo curto da etapa sem o catálogo: número e fase ("03 · Diagnóstico"); a final e a arquivada têm nome próprio. */
export function rotuloEtapa(etapa: string, fase: string): string {
  if (etapa === ETAPA_ARQUIVADA || fase === FASE_ARQUIVADA) return ROTULO_ARQUIVADA
  if (etapa === "final") return `Final · ${fase}`
  return `${etapa} · ${fase}`
}

/**
 * Fatias da rosca, por fase ou por etapa, na ordem fixa das fases. Fatias abaixo de 3% do total agrupam em "Outras"
 * (só quando há duas ou mais; a arquivada nunca agrupa). Zeros não entram; percentuais somam 100.
 */
export function fatiasDaRosca(porEtapa: PainelMetricas["porEtapa"], visao: "fase" | "etapa"): FatiaRosca[] {
  const positivas = porEtapa.filter((e) => e.usd >= ZERO_USD)
  if (positivas.length === 0) return []
  const ordemFase = fasesOrdenadas(positivas.map((e) => e.fase))
  type Base = Omit<FatiaRosca, "pct" | "agrupada">
  let base: Base[]
  if (visao === "fase") {
    base = ordemFase.map((fase) => {
      const daFase = positivas.filter((e) => e.fase === fase)
      return {
        id: fase,
        rotulo: fase === FASE_ARQUIVADA ? ROTULO_ARQUIVADA : fase,
        usd: arredondar(daFase.reduce((a, e) => a + e.usd, 0)),
        cor: corDaFase(fase),
        etapas: daFase.map((e) => e.etapa),
      }
    })
  } else {
    base = [...positivas]
      .sort((a, b) => ordemFase.indexOf(a.fase) - ordemFase.indexOf(b.fase) || a.etapa.localeCompare(b.etapa))
      .map((e) => ({ id: e.etapa, rotulo: rotuloEtapa(e.etapa, e.fase), usd: e.usd, cor: corDaFase(e.fase), etapas: [e.etapa] }))
  }
  const total = base.reduce((a, f) => a + f.usd, 0)
  const arquivada = (f: Base) => f.id === FASE_ARQUIVADA || f.id === ETAPA_ARQUIVADA
  const pequenas = base.filter((f) => !arquivada(f) && f.usd / total < FRACAO_PEQUENA)
  let fatias: Array<Base & { agrupada: boolean }> = base.map((f) => ({ ...f, agrupada: false }))
  if (pequenas.length >= 2) {
    const idsPequenas = new Set(pequenas.map((f) => f.id))
    fatias = fatias.filter((f) => !idsPequenas.has(f.id))
    fatias.push({
      id: "outras",
      rotulo: "Outras",
      usd: arredondar(pequenas.reduce((a, f) => a + f.usd, 0)),
      cor: COR_OUTRAS,
      etapas: pequenas.flatMap((f) => f.etapas),
      agrupada: true,
    })
  }
  const pcts = percentuaisMaiorResto(fatias.map((f) => f.usd))
  return fatias.map((f, i) => ({ ...f, pct: pcts[i]! }))
}

// ---------------------------------------------------------------- Barras

export const MAXIMO_PROJETOS = 8
export const ALTURA_LINHA = 36
export const ALTURA_EIXO = 40

/** Os 8 projetos de maior custo (só os com custo) e quantos com custo ficaram de fora. */
export function topProjetos(porProjeto: PainelMetricas["porProjeto"], n = MAXIMO_PROJETOS) {
  const comCusto = porProjeto.filter((p) => p.usd >= ZERO_USD).sort((a, b) => b.usd - a.usd)
  return { linhas: comCusto.slice(0, n), aMais: Math.max(0, comCusto.length - n) }
}

/** Altura do gráfico de barras horizontais: 36 px por linha mais 40 px do eixo. */
export function alturaBarras(linhas: number): number {
  return linhas * ALTURA_LINHA + ALTURA_EIXO
}

const PASSOS_SEG = [5, 10, 15, 30].map((m) => m * 60).concat([1, 2, 3, 4, 6, 8, 12, 24, 48, 72, 168].map((h) => h * 3600))

/** Marcas do eixo de tempo em minutos ou horas redondos, de 0 até cobrir o máximo, com no máximo 4 intervalos. */
export function ticksDeTempo(maximoSeg: number): number[] {
  if (!(maximoSeg > 0)) return [0]
  const passo = PASSOS_SEG.find((p) => Math.ceil(maximoSeg / p) <= 4) ?? Math.ceil(maximoSeg / 4 / 168 / 3600) * 168 * 3600
  return Array.from({ length: Math.ceil(maximoSeg / passo) + 1 }, (_, i) => i * passo)
}

/** Pessoas com algum tempo, da que mais trabalhou para a que menos. */
export function pessoasDoGrafico(tempo: PainelMetricas["tempoPorPessoa"]) {
  const total = (p: PainelMetricas["tempoPorPessoa"][number]) => p.agenteSeg + p.ativoSeg + p.ociosoSeg
  return tempo.filter((p) => total(p) > 0).sort((a, b) => total(b) - total(a) || a.email.localeCompare(b.email))
}
