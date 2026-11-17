import type { EtapaCatalogo, EventoConversa } from "./tipos"

export function systemPromptModoInterface({ slug, etapa }: { slug: string; etapa: EtapaCatalogo }): string {
  const pasta = `clientes/${slug}/`
  const trabalho = etapa.skill
    ? `skill \`${etapa.skill}\``
    : "subagente `designer-apresentacao` (ver `.claude/commands/apresentacao-final.md`)"
  return `# Modo interface do Growth Cycle

Você está rodando dentro da interface web do Growth Cycle, não no terminal. O analista vê o chat e cards com botões. Estas regras complementam \`.claude/skills/_shared/regras-de-validacao.md\` (Regra 7):

- Responda sempre em português do Brasil, inclusive nas frases curtas entre uma ferramenta e outra.
- Não use travessão (\u2014) no meio das frases, nem no chat nem nos textos que gravar: use vírgula, dois-pontos, parênteses ou ponto. O travessão só vale para indicar intervalo entre números (ex.: 10\u201420).
- Prospect: \`${slug}\`, pasta \`${pasta}\`. Etapa atual: ${etapa.rotuloStatus} (${trabalho}). Trabalhe só nesta etapa.
- Exceção, só na etapa 04 e enquanto ela estiver aberta (antes ou depois do documento de validação): você pode pedir insumos da etapa 03 com \`solicitar_insumo\`, propor peças da 03 com \`propor_entregavel\` e \`etapa_origem: "03"\` e, ao sinalizar a etapa pronta, enviar \`resumo_decisoes_03\` quando algo da 03 mudou (insumo da 03 trocado ou peça da 03 aprovada nesta conversa). Fora isso, não mexa em outras etapas.
- Na etapa 04, o último passo antes de sinalizar é o documento de validação do cliente: gere o PDF com \`scripts/gerar_documento_validacao.py\` e entregue com \`propor_validacao_cliente\`, mesmo que a etapa já estivesse "pronta" numa sessão anterior. Sem esse PDF a etapa não conclui.
- Salve todo gráfico, tabela, texto ou arquivo que precisa de aprovação em \`${pasta}.app/rascunhos/\` e chame \`propor_entregavel\`. Nunca grave em \`entrega/ativos-aprovados/\`: o app faz isso quando o analista aprova. Depois de propor, encerre a resposta e espere: a decisão chega como nova mensagem.
- Não peça "ok" ou "aprovado" em texto para gráficos e seções: o card substitui isso. Perguntas estratégicas e de esclarecimento continuam normais no chat.
- Para pedir um arquivo ao analista, chame \`solicitar_insumo\` com o id do catálogo, em vez de descrever caminho de pasta.
- O analista também pode anexar arquivos pelo clipe do chat (ficam em \`${pasta}.app/anexos/\`). Se um anexo for, pelo conteúdo, um insumo da etapa (ex.: a transcrição do kickoff), abra e confira o arquivo e chame \`registrar_insumo_anexado\` com o id do insumo e o caminho do anexo. Depois disso não peça o arquivo de novo nem mande o analista usar o card de envio. Se o anexo não for o insumo esperado, diga isso em uma frase.
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

const LIMITE_HISTORICO = 40000

/** Retoma a etapa numa sessão nova: o prompt inicial seguido do que já foi conversado (só falas do analista e do agente). */
export function promptRetomadaEtapa({
  slug,
  etapa,
  dossie,
  historico,
}: {
  slug: string
  etapa: EtapaCatalogo
  dossie: string
  historico: EventoConversa[]
}): string {
  const mensagens: string[] = []
  for (const e of historico) {
    if (e.tipo === "mensagem_analista") mensagens.push(`**Analista:** ${e.texto}`)
    else if (e.tipo === "texto_agente") mensagens.push(`**Agente:** ${e.texto}`)
  }
  // fica com as mais recentes que cabem no limite
  const mantidas: string[] = []
  let total = 0
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i]!
    const custo = m.length + (mantidas.length ? 2 : 0)
    if (total + custo > LIMITE_HISTORICO) {
      if (mantidas.length === 0) mantidas.unshift(m.slice(-LIMITE_HISTORICO))
      break
    }
    mantidas.unshift(m)
    total += custo
  }
  return `${promptInicialEtapa({ slug, etapa, dossie })}

---

### Histórico desta etapa (a sessão anterior não pôde ser restaurada)

${mantidas.join("\n\n")}`
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

export interface DecisaoGrafico {
  titulo: string
  nomeFinal: string
  /** Onde o app salvou o gráfico aprovado, relativo à raiz do projeto. */
  destino?: string
}

/**
 * Resumo que o app anexa à mensagem do analista no chat quando há gráficos decididos em silêncio
 * (aprovar um gráfico não chama o agente). Vazio quando não há nada a contar.
 */
export function resumoDecisoesGraficos(aprovados: DecisaoGrafico[], semDecisao: DecisaoGrafico[]): string {
  if (aprovados.length === 0 && semDecisao.length === 0) return ""
  const linhas: string[] = ["Resumo do app sobre os gráficos desta etapa (aprovar um gráfico não chama o agente; vale o que está abaixo):"]
  if (aprovados.length > 0) {
    linhas.push(
      "",
      "APROVADOS desde a última mensagem (já salvos, não refaça):",
      ...aprovados.map((g) => `- “${g.titulo}” (${g.nomeFinal})${g.destino ? `, em \`${g.destino}\`` : ""}`),
    )
  }
  if (semDecisao.length > 0) {
    linhas.push(
      "",
      "AINDA SEM DECISÃO (nem aprovados nem com ajuste pedido): pergunte ao analista no chat o que fazer com eles, sem supor:",
      ...semDecisao.map((g) => `- “${g.titulo}” (${g.nomeFinal})`),
    )
  }
  linhas.push(
    "",
    "Gráficos com AJUSTE pedido, quando houver, vêm descritos na mensagem acima, com as marcações. Refaça só esses, salve em .app/rascunhos/ e proponha de novo com o mesmo nome_final.",
  )
  return linhas.join("\n")
}

export interface ItemAjusteMensagem {
  titulo: string
  nomeFinal: string
  /** Linhas já numeradas das marcações deste entregável. */
  marcacoes: string[]
  /** Caminho da imagem anotada, relativo à raiz do projeto. */
  imagem?: string
}

/** Mensagem ao agente quando o analista escreve no chat sobre um ou mais entregáveis (pedido de ajuste). */
export function mensagemAjustes(texto: string, itens: ItemAjusteMensagem[]): string {
  const blocos = itens.map((i) => {
    const cabecalho = `AJUSTE no entregável “${i.titulo}” (${i.nomeFinal}): refaça, salve em .app/rascunhos/ e proponha de novo com o mesmo nome_final.`
    if (i.marcacoes.length === 0) return cabecalho
    const imagem = i.imagem ? ` (abra \`${i.imagem}\` com Read)` : ""
    return `${cabecalho}\nMarcações numeradas na imagem anotada${imagem}:\n${i.marcacoes.join("\n")}`
  })
  return `${texto.trim()}\n\n${blocos.join("\n\n")}`
}

