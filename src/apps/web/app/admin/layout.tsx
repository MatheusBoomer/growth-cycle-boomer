import { redirect } from "next/navigation"
import { BarraTopo } from "@/components/marca/barra-topo"
import { AbasAdmin } from "@/components/admin/abas-admin"
import { CabecalhoAdmin } from "@/components/admin/cabecalho-admin"
import { ConteudoAba, ProvedorResumoAdmin } from "@/components/admin/resumo-admin"
import { FaixaDithered } from "@/components/marca/faixa-dithered"
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
      <div className="relative isolate">
        <FaixaDithered />
        <ProvedorResumoAdmin>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pt-8 pb-10 sm:px-8">
            <CabecalhoAdmin />
            <AbasAdmin />
            {/* Painel sólido: tabelas e listas da administração não têm fundo próprio e deixariam o fundo dithered aparecer. */}
            <div className="flex flex-col gap-6 rounded-[18px] border bg-popover p-5 shadow-[var(--sombra-card)] sm:p-6">
              <ConteudoAba>{children}</ConteudoAba>
            </div>
          </div>
        </ProvedorResumoAdmin>
      </div>
    </>
  )
}
