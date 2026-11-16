/** Cores do fluxograma no tema do app: as três classes do catálogo (aprovação, subagente, entrega) e a base. */
export interface CoresFluxo {
  fundo: string
  texto: string
  borda: string
  textoApagado: string
  acento: string
  azul: string
  verde: string
}

/**
 * Valor de um token do CSS como `#rrggbb`: aceita `#rgb` (o tema claro usa `#fff`) e `#rrggbb`; qualquer outra coisa
 * (rgb(), color-mix, vazio) vira `null` e o chamador usa o padrão do tema.
 */
export function hexCompleto(valor: string): string | null {
  const v = valor.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}

/** Mistura `cor` (hex) sobre `fundo` (hex) na proporção dada: o Mermaid não entende color-mix nem rgba com var(). */
export function misturar(cor: string, fundo: string, proporcao: number): string {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [a, b] = [c(cor), c(fundo)]
  return `#${a.map((v, i) => Math.round(v * proporcao + b[i]! * (1 - proporcao)).toString(16).padStart(2, "0")).join("")}`
}

/**
 * Troca as `classDef` de checkpoint, subagente e entrega pelas cores do tema (os .mmd fixam tons claros que no escuro
 * viram caixas pastel). As outras linhas ficam como estão.
 */
export function comCoresDoTema(codigo: string, cores: CoresFluxo): string {
  const classe = (cor: string) => `fill:${misturar(cor, cores.fundo, 0.14)},stroke:${cor},color:${cores.texto}`
  const novas: Record<string, string> = { checkpoint: classe(cores.acento), subagente: classe(cores.azul), entrega: classe(cores.verde) }
  return codigo.replace(/^(\s*classDef\s+)(checkpoint|subagente|entrega)\s+.*$/gm, (_l, inicio: string, nome: string) => `${inicio}${nome} ${novas[nome]}`)
}

/** Variáveis do tema "base" do Mermaid a partir das cores do app. */
export function variaveisMermaid(cores: CoresFluxo) {
  return {
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontSize: "13px",
    background: cores.fundo,
    primaryColor: cores.fundo,
    primaryTextColor: cores.texto,
    primaryBorderColor: cores.borda,
    lineColor: cores.textoApagado,
    textColor: cores.texto,
    edgeLabelBackground: cores.fundo,
    clusterBkg: cores.fundo,
    clusterBorder: cores.borda,
  }
}
