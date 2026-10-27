/** Região de um slide em % (0 a 100). */
export type Regiao = { x: number; y: number; w: number; h: number }

export interface Comentario {
  id: string
  /** Número do slide na prévia (apresentação) ou do bloco no roteiro, a partir de 1. */
  slide: number
  regiao: Regiao | null
  /** Campo do molde que a região atinge (titulo, conclusoes…), quando há mapa. */
  campo: string | null
  texto: string
  criadoEm: string
  enviadoEm: string | null
  /** E-mail de quem comentou; ausente sem login ou em comentários antigos. */
  autor?: string
}

export interface MapaPrevia {
  slides: { numero: number; titulo: string; campos: Record<string, Regiao> }[]
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

export function regiaoValida(r: unknown): r is Regiao {
  if (!r || typeof r !== "object") return false
  const { x, y, w, h } = r as Record<string, unknown>
  if (!num(x) || !num(y) || !num(w) || !num(h)) return false
  return x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 100.01 && y + h <= 100.01
}

function intersecao(a: Regiao, b: Regiao): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** Campo com maior sobreposição; null se nenhum cobre ao menos 20% da região. */
export function campoDaRegiao(r: Regiao, campos: Record<string, Regiao>): string | null {
  let melhor: string | null = null
  let maior = 0
  for (const [nome, caixa] of Object.entries(campos)) {
    const area = intersecao(r, caixa)
    if (area > maior) {
      maior = area
      melhor = nome
    }
  }
  return maior >= 0.2 * r.w * r.h ? melhor : null
}

/** Comentários ainda não enviados, na ordem em que vão numerados ao agente (e na tela). */
export function emOrdemDeEnvio(comentarios: Comentario[]): Comentario[] {
  return comentarios
    .filter((c) => !c.enviadoEm)
    .sort((a, b) => a.slide - b.slide || a.criadoEm.localeCompare(b.criadoEm))
}

export function textoDoAjuste(p: {
  titulo: string
  comentarios: Comentario[]
  rotulo: (slide: number) => string
  recortes: Record<string, string>
}): string {
  const linhas = [`Ajustes em "${p.titulo}" (${p.comentarios.length}):`]
  p.comentarios.forEach((c, i) => {
    let onde = "slide inteiro"
    if (c.regiao) {
      onde = `região: ${c.campo ?? "área marcada"}`
      if (p.recortes[c.id]) onde += ` (recorte: ${p.recortes[c.id]})`
    }
    linhas.push(`${i + 1}. ${p.rotulo(c.slide)} · ${onde}`, `   "${c.texto.trim()}"`)
  })
  linhas.push(
    "",
    "Corrija só o roteiro nos slides citados (abra cada recorte com Read para ver a região marcada), regere a apresentação e proponha de novo.",
  )
  return linhas.join("\n")
}
