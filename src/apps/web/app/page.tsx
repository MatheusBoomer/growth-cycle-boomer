import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Entrada } from "@/components/home/entrada"
import { GradeProspects } from "@/components/home/grade-prospects"
import { avataresDosDonos } from "@/lib/avatares"
import { COOKIE_BOAS_VINDAS } from "@/lib/boas-vindas"
import { separarPorSituacao } from "@/lib/filtro-prospects"
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
  const grade = <GradeProspects prospects={prospects} etapas={etapas} avatares={avatares} />
  // Logo depois de um login de verdade o retorno do Google deixa este cookie; a entrada o apaga ao montar.
  const acabouDeEntrar = (await cookies()).get(COOKIE_BOAS_VINDAS)?.value === "1"
  if (!acabouDeEntrar) return grade
  return (
    <>
      {grade}
      <Entrada emAndamento={separarPorSituacao(prospects).emAndamento.length} />
    </>
  )
}
