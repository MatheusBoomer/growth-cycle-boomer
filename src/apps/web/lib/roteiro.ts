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
  // "benchmark": tipo reservado, sem uso no roteiro padrão (o deck de 5 seções não tem benchmarking)
  const prefixo = s.tipo === "benchmark" && s.concorrente ? `${semNegrito(s.concorrente)}: ` : ""
  const desafio =
    s.tipo === "desafio"
      ? [
          ...(typeof s.problema === "string" ? [`Problema: ${semNegrito(s.problema)}`] : []),
          ...lista(s.hipoteses).map((h) => `Hipótese: ${h}`),
          ...lista(s.solucoes).map((x) => `Solução: ${x}`),
          ...(typeof s.impacto === "string" ? [`Impacto: ${semNegrito(s.impacto)}`] : []),
        ]
      : []
  const linhas = [...lista(s.conclusoes), ...lista(s.itens), ...lista(s.cartoes), ...desafio, ...(typeof s.texto === "string" ? [semNegrito(s.texto)] : [])]
  return { titulo: prefixo + titulo, linhas, imagens }
}

export type Diferenca = { rotulo: string; removidos: string[]; adicionados: string[] }
export type StatusSlide = "igual" | "alterado" | "novo" | "movido"
export type SlideComparado = { slide: SlideRoteiro; numero: number; status: StatusSlide; diferencas: Diferenca[] }
export type SlideRemovido = { slide: SlideRoteiro; numeroAnterior: number; depoisDoNumero: number }
export type Comparacao = {
  slides: SlideComparado[]
  removidos: SlideRemovido[]
  resumo: { alterados: number; novos: number; removidos: number; movidos: number }
}

const estavel = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

const chaveDoSlide = (s: SlideRoteiro) => `${s.tipo}|${resumoDoSlide(s).titulo}`

function diferencasEntre(antes: SlideRoteiro, depois: SlideRoteiro): Diferenca[] {
  const a = resumoDoSlide(antes)
  const d = resumoDoSlide(depois)
  const opcional = (v: unknown) => (typeof v === "string" && v ? [v] : [])
  const saida: Diferenca[] = []
  const comparar = (rotulo: string, ant: string[], dep: string[]) => {
    const removidos = ant.filter((x) => !dep.includes(x))
    const adicionados = dep.filter((x) => !ant.includes(x))
    if (removidos.length || adicionados.length) saida.push({ rotulo, removidos, adicionados })
  }
  comparar("Título", [a.titulo], [d.titulo])
  comparar("Texto", a.linhas, d.linhas)
  comparar("Imagem", a.imagens, d.imagens)
  comparar("Pendência", opcional(antes.pendencia), opcional(depois.pendencia))
  comparar("Fonte", opcional(antes.fonte), opcional(depois.fonte))
  if (!saida.length && estavel(antes) !== estavel(depois)) saida.push({ rotulo: "Outros campos", removidos: [], adicionados: [] })
  return saida
}

/** Índices (em `seq`) que formam a maior subsequência crescente: os slides que ficaram na mesma ordem relativa. */
function maiorSubsequenciaCrescente(seq: number[]): Set<number> {
  const compr: number[] = []
  const pai: number[] = []
  for (let i = 0; i < seq.length; i++) {
    compr[i] = 1
    pai[i] = -1
    for (let j = 0; j < i; j++) {
      if (seq[j]! < seq[i]! && compr[j]! + 1 > compr[i]!) {
        compr[i] = compr[j]! + 1
        pai[i] = j
      }
    }
  }
  let fim = 0
  for (let i = 1; i < seq.length; i++) if (compr[i]! > compr[fim]!) fim = i
  const dentro = new Set<number>()
  for (let i = seq.length ? fim : -1; i >= 0; i = pai[i]!) dentro.add(i)
  return dentro
}

/**
 * Compara o roteiro novo com o anterior. Dois slides são o mesmo quando têm o mesmo tipo e título; os que sobram
 * casam pela posição (título editado) ou pela imagem. Slide que só mudou de lugar é "movido".
 */
export function compararRoteiros(anterior: SlideRoteiro[], novo: SlideRoteiro[]): Comparacao {
  const parDe = new Array<number>(novo.length).fill(-1) // índice novo -> índice anterior
  const usadoAnterior = new Set<number>()
  const fila = new Map<string, number[]>()
  anterior.forEach((s, i) => fila.set(chaveDoSlide(s), [...(fila.get(chaveDoSlide(s)) ?? []), i]))
  novo.forEach((s, i) => {
    const j = fila.get(chaveDoSlide(s))?.shift()
    if (j === undefined) return
    parDe[i] = j
    usadoAnterior.add(j)
  })
  novo.forEach((s, i) => {
    const j = anterior[i]
    if (parDe[i] !== -1 || !j || usadoAnterior.has(i) || j.tipo !== s.tipo) return
    parDe[i] = i
    usadoAnterior.add(i)
  })
  const primeiraImagem = (s: SlideRoteiro) => resumoDoSlide(s).imagens[0]
  novo.forEach((s, i) => {
    const img = primeiraImagem(s)
    if (parDe[i] !== -1 || !img) return
    const j = anterior.findIndex((a, k) => !usadoAnterior.has(k) && a.tipo === s.tipo && primeiraImagem(a) === img)
    if (j === -1) return
    parDe[i] = j
    usadoAnterior.add(j)
  })

  const casados = parDe.map((j, i) => ({ i, j })).filter((p) => p.j !== -1)
  const naOrdem = maiorSubsequenciaCrescente(casados.map((p) => p.j))
  const fora = new Set(casados.filter((_, k) => !naOrdem.has(k)).map((p) => p.i))

  const slides: SlideComparado[] = novo.map((slide, i) => {
    const j = parDe[i]!
    if (j === -1) return { slide, numero: i + 1, status: "novo", diferencas: [] }
    const diferencas = diferencasEntre(anterior[j]!, slide)
    const status: StatusSlide = diferencas.length ? "alterado" : fora.has(i) ? "movido" : "igual"
    return { slide, numero: i + 1, status, diferencas }
  })
  const removidos: SlideRemovido[] = anterior.flatMap((slide, j) => {
    if (usadoAnterior.has(j)) return []
    const antes = casados.filter((p) => p.j < j).map((p) => p.i + 1)
    return [{ slide, numeroAnterior: j + 1, depoisDoNumero: antes.length ? Math.max(...antes) : 0 }]
  })
  const conta = (st: StatusSlide) => slides.filter((s) => s.status === st).length
  return { slides, removidos, resumo: { alterados: conta("alterado"), novos: conta("novo"), removidos: removidos.length, movidos: conta("movido") } }
}
