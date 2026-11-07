import { notFound, redirect } from "next/navigation"
import { ErroEntrada } from "@workspace/core/erros"
import { AreaDeTrabalho } from "@/components/trabalho/area-de-trabalho"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export default async function Pagina(props: PageProps<"/prospects/[slug]">) {
  // Mesma regra das rotas: prospect inexistente, excluído ou de outro dono dá 404, sem distinguir os casos.
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const { slug } = await props.params
  let visivel: boolean
  try {
    visivel = await servidor().servico.prospectVisivel(usuario, slug)
  } catch (e) {
    if (!(e instanceof ErroEntrada)) throw e
    visivel = false
  }
  if (!visivel) notFound()
  return <AreaDeTrabalho slug={slug} />
}
