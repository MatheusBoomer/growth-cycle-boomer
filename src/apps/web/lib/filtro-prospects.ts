import type { ResumoProspect } from "@workspace/core/tipos"
import { normalizarEmail } from "@workspace/core/papeis"

export interface FiltroProspects {
  busca: string
  /** Só os prospects cujo dono é `email`. */
  apenasMeus: boolean
  /** E-mail de quem está usando; null no modo sem login (nesse caso "meus" não traz nada). */
  email: string | null
}

/** Filtro da home: busca por nome e, para o admin, o alternador "Meus / Todos". Puro, para testar sem tela. */
export function filtrarProspects(lista: ResumoProspect[], { busca, apenasMeus, email }: FiltroProspects): ResumoProspect[] {
  const termo = busca.trim().toLowerCase()
  const meu = email === null ? null : normalizarEmail(email)
  return lista.filter((p) => {
    if (!p.nome.toLowerCase().includes(termo)) return false
    if (!apenasMeus) return true
    return meu !== null && p.dono !== null && normalizarEmail(p.dono) === meu
  })
}
