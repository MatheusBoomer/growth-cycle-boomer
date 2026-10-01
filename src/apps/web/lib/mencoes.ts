// Menções de arquivo no chat: no campo de mensagem o analista vê "@caminho" (relativo à pasta do
// prospect); o agente roda na raiz do projeto, então ao enviar acrescenta-se um rodapé com o
// caminho completo de cada arquivo mencionado, como já acontece com os anexos.

const MENCAO = /(^|\s)@([\p{L}\p{N}_\-./~$]+\.[\p{L}\p{N}]{1,5})/gu
const RODAPE = "\n\n[Arquivos mencionados]\n"

export function extrairMencoes(texto: string): string[] {
  const vistos = new Set<string>()
  for (const m of texto.matchAll(MENCAO)) vistos.add(m[2]!)
  return [...vistos]
}

export function textoParaAgente(texto: string, slug: string): string {
  const mencoes = extrairMencoes(texto)
  if (mencoes.length === 0) return texto
  return `${texto}${RODAPE}${mencoes.map((m) => `- clientes/${slug}/${m}`).join("\n")}`
}

/** Mensagem como o analista escreveu, sem o rodapé técnico para o agente. */
export function semRodape(texto: string): string {
  const i = texto.indexOf(RODAPE)
  return i === -1 ? texto : texto.slice(0, i)
}

/** O "@termo" sendo digitado na posição do cursor, se houver. */
export function consultaDeMencao(texto: string, cursor: number): { inicio: number; termo: string } | null {
  for (let i = cursor - 1; i >= 0; i--) {
    const c = texto[i]!
    if (/\s/.test(c)) return null
    if (c === "@") {
      if (i > 0 && !/\s/.test(texto[i - 1]!)) return null
      return { inicio: i, termo: texto.slice(i + 1, cursor) }
    }
  }
  return null
}

/** Partes do texto para desenhar menções como etiquetas clicáveis. */
export function partesComMencoes(texto: string): Array<{ tipo: "texto"; valor: string } | { tipo: "mencao"; caminho: string }> {
  const partes: Array<{ tipo: "texto"; valor: string } | { tipo: "mencao"; caminho: string }> = []
  let ultimo = 0
  for (const m of texto.matchAll(MENCAO)) {
    const inicioMencao = m.index! + m[1]!.length
    if (inicioMencao > ultimo) partes.push({ tipo: "texto", valor: texto.slice(ultimo, inicioMencao) })
    partes.push({ tipo: "mencao", caminho: m[2]! })
    ultimo = inicioMencao + 1 + m[2]!.length
  }
  if (ultimo < texto.length) partes.push({ tipo: "texto", valor: texto.slice(ultimo) })
  return partes
}
