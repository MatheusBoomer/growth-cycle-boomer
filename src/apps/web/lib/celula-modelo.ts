import { nomeCurto } from "@workspace/core/autenticacao"
import { NIVEIS_ESFORCO, type EscolhaModelo, type ListaDeModelos, type NivelEsforco } from "@workspace/core/modelos"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"

/**
 * Níveis de esforço que o seletor oferece para um modelo. Com o padrão (nulo) ou um modelo que a lista
 * não conhece, todos os níveis: a API é quem recusa o que o modelo não aceita. Vazio quando o modelo não aceita esforço.
 */
export function esforcosDoModelo(lista: ListaDeModelos, modelo: string | null): NivelEsforco[] {
  if (modelo === null) return [...NIVEIS_ESFORCO]
  const m = lista.modelos.find((x) => x.value === modelo)
  return m ? [...m.esforcos] : [...NIVEIS_ESFORCO]
}

/** A escolha depois de trocar o modelo: o esforço que o novo modelo não aceita é limpo, para não ir recusado ao salvar. */
export function escolhaAoTrocarModelo(atual: EscolhaModelo, novoModelo: string | null, lista: ListaDeModelos): EscolhaModelo {
  const aceito = atual.esforco !== null && esforcosDoModelo(lista, novoModelo).includes(atual.esforco)
  return { modelo: novoModelo, esforco: aceito ? atual.esforco : null }
}

/** Modelo gravado que não está mais na lista (o SDK deixou de oferecê-lo). O padrão nunca está fora. */
export function foraDaLista(lista: ListaDeModelos, modelo: string | null): boolean {
  return modelo !== null && !lista.modelos.some((m) => m.value === modelo)
}

/** "Alterado por Ana Silva em 08/11", ou nulo quando a linha não existe ou não diz quem e quando. */
export function textoAlteracao(linha: LinhaConfigModelo | undefined): string | null {
  if (!linha?.alteradoPor || !linha.alteradoEm) return null
  const d = new Date(linha.alteradoEm)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
  return `Alterado por ${nomeCurto(linha.alteradoPor)} em ${dia}`
}
