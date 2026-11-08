/** O pedaço do `document` que a atualização usa; os testes passam um falso. */
export interface DocumentoVisivel {
  readonly visibilityState: string
  addEventListener(tipo: "visibilitychange", ouvinte: () => void): void
  removeEventListener(tipo: "visibilitychange", ouvinte: () => void): void
}

/**
 * Chama `carregar` a cada `intervaloMs`, mas só com a aba visível, e uma vez quando ela volta a ficar visível (o
 * que mudou enquanto estava escondida aparece na hora, sem ficar consultando o servidor à toa). Não chama na
 * partida: quem começa a atualizar já carregou uma vez. Devolve a função que para tudo.
 */
export function atualizarEnquantoVisivel(
  carregar: () => void,
  intervaloMs: number,
  documento: DocumentoVisivel = document,
): () => void {
  const aoMudarVisibilidade = () => {
    if (documento.visibilityState === "visible") carregar()
  }
  const relogio = setInterval(aoMudarVisibilidade, intervaloMs)
  documento.addEventListener("visibilitychange", aoMudarVisibilidade)
  return () => {
    clearInterval(relogio)
    documento.removeEventListener("visibilitychange", aoMudarVisibilidade)
  }
}
