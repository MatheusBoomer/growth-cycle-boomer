/** Resumo de custo e tempo de um projeto e médias por etapa entre projetos. Sem I/O. */
import { ORDEM_ETAPAS } from "../tipos"
import type { EtapaId } from "../tipos"
import { custoPorEtapa, custoPorPessoa } from "./custo"
import { classificarTempo, somarTempo, tempoUtil } from "./tempo"
import type { CustoEtapa, Limites, LinhaPresenca, LinhaUso, TempoSegundos } from "./tipos"

export interface MetricasEtapa {
  custo: CustoEtapa
  tempo: TempoSegundos
  /** Verdadeiro quando houve ao menos um aviso de presença na etapa (tempo de pessoa medido). */
  temPresenca: boolean
}

export interface MetricasPessoa {
  email: string
  custoUsd: number
  tempo: TempoSegundos
}

export interface MetricasProjeto {
  custoUsd: number
  estimado: boolean
  tempo: TempoSegundos
  porEtapa: Partial<Record<EtapaId, MetricasEtapa>>
  /** Ordenadas por tempo útil decrescente. */
  porPessoa: MetricasPessoa[]
  ultimaAtividade: string | null
}

export interface Estatistica {
  media: number
  mediana: number
  min: number
  max: number
  n: number
}

export interface MediaEtapa {
  custo: Estatistica | null
  tempoUtil: Estatistica | null
  /** Verdadeiro quando alguma das estatísticas tem menos de 5 projetos. */
  basePequena: boolean
}

const BASE_MINIMA = 5
const RAZAO_MINIMA = 0.8
const RAZAO_MAXIMA = 1.25

function tempoZero(): TempoSegundos {
  return { agente: 0, ativo: 0, ocioso: 0, descartado: 0 }
}

function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000
}

function maisRecente(atual: string | null, candidato: string): string | null {
  const ms = Date.parse(candidato)
  if (Number.isNaN(ms)) return atual
  if (atual === null || ms > Date.parse(atual)) return candidato
  return atual
}

export function resumirProjeto(usos: LinhaUso[], presencas: LinhaPresenca[], limites: Limites): MetricasProjeto {
  const custos = custoPorEtapa(usos)
  const custosPessoa = custoPorPessoa(usos)
  const blocos = classificarTempo(presencas, usos, limites)
  const tempoEtapa = somarTempo(blocos, (b) => b.etapa)
  const tempoPessoa = somarTempo(blocos, (b) => b.email)
  const comPresenca = new Set<string>()
  for (const b of blocos) if (b.categoria !== "agente") comPresenca.add(b.etapa)

  const porEtapa: Partial<Record<EtapaId, MetricasEtapa>> = {}
  const tempo = tempoZero()
  let custoUsd = 0
  let estimado = false

  // Os totais somam toda etapa que aparece nos dados, inclusive a arquivada (briefing-benchmark, fora de ORDEM_ETAPAS),
  // para baterem com a soma por pessoa; o detalhe por etapa mostra só as etapas de ORDEM_ETAPAS.
  const etapasNosDados = new Set<string>([...ORDEM_ETAPAS, ...custos.keys(), ...tempoEtapa.keys()])
  for (const etapa of etapasNosDados) {
    const custo = custos.get(etapa as EtapaId)
    const t = tempoEtapa.get(etapa)
    if (!custo && !t) continue
    const custoDaEtapa = custo ?? { usd: 0, estimado: false, turnos: 0, modelos: {} }
    const tempoDaEtapa = t ?? tempoZero()
    if ((ORDEM_ETAPAS as readonly string[]).includes(etapa)) {
      porEtapa[etapa as EtapaId] = { custo: custoDaEtapa, tempo: tempoDaEtapa, temPresenca: comPresenca.has(etapa) }
    }
    custoUsd += custoDaEtapa.usd
    estimado ||= custoDaEtapa.estimado
    for (const chave of Object.keys(tempo) as Array<keyof TempoSegundos>) tempo[chave] += tempoDaEtapa[chave]
  }

  const emails = new Set([...custosPessoa.keys(), ...tempoPessoa.keys()])
  const porPessoa: MetricasPessoa[] = [...emails]
    .map((email) => ({
      email,
      custoUsd: custosPessoa.get(email) ?? 0,
      tempo: tempoPessoa.get(email) ?? tempoZero(),
    }))
    .sort((a, b) => tempoUtil(b.tempo) - tempoUtil(a.tempo) || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))

  let ultimaAtividade: string | null = null
  for (const u of usos) ultimaAtividade = maisRecente(ultimaAtividade, u.fim)
  for (const p of presencas) ultimaAtividade = maisRecente(ultimaAtividade, p.em)

  return { custoUsd: arredondar(custoUsd), estimado, tempo, porEtapa, porPessoa, ultimaAtividade }
}

function estatistica(valores: number[]): Estatistica | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const n = ordenados.length
  const meio = Math.floor(n / 2)
  const minimo = ordenados[0] ?? 0
  const maximo = ordenados[n - 1] ?? 0
  const mediana = n % 2 === 1 ? (ordenados[meio] ?? 0) : ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2
  return {
    media: arredondar(ordenados.reduce((s, v) => s + v, 0) / n),
    mediana: arredondar(mediana),
    min: minimo,
    max: maximo,
    n,
  }
}

/**
 * Média, mediana, mínimo e máximo por etapa, entre os projetos que a concluíram. Projeto de teste fica
 * fora. O custo só entra se a etapa tem custo; o tempo só entra se houve aviso de presença na etapa, para
 * que uma etapa anterior à medição (só tempo de agente) não puxe a média para baixo.
 */
export function mediasPorEtapa(
  projetos: Array<{ metricas: MetricasProjeto; concluidas: EtapaId[]; teste: boolean }>,
): Partial<Record<EtapaId, MediaEtapa>> {
  const medias: Partial<Record<EtapaId, MediaEtapa>> = {}
  for (const etapa of ORDEM_ETAPAS) {
    const custos: number[] = []
    const tempos: number[] = []
    for (const p of projetos) {
      if (p.teste || !p.concluidas.includes(etapa)) continue
      const m = p.metricas.porEtapa[etapa]
      if (!m) continue
      if (m.custo.usd > 0) custos.push(m.custo.usd)
      if (m.temPresenca) tempos.push(tempoUtil(m.tempo))
    }
    const custo = estatistica(custos)
    const tempo = estatistica(tempos)
    if (!custo && !tempo) continue
    medias[etapa] = {
      custo,
      tempoUtil: tempo,
      basePequena: (custo !== null && custo.n < BASE_MINIMA) || (tempo !== null && tempo.n < BASE_MINIMA),
    }
  }
  return medias
}

/**
 * Compara um valor com a média: `null` sem média útil, `dentro da média` entre 0,8 e 1,25, senão `2,4× a média`.
 * Perto da borda da faixa (0,8, 1,2 ou 1,3 com uma casa), usa duas casas para o número não contradizer a faixa.
 */
export function compararComMedia(valor: number, media: number | null | undefined): string | null {
  if (!media) return null
  const razao = valor / media
  if (razao >= RAZAO_MINIMA && razao <= RAZAO_MAXIMA) return "dentro da média"
  const umaCasa = razao.toFixed(1)
  const texto = ["0.8", "1.2", "1.3"].includes(umaCasa) ? razao.toFixed(2) : umaCasa
  return `${texto.replace(".", ",")}× a média`
}
