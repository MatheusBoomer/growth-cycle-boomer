/**
 * O que mostrar no lugar do "Concluir etapa" (regra do usuário: o botão só aparece quando tudo está pronto).
 * - pronto: nada falta e o agente não está trabalhando nesta etapa;
 * - esperando-agente: há entregável, tudo aprovado e enviado, só falta o agente sinalizar o fim (linha discreta, sem botão);
 * - oculto: qualquer outro caso (os contadores do painel já mostram o que falta).
 */
export function estadoDoConcluir({
  condicoes,
  sinalizada,
  turnoAtivoAqui,
  temEntregaveis,
}: {
  condicoes: string[]
  sinalizada: boolean
  turnoAtivoAqui: boolean
  /** Há ao menos um entregável (não substituído) na etapa. Sem nada proposto, "tudo aprovado" seria falso. */
  temEntregaveis: boolean
}): "pronto" | "esperando-agente" | "oculto" {
  if (turnoAtivoAqui) return "oculto"
  if (condicoes.length === 0) return "pronto"
  if (!sinalizada && condicoes.length === 1 && temEntregaveis) return "esperando-agente"
  return "oculto"
}

/** Insumos obrigatórios recebidos e total (os opcionais não travam a etapa e fariam "2/3" parecer que falta algo). */
export function contagemInsumos(
  refs: { id: string; obrigatorio: boolean }[],
  estados: { etapa: string; insumoId: string; status: string }[],
  etapa: string,
): { recebidos: number; total: number } {
  const obrigatorios = refs.filter((r) => r.obrigatorio)
  return {
    recebidos: obrigatorios.filter((r) => estados.some((i) => i.etapa === etapa && i.insumoId === r.id && i.status === "valido")).length,
    total: obrigatorios.length,
  }
}
