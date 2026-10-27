import { NextResponse, type NextRequest } from "next/server"
import { modoDeAutenticacao } from "@workspace/core/autenticacao"
import { origemDoRedirecionamento } from "@/lib/origem-publica"
import { clienteSupabaseDoServidor } from "@/lib/sessao"

type CookieParaGravar = { name: string; value: string; options: Record<string, unknown> }

/**
 * O que as rotas /auth/* precisam: o cliente do Supabase lendo os cookies da requisição, e um jeito de
 * pôr na resposta os cookies que ele mandou gravar (o cliente só os entrega depois, ao trocar o código,
 * encerrar a sessão ou guardar o verificador do PKCE).
 */
export function contextoDeRota(request: NextRequest, env: Record<string, string | undefined> = process.env) {
  const gravados: CookieParaGravar[] = []
  const cabecalhos: Record<string, string> = {}
  const supabase = clienteSupabaseDoServidor(
    {
      getAll: () => request.cookies.getAll(),
      setAll: (aGravar, headers) => {
        gravados.push(...aGravar)
        Object.assign(cabecalhos, headers)
      },
    },
    env,
  )
  const origem = origemDoRedirecionamento(request.headers, env, new URL(request.url).protocol)

  function comCookies(destino: URL, status: number): NextResponse {
    const resposta = NextResponse.redirect(destino, status)
    for (const { name, value, options } of gravados) resposta.cookies.set(name, value, options)
    for (const [nome, valor] of Object.entries(cabecalhos)) resposta.headers.set(nome, valor)
    return resposta
  }

  /** Redireciona para um caminho do próprio app (a origem vem de `origemDoRedirecionamento`), levando os cookies. */
  function redirecionar(caminho: string, status = 307): NextResponse {
    return comCookies(new URL(caminho, origem), status)
  }

  /** Redireciona para uma URL absoluta que o Supabase devolveu (a do Google), levando os cookies do PKCE. */
  function redirecionarParaFora(url: URL): NextResponse {
    return comCookies(url, 307)
  }

  return { supabase, origem, redirecionar, redirecionarParaFora }
}

/** O login existe (modo google)? No modo off as rotas /auth/* e /login mandam para /. Valor inválido lança, como no proxy. */
export function loginLigado(env: Record<string, string | undefined> = process.env): boolean {
  return modoDeAutenticacao(env) === "google"
}

/** Redireciona para `/` sem tocar no Supabase (modo off: não há login a fazer). */
export function redirecionarSemLogin(request: NextRequest, status = 307, env: Record<string, string | undefined> = process.env): NextResponse {
  const origem = origemDoRedirecionamento(request.headers, env, new URL(request.url).protocol)
  return NextResponse.redirect(new URL("/", origem), status)
}
