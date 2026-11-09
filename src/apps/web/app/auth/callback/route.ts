import type { NextRequest } from "next/server"
import { avatarDeClaims, caminhoProximoSeguro, dominiosPermitidos } from "@workspace/core/autenticacao"
import { contextoDeRota, loginLigado, redirecionarSemLogin } from "@/lib/rota-auth"
import { usuarioDeClaims } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/**
 * Guarda a foto do Google de quem acabou de entrar. A foto nunca pode atrapalhar o login: qualquer falha
 * (banco fora, repositório indisponível) é ignorada. Sem foto válida ou no modo disco, não faz nada.
 */
async function guardarFoto(email: string, claims: Record<string, unknown>): Promise<void> {
  try {
    const avatar = avatarDeClaims(claims)
    if (avatar === null) return
    // Import tardio, como em sessao.ts: o grafo do servidor só carrega quando há o que gravar.
    const { servidor } = await import("@/lib/servidor")
    const { usuarios } = servidor()
    if (usuarios === null) return
    await usuarios.registrarAvatar(email, avatar)
  } catch (e) {
    console.error("[auth] falha ao guardar a foto do Google", e)
  }
}

/** Volta do Google: troca o código por sessão (cookies), confere o domínio e o e-mail e manda para a página pedida. */
export async function GET(request: NextRequest) {
  if (!loginLigado()) return redirecionarSemLogin(request)
  const { supabase, redirecionar, consumirProximo } = contextoDeRota(request)
  const parametros = request.nextUrl.searchParams
  // Lido e apagado já na entrada: toda saída abaixo, de erro ou não, leva a remoção do cookie.
  const proximo = consumirProximo()
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
    await guardarFoto(usuario.email, data.claims)
    // Revalidado aqui: o cookie volta pelo navegador e não é confiável só por /auth/entrar tê-lo gravado.
    return redirecionar(caminhoProximoSeguro(proximo))
  } catch (e) {
    console.error("[auth] falha no retorno do login", e)
    return redirecionar("/login?erro=falha")
  }
}
