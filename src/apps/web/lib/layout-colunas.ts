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
 *
 * `painel` (a coluna 3): o estado atual dela prevalece sobre o do layout salvo. Recolhida continua recolhida (a
 * largura vai para o chat) e aberta continua aberta (volta com `largura` se o salvo a tinha recolhido). Sem
 * `painel`, vale o layout escolhido como está.
 */
export function layoutParaVisualizador(atual: Layout, salvo: Layout | null, aberto: boolean, painel?: { recolhido: boolean; largura: number }): Layout {
  const r = escolherLayout(atual, salvo, aberto)
  if (!painel) return r
  if (painel.recolhido) return (r.painel ?? 0) > 0 ? { ...r, chat: (r.chat ?? 0) + r.painel!, painel: 0 } : r
  return (r.painel ?? 0) === 0 ? layoutParaPainel(r, true, painel.largura) : r
}

function escolherLayout(atual: Layout, salvo: Layout | null, aberto: boolean): Layout {
  if (valido(salvo, atual, aberto)) return salvo
  const largura = atual.visualizador ?? 0
  if (!aberto) return { ...atual, chat: (atual.chat ?? 0) + largura, visualizador: 0 }
  const escala = (100 - LARGURA_INICIAL_VISUALIZADOR) / (100 - largura)
  const novo: Layout = {}
  for (const [id, tamanho] of Object.entries(atual)) novo[id] = id === "visualizador" ? LARGURA_INICIAL_VISUALIZADOR : tamanho * escala
  return novo
}

/**
 * Com o visualizador fechado, a divisória visível à esquerda do painel lateral fica entre ele e o visualizador: arrastar
 * o painel para a direita dava a largura ao visualizador fechado, que aparecia como uma coluna em branco. Aqui essa
 * largura volta para a área de trabalho. Devolve null quando não há o que corrigir.
 */
export function semVisualizadorFantasma(layout: Layout, visualizadorAberto: boolean): Layout | null {
  const sobra = layout.visualizador ?? 0
  if (visualizadorAberto || sobra <= 0) return null
  return { ...layout, chat: (layout.chat ?? 0) + sobra, visualizador: 0 }
}

/** Largura mínima (%) que a área de trabalho mantém quando o painel lateral volta. */
const CHAT_MINIMO = 25

/**
 * Layout ao recolher ou mostrar o painel lateral pelo botão. Recolher pela API do grupo entregaria a
 * largura ao vizinho do painel (o visualizador, quase sempre fechado); aqui ela vai para a área de
 * trabalho. Ao mostrar, o painel volta com `largura` (%), tirada da área de trabalho ou, se ela
 * ficaria estreita demais, proporcionalmente das outras colunas.
 */
export function layoutParaPainel(atual: Layout, aberto: boolean, largura: number): Layout {
  const painel = atual.painel ?? 0
  if (!aberto) return { ...atual, chat: (atual.chat ?? 0) + painel, painel: 0 }
  const falta = largura - painel
  if ((atual.chat ?? 0) - falta >= CHAT_MINIMO) return { ...atual, chat: (atual.chat ?? 0) - falta, painel: largura }
  const escala = (100 - largura) / (100 - painel)
  const novo: Layout = {}
  for (const [id, tamanho] of Object.entries(atual)) novo[id] = id === "painel" ? largura : tamanho * escala
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
export function chaveColunas(visualizadorAberto: boolean): string {
  return `area-de-trabalho:${visualizadorAberto ? "com" : "sem"}-visualizador`
}

export const CHAVE_COLUNA_DIREITA = "area-de-trabalho:coluna-direita"

export function lerLayout(chave: string): Layout | null {
  try {
    if (typeof window === "undefined") return null
    const texto = window.localStorage.getItem(chave)
    return texto ? (JSON.parse(texto) as Layout) : null
  } catch {
    return null
  }
}

export function salvarLayout(chave: string, layout: Layout): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(layout))
  } catch {
    // sem armazenamento: o layout só não fica lembrado
  }
}
