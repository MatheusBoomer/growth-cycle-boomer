---
name: benchmark-meta-ads
description: Automatiza a produção de um Benchmark de Anúncios Meta (Facebook/Instagram Ads Library) para um cliente da agência — do briefing até o relatório HTML final, pronto pra entrega. Faz perguntas de briefing (marca, concorrentes, contexto), navega a Biblioteca de Anúncios do Meta pra coletar e analisar criativos de até 4 concorrentes + o próprio cliente, e gera um HTML completo com tabela por anúncio, síntese por concorrente, respostas a perguntas estratégicas e ranking de intensidade de mídia. Use sempre que o usuário pedir para "rodar um benchmark", "benchmark de anúncios/mídia paga", "benchmark meta ads", "analisar os concorrentes no Facebook/Instagram Ads Library", "ver o que a concorrência está anunciando", ou mencionar comparar criativos/campanhas de concorrentes de uma marca — mesmo sem citar o nome exato da skill ou sem ainda ter um briefing pronto em mãos.
---

# Benchmark Meta Ads

Automação do processo de benchmarking de anúncios da agência: coleta um
briefing, navega a Biblioteca de Anúncios do Meta para analisar os criativos
de até 4 concorrentes + o cliente, e entrega um relatório HTML pronto.

Este fluxo substitui o processo manual de copiar/colar dois prompts na
extensão do Claude no Chrome — aqui as três fases rodam em sequência dentro
da mesma execução.

## Requisito

Esta skill depende de uma ferramenta de navegador com capacidade de navegar
sites reais, clicar, rolar e executar JavaScript na página (ex.: Claude in
Chrome, ou o navegador embutido do Claude). Sem isso, a Fase 1 não é
executável — avise o usuário se nenhuma ferramenta de navegador estiver
disponível na sessão, em vez de tentar simular a coleta.

Essa é uma execução longa: até 5 anunciantes × até 10 anúncios cada, cada um
exigindo abrir o anúncio, esperar carregar (e, no caso de vídeo, assistir
antes de descrever). Avise o usuário no início que isso pode levar bastante
tempo, e trabalhe de forma constante — sem pausas desnecessárias entre
anúncios — para não desperdiçar esse tempo.

## Visão geral do fluxo

1. **Fase 0 — Briefing**: reúne cliente, concorrentes e contexto.
2. **Fase 1 — Coleta & Análise**: navega o Facebook Ads Library e analisa os
   criativos, anunciante por anunciante.
3. **Fase 2 — Geração do relatório**: transforma a análise em um HTML final.

As três fases rodam em sequência, sem pausar para revisão no meio — mas o
texto de análise da Fase 1 é sempre salvo como um arquivo à parte antes de
seguir para a Fase 2, então nada se perde se o usuário quiser auditar ou se
a execução for interrompida.

Só pare a execução no meio se ela tiver sido severamente comprometida (ex.:
quase nenhum concorrente acessível). Fora isso, rode o plano completo do
início ao fim.

## Fase 0 — Briefing

Leia `references/briefing.md` antes de começar a perguntar. Resumo: pergunte
em blocos (identificação do cliente, contexto de negócio, lista de até 4
concorrentes, pontos de atenção opcionais) — não pergunta por pergunta. Se o
usuário já tiver colado ou anexado um briefing, extraia dali o que puder
antes de perguntar o resto.

## Fase 1 — Coleta & Análise

Leia `references/coleta-e-analise.md` — contém todas as regras obrigatórias
de navegação, extração de IDs, classificação de formato/funil, deduplicação
e análise de vídeo. Use o script `scripts/extract_ad_ids.js` para extrair
os IDs de anúncio de cada página de resultados.

Resumo do essencial:

- Nunca abra facebook.com direto — sempre via google.com.
- Um anunciante por vez, do primeiro concorrente ao último, cliente sempre
  por último.
- Até 10 anúncios por anunciante, máximo 3 catálogos (DPA), sem duplicar
  criativos.
- Registre só o que for visualmente confirmado — nunca infira.
- Salve o resultado em `ANÁLISE DE BENCHMARK - [CLIENTE] (OUTPUT PROMPT
  1).md` antes de seguir para a Fase 2. Esse arquivo é o checkpoint desta
  fase.

## Fase 2 — Geração do relatório

Leia `references/geracao-relatorio.md` e use `assets/template.html` como
esqueleto exato do relatório — não modifique a estrutura, classes CSS ou
cores, só preencha os placeholders e duplique os blocos repetíveis.

Resumo do essencial:

- IDs de anúncio viram links clicáveis que abrem em nova aba.
- Análise do cliente vem depois dos concorrentes, antes da síntese
  estratégica geral.
- Responda as 7 perguntas estratégicas padrão (ou as do briefing, se houver)
  comparando nominalmente os anunciantes.
- Monte o ranking de intensidade de mídia com barras proporcionais ao maior
  volume.
- Salve como `benchmark_[cliente].html`.

## Entrega

Envie ao usuário os dois arquivos: o texto de análise da Fase 1 (para
auditoria) e o HTML final da Fase 2. Se houver uma pasta do usuário conectada
à sessão, salve o HTML também lá. Informe que, para exportar em PDF, basta
abrir o HTML no Chrome e usar Cmd+P/Ctrl+P → Destino: Salvar como PDF.

## Erros e casos de borda comuns

- **Ferramenta de navegador pede aprovação de acesso ao site**: aguarde a
  aprovação do usuário em vez de tentar contornar.
- **Concorrente sem nenhum anúncio ativo**: registre e siga em frente — no
  relatório ele aparece com a seção "Nenhum anúncio ativo encontrado".
- **Briefing lista mais de 4 concorrentes**: pergunte ao usuário quais 4 são
  prioridade antes de iniciar a Fase 1 (ver `references/briefing.md`).
- **Vídeo não reproduz**: recarregue e tente de novo antes de desistir; na
  segunda falha, descreva o frame de capa com o máximo de detalhe.
- **ID não carrega**: descarte e substitua pelo próximo da lista — nunca
  registre uma linha só com campos vazios.
- **Anunciante com menos de 10 anúncios ativos**: inclua todos
  integralmente, sem forçar completar 10.
