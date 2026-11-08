import { redirect } from "next/navigation"
import { BarraTopo } from "@/components/marca/barra-topo"
import { AbasAdmin } from "@/components/admin/abas-admin"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade além da API (que também exige admin): quem não é admin nem vê a tela.
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  if (usuario.papel !== "admin") redirect("/")
  return (
    <>
      <BarraTopo titulo="Administração" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header>
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">Administração</p>
          <h1 className="text-texto-forte mt-1 text-2xl font-semibold tracking-tight">Administração</h1>
        </header>
        <AbasAdmin />
        {children}
      </div>
    </>
  )
}
