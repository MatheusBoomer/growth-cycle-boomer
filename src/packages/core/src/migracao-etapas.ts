import type { Manifesto } from "./fixture"
import type { ConjuntoPerguntas, Entregavel, Estado, EstadoEtapa, EstadoInsumo, ItemFila } from "./tipos"

/** A antiga 07 (briefing e benchmark) deixa de ser etapa: o que ela produziu vai para entrega/arquivo-etapa-07/. */
export const ID_ETAPA_ARQUIVADA = "briefing-benchmark"

/** Id antigo para o novo: 08 vira 07 e 09 vira 08; 01 a 06 e final não mudam. */
export const MAPA_ETAPAS: Readonly<Record<string, string>> = {
  "07": ID_ETAPA_ARQUIVADA,
  "08": "07",
  "09": "08",
}

export function novoIdEtapa(id: string): string {
  return MAPA_ETAPAS[id] ?? id
}

export type ClasseNumeracao = "atual" | "legada" | "migrada"

/** Estado salvo em qualquer numeração: os ids de etapa são texto livre, não `EtapaId`. */
export type EstadoMigravel = Omit<Estado, "etapas" | "entregaveis" | "insumos" | "perguntas" | "filaAutomatica" | "teste"> & {
  etapas: Record<string, EstadoEtapa>
  entregaveis: (Omit<Entregavel, "etapa"> & { etapa: string })[]
  insumos: (Omit<EstadoInsumo, "etapa"> & { etapa: string })[]
  perguntas: (Omit<ConjuntoPerguntas, "etapa"> & { etapa: string })[]
  filaAutomatica: (Omit<ItemFila, "etapa"> & { etapa: string })[]
  teste?: { fixture: string; etapaInicial: string }
}

export type ManifestoMigravel = Omit<Manifesto, "arquivos" | "kit"> & {
  arquivos: { caminho: string; etapa: string }[]
  kit: Record<string, string[]>
}

/** "migrada" se já tem o marcador; "atual" se ainda tem as 9 etapas numeradas (chave "09"); senão "legada". */
export function classificarNumeracao(estado: { versaoEtapas?: number; etapas: Record<string, unknown> }): ClasseNumeracao {
  if (estado.versaoEtapas === 2) return "migrada"
  return "09" in estado.etapas ? "atual" : "legada"
}

/** A nova 07 vem da antiga 08, então a antiga 07 não tem mais lugar. */
function descartada(etapa: string): boolean {
  return etapa === "07"
}

function remapeiaLista<T extends { etapa: string }>(itens: T[]): T[] {
  return itens.filter((i) => !descartada(i.etapa)).map((i) => ({ ...i, etapa: novoIdEtapa(i.etapa) }))
}

export function migrarEstado(estado: EstadoMigravel): EstadoMigravel {
  const classe = classificarNumeracao(estado)
  if (classe !== "atual") {
    throw new Error(`Não dá para migrar um estado de numeração ${classe}: só o estado "atual" (com a etapa 09) é migrado.`)
  }
  const etapas: Record<string, EstadoEtapa> = {}
  for (const [id, dados] of Object.entries(estado.etapas)) {
    if (!descartada(id)) etapas[novoIdEtapa(id)] = { ...dados }
  }
  // A nova 07 era a 08, bloqueada atrás da antiga 07: com a 06 concluída ela já pode começar.
  if (etapas["07"]?.status === "bloqueada" && etapas["06"]?.status === "concluida") {
    etapas["07"] = { ...etapas["07"], status: "liberada" }
  }
  const migrado: EstadoMigravel = {
    ...structuredClone(estado),
    versaoEtapas: 2,
    etapas,
    entregaveis: remapeiaLista(structuredClone(estado.entregaveis)),
    insumos: remapeiaLista(structuredClone(estado.insumos)),
    perguntas: remapeiaLista(structuredClone(estado.perguntas)),
    filaAutomatica: remapeiaLista(structuredClone(estado.filaAutomatica)),
  }
  if (estado.teste) {
    // Quem recomeçaria na antiga 07 recomeça na nova 07, a próxima que existe.
    const inicial = estado.teste.etapaInicial
    migrado.teste = { ...estado.teste, etapaInicial: descartada(inicial) ? "07" : novoIdEtapa(inicial) }
  }
  return migrado
}

export interface MovimentoArquivo {
  de: string
  para: string
}

