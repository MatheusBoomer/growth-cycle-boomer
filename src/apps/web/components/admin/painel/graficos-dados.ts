/** Lógica pura dos gráficos do painel de Projetos (sem React): agrupamentos, percentuais, cores e rótulos. */
import { ID_ETAPA_ARQUIVADA } from "@workspace/core/migracao-etapas"
import type { PainelMetricas, PontoSerie } from "@workspace/core/metricas/painel"
import { FASE_ARQUIVADA } from "@workspace/core/tipos"
import { rotuloModelo, type EtapaRotulada } from "./comuns"

/** Abaixo disto (US$ 0,00 na tela) um total conta como zero: é ruído de arredondamento. */
const ZERO_USD = 0.005
/** Cores de série do tema (`--chart-1..5`). */
const CORES_SERIE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const
/** Fatias abaixo desta fração do total agrupam em "Outras". */
const FRACAO_PEQUENA = 0.03

/** As mesmas constantes do core: a fase das etapas fora do catálogo e o id da antiga etapa de briefing. */
export { FASE_ARQUIVADA }
export const ETAPA_ARQUIVADA = ID_ETAPA_ARQUIVADA
export const ROTULO_ARQUIVADA = "Briefing e benchmark (arquivada)"

/** Ordem das fases quando o catálogo não chega à tela: a de `etapas.json`, mais a arquivada no fim. */
export const ORDEM_FASES: readonly string[] = ["Contexto", "Diagnóstico", "Soluções e metas", "Mídia e ação", "Apresentação", FASE_ARQUIVADA]

/** Só tokens do tema. A arquivada e "Outras" usam tons fora da paleta de séries, sempre com rótulo ao lado. */
const COR_ARQUIVADA = "var(--selo-opus)"
export const COR_OUTRAS = "var(--muted-foreground)"

/**
 * Ordem das fases pelo catálogo (a primeira aparição de cada `fase`, na ordem das etapas), com a arquivada no fim.
 * Sem catálogo, ou sem nenhuma fase nele, vale `ORDEM_FASES`.
 */
export function ordemDasFases(etapas: readonly EtapaRotulada[] = []): readonly string[] {
  const fases = [...new Set(etapas.map((e) => e.fase).filter((f): f is string => typeof f === "string" && f !== "" && f !== FASE_ARQUIVADA))]
  return fases.length === 0 ? ORDEM_FASES : [...fases, FASE_ARQUIVADA]
}

/** Cor da fase pela posição dela na ordem (as 5 primeiras têm cor própria); a arquivada tem a dela; o resto fica apagado. */
export function corDaFase(fase: string, ordem: readonly string[] = ORDEM_FASES): string {
  if (fase === FASE_ARQUIVADA) return COR_ARQUIVADA
  const i = ordem.filter((f) => f !== FASE_ARQUIVADA).indexOf(fase)
  return i >= 0 && i < CORES_SERIE.length ? CORES_SERIE[i]! : COR_OUTRAS
}

