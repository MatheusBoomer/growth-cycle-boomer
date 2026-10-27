import type { NextRequest } from "next/server"
import { caminhoProximoSeguro, dominiosPermitidos } from "@workspace/core/autenticacao"
import { contextoDeRota, loginLigado, redirecionarSemLogin } from "@/lib/rota-auth"
import { usuarioDeClaims } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/** Volta do Google: troca o código por sessão (cookies), confere o domínio e o e-mail e manda para a página pedida. */
export async function GET(request: NextRequest) {
  if (!loginLigado()) return redirecionarSemLogin(request)
  const { supabase, redirecionar } = contextoDeRota(request)
  const parametros = request.nextUrl.searchParams
  const code = parametros.get("code")
  if (!code || parametros.has("error")) return redirecionar("/login?erro=falha")

  /** Encerra só a sessão deste navegador; falha ao encerrar não muda o destino. */
  const encerrar = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch (e) {
      console.error("[auth] falha ao encerrar a sessão recusada", e)
    }
  }

  try {
    const troca = await supabase.auth.exchangeCodeForSession(code)
    if (troca.error) return redirecionar("/login?erro=falha")

    const { data, error } = await supabase.auth.getClaims()
    if (error || !data) {
      await encerrar()
      return redirecionar("/login?erro=falha")
    }
    const usuario = usuarioDeClaims(data.claims, dominiosPermitidos(process.env.PLANEJAMENTO_DOMINIOS_PERMITIDOS))
    if (!usuario) {
      await encerrar()
      return redirecionar("/login?erro=dominio")
    }
    // Revalidado aqui: o `proximo` volta pelo navegador e não é confiável só por ter passado por /auth/entrar.
    return redirecionar(caminhoProximoSeguro(parametros.get("proximo")))
  } catch (e) {
    console.error("[auth] falha no retorno do login", e)
    return redirecionar("/login?erro=falha")
  }
}
