import { redirect } from "next/navigation"
import { PainelProjetos } from "@/components/admin/painel-projetos"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

// Só o catálogo (nomes das etapas) é lido no servidor; os números vêm da API no navegador. O layout e a rota exigem admin.
export default async function PaginaProjetos() {
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const etapas = servidor().catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus }))
  return <PainelProjetos etapas={etapas} />
}
