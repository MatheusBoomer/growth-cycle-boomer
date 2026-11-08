import { readFileSync } from "node:fs"
import path from "node:path"
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

export const CAMINHO_SUGESTOES = ".claude/skills/_shared/sugestoes-modelos.json"

/** Alvos configuráveis de uma etapa: o agente principal e os subagentes que ela aciona. */
export function alvosDaEtapa(catalogo: Catalogo, etapa: EtapaId): string[] {
  const e = catalogo.etapas.find((x) => x.id === etapa)
  if (!e) throw new Error(`Etapa desconhecida no catálogo: ${etapa}`)
  return [ALVO_PRINCIPAL, ...e.subagentes]
}

export function carregarSugestoes(raiz: string, catalogo: Catalogo): Sugestao[] {
  const bruto = JSON.parse(readFileSync(path.join(raiz, CAMINHO_SUGESTOES), "utf8")) as Sugestao[]
  if (!Array.isArray(bruto)) throw new Error("sugestoes-modelos.json: o conteúdo deve ser uma lista")
  for (const s of bruto) {
    const etapa = catalogo.etapas.find((e) => e.id === s.etapa)
    if (!etapa) throw new Error(`sugestoes-modelos.json: etapa inexistente "${s.etapa}"`)
    if (!alvosDaEtapa(catalogo, etapa.id).includes(s.alvo)) {
      throw new Error(`sugestoes-modelos.json: o alvo "${s.alvo}" não existe na etapa ${s.etapa}`)
    }
    if (typeof s.modelo !== "string" || s.modelo.trim() === "") {
      throw new Error(`sugestoes-modelos.json: a sugestão da etapa ${s.etapa} (${s.alvo}) precisa de modelo`)
    }
    if (s.esforco !== null && !(NIVEIS_ESFORCO as readonly string[]).includes(s.esforco)) {
      throw new Error(`sugestoes-modelos.json: esforço inválido "${s.esforco}" na etapa ${s.etapa} (${s.alvo})`)
    }
    if (typeof s.motivo !== "string" || s.motivo.trim() === "") {
      throw new Error(`sugestoes-modelos.json: a sugestão da etapa ${s.etapa} (${s.alvo}) precisa de motivo`)
    }
  }
  return bruto
}

export interface ModeloDisponivel {
  value: string
  nome: string
  descricao: string
  esforcos: NivelEsforco[]
  /** true para haiku, sonnet e opus: valem sempre, e acompanham a versão mais nova do SDK. */
  apelido: boolean
}

export interface ListaDeModelos {
  modelos: ModeloDisponivel[]
  /** false quando o SDK não respondeu: só os apelidos estão na lista. */
  completa: boolean
}

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
    }
  })
  const vistos = new Set<string>(modelos.map((m) => m.value))
  for (const l of linhas) {
    if (vistos.has(l.value)) continue
    vistos.add(l.value)
    modelos.push({ value: l.value, nome: l.displayName, descricao: l.description, esforcos: esforcosDaLinha(l), apelido: false })
  }
  return { modelos, completa: info !== null }
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
