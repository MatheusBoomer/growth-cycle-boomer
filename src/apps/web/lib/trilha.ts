import type { EtapaCatalogo, EtapaId, Estado, StatusEtapa } from "@workspace/core/tipos"

export interface FaseDaTrilha {
  fase: string
  etapas: { id: EtapaId; numero: string; titulo: string; status: StatusEtapa }[]
  feitas: number
  /** "feita": todas concluídas; "atual": alguma em andamento, pronta ou liberada; "": nenhuma das duas. */
  situacao: "feita" | "atual" | ""
}

const SEM_FASE = "Outras"

/** Etapas do catálogo agrupadas por fase, na ordem do catálogo (etapa sem fase vai para "Outras", no fim). */
export function fasesDaTrilha(etapas: EtapaCatalogo[], estado: Estado): FaseDaTrilha[] {
  const grupos = new Map<string, FaseDaTrilha["etapas"]>()
  for (const e of etapas) {
    const fase = e.fase ?? SEM_FASE
    if (!grupos.has(fase)) grupos.set(fase, [])
    grupos.get(fase)!.push({ id: e.id, numero: e.numero, titulo: e.titulo, status: estado.etapas[e.id]?.status ?? "bloqueada" })
  }
  const ordem = [...grupos.keys()].sort((a, b) => Number(a === SEM_FASE) - Number(b === SEM_FASE))
  return ordem.map((fase) => {
    const lista = grupos.get(fase)!
    const feitas = lista.filter((e) => e.status === "concluida").length
    const atual = lista.some((e) => e.status === "em_andamento" || e.status === "pronta" || e.status === "liberada")
    return { fase, etapas: lista, feitas, situacao: feitas === lista.length ? "feita" : atual ? "atual" : "" }
  })
}
