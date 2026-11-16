import type { Estado, EtapaId, InsumoCatalogo, StatusInsumo } from "./tipos"

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
  const mesmo = (i: { etapa: EtapaId; insumoId: string }) => i.etapa === dados.etapa && i.insumoId === dados.insumoId
  const anterior = estado.insumos.find(mesmo)
  // Um envio inválido não apaga a marca do último válido: o arquivo bom continua na pasta e a troca de dados já aconteceu.
  const ultimoValidoEm = dados.status === "valido" ? em : anterior?.ultimoValidoEm
  const registro = { ...dados, atualizadoEm: em, ...(ultimoValidoEm ? { ultimoValidoEm } : {}) }
  return { ...estado, insumos: [...estado.insumos.filter((i) => !mesmo(i)), registro], atualizadoEm: em }
}

export function extensao(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? ""
  const i = base.lastIndexOf(".")
  return i > 0 ? base.slice(i).toLowerCase() : ""
}

export function extensaoAceita(insumo: InsumoCatalogo, nomeArquivo: string): boolean {
  return insumo.formatos.includes(extensao(nomeArquivo))
}

export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() || "arquivo"
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
}

export function destinoInsumo(insumo: InsumoCatalogo, nomeArquivo: string): string {
  if (insumo.tipo === "link") return insumo.destino
  if (insumo.destino.endsWith("/")) return `${insumo.destino}${nomeSeguro(nomeArquivo)}`
  return `${insumo.destino}${extensao(nomeArquivo)}`
}
