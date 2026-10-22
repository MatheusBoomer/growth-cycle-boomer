import type { EtapaCatalogo } from "./tipos"

export function systemPromptModoInterface({ slug, etapa }: { slug: string; etapa: EtapaCatalogo }): string {
  const pasta = `clientes/${slug}/`
  const trabalho = etapa.skill
    ? `skill \`${etapa.skill}\``
    : "subagente `designer-apresentacao` (ver `.claude/commands/apresentacao-final.md`)"
  return `# Modo interface do Planejamento Estratégico

Você está rodando dentro da interface web do planejamento, não no terminal. O analista vê o chat e cards com botões. Estas regras complementam \`.claude/skills/_shared/regras-de-validacao.md\` (Regra 7):

- Responda sempre em português do Brasil, inclusive nas frases curtas entre uma ferramenta e outra.
- Não use travessão (\u2014) no meio das frases, nem no chat nem nos textos que gravar: use vírgula, dois-pontos, parênteses ou ponto. O travessão só vale para indicar intervalo entre números (ex.: 10\u201420).
- Prospect: \`${slug}\`, pasta \`${pasta}\`. Etapa atual: ${etapa.rotuloStatus} (${trabalho}). Trabalhe só nesta etapa.
- Salve todo gráfico, tabela, texto ou arquivo que precisa de aprovação em \`${pasta}.app/rascunhos/\` e chame \`propor_entregavel\`. Nunca grave em \`entrega/ativos-aprovados/\`: o app faz isso quando o analista aprova. Depois de propor, encerre a resposta e espere: a decisão chega como nova mensagem.
- Não peça "ok" ou "aprovado" em texto para gráficos e seções: o card substitui isso. Perguntas estratégicas e de esclarecimento continuam normais no chat.
- Para pedir um arquivo ao analista, chame \`solicitar_insumo\` com o id do catálogo, em vez de descrever caminho de pasta.
- Para pedir uma decisão ou fazer perguntas ao analista, pergunte no chat, em texto: faça uma pergunta por vez, com a sua recomendação quando houver, e espere a resposta antes de seguir. Não liste várias perguntas de uma vez.
- Não edite \`contexto/status-planejamento.md\` nem nada em \`.app/\` fora de \`.app/rascunhos/\`.
- Quando o critério de conclusão for atingido, chame \`sinalizar_etapa_pronta\` com o resumo das decisões (markdown) e o texto de handoff para a próxima etapa (o mesmo do "Encerramento e handoff" da skill, sem citar caminhos). Se a ferramenta disser que falta algo, resolva o que depender de você e espere o resto.
- Nunca reproduza CPF, e-mail, telefone, endereço ou dado de cartão.`
}

export function promptInicialEtapa({
  slug,
  etapa,
  dossie,
}: {
  slug: string
  etapa: EtapaCatalogo
  dossie: string
}): string {
  const acao = etapa.skill
    ? `Use a skill \`${etapa.skill}\` e siga o processo dela do início.`
    : "Acione o subagente `designer-apresentacao` para montar a apresentação final, usando só `entrega/ativos-aprovados/` (ver `.claude/commands/apresentacao-final.md`)."
  return `Vamos trabalhar na ${etapa.rotuloStatus} do prospect \`${slug}\`.

${acao}

## Dossiê das etapas anteriores

${dossie}`
}

export function mensagemAprovacao(titulo: string, nomeFinal: string, destino: string, editado = false): string {
  const edicao = editado
    ? " O analista editou o texto antes de aprovar: releia o arquivo aprovado e use essa versão daqui em diante, não a que você escreveu."
    : ""
  return `O analista APROVOU o entregável “${titulo}” (${nomeFinal}). O app já salvou em \`${destino}\`.${edicao} Siga para o próximo passo da skill.`
}

export function mensagemAjuste(titulo: string, nomeFinal: string, texto: string, imagem?: string): string {
  const marcacoes = imagem
    ? ` O analista marcou áreas e números sobre o gráfico: abra \`${imagem}\` com Read e atenda cada número da lista.`
    : ""
  return `O analista pediu AJUSTE no entregável “${titulo}” (${nomeFinal}): “${texto}”.${marcacoes} Refaça, salve em .app/rascunhos/ e proponha de novo com o mesmo nome_final.`
}

export function mensagemInsumoRecebido(nome: string, arquivo: string, resumo: string | null): string {
  return `O analista enviou “${nome}” e o arquivo passou na validação: \`${arquivo}\`${resumo ? ` (${resumo})` : ""}. Pode seguir.`
}

export function mensagemEtapaAnteriorAlterada(rotulo: string): string {
  return `Aviso do app: a etapa ${rotulo} foi reaberta pelo analista. O que for aprovado lá pode mudar as bases desta etapa; releia \`contexto/decisoes/\` e os ativos aprovados antes de seguir.`
}
