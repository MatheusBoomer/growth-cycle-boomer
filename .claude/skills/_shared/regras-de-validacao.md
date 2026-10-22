# Regras de validação — comuns a todas as skills

Referenciado por todas as skills. Não copie este conteúdo para dentro de uma
skill — referencie este arquivo.

## 1. Checagem manual obrigatória

Depois de gerar qualquer gráfico, tabela ou cálculo, a skill **para** e pede
confirmação explícita do analista antes de avançar para a próxima etapa. Nunca
assumir que um resultado está correto automaticamente. Se houver qualquer
inconsistência apontada, interromper e corrigir — não seguir em frente "só
essa vez".

## 2. Salvar o aprovado

Assim que a checagem manual confirmar um gráfico ou uma seção de texto
(Análises/Insights), a skill salva o artefato em:

- Gráficos → `entrega/ativos-aprovados/graficos/<nome-do-grafico>.png`
- Texto → `entrega/ativos-aprovados/secoes/<numero-da-skill>-<nome>.md`

**Nome de arquivo estável, sem versionamento.** Se o analista pedir para
refazer um gráfico ou reescrever uma análise mais tarde, a nova versão
aprovada **sobrescreve** a anterior no mesmo caminho — não criar `-v2`, `-v3`
nem manter histórico. Só a versão aprovada mais recente importa.

Isso desacopla a montagem da apresentação final (feita pela Skill 10, ao
final de tudo) da conversa em si: a Skill 10 lê apenas essa pasta, não precisa
saber quantas iterações aconteceram em cada gráfico ou texto.

## 3. Regra do não-flat

Nenhuma distribuição mensal — meta anual quebrada por mês, cenários de KPI,
alocação de verba por plataforma — pode ser uniforme (o mesmo valor ou a mesma
proporção todo mês). Isso é garantido em código pelo `scripts/projecao.py`
(usado pelo subagente `analista-dados`), não por instrução em texto: o script
recusa uma distribuição flat e obriga o uso da sazonalidade histórica real do
prospect.

## 4. Teste de consistência cruzada

Sempre que um número ou ranking calculado tiver uma fonte de verdade na
plataforma de origem (ex.: ranking Top-5 clientes por gasto histórico, na
Skill 04), pedir ao analista que confirme comparando com o que a plataforma
mostra diretamente. Se houver divergência, interromper até esclarecer — nunca
seguir com um número que diverge de uma fonte que poderia ter sido checada.

## 5. Sanitização de PII

Ver `CLAUDE.md` raiz. Vale para qualquer skill que processe dado de cliente
final do prospect, não só a Skill 04.

## 6. Handoff estruturado ao final de cada etapa

Ao atingir o critério de conclusão, toda skill numerada (e a `criar-prospect`)
apresenta ao analista um bloco fechado de handoff, em vez de só dizer "avance
para a Skill NN": o que foi produzido nesta etapa, e o que precisa estar
pronto — arquivo, decisão ou resposta — para iniciar a próxima, terminando
com o comando exato para chamá-la.

A mensagem de encerramento começa situando a sessão que acabou de fechar
("Nesta sessão, …"), nunca com "Etapa concluída": a etapa só é concluída
quando o analista clica em Concluir, e é a interface que comemora isso (aviso
e confete). Dizer "concluída" antes disso adianta uma decisão que é dele.

O pedido é sempre em linguagem natural, como um colega pediria, nunca citando
caminho de arquivo interno (ex.: nunca `contexto/brutos/kickoff-transcricao-
bruta.docx` na mensagem ao analista). Quando o pedido envolver arquivo, o
formato sempre é nomeado do jeito que o analista reconhece — planilha/Excel,
documento Word, PDF, print/imagem, link — nunca deixado implícito.

Ao mesmo tempo, a skill atualiza `contexto/status-planejamento.md` do
prospect: marca sua própria linha como concluída (data) e reescreve o bloco
"Próximo passo" com o mesmo pedido feito ao analista no chat. Isso torna o
handoff persistente — se a conversa for reaberta em outra sessão ou
compactada por excesso de histórico, basta ler esse arquivo para saber onde o
processo parou e o que falta preparar, sem depender do chat.

