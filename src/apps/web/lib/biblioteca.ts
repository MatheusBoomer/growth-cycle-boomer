import { ORDEM_BIBLIOTECA, type EtapaBiblioteca, type ItemBiblioteca, type OrigemImagem } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"

/** "substituido" não tem filtro próprio: aparece com "Mostrar versões antigas" e segue o filtro de Pendentes. */
export const ORIGENS_FILTRO = ["aprovado", "proposta", "anexo", "insumo", "previa"] as const
export type OrigemFiltro = (typeof ORIGENS_FILTRO)[number]

export const ROTULO_ORIGEM: Record<OrigemImagem, string> = {
  aprovado: "Aprovado",
  proposta: "Pendente",
  substituido: "Substituído",
  anexo: "Anexo",
  insumo: "Insumo",
  previa: "Prévia",
}

export const ROTULO_FILTRO_ORIGEM: Record<OrigemFiltro, string> = {
  aprovado: "Aprovados",
  proposta: "Pendentes",
  anexo: "Anexos",
  insumo: "Insumos",
  previa: "Prévias",
}

export type FiltroEtapa = EtapaBiblioteca | "todas"

export interface FiltrosBiblioteca {
  etapa: FiltroEtapa
  busca: string
  origens: ReadonlySet<OrigemFiltro>
  versoesAntigas: boolean
}

export const FILTROS_INICIAIS: FiltrosBiblioteca = {
  etapa: "todas",
  busca: "",
  origens: new Set(ORIGENS_FILTRO),
  versoesAntigas: false,
}

export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function passaSemEtapa(i: ItemBiblioteca, f: FiltrosBiblioteca): boolean {
  if (i.origem === "substituido") {
    if (!f.versoesAntigas || !f.origens.has("proposta")) return false
  } else if (!f.origens.has(i.origem)) {
    return false
  }
  const busca = normalizarBusca(f.busca)
  return !busca || normalizarBusca(i.titulo).includes(busca) || normalizarBusca(i.nomeArquivo).includes(busca)
}

export function filtrarItens(itens: ItemBiblioteca[], f: FiltrosBiblioteca): ItemBiblioteca[] {
  return itens.filter((i) => passaSemEtapa(i, f) && (f.etapa === "todas" || i.etapa === f.etapa))
}

/** Contagem de cada pílula: considera busca e origem, mas não a etapa escolhida. */
export function contarPorEtapa(itens: ItemBiblioteca[], f: FiltrosBiblioteca): Record<FiltroEtapa, number> {
  const contagem = Object.fromEntries([["todas", 0], ...ORDEM_BIBLIOTECA.map((e) => [e, 0])]) as Record<FiltroEtapa, number>
  for (const i of itens) {
    if (!passaSemEtapa(i, f)) continue
    contagem.todas++
    contagem[i.etapa]++
  }
  return contagem
}

export function agruparPorEtapa(itens: ItemBiblioteca[]): { etapa: EtapaBiblioteca; itens: ItemBiblioteca[] }[] {
  return ORDEM_BIBLIOTECA.map((etapa) => ({ etapa, itens: itens.filter((i) => i.etapa === etapa) })).filter((g) => g.itens.length > 0)
}

/** A mesma ordem em que a grade desenha os cards. */
export function ordemDeExibicao(itens: ItemBiblioteca[]): ItemBiblioteca[] {
  return agruparPorEtapa(itens).flatMap((g) => g.itens)
}

export function rotuloEtapa(catalogo: Catalogo, etapa: EtapaBiblioteca, curto = false): string {
  if (etapa === "sem-etapa") return "Sem etapa"
  const e = catalogo.etapas.find((x) => x.id === etapa)
  if (!e) return etapa
  if (curto) return e.numero || "Final"
  return e.numero ? `${e.numero} · ${e.titulo}` : e.titulo
}

export function totalVisivel(itens: ItemBiblioteca[]): number {
  return itens.filter((i) => i.origem !== "substituido").length
}
