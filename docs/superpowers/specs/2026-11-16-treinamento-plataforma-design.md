# Treinamento da plataforma Growth Cycle — Design

**Data:** 2026-11-16
**Status:** aprovado em brainstorming
**Escopo:** dois treinamentos de 1h30 para ensinar os analistas a usar o app web do Growth Cycle no dia a dia, e os dois decks de apresentação que os conduzem.

## 1. Objetivo

Os analistas já fazem Growth Cycle no processo manual. O que é novo é a plataforma. Ao fim dos dois encontros, cada analista deve conseguir rodar um prospect do kickoff à apresentação final sozinho, sabendo o que trazer para cada etapa, o que conferir antes de aprovar e o que fazer quando algo sai do esperado.

**Critério de sucesso:** depois do treinamento 2, o analista abre um prospect real e conduz as etapas sem pedir ajuda sobre *onde clicar*; as dúvidas que restam são de método, não de ferramenta.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Público | Analistas que já dominam o método; a novidade é a plataforma |
| 2 | Prática | Demo ao vivo conduzida pelo apresentador, sem mão na massa da turma |
| 3 | Base da demo | Cliente de teste Verdeluz, com o seletor "Em qual etapa o teste começa?" |
| 4 | Duração | Dois encontros de ~1h30 |
| 5 | Intervalo | Encontros em sequência, sem uso da plataforma entre eles |
| 6 | Divisão | Pela jornada: T1 = funcionamento + etapas 01–04; T2 = etapas 05–08 + apresentação final + rotina |
| 7 | Proporção | ~35% teoria, ~65% demo, intercaladas etapa a etapa |
| 8 | Visual | Design system da agência no tipo Slides do claude.ai |

## 3. Princípio e ciclo da etapa

O analista é o dono do número; o agente faz o trabalho pesado. Toda etapa é ensinada pelo mesmo ciclo:

> envia o insumo → o agente trabalha → propõe um entregável → você aprova ou clica em **Pedir ajuste…** → **Concluir etapa** → a próxima é liberada.

Cada etapa recebe o mesmo molde: um slide em três partes (**Entrega**, **Você traz**, **Fique atento**) seguido de uma chamada de demo no Verdeluz. A etapa 04 ganha dois slides extras: a planilha sem dado pessoal e a validação do cliente.

## 4. Agenda

### Treinamento 1 — "Do kickoff ao diagnóstico validado" (90 min)

| Tempo | Bloco | Tipo |
|---|---|---|
| 0–10 | Abertura: o que muda em relação ao processo manual e o papel do analista | Teoria |
| 10–25 | Como a plataforma funciona: prospects, **Novo prospect**, tela de trabalho (trilha, chat, Insumos, Entregáveis), Biblioteca | Tour ao vivo |
| 25–75 | Etapas 01, 02, 03 e 04 (~12 min cada); na 04, planilha sem PII, PDF de validação e a trava do Concluir | Teoria curta + demo |
| 75–85 | Situações reais: insumo errado, número estranho, pedido de ajuste bem escrito, retomar outro dia, Reportar | Demo |
| 85–90 | Fechamento e o que vem no treinamento 2 | — |

### Treinamento 2 — "Das soluções à apresentação" (90 min)

| Tempo | Bloco | Tipo |
|---|---|---|
| 0–5 | Recapitulação: a trilha e o ciclo da etapa | Teoria |
| 5–60 | Etapas 05, 06, 07 e 08 (~13 min cada) | Teoria curta + demo |
| 60–72 | Apresentação final: roteiro, aprovação, .pptx e visualizador | Demo |
| 72–85 | Rotina do dia a dia: reabrir etapa, trocar dono, custo, organizar a semana de um Growth Cycle | Teoria + demo |
| 85–90 | Guia de bolso e perguntas | — |

## 5. Conteúdo e tom dos slides

**Tom:** direto, no imperativo, com as palavras da tela.

**Regras de escrita**
- Uma ideia por slide; o título é a mensagem (ex.: "Na 04, a planilha entra sem CPF, e-mail ou telefone").
- Botões e seções com o nome exato do app, em destaque: **Pedir ajuste…**, **Concluir etapa**, **Kit da etapa**, **Reabrir etapa**, **O que esperar desta etapa**.
- Trilha 01→08 fixa nos slides de etapa, com a etapa atual destacada.
- Caixa de **Atenção** com o erro mais comum da etapa, tirado das restrições do `SKILL.md` dela.

**Tipos de slide**
1. Abertura de bloco — número grande da etapa e nome.
2. Entrega / Você traz / Fique atento.
3. Chamada de demo — "DEMO · Verdeluz · etapa NN" com 3 a 4 itens do que será mostrado.
4. Tela anotada — print real do app com marcadores numerados (tour e etapa 04).
5. Situação real — "Quando acontecer X → faça Y".
6. Guia de bolso — uma página com o ciclo da etapa, insumos por etapa e o que conferir antes de aprovar.

**Notas do apresentador:** todo slide de demo leva nas notas o roteiro de cliques e falas.

## 6. Entregáveis

- Deck **"Growth Cycle na prática · 1"** (~26 slides) e deck **"Growth Cycle na prática · 2"** (~24 slides, terminando no guia de bolso), no tipo Slides do claude.ai, com o design system da agência; exportáveis para .pptx ou PDF.
- ~5 prints do app local com o Verdeluz: lista de prospects, tela de trabalho, card de entregável, card de validação do cliente e painel do kit.

## 7. Fontes do conteúdo

- `.claude/skills/_shared/etapas.json` — entrega, "o que esperar" e insumos de cada etapa.
- `SKILL.md` de cada etapa — restrições que viram as caixas de Atenção.
- Componentes de `src/apps/web/components/` — rótulos exatos dos botões e seções.
- App local com o Verdeluz — prints.

Nada sobre a plataforma é afirmado nos slides sem estar em uma dessas fontes.

## 8. Ordem de produção

1. Deck 1 → revisão do Matheus.
2. Ajustes no deck 1 → deck 2 no mesmo molde.
3. Prints capturados e encaixados nos dois decks.

## 9. Fora do escopo

Gravação em vídeo e material de exercício para a turma. As demos rodam no modo ensaiado do cliente de teste, desenhado à parte em `2026-11-16-modo-ensaiado-design.md`.