const PASTA_ARQUIVO = "entrega/arquivo-etapa-07"

/** Posição na sequência: arquivar a 07 antiga (0) e só então 08→07, 09→08, 10→09, sempre para um destino já livre. */
const ORDEM_DE_FASE: Record<string, number> = { "07": 0, "08": 1, "09": 2, "10": 3 }

/** Número de 2 dígitos no nome dos arquivos: a apresentação final (10) vira 09. */
const NOVO_NUMERO: Record<string, string> = { "08": "07", "09": "08", "10": "09" }

/** Caminhos do prospect que carregam o número de uma etapa: para onde vai o da 07 antiga e como renumerar os demais. */
const PADROES: { regex: RegExp; arquivar: (m: RegExpMatchArray) => string; renomear: (m: RegExpMatchArray, numero: string) => string }[] = [
  {
    regex: /^\.app\/conversas\/(\d\d)\.jsonl$/,
    arquivar: (m) => `${PASTA_ARQUIVO}/conversas/${m[1]}.jsonl`,
    renomear: (_m, n) => `.app/conversas/${n}.jsonl`,
  },
  {
    regex: /^contexto\/decisoes\/(\d\d)-(.+)$/,
    arquivar: (m) => `${PASTA_ARQUIVO}/decisoes/${m[1]}-${m[2]}`,
    renomear: (m, n) => `contexto/decisoes/${n}-${m[2]}`,
  },
  {
    regex: /^entrega\/ativos-aprovados\/secoes\/(\d\d)-(.+)$/,
    arquivar: (m) => `${PASTA_ARQUIVO}/secoes/${m[1]}-${m[2]}`,
    renomear: (m, n) => `entrega/ativos-aprovados/secoes/${n}-${m[2]}`,
  },
  {
    regex: /^kit-de-teste\/(\d\d)\/(.+)$/,
    arquivar: (m) => `${PASTA_ARQUIVO}/kit-de-teste/${m[2]}`,
    renomear: (m, n) => `kit-de-teste/${n}/${m[2]}`,
  },
]

const PASTA_BENCHMARK = "entrega/ativos-aprovados/benchmark/"

function movimento(caminho: string): (MovimentoArquivo & { fase: number }) | null {
  // O benchmark de anúncios pertence todo à 07 antiga, sem número no caminho.
  if (caminho.startsWith(PASTA_BENCHMARK)) {
    return { de: caminho, para: `${PASTA_ARQUIVO}/benchmark/${caminho.slice(PASTA_BENCHMARK.length)}`, fase: 0 }
  }
  for (const padrao of PADROES) {
    const m = caminho.match(padrao.regex)
    if (!m) continue
    const numero = m[1] ?? ""
    if (numero === "07") return { de: caminho, para: padrao.arquivar(m), fase: 0 }
    const novo = NOVO_NUMERO[numero]
    const fase = ORDEM_DE_FASE[numero]
    if (!novo || fase === undefined) return null
    return { de: caminho, para: padrao.renomear(m, novo), fase }
  }
  return null
}

/**
 * Caminhos (relativos à pasta do prospect) que mudam na renumeração, na ordem em que podem ser movidos sem sobrescrever nada.
 * Não é idempotente: sobre uma pasta já migrada ela renumeraria de novo. Quem chama só pode usá-la com `classificarNumeracao(estado) === "atual"`.
 */
export function planoDeArquivos(caminhos: string[]): MovimentoArquivo[] {
  return caminhos
    .map(movimento)
    .filter((m): m is MovimentoArquivo & { fase: number } => m !== null)
    .sort((a, b) => a.fase - b.fase || (a.de < b.de ? -1 : a.de > b.de ? 1 : 0))
    .map(({ de, para }) => ({ de, para }))
}

/** Não é idempotente (remapeia as etapas de novo se o manifesto já está migrado): chamar só quando `classificarNumeracao(estado) === "atual"`. */
export function migrarManifesto(m: ManifestoMigravel): ManifestoMigravel {
  const kit: Record<string, string[]> = {}
  for (const [etapa, arquivos] of Object.entries(m.kit)) {
    if (!descartada(etapa)) kit[novoIdEtapa(etapa)] = [...arquivos]
  }
  return {
    ...m,
    arquivos: remapeiaLista(m.arquivos),
    kit,
  }
}
