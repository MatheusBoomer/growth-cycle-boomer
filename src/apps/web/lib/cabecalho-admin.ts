const ABAS: Record<string, { titulo: string; destaque: string; frase: string }> = {
  "/admin/pessoas": { titulo: "Pessoas", destaque: "da equipe", frase: "Quem entra no Growth Cycle e com que papel. Admin vê todos os prospects e administra as pessoas." },
  "/admin/projetos": { titulo: "Projetos", destaque: "e custos", frase: "Quanto cada projeto custou, em quanto tempo e onde o dinheiro foi." },
  "/admin/modelos": { titulo: "Modelos", destaque: "por etapa", frase: "Vale a partir do próximo turno de cada etapa. Padrão deixa a escolha com o Claude Code." },
  "/admin/skills": { titulo: "Skills", destaque: "e fluxos", frase: "Fluxo e texto de cada etapa, subagente e regra. As notas anotam o que melhorar." },
  "/admin/reports": { titulo: "Reports", destaque: "da equipe", frase: "Bugs e melhorias enviados pelo botão Reportar, com o print marcado." },
}

/** Cabeçalho de cada aba da administração (sub-rotas usam a aba mãe). Rota desconhecida: só "Administração". */
export function cabecalhoDaAba(caminho: string): { titulo: string; destaque: string; frase: string } {
  const aba = Object.keys(ABAS).find((a) => caminho === a || caminho.startsWith(`${a}/`))
  return aba ? ABAS[aba]! : { titulo: "Administração", destaque: "", frase: "" }
}
