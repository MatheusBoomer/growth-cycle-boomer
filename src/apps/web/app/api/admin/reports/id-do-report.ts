import { ErroNaoEncontrado } from "@workspace/core/erros"

const INTEIRO_POSITIVO = /^[1-9]\d*$/

/** Só dígitos decimais, sem zero à esquerda: "1e3", "0x10", " 12 " e afins não viram um id por acaso (404 com `msg`). */
export function idInteiro(bruto: string, msg: string): number {
  const id = INTEIRO_POSITIVO.test(bruto) ? Number(bruto) : Number.NaN
  if (!Number.isSafeInteger(id)) throw new ErroNaoEncontrado(msg)
  return id
}
