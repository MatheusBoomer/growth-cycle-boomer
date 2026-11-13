import "@/lib/ambiente"
import { caminhoProximoSeguro, modoDeAutenticacao } from "@workspace/core/autenticacao"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { CartaoLogin } from "@/components/login/cartao-login"
import { raizDoProjeto } from "@/lib/ambiente"
import { fasesEmOrdem } from "@/lib/fases"
import { mensagemDeErroLogin } from "@/lib/login"

export const dynamic = "force-dynamic"

export default async function Pagina(props: PageProps<"/login">) {
  // Sem login ligado (modo local) a tela aparece só para conferir: o botão entra direto por /auth/entrar.
  if (modoDeAutenticacao(process.env) === "off") {
    return <CartaoLogin href="/auth/entrar" mensagemDeErro={null} fases={fasesEmOrdem(carregarCatalogo(raizDoProjeto()).etapas)} />
  }
  const { erro, proximo } = await props.searchParams
  // O destino volta ao servidor por /auth/entrar e é validado de novo lá e no callback.
  const destino = caminhoProximoSeguro(typeof proximo === "string" ? proximo : null)
  const href = destino === "/" ? "/auth/entrar" : `/auth/entrar?proximo=${encodeURIComponent(destino)}`
  const fases = fasesEmOrdem(carregarCatalogo(raizDoProjeto()).etapas)
  return <CartaoLogin href={href} mensagemDeErro={mensagemDeErroLogin(erro)} fases={fases} />
}
