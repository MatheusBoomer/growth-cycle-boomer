import { TransicaoInvalida } from "./erros"
import type { Entregavel, Estado, EtapaId, ValidacaoCliente } from "./tipos"

/** Onde o PDF de validação fica na pasta do prospect; sempre o mesmo caminho, uma nova geração sobrescreve. */
export const ARQUIVO_VALIDACAO = "entrega/validacao-cliente/documento-validacao.pdf"

const ETAPAS_DO_DOCUMENTO: EtapaId[] = ["03", "04"]
const TIPOS_DO_DOCUMENTO: Entregavel["tipo"][] = ["grafico", "tabela", "secao"]

/** Etapa do chat onde o card do entregável aparece. */
export function etapaDaConversa(e: Pick<Entregavel, "etapa" | "etapaConversa">): EtapaId {
  return e.etapaConversa ?? e.etapa
}

/** Aprovados que entram no documento de validação: gráfico, tabela ou seção das etapas 03 e 04. */
function aprovadosDoDocumento(estado: Estado): Entregavel[] {
  return estado.entregaveis.filter(
    (e) => e.status === "aprovado" && ETAPAS_DO_DOCUMENTO.includes(e.etapa) && TIPOS_DO_DOCUMENTO.includes(e.tipo),
  )
}

/** Troca de dados é um envio que passou na validação: um upload que terminou "invalido" não muda nada no documento. */
function trocasDeInsumo(estado: Estado, depoisDe: string, etapas: EtapaId[]): string[] {
  return estado.insumos
    .filter((i) => i.status === "valido" && etapas.includes(i.etapa) && i.atualizadoEm > depoisDe)
    .map((i) => i.atualizadoEm)
}

/**
 * Aprovados do documento que são anteriores à última troca de insumo (03 ou 04) feita depois da primeira geração do PDF.
 * Trocas de insumo antes do primeiro PDF não contam: é o fluxo normal da 04.
 */
export function entregaveisAntesDaTroca(estado: Estado): Entregavel[] {
  const v = estado.validacaoCliente
  if (!v) return []
  const trocas = trocasDeInsumo(estado, v.primeiraGeracaoEm, ETAPAS_DO_DOCUMENTO)
  if (trocas.length === 0) return []
  const ultima = trocas.reduce((a, b) => (a > b ? a : b))
  return aprovadosDoDocumento(estado).filter((e) => e.decididoEm !== null && e.decididoEm < ultima)
}

/** Alguém aprovou gráfico, tabela ou seção depois que o PDF foi gerado: o documento não reflete mais o que foi aprovado. */
export function documentoDefasado(estado: Estado): boolean {
  const v = estado.validacaoCliente
  if (!v) return false
  return aprovadosDoDocumento(estado).some((e) => e.decididoEm !== null && e.decididoEm > v.geradoEm)
}

/** A 03 foi refeita (insumo trocado ou entregável da 03 aprovado) depois da primeira geração do PDF. */
export function refezTresDepoisDoPdf(estado: Estado): boolean {
  const v = estado.validacaoCliente
  if (!v) return false
  const insumoNovo = trocasDeInsumo(estado, v.primeiraGeracaoEm, ["03"]).length > 0
  const entregavelNovo = estado.entregaveis.some(
    (e) => e.status === "aprovado" && e.etapa === "03" && e.decididoEm !== null && e.decididoEm > v.primeiraGeracaoEm,
  )
  return insumoNovo || entregavelNovo
}

function exigirQuatroAberta(estado: Estado, acao: string): void {
  const status = estado.etapas["04"].status
  if (status !== "em_andamento" && status !== "pronta") {
    throw new TransicaoInvalida(`Não dá para ${acao} agora: a etapa 04 está "${status.replace("_", " ")}".`)
  }
}

function exigirDocumento(estado: Estado, acao: string): ValidacaoCliente {
  if (!estado.validacaoCliente) {
    throw new TransicaoInvalida(`Não dá para ${acao}: o documento de validação ainda não foi gerado.`)
  }
  return estado.validacaoCliente
}

export function registrarValidacaoGerada(estado: Estado, em: string): Estado {
  exigirQuatroAberta(estado, "gerar o documento de validação")
  const antes = entregaveisAntesDaTroca(estado)
  if (antes.length > 0) {
    throw new TransicaoInvalida(
      `Antes de gerar o documento, aprove de novo o que foi aprovado antes da troca de dados: ${antes.map((e) => e.titulo).join("; ")}.`,
    )
  }
  const validacaoCliente: ValidacaoCliente = {
    arquivo: ARQUIVO_VALIDACAO,
    primeiraGeracaoEm: estado.validacaoCliente?.primeiraGeracaoEm ?? em,
    geradoEm: em,
    baixadoEm: null,
    baixadoPor: null,
    confirmadoEm: null,
    confirmadoPor: null,
  }
  return { ...estado, validacaoCliente, atualizadoEm: em }
}

export function registrarDownloadValidacao(estado: Estado, autor: string | null, em: string): Estado {
  const v = exigirDocumento(estado, "registrar o download")
  return { ...estado, validacaoCliente: { ...v, baixadoEm: em, baixadoPor: autor }, atualizadoEm: em }
}

export function confirmarValidacaoCliente(estado: Estado, autor: string | null, em: string): Estado {
  const v = exigirDocumento(estado, "confirmar a validação do cliente")
  if (v.confirmadoEm) return estado
  exigirQuatroAberta(estado, "confirmar a validação do cliente")
  if (!v.baixadoEm) {
    throw new TransicaoInvalida("Baixe o documento de validação antes de confirmar que o cliente validou os dados.")
  }
  if (documentoDefasado(estado)) {
    throw new TransicaoInvalida("O documento de validação está desatualizado: gere de novo antes de confirmar.")
  }
  return { ...estado, validacaoCliente: { ...v, confirmadoEm: em, confirmadoPor: autor }, atualizadoEm: em }
}

/** Mantém o download e desfaz só a confirmação (nova mensagem do analista na 04 reabre a conversa). */
export function limparConfirmacaoValidacao(estado: Estado, em: string): Estado {
  const v = estado.validacaoCliente
  if (!v || !v.confirmadoEm) return estado
  return { ...estado, validacaoCliente: { ...v, confirmadoEm: null, confirmadoPor: null }, atualizadoEm: em }
}

/** O que ainda impede a 04 de concluir por causa do gate de validação, na ordem em que o analista resolve. */
export function pendenciasValidacao(estado: Estado): string[] {
  const v = estado.validacaoCliente
  if (!v) return ["Gerar o documento de validação do cliente"]
  const faltando: string[] = []
  if (documentoDefasado(estado)) faltando.push("Gerar de novo o documento de validação: os gráficos mudaram depois dele")
  for (const e of entregaveisAntesDaTroca(estado)) {
    faltando.push(`Aprovar de novo, depois da troca de dados: ${e.titulo}`)
  }
  if (!v.baixadoEm) faltando.push("Baixar o documento de validação")
  if (!v.confirmadoEm) faltando.push("Confirmar que o cliente validou os dados")
  return faltando
}
