// "Responder a este trecho": a resposta do agente entra no campo de mensagem como citação markdown.

export function citacao(trecho: string): string {
  const linhas = trecho.trim().split("\n")
  return `${linhas.map((l) => (l.trim() ? `> ${l.trim()}` : ">")).join("\n")}\n\n`
}

export function primeiroParagrafo(markdown: string): string {
  return markdown.trim().split(/\n\s*\n/)[0] ?? ""
}

/** O que vai entre o texto já digitado e o trecho inserido no cursor. */
export function separadorAntes(antes: string, trecho: string): string {
  if (!antes) return ""
  if (trecho.startsWith(">")) return antes.endsWith("\n\n") ? "" : antes.endsWith("\n") ? "\n" : "\n\n"
  return /\s$/.test(antes) ? "" : " "
}