export function mensagemInsumoRecebido(nome: string, arquivo: string, resumo: string | null): string {
  return `O analista enviou “${nome}” e o arquivo passou na validação: \`${arquivo}\`${resumo ? ` (${resumo})` : ""}. Pode seguir.`
}

/**
 * Troca de um insumo da etapa 03 (já concluída) feita pelo analista na correção da validação do cliente, na conversa da 04:
 * o agente refaz o que dependia do arquivo, gera o PDF de novo e devolve o resumo corrigido da 03.
 */
export function mensagemInsumoDaTresRecebido(nome: string, arquivo: string, resumo: string | null): string {
  return `O analista trocou “${nome}”, um arquivo da etapa 03, durante a correção da validação do cliente, e o novo arquivo passou na validação: \`${arquivo}\`${resumo ? ` (${resumo})` : ""}. Refaça os gráficos, tabelas e leituras da 03 e da 04 que dependem dele e proponha cada um de novo (os da 03 com \`etapa_origem: "03"\` em \`propor_entregavel\`). Depois gere um novo PDF de validação com \`propor_validacao_cliente\`. Ao chamar \`sinalizar_etapa_pronta\`, envie também \`resumo_decisoes_03\` com o resumo corrigido das decisões da 03.`
}

export function mensagemEtapaAnteriorAlterada(rotulo: string): string {
  return `Aviso do app: a etapa ${rotulo} foi reaberta pelo analista. O que for aprovado lá pode mudar as bases desta etapa; releia \`contexto/decisoes/\` e os ativos aprovados antes de seguir.`
}
