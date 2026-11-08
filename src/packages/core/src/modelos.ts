import { ErroEntrada } from "./erros"
import type { InfoModeloSdk } from "./executor/modelos-sdk"
import type { Catalogo, EtapaId } from "./tipos"

export const NIVEIS_ESFORCO = ["low", "medium", "high", "xhigh", "max"] as const
export type NivelEsforco = (typeof NIVEIS_ESFORCO)[number]

/** Alvo de uma configuração que vale para o agente principal da etapa. */
export const ALVO_PRINCIPAL = "principal"
export const SUBAGENTES_CONFIGURAVEIS = ["analista-dados", "pesquisador-benchmark"] as const

export interface EscolhaModelo {
  modelo: string | null
  esforco: NivelEsforco | null
}

export interface Sugestao {
  etapa: EtapaId
  alvo: string
  modelo: string
  esforco: NivelEsforco | null
  motivo: string
}

/** Alvos configuráveis de uma etapa: o agente principal e os subagentes que ela aciona. */
export function alvosDaEtapa(catalogo: Catalogo, etapa: EtapaId): string[] {
  const e = catalogo.etapas.find((x) => x.id === etapa)
  if (!e) throw new Error(`Etapa desconhecida no catálogo: ${etapa}`)
  return [ALVO_PRINCIPAL, ...e.subagentes]
}

export interface ModeloDisponivel {
  value: string
  nome: string
  descricao: string
  esforcos: NivelEsforco[]
  /** true para haiku, sonnet e opus: valem sempre, e acompanham a versão mais nova do SDK. */
  apelido: boolean
  /** Só nos apelidos: o id fixo para o qual o apelido aponta hoje, quando o SDK informou. */
  resolvido?: string
}

export interface ListaDeModelos {
  modelos: ModeloDisponivel[]
  /** Modelo que o Claude Code usa quando nada é escolhido (resolvedModel ou displayName da entrada `default` do SDK). */
  padrao: string | null
  /** false quando o SDK não respondeu: só os apelidos estão na lista. */
  completa: boolean
}

/** Entrada do SDK que descreve o modelo padrão: não é uma opção da lista. */
const ENTRADA_PADRAO = "default"

const APELIDOS = [
  { value: "haiku", nome: "Haiku (mais recente)" },
  { value: "sonnet", nome: "Sonnet (mais recente)" },
  { value: "opus", nome: "Opus (mais recente)" },
] as const
const ESFORCOS_PADRAO_APELIDO: NivelEsforco[] = ["low", "medium", "high"]

const temInfoDeEsforco = (l: InfoModeloSdk) => l.supportsEffort !== undefined || l.supportedEffortLevels !== undefined

function esforcosDaLinha(l: InfoModeloSdk): NivelEsforco[] {
  if (l.supportsEffort === false) return []
  return (l.supportedEffortLevels ?? []).filter((n) => (NIVEIS_ESFORCO as readonly string[]).includes(n))
}

/**
 * Lista que a tela de configuração oferece: os três apelidos no topo e, depois, os demais modelos
 * que o SDK informou. Com `info` nulo (SDK fora do ar), só os apelidos, e a lista sai incompleta.
 */
export function montarListaDeModelos(info: InfoModeloSdk[] | null): ListaDeModelos {
  const linhas = info ?? []
  const modelos: ModeloDisponivel[] = APELIDOS.map(({ value, nome }) => {
    const propria = linhas.find((l) => l.value === value)
    const resolvida = propria?.resolvedModel ? linhas.find((l) => l.value === propria.resolvedModel) : undefined
    const fonte = [propria, resolvida].find((l): l is InfoModeloSdk => l !== undefined && temInfoDeEsforco(l))
    return {
      value,
      nome,
      descricao: propria?.description ?? "",
      esforcos: fonte ? esforcosDaLinha(fonte) : [...ESFORCOS_PADRAO_APELIDO],
      apelido: true,
      ...(propria?.resolvedModel ? { resolvido: propria.resolvedModel } : {}),
    }
  })
  const vistos = new Set<string>(modelos.map((m) => m.value))
  for (const l of linhas) {
    if (l.value === ENTRADA_PADRAO || vistos.has(l.value)) continue
    vistos.add(l.value)
    modelos.push({ value: l.value, nome: l.displayName, descricao: l.description, esforcos: esforcosDaLinha(l), apelido: false })
  }
  const entradaPadrao = linhas.find((l) => l.value === ENTRADA_PADRAO)
  return { modelos, padrao: entradaPadrao ? (entradaPadrao.resolvedModel ?? entradaPadrao.displayName) : null, completa: info !== null }
}

export interface RotuloModelo {
  /** Família do modelo (`sonnet`, `opus`...), ou null quando o id não segue o padrão `claude-<familia>-<maior>-<menor>`. */
  familia: string | null
  texto: string
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** `claude-sonnet-5-5` vira `Sonnet 5.5`. Fora do padrão, vale o nome do SDK ou o próprio id. */
export function rotuloDoModelo(id: string, nomeSdk?: string): RotuloModelo {
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id)
  if (!m) return { familia: null, texto: nomeSdk ?? id }
  return { familia: m[1]!, texto: `${capitalizar(m[1]!)} ${m[2]}.${m[3]}` }
}

