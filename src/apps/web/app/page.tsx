import { GradeProspects } from "@/components/home/grade-prospects"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export default async function Pagina() {
  const prospects = await servidor().servico.listarProspects()
  return <GradeProspects prospects={prospects} />
}
