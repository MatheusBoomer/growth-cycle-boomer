import type { NextRequest } from "next/server"
import { caminhoProximoSeguro } from "@workspace/core/autenticacao"
import { origemPublica } from "@/lib/origem-publica"
import { contextoDeRota, loginLigado, redirecionarSemLogin } from "@/lib/rota-auth"

export const dynamic = "force-dynamic"

/** Começa o login: pede ao Supabase a URL do Google (o verificador do PKCE vai para os cookies) e redireciona para ela. */
export async function GET(request: NextRequest) {
  if (!loginLigado()) return redirecionarSemLogin(request)
  const { supabase, origem, redirecionar, redirecionarParaFora, lembrarProximo } = contextoDeRota(request)
  try {
    // searchParams já decodifica uma vez; o destino é validado aqui e de novo no callback.
    const proximo = caminhoProximoSeguro(request.nextUrl.searchParams.get("proximo"))
    // O retorno do Google tem de cair no endereço público (o cadastrado no Supabase), não no interno. O Supabase
    // compara a URL inteira, query incluída, com a lista de permitidas: por isso é o callback exato, e o destino
    // viaja no cookie `planejamento-proximo`.
    const redirectTo = `${origemPublica(process.env) ?? origem}/auth/callback`
    lembrarProximo(proximo)
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
    if (error || !data?.url) return redirecionar("/login?erro=falha")
    const destino = new URL(data.url)
    if (destino.protocol !== "https:" && destino.protocol !== "http:") return redirecionar("/login?erro=falha")
    return redirecionarParaFora(destino)
  } catch (e) {
    console.error("[auth] falha ao iniciar o login", e)
    return redirecionar("/login?erro=falha")
  }
}
