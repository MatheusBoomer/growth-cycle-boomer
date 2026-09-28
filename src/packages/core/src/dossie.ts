export function extrairOverrides(claudeMd: string | null): string | null {
  if (!claudeMd) return null
  const partes = claudeMd.split(/^## Overrides específicos deste prospect\s*$/m)
  if (partes.length < 2) return null
  const secao = partes[1]!.split(/^## /m)[0]!.trim()
  if (!secao || secao.includes("Esta seção normalmente fica vazia")) return null
  return secao
}

export interface AnteriorDossie {
  rotulo: string
  origem: "app" | "terminal"
  resumo: string | null
  desatualizada: boolean
}

export interface EntradaDossie {
  nome: string
  slug: string
  site: string | null
  anteriores: AnteriorDossie[]
  aprovados: string[]
  overrides: string | null
  contextoPersistido: string[]
  insumosRecebidos: { nome: string; arquivo: string }[]
}

export function montarDossie(e: EntradaDossie): string {
  const caminho = (rel: string) => `\`clientes/${e.slug}/${rel}\``
  const partes: string[] = [
    `**Prospect:** ${e.nome} (pasta \`clientes/${e.slug}/\`)${e.site ? ` · site: ${e.site}` : ""}`,
  ]
  if (e.overrides) partes.push("### Overrides deste prospect (valem sobre as regras padrão)", e.overrides)
  partes.push("### Decisões das etapas anteriores")
  if (e.anteriores.length === 0) partes.push("Nenhuma — esta é a primeira etapa.")
  for (const a of e.anteriores) {
    partes.push(`#### ${a.rotulo}${a.desatualizada ? " ⚠️ desatualizada (uma etapa anterior foi reaberta)" : ""}`)
    partes.push(
      a.resumo?.trim() ||
        (a.origem === "terminal"
          ? "Etapa feita no terminal, sem resumo de decisões. Consulte os arquivos de contexto e os ativos aprovados abaixo."
          : "Sem resumo registrado."),
    )
  }
  if (e.contextoPersistido.length > 0) {
    partes.push("### Contexto persistido (leia antes de começar)", e.contextoPersistido.map((c) => `- ${caminho(c)}`).join("\n"))
  }
  partes.push(
    "### Ativos já aprovados",
    e.aprovados.length > 0 ? e.aprovados.map((a) => `- ${caminho(a)}`).join("\n") : "Nenhum ainda.",
  )
  if (e.insumosRecebidos.length > 0) {
    partes.push(
      "### Insumos já recebidos nesta etapa",
      e.insumosRecebidos.map((i) => `- ${i.nome}: ${caminho(i.arquivo)}`).join("\n"),
    )
  }
  return partes.join("\n\n")
}
