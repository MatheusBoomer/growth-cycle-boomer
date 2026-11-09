/** Agregação do painel de métricas: série no tempo, custo por etapa, por projeto e tempo por pessoa. Sem I/O. */
import { normalizarEmail } from "../papeis"
import { custosPorTurno } from "./custo"
import { classificarTempo } from "./tempo"
import type { Limites, LinhaPresenca, LinhaUso } from "./tipos"

/**
 * Filtro do painel. Contrato: `de` e `ate` são datas de calendário de Brasília `AAAA-MM-DD`, os dois dias incluídos;
 * data inválida ou `ate` antes de `de` faz `agregarPainel` lançar `RangeError`.
 */
export interface FiltroPainel {
  /** Primeiro dia do período, `AAAA-MM-DD`, no fuso de Brasília (inclusivo). */
  de: string
  /** Último dia do período, `AAAA-MM-DD`, no fuso de Brasília (inclusivo). */
  ate: string
  donos: string[]
  projetos: string[]
  etapas: string[]
  modelos: string[]
  incluirTestes: boolean
}

export interface EntradaProjeto {
  slug: string
  nome: string
  dono: string | null
  teste: boolean
  ativo: boolean
  concluidoEm: string | null
  pendencias: number
}

export interface PontoSerie {
  inicio: string
  total: number
  /** Ids crus de `LinhaUso.modelos`, mais `"outros"` (CHAVE_OUTROS) para o custo sem modelo; soma `total`. */
  porModelo: Record<string, number>
}

export interface PainelMetricas {
  periodo: { de: string; ate: string; granularidade: "dia" | "semana" }
  totais: { custoUsd: number; estimado: boolean; tempoUtilSeg: number; custoAnteriorUsd: number; tempoUtilAnteriorSeg: number }
  /**
   * Custo de vida inteira dos projetos concluídos (`concluidoEm`) dentro do período. Esse custo aplica os filtros de
   * etapa e de modelo, mas NÃO o período.
   */
  concluidos: { media: number | null; mediana: number | null; n: number }
  contagem: { ativos: number; concluidos: number; comPendencia: number }
  serie: PontoSerie[]
  porEtapa: Array<{ etapa: string; fase: string; usd: number }>
  porProjeto: Array<{
    slug: string
    nome: string
    dono: string | null
    usd: number
    porFase: Record<string, number>
    tempoUtilSeg: number
    ultimaAtividade: string | null
  }>
  tempoPorPessoa: Array<{ email: string; agenteSeg: number; ativoSeg: number; ociosoSeg: number }>
  tempoIgnoraModelo: boolean
}

const FUSO = "America/Sao_Paulo"
const DIA_MS = 86_400_000
const BLOCO_MS = 30_000
const BLOCO_SEGUNDOS = 30
const MAXIMO_DIAS_POR_DIA = 31
/** Chave de `PontoSerie.porModelo` para o custo sem modelo registrado. */
export const CHAVE_OUTROS = "outros"

const relogioLocal = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000
}

function somar(mapa: Map<string, number> | Record<string, number>, chave: string, valor: number): void {
  if (mapa instanceof Map) mapa.set(chave, (mapa.get(chave) ?? 0) + valor)
  else mapa[chave] = (mapa[chave] ?? 0) + valor
}

function arredondarValores(registro: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(registro).map(([k, v]) => [k, arredondar(v)]))
}

/** Diferença, em ms, entre o relógio de Brasília e o UTC no instante dado (negativa a oeste de Greenwich). */
function deslocamentoMs(ms: number): number {
  const partes: Record<string, number> = {}
  for (const p of relogioLocal.formatToParts(new Date(ms))) if (p.type !== "literal") partes[p.type] = Number(p.value)
  const comoUtc = Date.UTC(partes.year!, partes.month! - 1, partes.day!, partes.hour!, partes.minute!, partes.second!)
  return comoUtc - (ms - (((ms % 1000) + 1000) % 1000))
}

/** Instante da meia-noite de Brasília do dia dado (dias desde 1970-01-01). Duas passadas acertam a troca de horário. */
function meiaNoiteLocal(dia: number): number {
  const utc = dia * DIA_MS
  const primeira = utc - deslocamentoMs(utc)
  return utc - deslocamentoMs(primeira)
}

/** Dia `AAAA-MM-DD` em dias desde 1970-01-01; lança se a data não existe. */
function diaDaData(data: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  const ms = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== data) {
    throw new RangeError(`Data inválida no filtro do painel: ${data}`)
  }
  return ms / DIA_MS
}

/** Último início menor ou igual a `ms` (busca binária); -1 se `ms` vem antes do primeiro. */
function indiceDoBucket(inicios: number[], ms: number): number {
  let baixo = 0
  let alto = inicios.length - 1
  let achado = -1
  while (baixo <= alto) {
    const meio = (baixo + alto) >> 1
    if (inicios[meio]! <= ms) {
      achado = meio
      baixo = meio + 1
    } else {
      alto = meio - 1
    }
  }
  return achado
}

