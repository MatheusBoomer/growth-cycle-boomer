import type { ConjuntoPerguntas } from "@workspace/core/tipos"

const SEM_RESPOSTA = "sem resposta"

/** Pergunta e resposta em texto, para mostrar o histórico dos cards antigos de perguntas (só leitura). */
export function linhasDoHistorico(c: ConjuntoPerguntas): { enunciado: string; resposta: string }[] {
  return c.perguntas.map((p, i) => {
    const r = c.status === "respondida" ? c.respostas?.[i] : null
    const escrita = r?.outra?.trim()
    const partes = [...(r?.selecionadas ?? []), ...(escrita ? [escrita] : [])]
    return { enunciado: p.enunciado, resposta: partes.length > 0 ? partes.join("; ") : SEM_RESPOSTA }
  })
}
