import "@/lib/ambiente"
import { redirect } from "next/navigation"
import { caminhoProximoSeguro, modoDeAutenticacao } from "@workspace/core/autenticacao"
import { CartaoLogin } from "@/components/login/cartao-login"
import { mensagemDeErroLogin } from "@/lib/login"

export const dynamic = "force-dynamic"

export default async function Pagina(props: PageProps<"/login">) {
  // Sem login ligado não há o que fazer aqui: o app segue como antes, pela regra de host local.
  if (modoDeAutenticacao(process.env) === "off") redirect("/")
  const { erro, proximo } = await props.searchParams
  // O destino volta ao servidor por /auth/entrar e é validado de novo lá e no callback.
  const destino = caminhoProximoSeguro(typeof proximo === "string" ? proximo : null)
  const href = destino === "/" ? "/auth/entrar" : `/auth/entrar?proximo=${encodeURIComponent(destino)}`
  return <CartaoLogin href={href} mensagemDeErro={mensagemDeErroLogin(erro)} />
}