/**
 * Completa o custo por modelo de um bucket com a chave `"outros"`: o custo de turnos cujo `modelos` é nulo ou não cobre
 * todo o `usd` (por exemplo, linhas antigas). Só entra quando o resto passa de 1e-9; ruído de ponto flutuante e resto
 * negativo (modelos somando mais que o turno) não geram chave.
 */
function porModeloComOutros(total: number, porModelo: Record<string, number>): Record<string, number> {
  const resto = arredondar(total - Object.values(porModelo).reduce((s, v) => s + v, 0))
  return resto > 1e-9 ? { ...porModelo, [CHAVE_OUTROS]: resto } : porModelo
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1 ? ordenados[meio]! : (ordenados[meio - 1]! + ordenados[meio]!) / 2
}

function maisRecente(atual: string | null, candidato: string): string | null {
  const ms = Date.parse(candidato)
  if (Number.isNaN(ms)) return atual
  if (atual === null || ms > Date.parse(atual)) return candidato
  return atual
}

/**
 * Agrega custo e tempo para o painel. Os filtros de dono, projeto e teste escolhem projetos inteiros; o de etapa filtra
 * turnos e blocos; o de modelo restringe só o custo à parcela daqueles modelos. Custo e tempo contam pelo instante em
 * que acontecem (fim do turno, início do bloco de 30 s) dentro do período, em dias de Brasília. O período anterior, de
 * mesmo comprimento, só alimenta os totais anteriores. `concluidos` usa o custo de vida inteira (com os filtros de
 * etapa e modelo) dos projetos concluídos no período; `contagem` é o estado de hoje e ignora o período.
 */
