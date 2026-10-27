import { redirect } from "next/navigation"
import { GradeProspects } from "@/components/home/grade-prospects"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export default async function Pagina() {
  // Defesa em profundidade além do proxy: sem usuário verificado não se lê dado nenhum. No modo off o usuário
  // vem com e-mail nulo, então nada muda por lá.
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const prospects = await servidor().servico.listarProspects()
  return <GradeProspects prospects={prospects} />
}
