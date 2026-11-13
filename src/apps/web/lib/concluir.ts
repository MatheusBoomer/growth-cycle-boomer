/**
 * O que mostrar no lugar do "Concluir etapa" (regra do usuário: o botão só aparece quando tudo está pronto).
 * - pronto: nada falta e o agente não está trabalhando nesta etapa;
 * - esperando-agente: tudo aprovado e enviado, só falta o agente sinalizar o fim (uma linha discreta, sem botão);
 * - oculto: qualquer outro caso (os contadores do painel já mostram o que falta).
 */
export function estadoDoConcluir({ condicoes, sinalizada, turnoAtivoAqui }: { condicoes: string[]; sinalizada: boolean; turnoAtivoAqui: boolean }): "pronto" | "esperando-agente" | "oculto" {
  if (turnoAtivoAqui) return "oculto"
  if (condicoes.length === 0) return "pronto"
  if (!sinalizada && condicoes.length === 1) return "esperando-agente"
  return "oculto"
}
