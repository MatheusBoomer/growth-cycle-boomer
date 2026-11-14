/**
 * Marca de "acabou de entrar": o retorno do Google (/auth/callback) grava este cookie e a home monta a entrada
 * "Bem-vindo ao Growth Cycle" enquanto ele existir. A entrada apaga o cookie ao montar, então refresh, abrir o app
 * já logado ou trocar de tela nunca a mostram de novo.
 */
export const COOKIE_BOAS_VINDAS = "gc-boas-vindas"

/** O cookie de boas-vindas está no navegador? (Voltar do navegador restaura a home do cache sem passar pelo servidor.) */
export function temCookieBoasVindas(): boolean {
  return document.cookie.split("; ").includes(`${COOKIE_BOAS_VINDAS}=1`)
}

/** Apaga o cookie de boas-vindas no navegador (ele não é httpOnly justamente para isto). */
export function apagarCookieBoasVindas(): void {
  document.cookie = `${COOKIE_BOAS_VINDAS}=; Max-Age=0; Path=/`
}