export function agregarPainel(
  entrada: {
    projetos: EntradaProjeto[]
    usos: LinhaUso[]
    presencas: LinhaPresenca[]
    faseDaEtapa: (etapa: string) => string
    limites: Limites
  },
  filtro: FiltroPainel,
): PainelMetricas {
  // Período em dias de Brasília: [inicioMs, fimMs) e o anterior [anteriorMs, inicioMs).
  const diaDe = diaDaData(filtro.de)
  const diaAte = diaDaData(filtro.ate)
  if (diaAte < diaDe) throw new RangeError(`Período do painel invertido: ${filtro.de} a ${filtro.ate}`)
  const dias = diaAte - diaDe + 1
  const granularidade = dias <= MAXIMO_DIAS_POR_DIA ? "dia" : "semana"
  const inicioMs = meiaNoiteLocal(diaDe)
  const fimMs = meiaNoiteLocal(diaAte + 1)
  const anteriorMs = meiaNoiteLocal(diaDe - dias)

  // Buckets: cada dia, ou cada semana a partir da segunda-feira de `de` (1970-01-01 foi quinta-feira).
  const inicios: number[] = []
  const passo = granularidade === "dia" ? 1 : 7
  const primeiroDia = granularidade === "dia" ? diaDe : diaDe - ((diaDe + 3) % 7)
  for (let dia = primeiroDia; dia <= diaAte; dia += passo) inicios.push(meiaNoiteLocal(dia))
  const serie = inicios.map(() => ({ total: 0, porModelo: {} as Record<string, number> }))

  // Projetos visíveis pelos filtros de projeto inteiro.
  const donos = new Set(filtro.donos.map(normalizarEmail))
  const slugsFiltro = new Set(filtro.projetos)
  const visiveis = new Map<string, EntradaProjeto>()
  for (const p of entrada.projetos) {
    if (!filtro.incluirTestes && p.teste) continue
    if (slugsFiltro.size > 0 && !slugsFiltro.has(p.slug)) continue
    if (donos.size > 0 && (p.dono === null || !donos.has(normalizarEmail(p.dono)))) continue
    visiveis.set(p.slug, p)
  }
  const etapas = new Set(filtro.etapas)
  const etapaVale = (etapa: string) => etapas.size === 0 || etapas.has(etapa)
  const modelos = new Set(filtro.modelos)

  const usos = entrada.usos.filter((u) => visiveis.has(u.slug))
  const presencas = entrada.presencas.filter((p) => visiveis.has(p.slug))

  const projetos = new Map(
    [...visiveis.values()].map((p) => [
      p.slug,
      { usd: 0, vida: 0, porFase: {} as Record<string, number>, tempoUtilSeg: 0, ultimaAtividade: null as string | null },
    ]),
  )
  const marcas = [...usos.map((u) => [u.slug, u.fim] as const), ...presencas.map((p) => [p.slug, p.em] as const)]
  for (const [slug, instante] of marcas) {
    const projeto = projetos.get(slug)!
    projeto.ultimaAtividade = maisRecente(projeto.ultimaAtividade, instante)
  }

  // Custo: uma passada nos turnos datados. Cada parcela é arredondada antes de somar, para as somas baterem.
  let custoUsd = 0
  let custoAnteriorUsd = 0
  let estimado = false
  const porEtapa = new Map<string, number>()
  for (const c of custosPorTurno(usos)) {
    if (!etapaVale(c.etapa)) continue
    // Valores por modelo arredondados por turno: com filtro de modelo, o custo do turno é exatamente a soma deles.
    const parcela = Object.fromEntries(
      Object.entries(c.modelos)
        .filter(([m]) => modelos.size === 0 || modelos.has(m))
        .map(([m, v]) => [m, arredondar(v)]),
    )
    const valor = arredondar(modelos.size === 0 ? c.usd : Object.values(parcela).reduce((s, v) => s + v, 0))
    const projeto = projetos.get(c.slug)!
    projeto.vida += valor
    const ms = Date.parse(c.quando)
    if (ms >= anteriorMs && ms < inicioMs) custoAnteriorUsd += valor
    if (!(ms >= inicioMs && ms < fimMs)) continue
    estimado ||= c.estimado
    if (valor === 0) continue
    custoUsd += valor
    const ponto = serie[indiceDoBucket(inicios, ms)]!
    ponto.total += valor
    for (const [modelo, v] of Object.entries(parcela)) if (v !== 0) somar(ponto.porModelo, modelo, v)
    somar(porEtapa, c.etapa, valor)
    projeto.usd += valor
    somar(projeto.porFase, entrada.faseDaEtapa(c.etapa), valor)
  }

  // Tempo: uma passada nos blocos de 30 s, classificados com todos os dados dos projetos visíveis.
  let tempoUtilSeg = 0
  let tempoUtilAnteriorSeg = 0
  const pessoas = new Map<string, { agenteSeg: number; ativoSeg: number; ociosoSeg: number }>()
  for (const b of classificarTempo(presencas, usos, entrada.limites)) {
    if (!etapaVale(b.etapa)) continue
    const ms = b.bloco * BLOCO_MS
    const util = b.categoria === "agente" || b.categoria === "ativo" ? BLOCO_SEGUNDOS : 0
    if (ms >= anteriorMs && ms < inicioMs) tempoUtilAnteriorSeg += util
    if (!(ms >= inicioMs && ms < fimMs) || b.categoria === "descartado") continue
    tempoUtilSeg += util
    projetos.get(b.slug)!.tempoUtilSeg += util
    let pessoa = pessoas.get(b.email)
    if (!pessoa) {
      pessoa = { agenteSeg: 0, ativoSeg: 0, ociosoSeg: 0 }
      pessoas.set(b.email, pessoa)
    }
    pessoa[`${b.categoria}Seg`] += BLOCO_SEGUNDOS
  }

  const custosConcluidos = [...visiveis.values()]
    .filter((p) => {
      const ms = p.concluidoEm === null ? Number.NaN : Date.parse(p.concluidoEm)
      return ms >= inicioMs && ms < fimMs
    })
    .map((p) => arredondar(projetos.get(p.slug)!.vida))
  const n = custosConcluidos.length
  const medianaConcluidos = mediana(custosConcluidos)

  const todos = [...visiveis.values()]
  return {
    periodo: { de: filtro.de, ate: filtro.ate, granularidade },
    totais: {
      custoUsd: arredondar(custoUsd),
      estimado,
      tempoUtilSeg,
      custoAnteriorUsd: arredondar(custoAnteriorUsd),
      tempoUtilAnteriorSeg,
    },
    concluidos: {
      media: n === 0 ? null : arredondar(custosConcluidos.reduce((s, v) => s + v, 0) / n),
      mediana: medianaConcluidos === null ? null : arredondar(medianaConcluidos),
      n,
    },
    contagem: {
      ativos: todos.filter((p) => p.ativo).length,
      concluidos: todos.filter((p) => !p.ativo).length,
      comPendencia: todos.filter((p) => p.pendencias > 0).length,
    },
    serie: serie.map((s, i) => ({
      inicio: new Date(inicios[i]!).toISOString(),
      total: arredondar(s.total),
      porModelo: porModeloComOutros(arredondar(s.total), arredondarValores(s.porModelo)),
    })),
    porEtapa: [...porEtapa]
      .map(([etapa, usd]) => ({ etapa, fase: entrada.faseDaEtapa(etapa), usd: arredondar(usd) }))
      .sort((a, b) => b.usd - a.usd || (a.etapa < b.etapa ? -1 : a.etapa > b.etapa ? 1 : 0)),
    porProjeto: todos
      .map((p) => {
        const m = projetos.get(p.slug)!
        return {
          slug: p.slug,
          nome: p.nome,
          dono: p.dono,
          usd: arredondar(m.usd),
          porFase: arredondarValores(m.porFase),
          tempoUtilSeg: m.tempoUtilSeg,
          ultimaAtividade: m.ultimaAtividade,
        }
      })
      .sort((a, b) => b.usd - a.usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
    tempoPorPessoa: [...pessoas]
      .map(([email, t]) => ({ email, ...t }))
      .sort(
        (a, b) =>
          b.agenteSeg + b.ativoSeg - (a.agenteSeg + a.ativoSeg) || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0),
      ),
    tempoIgnoraModelo: modelos.size > 0,
  }
}
