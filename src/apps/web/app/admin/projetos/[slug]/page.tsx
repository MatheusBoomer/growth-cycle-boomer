import { redirect } from "next/navigation"
import { DetalheProjeto } from "@/components/admin/detalhe-projeto"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

// Só o catálogo (nomes das etapas) é lido no servidor; os números vêm da API no navegador. O layout e a rota exigem admin.
export default async function PaginaDetalheProjeto(props: PageProps<"/admin/projetos/[slug]">) {
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const { slug } = await props.params
  const etapas = servidor().catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus }))
  return <DetalheProjeto slug={slug} etapas={etapas} />
}
