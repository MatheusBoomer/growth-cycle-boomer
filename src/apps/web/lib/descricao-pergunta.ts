/**
 * Descrição de pergunta em markdown. Itens "P1 …, P2 …" que o agente mandou corridos num parágrafo só
 * (ilegível no card) ganham uma linha cada; o ideal é o agente já mandar uma linha por item.
 */
export function formatarDescricao(texto: string): string {
  const t = texto.trim()
  if (t.includes("\n")) return t
  const itens = t.match(/(?:^|\s)P\d+ /g)
  return itens && itens.length >= 2 ? t.replace(/\s+(P\d+ )/g, "\n$1") : t
}
