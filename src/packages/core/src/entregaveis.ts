import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "./erros"
import { TIPOS_ENTREGAVEL, type Entregavel, type Estado, type EtapaId, type TipoEntregavel } from "./tipos"

export const EXTENSAO_POR_TIPO: Record<TipoEntregavel, string> = {
  grafico: ".png",
  tabela: ".png",
  secao: ".md",
  planilha: ".xlsx",
  documento: ".docx",
  html: ".html",
  roteiro: ".json",
  apresentacao: ".pptx",
}

const PASTA_POR_TIPO: Record<TipoEntregavel, string> = {
  grafico: "graficos",
  tabela: "graficos",
  secao: "secoes",
  planilha: "projecao",
  documento: "plano-de-acao",
  html: "benchmark",
  roteiro: "apresentacao",
  apresentacao: "apresentacao",
}

const NOME_FINAL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NOME_VERSIONADO = /-(?:v\d+|final|novo|nova|revisado|revisada)$/

export function normalizarNomeFinal(tipo: TipoEntregavel, nomeFinal: string, etapa: EtapaId): string {
  let nome = nomeFinal.trim().toLowerCase()
  const ext = EXTENSAO_POR_TIPO[tipo]
  if (nome.endsWith(ext)) nome = nome.slice(0, -ext.length)
  if (tipo === "secao" && nome.startsWith(`${etapa}-`)) nome = nome.slice(etapa.length + 1)
  if (!NOME_FINAL.test(nome)) {
    throw new ErroEntrada(
      `nome_final "${nomeFinal}" inválido: use só letras minúsculas, números e hífens (ex.: investimento-total-mensal).`,
    )
  }
  if (NOME_VERSIONADO.test(nome)) {
    throw new ErroEntrada(
      `nome_final "${nomeFinal}" parece versionado. Use o nome estável: uma nova aprovação sobrescreve a anterior.`,
    )
  }
  return nome
}

export function destinoAprovado(e: Pick<Entregavel, "tipo" | "nomeFinal" | "etapa">): string {
  if (e.tipo === "apresentacao") return "entrega/apresentacao-final.pptx"
  const nome = e.tipo === "secao" ? `${e.etapa}-${e.nomeFinal}` : e.nomeFinal
  return `entrega/ativos-aprovados/${PASTA_POR_TIPO[e.tipo]}/${nome}${EXTENSAO_POR_TIPO[e.tipo]}`
}

export interface DadosProposta {
  etapa: EtapaId
  tipo: TipoEntregavel
  titulo: string
  arquivoRascunho: string
  nomeFinal: string
}

export function proporEntregavel(estado: Estado, dados: DadosProposta, id: string, em: string): Estado {
  if (!TIPOS_ENTREGAVEL.includes(dados.tipo)) {
    throw new ErroEntrada(`tipo "${dados.tipo}" inválido. Use um de: ${TIPOS_ENTREGAVEL.join(", ")}.`)
  }
  if (!dados.titulo.trim()) throw new ErroEntrada("titulo é obrigatório.")
  const nomeFinal = normalizarNomeFinal(dados.tipo, dados.nomeFinal, dados.etapa)
  const ext = EXTENSAO_POR_TIPO[dados.tipo]
  if (!dados.arquivoRascunho.toLowerCase().endsWith(ext)) {
    throw new ErroEntrada(`Um entregável do tipo "${dados.tipo}" precisa ser um arquivo ${ext}.`)
  }
  const destino = destinoAprovado({ tipo: dados.tipo, nomeFinal, etapa: dados.etapa })
  const entregaveis: Entregavel[] = estado.entregaveis.map((e) =>
    e.status === "pendente" && destinoAprovado(e) === destino ? { ...e, status: "substituido", decididoEm: em } : e,
  )
  entregaveis.push({
    id,
    etapa: dados.etapa,
    tipo: dados.tipo,
    titulo: dados.titulo.trim(),
    arquivoRascunho: dados.arquivoRascunho,
    nomeFinal,
    status: "pendente",
    ajustePedido: null,
    criadoEm: em,
    decididoEm: null,
  })
  return { ...estado, entregaveis, atualizadoEm: em }
}

