import type { Estado, EtapaId, StatusInsumo } from "./tipos"

export interface DadosInsumo {
  etapa: EtapaId
  insumoId: string
  status: StatusInsumo
  problemas: string[]
  avisos: string[]
  resumo: string | null
  arquivo: string | null
}

export function registrarInsumo(estado: Estado, dados: DadosInsumo, em: string): Estado {
  const outros = estado.insumos.filter((i) => !(i.etapa === dados.etapa && i.insumoId === dados.insumoId))
  return { ...estado, insumos: [...outros, { ...dados, atualizadoEm: em }], atualizadoEm: em }
}
