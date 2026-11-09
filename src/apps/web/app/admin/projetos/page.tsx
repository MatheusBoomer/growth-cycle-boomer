import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PainelProjetos } from "@/components/admin/painel-projetos"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

// Só o catálogo (nomes das etapas) é lido no servidor; os números vêm da API no navegador. O layout e a rota exigem admin.
// O painel lê os filtros da URL (`useSearchParams`), por isso fica dentro de um Suspense.
export default async function PaginaProjetos() {
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const etapas = servidor().catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus }))
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PainelProjetos etapas={etapas} />
    </Suspense>
  )
}