export function encontrarEntregavel(estado: Estado, id: string): Entregavel {
  const e = estado.entregaveis.find((x) => x.id === id)
  if (!e) throw new ErroNaoEncontrado(`Entregável ${id} não encontrado.`)
  return e
}

export function aprovarEntregavel(estado: Estado, id: string, em: string): Estado {
  const alvo = encontrarEntregavel(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(`O entregável "${alvo.titulo}" não está aguardando aprovação.`)
  }
  if (alvo.ajustePedido) {
    throw new TransicaoInvalida(`O entregável "${alvo.titulo}" tem um ajuste pedido: aguarde a nova versão do agente para aprovar.`)
  }
  const destino = destinoAprovado(alvo)
  const entregaveis: Entregavel[] = estado.entregaveis.map((e) => {
    if (e.id === id) return { ...e, status: "aprovado", decididoEm: em }
    if (e.status === "aprovado" && destinoAprovado(e) === destino) return { ...e, status: "substituido" }
    return e
  })
  return { ...estado, entregaveis, atualizadoEm: em }
}

export function pedirAjuste(estado: Estado, id: string, texto: string, em: string): Estado {
  const alvo = encontrarEntregavel(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(`O entregável "${alvo.titulo}" não está aguardando aprovação.`)
  }
  if (!texto.trim()) throw new ErroEntrada("Descreva o ajuste que você quer.")
  return {
    ...estado,
    entregaveis: estado.entregaveis.map((e) => (e.id === id ? { ...e, ajustePedido: texto.trim() } : e)),
    atualizadoEm: em,
  }
}

/** O analista editou a seção pendente: só seção de texto, e só antes de aprovar ou pedir ajuste. */
export function marcarEditado(estado: Estado, id: string, em: string): Estado {
  const alvo = encontrarEntregavel(estado, id)
  if (alvo.tipo !== "secao") throw new ErroEntrada("Só seções de texto podem ser editadas aqui.")
  if (alvo.status !== "pendente") throw new TransicaoInvalida("Este entregável já foi decidido e não pode mais ser editado.")
  return { ...estado, entregaveis: estado.entregaveis.map((e) => (e.id === id ? { ...e, editadoEm: em } : e)), atualizadoEm: em }
}

/** Tipos que abrem no visualizador da coluna larga (HTML do benchmark e apresentação em slides). */
export const TIPOS_VISUALIZADOR: TipoEntregavel[] = ["html", "apresentacao"]

/**
 * O entregável que o visualizador mostra para um nome final: a versão não substituída mais recente
 * (pendente ou aprovada). Por padrão, HTML ou apresentação; com `tipos` = ["secao"], a seção de
 * texto (o benchmark tem HTML e seção com o mesmo nome final).
 */
export function entregavelVisivel(
  entregaveis: Entregavel[],
  etapa: EtapaId,
  nomeFinal: string,
  tipos: TipoEntregavel[] = TIPOS_VISUALIZADOR,
): Entregavel | null {
  let visivel: Entregavel | null = null
  for (const e of entregaveis) {
    if (!tipos.includes(e.tipo) || e.etapa !== etapa || e.nomeFinal !== nomeFinal || e.status === "substituido") continue
    if (!visivel || e.criadoEm > visivel.criadoEm) visivel = e
  }
  return visivel
}

/** Nome final do HTML ou da apresentação que acabou de chegar pendente na etapa aberta. null na primeira carga (`antes` = null). */
export function htmlParaAbrir(antes: Entregavel[] | null, depois: Entregavel[], etapa: EtapaId): string | null {
  if (antes === null) return null
  const conhecidos = new Set(antes.map((e) => e.id))
  const novo = depois.find((e) => !conhecidos.has(e.id) && TIPOS_VISUALIZADOR.includes(e.tipo) && e.status === "pendente" && e.etapa === etapa)
  return novo ? novo.nomeFinal : null
}

/** A apresentação aprovada mais recente e onde está o arquivo final (para baixar e ver a prévia). */
export function apresentacaoFinal(entregaveis: Entregavel[]): { entregavel: Entregavel; caminho: string } | null {
  let final: Entregavel | null = null
  for (const e of entregaveis) {
    if (e.tipo === "apresentacao" && e.status === "aprovado" && (!final || e.criadoEm > final.criadoEm)) final = e
  }
  return final ? { entregavel: final, caminho: destinoAprovado(final) } : null
}
