import { redirect } from "next/navigation"
import { BarraTopo } from "@/components/marca/barra-topo"
import { AbasAdmin } from "@/components/admin/abas-admin"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode
}) {
  // Defesa em profundidade além da API (que também exige admin): quem não é admin nem vê a tela.
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  if (usuario.papel !== "admin") redirect("/")
  return (
    <>
      <BarraTopo titulo="Administração" />
      <div className="mx-auto w-full max-w-6xl p-6">
        {/* Painel sólido: tabelas e listas da administração não têm fundo próprio e deixariam o fundo de ondas aparecer. */}
        <div className="flex flex-col gap-6 rounded-2xl border bg-popover p-6 shadow-[var(--sombra-card)]">
          <header>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Administração
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-texto-forte">
              Administração
            </h1>
          </header>
          <AbasAdmin />
          {children}
        </div>
      </div>
    </>
  )
}
