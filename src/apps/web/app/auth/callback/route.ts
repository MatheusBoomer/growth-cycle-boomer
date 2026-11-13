import type { NextRequest } from "next/server"
import { avatarDeClaims, caminhoProximoSeguro, dominiosPermitidos } from "@workspace/core/autenticacao"
import { contextoDeRota, loginLigado, redirecionarSemLogin } from "@/lib/rota-auth"
import { COOKIE_BOAS_VINDAS } from "@/lib/boas-vindas"
import { usuarioDeClaims } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/**
 * Garante a linha de quem acabou de entrar e guarda a foto do Google. A foto nunca pode atrapalhar o login:
 * qualquer falha (banco fora, repositório indisponível) é ignorada. No modo disco não faz nada.
 */
async function guardarFoto(email: string, claims: Record<string, unknown>): Promise<void> {
  try {
    // Import tardio, como em sessao.ts: o proxy e as rotas de login não devem carregar o grafo do servidor à toa.
    const { servidor } = await import("@/lib/servidor")
    const { usuarios } = servidor()
    if (usuarios === null) return
    // Idempotente (só atualiza ultimo_acesso depois de 1 h). No primeiro login a linha ainda não existe, e
    // registrarAvatar só atualiza quem já está registrado.
    await usuarios.registrarAcesso(email)
    const avatar = avatarDeClaims(claims)
    if (avatar !== null) await usuarios.registrarAvatar(email, avatar)
  } catch (e) {
    console.error("[auth] falha ao guardar a foto do Google", e)
  }
}

/** Volta do Google: troca o código por sessão (cookies), confere o domínio e o e-mail e manda para a página pedida. */
export async function GET(request: NextRequest) {
  if (!loginLigado()) return redirecionarSemLogin(request)
  const { supabase, seguro, redirecionar, consumirProximo } = contextoDeRota(request)
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
    const resposta = redirecionar(caminhoProximoSeguro(proximo))
    // Login de verdade: a home toca a entrada uma vez e apaga este cookie (por isso ele não é httpOnly).
    resposta.cookies.set(COOKIE_BOAS_VINDAS, "1", { path: "/", maxAge: 120, sameSite: "lax", httpOnly: false, secure: seguro })
    return resposta
  } catch (e) {
    console.error("[auth] falha no retorno do login", e)
    return redirecionar("/login?erro=falha")
  }
}