/** Fases que aparecem nos dados, na ordem dada; fases desconhecidas vão para o fim, em ordem alfabética. */
export function fasesOrdenadas(fases: Iterable<string>, ordem: readonly string[] = ORDEM_FASES): string[] {
  const presentes = new Set(fases)
  const conhecidas = ordem.filter((f) => presentes.has(f))
  const outras = [...presentes].filter((f) => !ordem.includes(f)).sort((a, b) => a.localeCompare(b, "pt-BR"))
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

/** Famílias com cor fixa, na ordem da legenda: Opus, Sonnet e Haiku ficam sempre com `--chart-1`, `-2` e `-3`. */
const FAMILIAS_FIXAS = ["opus", "sonnet", "haiku"] as const
const CHAVE_SEM_MODELO = "outros"

/** Família do id cru (`opus` ou `claude-opus-4-5...`), quando é uma das fixas. */
function familiaFixa(id: string): number {
  const familia = /^claude-([a-z]+)-\d/.exec(id)?.[1] ?? id
  return (FAMILIAS_FIXAS as readonly string[]).indexOf(familia)
}

/**
 * Séries por modelo do gráfico empilhado, com cor pela identidade do modelo, não pela posição no período. Tira
 * modelos zerados no período. Ordem estável: o maior modelo de cada família fixa (opus, sonnet, haiku), com a cor da
 * família; depois os demais pelo total, com `--chart-4`, `--chart-5` e as cores de família que sobraram (sem cor
 * livre para todos, o último vira "Outros modelos"); o custo sem modelo ("outros") sempre no fim, com a cor apagada.
 */
export function modelosDaSerie(serie: PontoSerie[]): { series: SerieModelo[]; linhas: LinhaSerie[]; total: number } {
  const totais = new Map<string, number>()
  for (const p of serie) for (const [id, v] of Object.entries(p.porModelo)) totais.set(id, (totais.get(id) ?? 0) + v)
  const ids = [...totais.entries()].filter(([, v]) => v >= ZERO_USD).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const daFamilia: Array<string | undefined> = FAMILIAS_FIXAS.map(() => undefined)
  const extras: string[] = []
  for (const [id] of ids) {
    if (id === CHAVE_SEM_MODELO) continue
    const f = familiaFixa(id)
    if (f >= 0 && daFamilia[f] === undefined) daFamilia[f] = id
    else extras.push(id)
  }
  const livres = [...CORES_SERIE.slice(FAMILIAS_FIXAS.length), ...CORES_SERIE.slice(0, FAMILIAS_FIXAS.length).filter((_, i) => daFamilia[i] === undefined)]
  const grupos: Array<{ rotulo: string; ids: string[]; cor: string }> = []
  daFamilia.forEach((id, i) => {
    if (id !== undefined) grupos.push({ rotulo: rotuloModelo(id), ids: [id], cor: CORES_SERIE[i]! })
  })
  if (extras.length > livres.length) {
    const proprios = extras.slice(0, livres.length - 1)
    proprios.forEach((id, i) => grupos.push({ rotulo: rotuloModelo(id), ids: [id], cor: livres[i]! }))
    grupos.push({ rotulo: "Outros modelos", ids: extras.slice(livres.length - 1), cor: livres[livres.length - 1]! })
  } else {
    extras.forEach((id, i) => grupos.push({ rotulo: rotuloModelo(id), ids: [id], cor: livres[i]! }))
  }
  if (totais.has(CHAVE_SEM_MODELO) && totais.get(CHAVE_SEM_MODELO)! >= ZERO_USD) {
    grupos.push({ rotulo: rotuloModelo(CHAVE_SEM_MODELO), ids: [CHAVE_SEM_MODELO], cor: COR_OUTRAS })
  }

  const series = grupos.map((g, i) => ({
    chave: `m${i}`,
    rotulo: g.rotulo,
    cor: g.cor,
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
 * Fatias da rosca, por fase ou por etapa, na ordem das fases do catálogo (ou na fixa, sem catálogo). Por etapa, o
 * rótulo é o título do catálogo ("03 · Diagnóstico de performance"); etapa fora dele usa `rotuloEtapa`. Fatias abaixo
 * de 3% do total agrupam em "Outras" (só quando há duas ou mais; a arquivada nunca agrupa). Zeros não entram;
 * percentuais somam 100.
 */
export function fatiasDaRosca(porEtapa: PainelMetricas["porEtapa"], visao: "fase" | "etapa", etapas: readonly EtapaRotulada[] = []): FatiaRosca[] {
  const positivas = porEtapa.filter((e) => e.usd >= ZERO_USD)
  if (positivas.length === 0) return []
  const ordem = ordemDasFases(etapas)
  const ordemFase = fasesOrdenadas(
    positivas.map((e) => e.fase),
    ordem,
  )
  const rotuloDoCatalogo = (etapa: string, fase: string) => etapas.find((e) => e.id === etapa)?.rotulo ?? rotuloEtapa(etapa, fase)
  type Base = Omit<FatiaRosca, "pct" | "agrupada">
  let base: Base[]
  if (visao === "fase") {
    base = ordemFase.map((fase) => {
      const daFase = positivas.filter((e) => e.fase === fase)
      return {
        id: fase,
        rotulo: fase === FASE_ARQUIVADA ? ROTULO_ARQUIVADA : fase,
        usd: arredondar(daFase.reduce((a, e) => a + e.usd, 0)),
        cor: corDaFase(fase, ordem),
        etapas: daFase.map((e) => e.etapa),
      }
    })
  } else {
    base = [...positivas]
      .sort((a, b) => ordemFase.indexOf(a.fase) - ordemFase.indexOf(b.fase) || a.etapa.localeCompare(b.etapa))
      .map((e) => ({ id: e.etapa, rotulo: rotuloDoCatalogo(e.etapa, e.fase), usd: e.usd, cor: corDaFase(e.fase, ordem), etapas: [e.etapa] }))
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

const MULTIPLOS_USD = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]

/**
 * Marcas do eixo de custo: de US$ 0 até cobrir o máximo, com passo redondo (1, 1,5, 2, 2,5, 3, 4, 5, 6 ou 8 vezes uma
 * potência de 10) e no máximo 3 marcas, para caberem sem se sobrepor mesmo a 360 px.
 */
export function ticksDeUsd(maximo: number): number[] {
  if (!(maximo > 0) || !Number.isFinite(maximo)) return [0]
  const bruto = maximo / 2
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = arredondar((MULTIPLOS_USD.find((m) => m * potencia >= bruto - 1e-9) ?? 10) * potencia)
  const n = Math.ceil(maximo / passo - 1e-9)
  return Array.from({ length: n + 1 }, (_, i) => arredondar(i * passo))
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
