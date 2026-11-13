import "@/lib/ambiente"
import { NextResponse, type NextRequest } from "next/server"
import { modoDeAutenticacao } from "@workspace/core/autenticacao"
import { origemDoRedirecionamento, requisicaoEhHttps } from "@/lib/origem-publica"
import { clienteSupabaseDoServidor } from "@/lib/sessao"

type CookieParaGravar = { name: string; value: string; options: Record<string, unknown> }

/** Cookie de vida curta que leva o destino do login (`proximo`) de /auth/entrar até /auth/callback. */
export const COOKIE_PROXIMO = "planejamento-proximo"
const CAMINHO_COOKIE_PROXIMO = "/auth"
const VALIDADE_PROXIMO_EM_SEGUNDOS = 600

/**
 * O que as rotas /auth/* precisam: o cliente do Supabase lendo os cookies da requisição, e um jeito de
 * pôr na resposta os cookies que ele mandou gravar (o cliente só os entrega depois, ao trocar o código,
 * encerrar a sessão ou guardar o verificador do PKCE).
 */
export function contextoDeRota(request: NextRequest, env: Record<string, string | undefined> = process.env) {
  const gravados: CookieParaGravar[] = []
  const cabecalhos: Record<string, string> = {}
  const protocolo = new URL(request.url).protocol
  const seguro = requisicaoEhHttps(request.headers, protocolo)
  const supabase = clienteSupabaseDoServidor(
    {
      getAll: () => request.cookies.getAll(),
      setAll: (aGravar, headers) => {
        gravados.push(...aGravar)
        Object.assign(cabecalhos, headers)
        // Espelha na requisição: o cliente monta as remoções a partir de getAll(), então um cookie gravado
        // aqui (a sessão nova) precisa aparecer lá para o signOut seguinte conseguir apagá-lo.
        for (const { name, value, options } of aGravar) {
          if (value === "" || options.maxAge === 0) request.cookies.delete(name)
          else request.cookies.set(name, value)
        }
      },
    },
    seguro,
    env,
  )
  const origem = origemDoRedirecionamento(request.headers, env, protocolo)

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

  const atributosProximo = { httpOnly: true, sameSite: "lax" as const, path: CAMINHO_COOKIE_PROXIMO, secure: seguro }

  /** Guarda o destino (já validado por quem chama) no cookie `planejamento-proximo`, que vale 10 minutos. */
  function lembrarProximo(caminhoSeguro: string) {
    gravados.push({ name: COOKIE_PROXIMO, value: caminhoSeguro, options: { ...atributosProximo, maxAge: VALIDADE_PROXIMO_EM_SEGUNDOS } })
  }

  /** Lê o destino do cookie (sem validar: quem chama usa `caminhoProximoSeguro`) e apaga o cookie em toda saída. */
  function consumirProximo(): string | null {
    const valor = request.cookies.get(COOKIE_PROXIMO)?.value ?? null
    gravados.push({ name: COOKIE_PROXIMO, value: "", options: { ...atributosProximo, maxAge: 0 } })
    return valor
  }

  return { supabase, origem, seguro, redirecionar, redirecionarParaFora, lembrarProximo, consumirProximo }
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
