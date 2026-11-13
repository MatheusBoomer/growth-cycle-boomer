/** Fases do ciclo, únicas e na ordem do catálogo (ex.: rodapé do login). Etapa sem fase não entra. */
export function fasesEmOrdem(etapas: { fase?: string }[]): string[] {
  return [...new Set(etapas.flatMap((e) => (e.fase ? [e.fase] : [])))]
}
