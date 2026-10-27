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

/** Cliente do Supabase para este servidor, lendo e escrevendo a sessão nos cookies dados. Um por requisição. */
export function clienteSupabaseDoServidor(armazem: ArmazemDeCookies, env: Record<string, string | undefined> = process.env) {
  const { url, chave } = configuracaoSupabase(env)
  return createServerClient(url, chave, { cookies: armazem })
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

/**
 * Transforma as claims já verificadas (getClaims confere a assinatura) em usuário. Exige e-mail em texto,
 * verificado (`email_verified` no topo ou em `user_metadata`, sempre o booleano true; um false em qualquer
 * dos dois vence) e de um domínio permitido. Qualquer outra forma vira null.
 */
export function usuarioDeClaims(claims: unknown, dominios: readonly string[]): Usuario | null {
  if (!ehObjeto(claims)) return null
  const { email } = claims
  if (typeof email !== "string" || !emailPermitido(email, dominios)) return null

  const metadados = claims.user_metadata
  if (metadados !== undefined && metadados !== null && !ehObjeto(metadados)) return null
  const indicadores = [claims.email_verified, ehObjeto(metadados) ? metadados.email_verified : undefined]
  if (indicadores.some((v) => v !== undefined && v !== true)) return null
  if (!indicadores.includes(true)) return null

  return { email: email.toLowerCase() }
}

/** Usuário da sessão atual (cookies de `next/headers`), ou null sem sessão válida. No modo off devolve { email: null }. */
export async function usuarioDaRequisicao(): Promise<Usuario | null> {
  const env = process.env
  if (modoDeAutenticacao(env) === "off") return { email: null }

  const armazem = await cookies()
  const supabase = clienteSupabaseDoServidor(
    {
      getAll: () => armazem.getAll(),
      setAll: (aGravar) => {
        // Em Server Components os cookies são só de leitura; quem renova a sessão é o proxy.
        try {
          for (const { name, value, options } of aGravar) armazem.set(name, value, options)
        } catch {
          // ignorado de propósito
        }
      },
    },
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
