import { nomeCurto } from "@workspace/core/autenticacao"
import { formatarUsd } from "@workspace/core/metricas/formato"
import {
  NIVEIS_ESFORCO,
  ROTULOS_ESFORCO,
  rotuloDoModelo,
  seloDoModelo,
  type EscolhaModelo,
  type ListaDeModelos,
  type NivelEsforco,
  type SeloModelo,
  type Sugestao,
  type UsoDaEtapa,
} from "@workspace/core/modelos"
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

/** Modelo gravado que não está mais na lista (o SDK deixou de oferecê-lo). O padrão (nulo ou `default`) nunca está fora. */
export function foraDaLista(lista: ListaDeModelos, modelo: string | null): boolean {
  return modelo !== null && modelo !== "default" && !lista.modelos.some((m) => m.value === modelo)
}

/** "Alterado por Ana Silva em 08/11", ou nulo quando a linha não existe ou não diz quem e quando. */
export function textoAlteracao(linha: LinhaConfigModelo | undefined): string | null {
  if (!linha?.alteradoPor || !linha.alteradoEm) return null
  const d = new Date(linha.alteradoEm)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
  return `Alterado por ${nomeCurto(linha.alteradoPor)} em ${dia}`
}

/** Rótulo de cada agente de uma etapa, como o cartão e o painel mostram. */
export const ROTULOS_ALVO: Record<string, string> = {
  principal: "Agente principal",
  "analista-dados": "Analista de dados · gráficos e projeções",
  "pesquisador-benchmark": "Pesquisador · benchmark e sites",
}

/** A sugestão só aparece quando difere do que está salvo: aplicada, ela some. */
export function sugestaoVisivel(sugestao: Sugestao | undefined, salvo: EscolhaModelo): boolean {
  return sugestao !== undefined && (sugestao.modelo !== salvo.modelo || sugestao.esforco !== salvo.esforco)
}

/** Linhas do rodapé do cartão: a média de custo e o modelo dos últimos turnos, ou `sem uso ainda`. */
export function textoRodape(uso: UsoDaEtapa | undefined, lista: ListaDeModelos): string[] {
  const linhas: string[] = []
  if (uso?.mediaUsd != null) linhas.push(`média ${formatarUsd(uso.mediaUsd)} por etapa · ${uso.projetos} ${uso.projetos === 1 ? "projeto" : "projetos"}`)
  if (uso?.modeloRecente) linhas.push(`últimos turnos: ${seloDoModelo(uso.modeloRecente, lista).texto}`)
  return linhas.length > 0 ? linhas : ["sem uso ainda"]
}

/**
 * Texto final do selo. O padrão mostra o modelo entre parênteses só quando ele é um id Claude reconhecido
 * (evita `Padrão (Default (recommended))`); o apelido leva `mais recente` e a versão fixa leva `fixo`.
 */
export function textoSelo(selo: SeloModelo, lista: ListaDeModelos): string {
  if (selo.padrao) return lista.padrao !== null && rotuloDoModelo(lista.padrao).familia !== null ? selo.texto : "Padrão"
  if (selo.apelido) return `${selo.texto} · mais recente`
  return selo.fixo ? `${selo.texto} · fixo` : selo.texto
}

/**
 * Texto da sugestão pendente: só o nome amigável do modelo (sem `mais recente`/`fixo`), o agente quando não é o
 * principal (`alvoRotulo`), o esforço sugerido e, depois do último ponto médio, o motivo.
 */
export function textoSugestao(sugestao: Sugestao, lista: ListaDeModelos, alvoRotulo?: string): string {
  const agente = alvoRotulo ? ` (${alvoRotulo})` : ""
  const esforco = sugestao.esforco ? `, esforço ${ROTULOS_ESFORCO[sugestao.esforco].toLowerCase()}` : ""
  return `Sugestão${agente}: ${seloDoModelo(sugestao.modelo, lista).texto}${esforco} · ${sugestao.motivo}`
}

/** O que está gravado para um agente da etapa. Sem linha, é o padrão (tudo nulo); um esforço desconhecido também vira nulo. */
export function escolhaSalva(config: LinhaConfigModelo[], etapa: string, alvo: string): EscolhaModelo {
  const linha = config.find((l) => l.etapa === etapa && l.alvo === alvo)
  const esforco = (NIVEIS_ESFORCO as readonly string[]).includes(linha?.esforco ?? "") ? (linha?.esforco as NivelEsforco) : null
  return { modelo: linha?.modelo ?? null, esforco }
}
