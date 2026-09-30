/** Colunas da área de trabalho: id do painel → largura em % (0 a 100), como no react-resizable-panels. */
export type Layout = Record<string, number>

const LARGURA_INICIAL_VISUALIZADOR = 50

function valido(salvo: Layout | null, atual: Layout, aberto: boolean): salvo is Layout {
  if (!salvo) return false
  const chaves = Object.keys(atual)
  if (Object.keys(salvo).length !== chaves.length || !chaves.every((c) => typeof salvo[c] === "number")) return false
  const soma = chaves.reduce((t, c) => t + salvo[c]!, 0)
  return Math.abs(soma - 100) < 1 && (salvo.visualizador! > 0) === aberto
}

/**
 * Layout a aplicar quando o visualizador abre ou fecha: o salvo daquela combinação, se houver;
 * senão, ao abrir ele ocupa metade da largura (tirada proporcionalmente das outras colunas) e,
 * ao fechar, a largura dele volta para o chat.
 */
export function layoutParaVisualizador(atual: Layout, salvo: Layout | null, aberto: boolean): Layout {
  if (valido(salvo, atual, aberto)) return salvo
  const largura = atual.visualizador ?? 0
  if (!aberto) return { ...atual, chat: (atual.chat ?? 0) + largura, visualizador: 0 }
  const escala = (100 - LARGURA_INICIAL_VISUALIZADOR) / (100 - largura)
  const novo: Layout = {}
  for (const [id, tamanho] of Object.entries(atual)) novo[id] = id === "visualizador" ? LARGURA_INICIAL_VISUALIZADOR : tamanho * escala
  return novo
}

interface ElementoFoco {
  tagName: string
  isContentEditable: boolean
  closest: (seletor: string) => unknown
}

/** O foco está num lugar onde Esc tem outro sentido (campo de texto, editor, diálogo)? */
export function alvoDeDigitacao(el: ElementoFoco | null): boolean {
  if (!el) return false
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return true
  return el.closest('[role="dialog"], [role="alertdialog"], dialog') !== null
}

// Larguras lembradas no navegador. No servidor (render inicial do Next) não há localStorage, e em
// janela anônima ele pode recusar: nos dois casos, vale o layout padrão.
function chave(aberto: boolean): string {
  return `area-de-trabalho:${aberto ? "com" : "sem"}-visualizador`
}

export function lerLayout(aberto: boolean): Layout | null {
  try {
    if (typeof window === "undefined") return null
    const texto = window.localStorage.getItem(chave(aberto))
    return texto ? (JSON.parse(texto) as Layout) : null
  } catch {
    return null
  }
}

export function salvarLayout(aberto: boolean, layout: Layout): void {
  try {
    window.localStorage.setItem(chave(aberto), JSON.stringify(layout))
  } catch {
    // sem armazenamento: o layout só não fica lembrado
  }
}
