/** Peças do login que valem no navegador e no servidor. Nada aqui toca em chave ou sessão. */

const MENSAGENS_DE_ERRO: Record<string, string> = {
  dominio: "Use a conta Google da Boomer (@boomer.com.br ou @gestaoboomer.com).",
  falha: "Não foi possível entrar agora. Tente de novo.",
}

/** Caminho da página de login. */
export const CAMINHO_LOGIN = "/login"

/** A rota está em /login (ou abaixo dele)? */
export function ehPaginaDeLogin(pathname: string | null | undefined): boolean {
  return pathname === CAMINHO_LOGIN || (typeof pathname === "string" && pathname.startsWith(`${CAMINHO_LOGIN}/`))
}

/** Texto para `?erro=` da página de login. Valor desconhecido, ausente ou em lista não mostra nada. */
export function mensagemDeErroLogin(erro: string | string[] | null | undefined): string | null {
  if (typeof erro !== "string") return null
  return Object.hasOwn(MENSAGENS_DE_ERRO, erro) ? (MENSAGENS_DE_ERRO[erro] ?? null) : null
}

/** Para onde ir quando a sessão acabou: /login com o caminho atual em `proximo`. Já em /login, null (sem laço). */
export function destinoDoLogin(pathname: string, search: string): string | null {
  if (ehPaginaDeLogin(pathname)) return null
  return `${CAMINHO_LOGIN}?proximo=${encodeURIComponent(pathname + search)}`
}

/**
 * Chamada de API respondeu 401 `nao_autenticado`: manda o navegador para o login. Devolve true se mandou.
 * `ir` é quem navega (padrão: `window.location.assign`); separado para o teste.
 */
export function tratarNaoAutenticado(
  status: number,
  codigo: string | null,
  local: { pathname: string; search: string },
  ir: (destino: string) => void,
): boolean {
  if (status !== 401 || codigo !== "nao_autenticado") return false
  const destino = destinoDoLogin(local.pathname, local.search)
  if (destino === null) return false
  ir(destino)
  return true
}
