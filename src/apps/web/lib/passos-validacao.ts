import type { ValidacaoCliente } from "@workspace/core/tipos"

export interface PassosValidacao {
  gerado: boolean
  baixado: boolean
  confirmado: boolean
  /** Só com o PDF baixado, ainda não confirmado e sem gráfico novo depois dele. */
  podeConfirmar: boolean
  aviso: string | null
}

/** Em que ponto está o documento de validação do cliente e o que o card deve dizer ao analista. */
export function passosValidacao(v: ValidacaoCliente | undefined, defasado: boolean): PassosValidacao {
  if (!v) return { gerado: false, baixado: false, confirmado: false, podeConfirmar: false, aviso: null }
  const baixado = v.baixadoEm !== null
  const confirmado = v.confirmadoEm !== null
  const aviso = defasado
    ? "Os gráficos mudaram depois deste PDF. Peça um novo ao agente."
    : !baixado
      ? "Baixe o PDF para liberar a confirmação."
      : null
  return { gerado: true, baixado, confirmado, podeConfirmar: baixado && !confirmado && !defasado, aviso }
}
