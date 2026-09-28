---
name: briefing-e-benchmark
description: Consolida tudo que foi construído nas skills anteriores num briefing estruturado e aciona a pesquisa de concorrentes — substitui o antigo processo manual de sair do chat e entrar no Cowork. Use após metas-e-cenarios, ao concluir o diagnóstico e a projeção.
---

# Skill 06 — Briefing e Benchmark de Concorrentes

Skill 6 de 8. Corresponde ao Prompt 7 (Produção de Briefing) do processo
original, mais a etapa de pesquisa de concorrentes que antes não tinha skill
própria e dependia de um salto manual para o Cowork. Aqui, o subagente
`pesquisador-benchmark` faz essa pesquisa sem sair do Claude Code.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 05 concluídas e aprovadas.
- [ ] Lista de concorrentes que você quer que a gente pesquise, se já tiver
      pensado nisso (se não tiver, a skill pergunta antes da Fase 2).

## Fase 1 — Briefing do Cliente

### Objetivo

Consolidar em um único documento estruturado todo o conhecimento construído
nas Skills 01 a 05.

### Processo

1. Ler os resumos de decisão das etapas anteriores em `contexto/decisoes/`
   e o histórico desta conversa (no modo interface, cada etapa tem sua
   própria conversa — o que foi decidido antes está nos resumos e no dossiê).
2. **Ler novamente a pasta `contexto/` do cliente** que está sendo trabalhado
   para coletar informações que podem ter sido perdidas ao longo da conversa.
3. Preencher todos os campos do template abaixo com as informações
   levantadas. Não deixe nenhum campo em branco — se algo não foi discutido,
   registrar "Não levantado nesta sessão".
4. Usar apenas valores exatos já validados pelo analista ao longo do
   processo. Não inventar nem estimar valores não confirmados.
5. Na seção de Concorrentes, usar a lista discutida com o analista. Se não
   foi discutida, registrar "A definir com o cliente" e sinalizar como
   pendência.

### Template do briefing (`entrega/ativos-aprovados/secoes/06-briefing.md`)

```markdown
# Briefing do Cliente — [Nome do Prospect]

## Identificação
Nome | Segmento | Link do e-commerce | Período analisado | Data | Analista

## 1. Contextualização Estratégica (Skill 02)
Modelo de negócio, produto, proposta de valor, público-alvo, posicionamento,
maturidade, objetivo declarado, hipóteses, gargalos, pendências.

## 2. Macro Financeiro (Skill 03, parte 1)
Investimento, receita, ROAS — médias, picos, vales, riscos.

## 3. Aquisição, Dependência e Conversão (Skill 03, parte 2)
Sessões, dependência de mídia paga, conversão por plataforma, Curva ABC.

## 4. Unidade Econômica (Skill 04)
CAC, novos vs recorrentes, LTV, LTV/CAC.

## 5. Metas do Projeto (Skill 05, parte 1)
Meta oficial, distribuição mensal, lógica de distribuição.

## 6. Cenários e Impactos Esperados (Skill 05, parte 2)
Resumo dos 3 cenários, alavancas, riscos, alavanca principal.

## 7. Concorrentes para Pesquisa de Benchmark
Lista de concorrentes a pesquisar + contexto estratégico para orientar a
análise.

## 8. Observações e Pendências
```

## Fase 2 — Pesquisa de Benchmark

Acionar o subagente `pesquisador-benchmark` passando a seção 7 do briefing
(lista de concorrentes + contexto estratégico). O subagente devolve **duas
saídas** (ver `.claude/agents/pesquisador-benchmark.md` para o processo
completo):

1. **Blocos estratégicos, por concorrente:**
   - **Lição:** o que o concorrente faz de relevante, com base em presença
     online e/ou anúncios ativos, conectado a uma aplicação direta e
     específica para o prospect — não uma observação genérica.
   - **Evidência:** contagem de anúncios ativos na Biblioteca de Anúncios do
     Meta + exemplos de criativos, quando disponível.

2. **Dados do relatório detalhado** — os atributos de cada criativo analisado
   (com o link da Biblioteca de Anúncios), a análise do próprio prospect e a
   síntese estratégica.

### Montagem e salvamento dos artefatos

Depois da checagem manual do Analista:

- Montar o **relatório HTML de benchmark** a partir da base visual
  `.claude/skills/_shared/benchmark-template.html`, preenchendo com os dados
  da saída 2 conforme `.claude/skills/_shared/relatorio-benchmark.md`, e salvar
  em `entrega/ativos-aprovados/benchmark/benchmark.html`. É um arquivo
  autocontido — inclui um card por concorrente com a tabela de atributos e os
  **links de cada criativo analisado**, a análise do próprio prospect e a
  Síntese Estratégica Geral.
- Salvar a camada estratégica concisa (Lição + Evidência por concorrente + os
  destaques estratégicos) em `entrega/ativos-aprovados/secoes/06-benchmark.md`
  — é ela que alimenta a narrativa e a apresentação final.

## Restrições

- Não resumir nem omitir informações já validadas no briefing.
- Não adicionar análise nova no briefing — apenas consolidar o que já foi
  construído.
- Não alterar valores que o analista já aprovou.

## Critério de conclusão

- Briefing completo, sem campo em branco não justificado.
- Achados de benchmark de todos os concorrentes da lista, com lição +
  evidência.
- Relatório HTML de benchmark montado, com um card por concorrente (tabela de
  atributos + links dos criativos), a análise do próprio prospect e a síntese
  estratégica.
- Tudo aprovado pelo analista e salvo: briefing e camada estratégica em
  `entrega/ativos-aprovados/secoes/`, relatório em
  `entrega/ativos-aprovados/benchmark/benchmark.html`.

## Encerramento e handoff

Ao concluir, marque "06 · Briefing e benchmark" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Não preciso de nada novo — só confirma se seguimos com o
cenário Realista como base para a próxima etapa. Se quiser, pode me mandar
prints de tela (imagens) das campanhas atuais das plataformas, mas isso é
opcional.

Quando estiver pronto, rode `/07-midia-paga`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
