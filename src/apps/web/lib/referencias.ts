// Referências de ajuste: entregáveis que o analista citou na mensagem do chat ("Pedir ajuste…"), com as marcações
// feitas sobre a imagem. Ficam em memória por etapa até a mensagem ser enviada.
import type { TipoEntregavel } from "@workspace/core/tipos"
import type { Marca } from "./anotacoes"

export interface Referencia {
  entregavelId: string
  titulo: string
  tipo: TipoEntregavel
  /** Imagem do gráfico ou da tabela, para marcar e para desenhar o PNG anotado; null nos demais tipos. */
  urlImagem: string | null
  marcas: Marca[]
}

/** Clicar de novo no mesmo entregável não duplica: a referência (e as marcações dela) continua como está. */
export function adicionarReferencia(lista: Referencia[], nova: Referencia): Referencia[] {
  return lista.some((r) => r.entregavelId === nova.entregavelId) ? lista : [...lista, nova]
}

export function removerReferencia(lista: Referencia[], entregavelId: string): Referencia[] {
  return lista.filter((r) => r.entregavelId !== entregavelId)
}

/** Numeração contínua das marcações entre as referências (A: 1 e 2, B: 3), para "3: trocar a cor" nunca ser ambíguo. */
export function numerar(lista: Referencia[]): { entregavelId: string; primeira: number; quantidade: number }[] {
  let proxima = 1
  return lista.map((r) => {
    const item = { entregavelId: r.entregavelId, primeira: proxima, quantidade: r.marcas.length }
    proxima += r.marcas.length
    return item
  })
}

/** Referência de um entregável que deixou de estar pendente (nova versão do agente) não vale mais: as marcas eram da imagem antiga. */
export function descartarSuperadas(lista: Referencia[], pendentes: string[]): { lista: Referencia[]; descartadas: number } {
  const validas = lista.filter((r) => pendentes.includes(r.entregavelId))
  return validas.length === lista.length ? { lista, descartadas: 0 } : { lista: validas, descartadas: lista.length - validas.length }
}
