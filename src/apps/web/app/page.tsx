import { redirect } from "next/navigation"
import { GradeProspects } from "@/components/home/grade-prospects"
import { avataresDosDonos } from "@/lib/avatares"
import { servidor } from "@/lib/servidor"
import { usuarioDaRequisicao } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export default async function Pagina() {
  // Defesa em profundidade além do proxy: sem usuário verificado não se lê dado nenhum. No modo off o usuário
  // vem com e-mail nulo, então nada muda por lá.
  const usuario = await usuarioDaRequisicao()
  if (!usuario) redirect("/login")
  const { servico, catalogo } = servidor()
  const prospects = await servico.listarProspects(usuario)
  // Só o admin vê o analista nos cartões; para os outros nem consulta, e para o admin vão só as fotos dos donos
  // listados (nunca o diretório inteiro de e-mails).
  const avatares = usuario.papel === "admin" ? await avataresDosDonos(prospects.map((p) => p.dono)) : {}
  const etapas = catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus }))
  return <GradeProspects prospects={prospects} etapas={etapas} avatares={avatares} />
}