Se o "Antes de começar" de uma skill mudar no futuro, atualizar também o
bloco de handoff da skill anterior correspondente — os dois textos descrevem
a mesma exigência e não podem divergir.

Além disso, toda etapa numerada registra um resumo das decisões tomadas em
`contexto/decisoes/<nome-da-skill>.md` (ex.: `contexto/decisoes/03-diagnostico-performance.md`):
números aprovados, escolhas do analista e ressalvas — o que uma etapa
posterior precisa saber sem reler a conversa. No terminal, a própria skill
grava esse arquivo; no modo interface (Regra 7), quem grava é o app, com o
`resumo_decisoes` enviado em `sinalizar_etapa_pronta`.

## 7. Modo interface

Quando as ferramentas do MCP `planejamento` estiverem disponíveis
(`propor_entregavel`, `solicitar_insumo`, `fazer_perguntas`, `sinalizar_etapa_pronta`), a skill
está rodando dentro da interface web, e estas regras substituem o jeito
"terminal" de fazer as Regras 1, 2 e 6:

- **Checkpoint (Regras 1 e 2):** salve o gráfico, a tabela ou o texto em
  `clientes/<slug>/.app/rascunhos/` e chame `propor_entregavel` com um
  `nome_final` estável. Não peça "ok" no chat e não grave em
  `entrega/ativos-aprovados/` — o app copia para lá quando o analista clica em
  Aprovar. Depois de propor, encerre a resposta; a decisão chega como nova
  mensagem ("APROVOU" ou "AJUSTE").
- **Insumos:** peça arquivos com `solicitar_insumo` (ids em
  `.claude/skills/_shared/etapas.json`), não descrevendo caminhos de pasta.
- **Decisões entre alternativas:** quando precisar que o analista escolha
  entre opções definidas (cenário, prioridade, premissa), chame
  `fazer_perguntas` em vez de listar as opções no texto. O card aceita até
  10 perguntas, mostra uma por vez e uma revisão editável antes do envio.
  Pergunta com opções (2 a 6) já aceita resposta livre; pergunta sem opções é
  aberta, de resposta escrita (é assim que a Skill 02 manda as perguntas
  estratégicas). Depois de chamar, encerre a resposta; as respostas chegam
  como nova mensagem ("RESPONDEU"). Uma dúvida pontual de esclarecimento
  pode continuar no chat normal.
- **Encerramento (Regra 6):** não edite `contexto/status-planejamento.md`.
  Chame `sinalizar_etapa_pronta` com o resumo de decisões (markdown) e o
  mesmo texto de handoff do "Encerramento e handoff" da skill.
- A pasta `.app/` pertence ao app: fora de `.app/rascunhos/`, não escreva nela.
- Scripts que geram arquivo (ex.: `preencher_projecao_xlsx.py`,
  `preencher_plano_acao_docx.py`) recebem `--output` apontando para
  `.app/rascunhos/`, e o resultado é proposto com `propor_entregavel`
  (tipo `planilha` ou `documento`). Na etapa final, o roteiro da apresentação é
  proposto como tipo `roteiro` (`.json`) e `gerar_apresentacao.py` gera o tipo
  `apresentacao` (`.pptx`).

## 8. Checklist de qualidade do diagnóstico

Regra de ouro: nenhum problema sai do diagnóstico sem solução. Antes do
checkpoint final, a Skill 05 (Soluções) e a Skill 10 (Apresentação final)
apresentam ao analista os 5 itens abaixo, cada um marcado como atendido ou
com o que falta:

1. **Problema identificado = 1 a 3 soluções**, no próprio problema, não só no
   plano de ação. Garantido por `scripts/validar_solucoes.py --modo registro`.
2. **Hipótese de causa antes da ação**: "por que acontece" vem antes de "o que
   fazer". Conferência do analista: a hipótese explica o dado?
3. **Impacto estimado em R$ ou %**: o número que abre a conversa com o
   cliente. Garantido pelo validador (`nao_quantificavel` só com
   justificativa, e vira aviso).
4. **Cada solução vira item do plano**, com dono, prazo e frente. Garantido
   por `scripts/validar_solucoes.py --modo plano` na Skill 09.
5. **Benchmarking termina em teste**: o que vamos aplicar, não só o que o
   concorrente faz. Conferência do analista no bloco "O que testar" da
   Skill 07.
