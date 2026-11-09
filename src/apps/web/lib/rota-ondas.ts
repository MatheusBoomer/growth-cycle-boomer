/** Telas que ganham o fundo de ondas ASCII: home, login e a tela do projeto. As demais (admin etc.) mantêm o fundo de brilhos. */
export function rotaUsaOndas(caminho: string): boolean {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho
  if (limpo === "/" || limpo === "/login") return true
  // `/prospects/<slug>` e o que vier abaixo dele; `/prospects` sem slug não é tela do projeto.
  return /^\/prospects\/[^/]+(\/|$)/.test(limpo)
}
