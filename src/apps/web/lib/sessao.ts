import "@/lib/ambiente"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { dominiosPermitidos, emailPermitido, modoDeAutenticacao } from "@workspace/core/autenticacao"
import { ErroNaoAutenticado } from "@workspace/core/erros"

/** Quem está usando o app. `email` é null só no modo off (sem login, ninguém para identificar). */
export interface Usuario {
  email: string | null
}

export interface ConfiguracaoSupabase {
  url: string
  chave: string
}

/** Cookies da requisição no formato que o `@supabase/ssr` espera. */
export interface ArmazemDeCookies {
  getAll: () => { name: string; value: string }[] | null
  setAll: (cookies: { name: string; value: string; options: Record<string, unknown> }[], headers: Record<string, string>) => void
}

/**
 * URL e chave publicável do projeto, aparadas. Variável só de espaços vale como ausente (o `core` só
 * checa vazio), porque uma URL em branco faria o cliente falhar longe da causa.
 */
export function configuracaoSupabase(env: Record<string, string | undefined>): ConfiguracaoSupabase {
  const url = (env.SUPABASE_URL ?? "").trim()
  const chave = (env.SUPABASE_PUBLISHABLE_KEY ?? "").trim()
  if (url === "") throw new Error("PLANEJAMENTO_AUTH=google exige SUPABASE_URL no .env da raiz.")
  if (chave === "") throw new Error("PLANEJAMENTO_AUTH=google exige SUPABASE_PUBLISHABLE_KEY no .env da raiz.")
  return { url, chave }
}

/**
 * Atributos dos cookies de sessão e do PKCE. Eles guardam o token de acesso e o de renovação (num projeto
 * compartilhado com outro sistema), então o navegador não os entrega ao JavaScript da página (httpOnly) nem os
 * manda em requisição entre sites (lax). `seguro` vem do protocolo efetivo da requisição (https), e não do
 * endereço público: com http://127.0.0.1 e um endereço público https, um cookie Secure seria descartado.
 */
export function opcoesDeCookieDaSessao(seguro: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: seguro }
}

/**
 * Cliente do Supabase para este servidor, lendo e escrevendo a sessão nos cookies dados. Um por requisição.
 * `seguro`: a requisição chegou por https (marca os cookies gravados como Secure).
 */
export function clienteSupabaseDoServidor(armazem: ArmazemDeCookies, seguro: boolean, env: Record<string, string | undefined> = process.env) {
  const { url, chave } = configuracaoSupabase(env)
  return createServerClient(url, chave, { cookies: armazem, cookieOptions: opcoesDeCookieDaSessao(seguro) })
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

/** Prova controlada pelo servidor de que a identidade veio do Google (`app_metadata` o usuário não consegue escrever). */
function veioDoGoogle(appMetadata: unknown): boolean {
  if (!ehObjeto(appMetadata)) return false
  if (appMetadata.provider === "google") return true
  return Array.isArray(appMetadata.providers) && appMetadata.providers.includes("google")
}

/**
 * Transforma as claims já verificadas (getClaims confere a assinatura) em usuário. Exige e-mail em texto
 * de um domínio permitido e a prova de que a identidade é do Google em `app_metadata` (`provider` ou
 * `providers`). `user_metadata` é gravável pelo próprio usuário (updateUser, signUp), então NÃO vale como
 * prova: nele só importa o lado negativo. Com o Google como provedor o e-mail já foi verificado por ele no
 * login, então `email_verified` ausente é aceito; presente (no topo ou em `user_metadata`) precisa ser o
 * booleano true, e qualquer outro valor (false, "true", 1) recusa. Qualquer outra forma vira null.
 */
export function usuarioDeClaims(claims: unknown, dominios: readonly string[]): Usuario | null {
  if (!ehObjeto(claims)) return null
  const { email } = claims
  if (typeof email !== "string" || !emailPermitido(email, dominios)) return null
  if (!veioDoGoogle(claims.app_metadata)) return null

  const metadados = claims.user_metadata
  if (metadados !== undefined && metadados !== null && !ehObjeto(metadados)) return null
  const indicadores = [claims.email_verified, ehObjeto(metadados) ? metadados.email_verified : undefined]
  if (indicadores.some((v) => v !== undefined && v !== true)) return null

  return { email: email.toLowerCase() }
}

/** Usuário da sessão atual (cookies de `next/headers`, só leitura), ou null sem sessão válida. No modo off devolve { email: null }. */
export async function usuarioDaRequisicao(): Promise<Usuario | null> {
  const env = process.env
  if (modoDeAutenticacao(env) === "off") return { email: null }

  const armazem = await cookies()
  const supabase = clienteSupabaseDoServidor(
    {
      getAll: () => armazem.getAll(),
      // Só lê: quem renova a sessão e grava os cookies (com os atributos certos) é o proxy.
      setAll: () => {},
    },
    false,
    env,
  )
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data) return null
    return usuarioDeClaims(data.claims, dominiosPermitidos(env.PLANEJAMENTO_DOMINIOS_PERMITIDOS))
  } catch {
    return null
  }
}

/** Como `usuarioDaRequisicao`, mas lança ErroNaoAutenticado (401) quando não há usuário. */
export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioDaRequisicao()
  if (!usuario) throw new ErroNaoAutenticado()
  return usuario
}
