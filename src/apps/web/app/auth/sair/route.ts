import type { NextRequest } from "next/server"
import { contextoDeRota, loginLigado, redirecionarSemLogin } from "@/lib/rota-auth"

export const dynamic = "force-dynamic"

/** Sai: encerra a sessão deste navegador (as de outros aparelhos seguem) e volta ao /login. 303 para o navegador seguir com GET. */
export async function POST(request: NextRequest) {
  // Modo local sem login: só volta à tela de login, para poder conferi-la.
  if (!loginLigado()) return redirecionarSemLogin(request, 303, process.env, "/login")
  const { supabase, redirecionar } = contextoDeRota(request)
  try {
    await supabase.auth.signOut({ scope: "local" })
  } catch (e) {
    console.error("[auth] falha ao encerrar a sessão", e)
  }
  return redirecionar("/login", 303)
}
