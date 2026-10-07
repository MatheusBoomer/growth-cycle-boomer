/** Slide do roteiro-apresentacao.json (ver scripts/gerar_apresentacao.py, ESQUEMA). */
export type SlideRoteiro = {
  tipo: string
  pendencia?: string
  fonte?: string
  [campo: string]: unknown
}

const semNegrito = (t: unknown) => (typeof t === "string" ? t.replaceAll("**", "") : "")
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(semNegrito) : [])

const NOMES: Record<string, string> = { capa: "Capa", jornada: "Jornada", obrigado: "Obrigado" }

export function resumoDoSlide(s: SlideRoteiro): { titulo: string; linhas: string[]; imagens: string[] } {
  const imagens = [s.imagem, ...(Array.isArray(s.imagens) ? s.imagens : [])].filter((x): x is string => typeof x === "string")
  if (s.tipo === "capa") return { titulo: `Capa · ${semNegrito(s.prospect)}`, linhas: [], imagens }
  if (s.tipo === "divisoria") return { titulo: `${semNegrito(s.numero)} ${semNegrito(s.titulo)}`.trim(), linhas: [], imagens }
  if (s.tipo === "analises_2_colunas") {
    const coluna = (c: unknown) => {
      const o = (c ?? {}) as { titulo?: string; itens?: unknown }
      return lista(o.itens).map((i) => `${semNegrito(o.titulo)}: ${i}`)
    }
    return { titulo: "Análises", linhas: [...coluna(s.esquerda), ...coluna(s.direita)], imagens }
  }
  const titulo = [semNegrito(s.titulo), semNegrito(s.subtitulo)].filter(Boolean).join(" · ") || NOMES[s.tipo] || s.tipo
  const prefixo = s.tipo === "benchmark" && s.concorrente ? `${semNegrito(s.concorrente)}: ` : ""
  const linhas = [...lista(s.conclusoes), ...lista(s.itens), ...lista(s.cartoes), ...(typeof s.texto === "string" ? [semNegrito(s.texto)] : [])]
  return { titulo: prefixo + titulo, linhas, imagens }
}