export interface SeloModelo {
  familia: string | null
  texto: string
  /** haiku, sonnet ou opus: a tela acrescenta `mais recente`. */
  apelido: boolean
  /** Versão fixa: a tela acrescenta `· fixo`. */
  fixo: boolean
  padrao: boolean
}

/** O que o selo de um modelo mostra. `null` (ou o valor `default` do SDK) é o modelo padrão. Os sufixos ficam a cargo da tela, a partir das flags. */
export function seloDoModelo(modelo: string | null, lista: ListaDeModelos): SeloModelo {
  if (modelo === null || modelo === ENTRADA_PADRAO) {
    const texto = lista.padrao === null ? "Padrão" : `Padrão (${rotuloDoModelo(lista.padrao).texto})`
    return { familia: null, texto, apelido: false, fixo: false, padrao: true }
  }
  if (APELIDOS.some((a) => a.value === modelo)) {
    const resolvido = lista.modelos.find((m) => m.value === modelo)?.resolvido
    const rotulo = resolvido ? rotuloDoModelo(resolvido) : null
    return { familia: modelo, texto: rotulo?.familia ? rotulo.texto : capitalizar(modelo), apelido: true, fixo: false, padrao: false }
  }
  const { familia, texto } = rotuloDoModelo(modelo, lista.modelos.find((m) => m.value === modelo)?.nome)
  return { familia, texto, apelido: false, fixo: true, padrao: false }
}

export const ROTULOS_ESFORCO: Record<NivelEsforco, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  xhigh: "Muito alto",
  max: "Máximo",
}

export const FRASES_ESFORCO: Record<NivelEsforco | "padrao", string> = {
  padrao: "deixa o Claude Code decidir",
  low: "respostas rápidas, pouca reflexão",
  medium: "equilíbrio entre rapidez e cuidado",
  high: "pensa com cuidado antes de responder",
  xhigh: "reflexão longa, para problemas difíceis",
  max: "o máximo de reflexão, mais lento e caro",
}

/** Quantos dos cinco segmentos da barra de esforço acendem: 0 para o padrão (null), 1 para `low` até 5 para `max`. */
export function segmentosDoEsforco(e: NivelEsforco | null): number {
  return e === null ? 0 : NIVEIS_ESFORCO.indexOf(e) + 1
}

/** Uso de uma etapa no resumo do cartão (calculado pelo serviço, exibido pela tela). */
export interface UsoDaEtapa {
  mediaUsd: number | null
  projetos: number
  modeloRecente: string | null
}

/** Recusa (400) um modelo fora da lista e um esforço que o modelo não aceita; a mensagem diz o que vale. */
export function validarEscolha(e: EscolhaModelo, lista: ListaDeModelos): void {
  if (e.esforco !== null && !(NIVEIS_ESFORCO as readonly string[]).includes(e.esforco)) {
    throw new ErroEntrada(`Esforço "${e.esforco}" desconhecido. Os níveis são: ${NIVEIS_ESFORCO.join(", ")}.`)
  }
  if (e.modelo === null) return
  const modelo = lista.modelos.find((m) => m.value === e.modelo)
  if (!modelo) {
    const parcial = lista.completa ? "" : " (lista parcial: não foi possível consultar os modelos da conta)"
    throw new ErroEntrada(
      `Modelo "${e.modelo}" não está disponível. Modelos válidos: ${lista.modelos.map((m) => m.value).join(", ")}${parcial}.`,
    )
  }
  if (e.esforco === null || modelo.esforcos.includes(e.esforco)) return
  throw new ErroEntrada(
    modelo.esforcos.length === 0
      ? `O modelo "${modelo.value}" não aceita esforço; deixe o esforço em Padrão.`
      : `O modelo "${modelo.value}" não aceita o esforço "${e.esforco}". Níveis aceitos: ${modelo.esforcos.join(", ")}.`,
  )
}

/** Guarda a lista por `ttlMs`. Falha da busca devolve só os apelidos e não fica em cache. */
export function criarCacheDeModelos(
  buscar: () => Promise<InfoModeloSdk[]>,
  agora: () => number = Date.now,
  ttlMs: number = 3_600_000,
): () => Promise<ListaDeModelos> {
  let guardada: { lista: ListaDeModelos; em: number } | null = null
  let buscando: Promise<ListaDeModelos> | null = null
  const buscarEGuardar = async (): Promise<ListaDeModelos> => {
    try {
      const lista = montarListaDeModelos(await buscar())
      guardada = { lista, em: agora() }
      return lista
    } catch (e) {
      console.error(`Falha ao consultar os modelos do SDK: ${e instanceof Error ? e.message : String(e)}`)
      return montarListaDeModelos(null)
    } finally {
      buscando = null
    }
  }
  return async () => {
    if (guardada && agora() - guardada.em < ttlMs) return guardada.lista
    buscando ??= buscarEGuardar()
    return buscando
  }
}
