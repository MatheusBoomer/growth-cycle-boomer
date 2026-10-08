// Menções de arquivo no chat: no campo de mensagem o analista vê "@caminho" (relativo à pasta do
// prospect); o agente roda na raiz do projeto, então ao enviar acrescenta-se um rodapé com o
// caminho completo de cada arquivo mencionado e com os anexos enviados.

const MENCAO = /(^|\s)@([\p{L}\p{N}_\-./~$]+\.[\p{L}\p{N}]{1,5})/gu
const RODAPE = "\n\n[Arquivos mencionados]\n"
const RODAPE_ANEXOS = "\n\n[Anexos]\n"

export function extrairMencoes(texto: string): string[] {
  const vistos = new Set<string>()
  for (const m of texto.matchAll(MENCAO)) vistos.add(m[2]!)
  return [...vistos]
}

export function textoParaAgente(texto: string, slug: string, anexos: string[] = []): string {
  const mencoes = extrairMencoes(texto)
  let saida = texto
  if (mencoes.length > 0) saida += `${RODAPE}${mencoes.map((m) => `- clientes/${slug}/${m}`).join("\n")}`
  if (anexos.length > 0) saida += `${RODAPE_ANEXOS}${anexos.map((c) => `- ${c}`).join("\n")}`
  return saida
}

/** Posição do rodapé; aceita também no início do texto, pois a rota guarda a mensagem com trim (sem as quebras iniciais). */
function posicaoDoRodape(texto: string, rodape: string): number {
  return texto.startsWith(rodape.slice(2)) ? 0 : texto.indexOf(rodape)
}

/** Mensagem como o analista escreveu, sem os rodapés técnicos para o agente. */
export function semRodape(texto: string): string {
  const cortes = [posicaoDoRodape(texto, RODAPE), posicaoDoRodape(texto, RODAPE_ANEXOS)].filter((i) => i !== -1)
  return cortes.length === 0 ? texto : texto.slice(0, Math.min(...cortes))
}

/** Caminhos do rodapé [Anexos] (como o app devolveu no upload). */
export function extrairAnexos(texto: string): string[] {
  const i = posicaoDoRodape(texto, RODAPE_ANEXOS)
  if (i === -1) return []
  const inicio = i === 0 && texto.startsWith(RODAPE_ANEXOS.slice(2)) ? RODAPE_ANEXOS.length - 2 : i + RODAPE_ANEXOS.length
  return texto
    .slice(inicio)
    .split("\n")
    .map((l) => l.match(/^- (.+)$/)?.[1])
    .filter((c): c is string => c !== undefined)
}

/** Nome para mostrar: último trecho do caminho, sem o prefixo numérico que o upload acrescenta. */
export function nomeDoAnexo(caminho: string): string {
  return (caminho.split("/").pop() ?? caminho).replace(/^\d+-/, "")
}

/** Caminho relativo à pasta do prospect (o que o visualizador espera). */
export function caminhoNoProspect(caminho: string, slug: string): string {
  const prefixo = `clientes/${slug}/`
  return caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : caminho
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
