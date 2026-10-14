---
name: midia-paga
description: Constrói o planejamento estratégico de mídia paga — alocação de verba por plataforma, estratégia por Curva ABC, calendário estratégico anual, ROAS esperado e redução de dependência — com base em tudo que foi diagnosticado e projetado. Use após briefing-e-benchmark, com o cenário Realista já validado.
---

# Skill 08 — Planejamento de Mídia Paga

Skill 8 de 10. Corresponde ao Prompt 9 do processo original. Ainda não é a etapa de criação de criativos,
configuração de campanhas ou plano de ação — é só estratégia de alocação e direcionamento.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 07 concluídas e aprovadas — toda a base necessária já está
      na conversa, não é preciso reenviar nenhum arquivo.
- [ ] Confirmar qual cenário serve de base (Realista, salvo indicação
      contrária do analista).
- [ ] **Opcional:** se quiser a análise de estrutura de campanha (Etapa
      extra abaixo), anexar prints de tela das plataformas em
      `contexto/brutos/prints-campanhas/`.

## Base de dados obrigatória

Usar exclusivamente o que já está na conversa: histórico por plataforma
(Skill 03), Curva ABC (Skill 03), KPIs do cenário Realista mês a mês (Skill
05), sazonalidade histórica identificada ao longo do diagnóstico.

## Etapa 1 — Alocação de verba mensal por plataforma

Distribuir o investimento total mensal do cenário Realista entre Google Ads e
Meta Ads, respeitando: comportamento histórico de cada plataforma, ROAS
histórico por plataforma por período, meses de alto potencial vs
estruturalmente fracos. **Não pode ser flat.** Cada decisão de alocação
precisa de justificativa baseada em dado histórico específico (ex.: "Meta
assume protagonismo no 2º semestre porque o ROAS histórico confirma queda de
eficiência do Google a partir de maio"). Gerar dois artefatos, sempre os
dois — não é opcional:
- **Gráfico** de barras empilhadas (padrão `padrao-visual.md`), com o total
  do mês no topo de cada barra e o % de cada plataforma dentro do próprio
  segmento colorido.
- **Tabela-imagem** (PNG, via `analista-dados`/matplotlib, mesmo padrão
  visual das tabelas-imagem da Skill 06 — cabeçalho azul escuro com texto
  branco, linhas alternadas, linha de TOTAL destacada): colunas Mês |
  Invest. Total | % Meta | % Google | Meta (R$) | Google (R$) | Justificativa.

Salvar em `entrega/ativos-aprovados/graficos/alocacao-verba-plataforma.png`
(gráfico) e `entrega/ativos-aprovados/graficos/tabela-alocacao-verba-plataforma.png`
(tabela).

## Etapa 2 — Estratégia por Curva ABC

Para cada curva (A, B, C): papel estratégico na mídia paga, tipo de campanha
recomendado, objetivo de ROAS mínimo, prioridade de verba (%). A Curva C, em
geral, não deve receber verba direta de performance — justificar com a
matemática (CPS médio × conversão média = custo de aquisição por SKU da
Curva C, comparado ao faturamento médio anual daquele SKU). Propor
alternativas sem investimento direto (kits/bundles com a Curva A, amostras,
avaliação de descontinuação).

Gerar sempre uma **tabela-imagem** (PNG, mesmo padrão visual das demais —
cabeçalho azul escuro, linhas alternadas): colunas Classe | Papel Estratégico
| Tipo de Campanha | ROAS Mínimo | Prioridade de Verba, com uma nota abaixo
citando o custo de aquisição de 1 venda usado na conta. Salvar em
`entrega/ativos-aprovados/graficos/tabela-curva-abc-estrategia.png`.

## Etapa 3 — Calendário estratégico de mídia

Classificar cada mês em: 🔴 Contenção (meses fracos, investimento
conservador, foco em retenção) · 🟡 Manutenção (desempenho médio) · 🟢 Escala
(alto potencial, pré-aquecimento) · 🔵 Pico (máxima oportunidade — Black
Friday, aniversário da marca). Para cada mês: lógica de alocação, foco de
produto (curva/lançamento), objetivo principal (aquisição/retenção/conversão).
Baseado no histórico e na sazonalidade de mercado.

Gerar sempre uma **tabela-imagem** (PNG, mesmo padrão visual das demais):
colunas Mês | Classificação (com o emoji) | Lógica de Alocação | Foco de
Produto | Objetivo Principal. Salvar em
`entrega/ativos-aprovados/graficos/tabela-calendario-estrategico.png`.

## Etapa 4 — ROAS esperado por plataforma

Projetar ROAS mês a mês (Global, Google, Meta), coerente com investimento e
receita do cenário Realista — nunca flat. Identificar meses de risco de
compressão e meses de maior eficiência esperada. Gráfico de linha com as 3
curvas.

## Etapa 5 — Redução de dependência de mídia paga

Com base na dependência diagnosticada na Skill 03: definir meta de % de
sessões pagas para o próximo ano, alinhada ao cenário Realista. Identificar
canais complementares (CRM/base de clientes, orgânico/SEO,
influenciadores, marketplace). Propor trajetória mensal de redução e o risco
se não acontecer. Não descer a nível operacional de CRM/SEO — só o papel
estratégico de cada canal.

## Etapa 6 — Benchmarking de mercado nacional e internacional

Acionar o subagente `pesquisador-benchmark` para levantar estratégias de
e-commerces de referência (nacional e internacional) que possam inspirar o
projeto — não depender só do conhecimento geral do modelo.

## Etapa extra — Análise de estrutura de campanha (opcional)

Se houver prints de campanhas em `contexto/brutos/prints-campanhas/`,
analisar CTR, taxa de conversão e demais KPIs de plataforma visíveis,
comparando contra benchmark do setor, e sinalizar pontos de atenção para
otimização futura.

## Checagem obrigatória

Depois de cada gráfico/tabela: "Confirme se os valores apresentados estão
coerentes com o cenário Realista e com o histórico." Corrigir antes de
avançar se houver inconsistência.

## Restrições

- Não propor estrutura de anúncio no nível de criativo/copy/público.
- Não propor estratégia de conteúdo orgânico detalhada, plano de CRM
  operacional, ou estratégia de influenciadores específicos.
- Não montar o plano de ação ainda — isso é a Skill 09.

## Critério de conclusão

- Todos os gráficos/tabelas confirmados como coerentes.
- Distribuição de verba, calendário e planejamento financeiro validados.
- Tabelas-imagem das Etapas 1, 2 e 3 geradas (ver cada etapa) — não é
  opcional, mesmo que o analista não peça explicitamente.
- Conteúdo aprovado salvo em `entrega/ativos-aprovados/`.

## Encerramento e handoff

Ao concluir, marque "08 · Mídia paga" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Não preciso de nada novo — só confirma comigo a data de
hoje, se seguimos com o cenário Realista, e quais são as 2–3 frentes mais
urgentes que você quer priorizar no plano de ação.

Quando estiver pronto, rode `/09-plano-de-acao`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
