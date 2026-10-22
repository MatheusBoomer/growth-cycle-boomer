/**
 * O texto que o agente deixa para a próxima etapa não abre com "Etapa concluída!": quem conclui é o analista,
 * no botão. Mensagens antigas (ou um agente que ignore a regra) são corrigidas aqui, ao gravar e ao exibir.
 */
const ABERTURA = /^\s*etapa\s+conclu[ií]da\s*[!.:\u2014\u2013-]*\s*/i

/** Começos de frase comuns: viram minúscula depois de "Nesta sessão,". Sigla e nome próprio não entram. */
const COMECOS_DE_FRASE = new Set(["não", "cada", "para", "só", "todos", "todas", "tudo", "agora", "já", "esta", "este", "isso", "vou", "preciso"])

export function semAberturaDeConclusao(texto: string): string {
  const resto = texto.replace(ABERTURA, "")
  if (resto === texto) return texto
  const primeira = (resto.split(/\s/, 1)[0] ?? "").replace(/[,.;:!?]$/, "").toLowerCase()
  const corpo = COMECOS_DE_FRASE.has(primeira) ? resto.charAt(0).toLowerCase() + resto.slice(1) : resto
  return `Nesta sessão, ${corpo}`
}
