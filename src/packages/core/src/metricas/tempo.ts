/** Classificação do tempo de trabalho em blocos de 30 s: agente, ativo, ocioso ou descartado. Sem I/O. */
import { normalizarEmail } from "../papeis"
import type { EtapaId } from "../tipos"
import type { BlocoClassificado, Categoria, Limites, LinhaPresenca, LinhaUso, TempoSegundos } from "./tipos"

const BLOCO_MS = 30_000
const BLOCO_SEGUNDOS = 30
const OCIOSO_PADRAO_MIN = 5
const DESCARTE_PADRAO_MIN = 15
/**
 * Buraco máximo, em blocos sem aviso, que ainda mantém a sequência de ociosidade (2 min). O navegador
 * atrasa os temporizadores de uma aba escondida (cerca de um aviso por minuto), então avisos legítimos
 * deixam blocos vazios entre si.
 */
export const LACUNA_MAXIMA_BLOCOS = 4

function numeroDoBloco(epochMs: number): number {
  return Math.floor(epochMs / BLOCO_MS)
}

function minutosPositivos(valor: string | undefined, padrao: number): number {
  if (valor === undefined) return padrao
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : padrao
}

/** Lê os limites do ambiente. Valor ausente, inválido ou não positivo cai no padrão (5 e 15). */
export function limitesDoAmbiente(env: Record<string, string | undefined>): Limites {
  return {
    ociosoMin: minutosPositivos(env.PLANEJAMENTO_OCIOSO_MIN, OCIOSO_PADRAO_MIN),
    descarteMin: minutosPositivos(env.PLANEJAMENTO_DESCARTE_MIN, DESCARTE_PADRAO_MIN),
  }
}

interface Marca {
  etapa: EtapaId
  categoria: "agente" | "ativo" | "ocioso"
  /** Instante usado para escolher a etapa quando há várias marcas no mesmo bloco. */
  ordem: number
}

/**
 * Cada bloco de 30 s (alinhado ao relógio) de cada pessoa em cada projeto recebe uma categoria.
 * Prioridade: agente, depois ativo, depois ocioso. Uma sequência de blocos ociosos consecutivos
 * passa a descartado depois de `descarteMin * 2` blocos de tempo decorrido desde o início dela. A sequência
 * atravessa buracos de até `LACUNA_MAXIMA_BLOCOS` blocos sem aviso; um buraco maior, um bloco ativo ou de
 * agente a encerra. Datas inválidas são ignoradas. O resultado não depende da ordem da entrada.
 */
export function classificarTempo(
  presencas: LinhaPresenca[],
  usos: LinhaUso[],
  limites: Limites,
): BlocoClassificado[] {
  const limiteOciosoS = limites.ociosoMin * 60
  const blocosParaDescarte = limites.descarteMin * 2

  // (slug, email) -> bloco -> marca de agente e marca de presença, separadas porque o agente vence.
  const pessoas = new Map<string, { slug: string; email: string; agente: Map<number, Marca>; aviso: Map<number, Marca> }>()
  const pessoa = (slug: string, email: string) => {
    const chave = JSON.stringify([slug, email])
    let p = pessoas.get(chave)
    if (!p) {
      p = { slug, email, agente: new Map(), aviso: new Map() }
      pessoas.set(chave, p)
    }
    return p
  }

  for (const uso of usos) {
    if (uso.autor === null) continue
    const p = pessoa(uso.slug, normalizarEmail(uso.autor))
    const inicioMs = Date.parse(uso.inicio)
    const ordem = Date.parse(uso.fim)
    if (Number.isNaN(inicioMs) || Number.isNaN(ordem)) continue
    // O fim do turno é exclusivo: um turno que termina na fronteira de um bloco não entra no seguinte.
    const de = numeroDoBloco(inicioMs)
    const ate = Math.max(de, numeroDoBloco(ordem - 1))
    for (let bloco = de; bloco <= ate; bloco++) {
      const atual = p.agente.get(bloco)
      if (!atual || ordem > atual.ordem || (ordem === atual.ordem && uso.etapa > atual.etapa)) {
        p.agente.set(bloco, { etapa: uso.etapa, categoria: "agente", ordem })
      }
    }
  }

  for (const aviso of presencas) {
    const ordem = Date.parse(aviso.em)
    if (Number.isNaN(ordem)) continue
    const p = pessoa(aviso.slug, normalizarEmail(aviso.email))
    const bloco = numeroDoBloco(ordem)
    const ativo = aviso.visivel && aviso.segundosSemInteracao < limiteOciosoS
    const atual = p.aviso.get(bloco)
    const etapaMaisRecente =
      !atual || ordem > atual.ordem || (ordem === atual.ordem && aviso.etapa > atual.etapa)
    p.aviso.set(bloco, {
      etapa: etapaMaisRecente ? aviso.etapa : atual.etapa,
      categoria: ativo || atual?.categoria === "ativo" ? "ativo" : "ocioso",
      ordem: etapaMaisRecente ? ordem : atual.ordem,
    })
  }

  const resultado: BlocoClassificado[] = []
  const ordenadas = [...pessoas.values()].sort(
    (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.email < b.email ? -1 : a.email > b.email ? 1 : 0),
  )

  for (const p of ordenadas) {
    const numeros = [...new Set([...p.agente.keys(), ...p.aviso.keys()])].sort((a, b) => a - b)
    // Primeiro bloco da sequência de ociosidade em curso e o último bloco ocioso visto nela.
    let inicioSequencia: number | null = null
    let ultimoOcioso = 0
    for (const bloco of numeros) {
      const marca = p.agente.get(bloco) ?? p.aviso.get(bloco)!

      let categoria: Categoria = marca.categoria
      if (marca.categoria === "ocioso") {
        const buraco = bloco - ultimoOcioso - 1
        if (inicioSequencia === null || buraco > LACUNA_MAXIMA_BLOCOS) inicioSequencia = bloco
        ultimoOcioso = bloco
        if (bloco - inicioSequencia >= blocosParaDescarte) categoria = "descartado"
      } else {
        inicioSequencia = null
      }
      resultado.push({ slug: p.slug, email: p.email, etapa: marca.etapa, bloco, categoria })
    }
  }
  return resultado
}

/** Soma o tempo por chave escolhida pelo chamador. Cada bloco vale 30 s. */
export function somarTempo(
  blocos: BlocoClassificado[],
  chave: (b: BlocoClassificado) => string,
): Map<string, TempoSegundos> {
  const mapa = new Map<string, TempoSegundos>()
  for (const b of blocos) {
    const k = chave(b)
    let t = mapa.get(k)
    if (!t) {
      t = { agente: 0, ativo: 0, ocioso: 0, descartado: 0 }
      mapa.set(k, t)
    }
    t[b.categoria] += BLOCO_SEGUNDOS
  }
  return mapa
}

/** Tempo útil: o do agente trabalhando mais o da pessoa ativa. */
export function tempoUtil(t: TempoSegundos): number {
  return t.agente + t.ativo
}
