# Redesign visual · PR 4: Tela de trabalho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de trabalho com a trilha em árvore por fase (Branched Menu), o processo do agente como Thought Line, o chat e o card de entregável na linguagem nova, e "Concluir etapa" só quando tudo estiver pronto.

**Architecture:** Regras puras em `lib/` (estado do botão de concluir, fases da trilha, duração do processo) com testes; componentes redesenhados no lugar (`trilha-etapas`, `chat-etapa` + novo `thought-line`, `card-entregavel`, `painel-etapa`, `fim-da-etapa`, cabeçalho da área de trabalho). Layout de três painéis redimensionáveis continua igual.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md` (seção "Tela de trabalho"); protótipo `docs/superpowers/specs/assets/redesign-visual/3-tela-de-trabalho.html` (e `4-modo-claro.html` para o pérola).

## Global Constraints

- Worktree `.claude/worktrees/redesign-visual`, branch `feat/redesign-visual`; `git branch --show-current` antes de commitar; só arquivos nomeados.
- Fases e etapas vêm do catálogo (`etapas.json`, campo `fase`): Contexto, Diagnóstico, Soluções e metas, Mídia e ação, Apresentação, Pós-apresentação; etapas sem número aparecem só pelo título.
- Sem dithered na tela de trabalho. Nada se move continuamente além do marcador da etapa atual (pulso leve), da borda do entregável pendente e do Thought Line ao vivo. Tudo respeita `prefers-reduced-motion`.
- Aprovar não solta confete; o confete é o atual (`lib/confete.ts`), só ao concluir, sem mudança.
- Testes de `core` e `web` verdes ao fechar cada task (o core tem o teste "sem travessão" que lê o web).
- Textos em português, verbatim da spec.

## Review Focus

1. Etapa com insumos e entregáveis completos mas sem sinalização do agente: aparece a linha "✓ Tudo aprovado · esperando o agente fechar a etapa", não um botão morto. → Task 1.
2. Conversa antiga (eventos sem horário confiável) ou processo de um passo só: o Thought Line não mostra "Pensou por NaN s". → Task 2.
3. Prospect antigo com etapa na fase arquivada, ou etapa sem fase: a árvore não quebra nem esconde a etapa. → Task 3.
4. Etapa bloqueada clicável por teclado, ou marcador sem etapa visível (fase fechada): nada quebra; bloqueada continua desabilitada. → Task 3.
5. Barra do topo na tela de trabalho em 375 px para admin: não estoura (pendência do PR 1). → Task 4.

---

### Task 1: "Concluir etapa" só quando tudo estiver pronto

**Files:** Create `src/apps/web/lib/concluir.ts`; Modify `src/apps/web/components/trabalho/painel-etapa.tsx`, `src/apps/web/components/chat/fim-da-etapa.tsx`; Test `src/apps/web/lib/concluir.test.ts`, `src/apps/web/components/trabalho/painel-etapa.test.ts` (novo)

**Interfaces — Produces:** `estadoDoConcluir({ condicoes, sinalizada, turnoAtivoAqui }: { condicoes: string[]; sinalizada: boolean; turnoAtivoAqui: boolean }): "pronto" | "esperando-agente" | "oculto"` — `pronto` quando `condicoes` está vazia e não há turno ativo nesta etapa; `esperando-agente` quando não há turno ativo, a etapa não foi sinalizada e a única condição é a da sinalização (`condicoes.length === 1`); senão `oculto`.

Painel (protótipo, coluna direita): `oculto` → nada (sem botão desabilitado, sem lista "O que falta"); `esperando-agente` → linha discreta "✓ Tudo aprovado · esperando o agente fechar a etapa"; `pronto` → bloco que entra devagar (classe `surgir`) com "✓ Tudo aprovado nesta etapa" e o botão "Concluir etapa e ir para <próxima> →" ("Concluir etapa" na última). `FimDaEtapa` no chat: mesma regra (só o botão em `pronto`; nada nos outros). Reabrir/Revisar/Confirmar continuam como hoje. Contagens em mono nos títulos "Entregáveis da etapa 0/1" e "Insumos 1/1".

- [ ] Step 1: testes de `estadoDoConcluir` (os três estados + turno ativo → `oculto`) e do painel: com condições pendentes não há botão "Concluir" nem lista "O que falta"; só a sinalização faltando mostra a linha de espera; pronto mostra o botão com o nome da próxima etapa.
- [ ] Step 2–4: falhar, implementar, passar.
- [ ] Step 5: commit `feat(web): concluir etapa só quando tudo estiver pronto`.

---

### Task 2: Thought Line

**Files:** Modify `src/apps/web/lib/passos.ts`; Create `src/apps/web/components/chat/thought-line.tsx`; Modify `src/apps/web/components/chat/chat-etapa.tsx` (troca `ListaDeProcesso`); Test `src/apps/web/lib/passos.test.ts` (casos novos), `src/apps/web/components/chat/thought-line.test.ts`

**Interfaces — Produces:**
- `duracaoDoProcesso(itens: EventoProcesso[], agora: number | null): number | null` — segundos com 1 casa: ao vivo (`agora` dado) de `itens[0].em` até `agora`; encerrado (`agora` nulo) do primeiro ao último `em`; `null` se algum horário for inválido ou se encerrado com menos de 2 itens.
- `ThoughtLine({ itens, slug, aoVivo }: { itens: EventoProcesso[]; slug: string; aoVivo: boolean })`.

Comportamento (React Bits Thought Line, protótipo `3-tela-de-trabalho.html`): cabeçalho clicável com ✦ (`SparklesIcon`, respira ao vivo), rótulo e cronômetro em mono. Ao vivo: rótulo = linha do passo atual (mesma `linhaDoProcesso` de hoje) com brilho que passa; cronômetro conta a cada 100 ms; passos abertos, entrando um a um numa linha vertical, check verde nos feitos e ponto pulsando no atual. Encerrado: recolhe; rótulo "Pensou por X s" (vírgula decimal) com a duração; sem duração: "Processo · N passos" (como hoje). Clicar abre/fecha. Movimento reduzido: sem respirar, sem brilho, sem pulso.

- [ ] Step 1: testes — `duracaoDoProcesso` (ao vivo, encerrado, horário inválido → null, 1 item encerrado → null); ThoughtLine encerrado com dois passos a 4,4 s → "Pensou por 4,4 s" e passos fechados; sem duração → "Processo · 2 passos"; ao vivo mostra a linha do passo atual e os passos abertos; clicar alterna `aria-expanded`.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): processo do agente como Thought Line`.

---

### Task 3: Trilha em árvore por fase (Branched Menu)

**Files:** Create `src/apps/web/lib/trilha.ts`; Modify `src/apps/web/components/trabalho/trilha-etapas.tsx`; Test `src/apps/web/lib/trilha.test.ts`, `src/apps/web/components/trabalho/trilha-etapas.test.ts` (casos novos; os atuais do painel de uso continuam)

**Interfaces — Produces:** `fasesDaTrilha(etapas: EtapaCatalogo[], estado: Estado): { fase: string; etapas: { id: EtapaId; numero: string; titulo: string; status: StatusEtapa }[]; feitas: number; situacao: "feita" | "atual" | "" }[]` — agrupa na ordem do catálogo (etapa sem fase vai para "Outras", no fim); `situacao` "feita" se todas concluídas, "atual" se alguma está em andamento/pronta/liberada, senão "".

Layout (protótipo, coluna esquerda): "Prospect" + nome (~22 px); linha com `AnelCiclo tamanho={26}` + "N de M etapas · em <fase da etapa selecionada>"; a árvore: tronco vertical fino; cada fase é um botão (abre/fecha, `aria-expanded`) com ponto de status e "feitas/total" em mono; abertas por padrão as fases "feita" ou "atual" e a da etapa selecionada; etapas saem com uma curva SVG fina, ícone de status (check verde, anel laranja pulsando, cadeado), número em mono e título truncado; a curva da selecionada fica laranja e um marcador laranja desliza no tronco até ela (some se a fase dela estiver fechada). Mantém `aria-current="step"`, `disabled` em bloqueada e o `title` com o status. Embaixo: "Arquivos" → Biblioteca com contagem; no pé, `UsoAssinaturaBarra` como hoje.

- [ ] Step 1: testes — `fasesDaTrilha` (agrupa e conta; sem fase → "Outras"; situação); trilha: fases do catálogo aparecem como botões com `aria-expanded`; fase da etapa selecionada aberta; fechar uma fase esconde suas etapas; a selecionada tem `aria-current="step"`; bloqueada fica `disabled`; os dois testes atuais do painel de uso continuam.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): trilha de etapas em árvore por fase`.

---

### Task 4: Cabeçalho, chat e compositor

**Files:** Modify `src/apps/web/components/trabalho/area-de-trabalho.tsx` (cabeçalho da etapa e título da barra), `src/apps/web/components/chat/chat-etapa.tsx`, `src/apps/web/components/chat/item-conversa.tsx` (bolha só da pessoa), `src/apps/web/components/chat/resposta-agente.tsx` (sem bolha), `src/apps/web/components/chat/compositor.tsx` (pílula flutuante com brilho no foco), `src/apps/web/components/trabalho/selo-custo.tsx` (some abaixo de `sm`); Test `src/apps/web/components/chat/chat-etapa.test.ts` (casos novos), `src/apps/web/components/trabalho/area-de-trabalho.test.ts` (casos novos)

Cabeçalho da etapa: "Etapa 04 · Diagnóstico" pequeno (número e fase) e o título grande em `font-serif` (~32 px); à direita o selo "Agente trabalhando" (ponto laranja pulsando) enquanto `turnoAtivo === etapa`, e os botões que já existem. Barra do topo: título "Growth Cycles", subtítulo o nome do prospect (já é o formato `titulo · subtitulo`). Chat: mensagem da pessoa em bolha discreta à direita; resposta do agente sem bolha (texto direto), com copiar/citar como hoje; desfoque nas bordas de cima e de baixo da rolagem (gradiente para o fundo, `pointer-events-none`); compositor em pílula grande flutuante (`rounded-[22px]`, borda, fundo translúcido com desfoque) com brilho laranja no foco (`focus-within:ring-4 ring-primary/15 border-primary/50`).

- [ ] Step 1: testes — cabeçalho mostra "Etapa 04 · Diagnóstico" e o título em serifada; selo "Agente trabalhando" só com turno ativo nesta etapa; resposta do agente não usa `Bubble`; mensagem da pessoa usa; compositor tem a classe de foco; selo de custo tem `max-sm:hidden`; os 5 testes atuais de turno continuam.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): cabeçalho, chat e compositor da tela de trabalho`.

---

### Task 5: Card de entregável

**Files:** Modify `src/apps/web/components/cards/card-entregavel.tsx`; Test `src/apps/web/components/cards/card-entregavel.test.ts` (novo)

Card (protótipo): tipo pequeno ("Gráfico · vai para a apresentação como …" como hoje), título em `font-serif` (~22 px); selo "● Aguardando aprovação" (âmbar) / "✓ Aprovado" (verde) / "Substituído"; pendente com a classe `borda-correndo` (a mesma do PR 3, sutil, 9 s); aprovado com contorno verde fino parado (`ring-1 ring-sucesso/30`); botão "Aprovar" com `brilho-passa`. Comportamento (aprovar, pedir ajuste, marcação) igual.

- [ ] Step 1: testes — pendente tem `borda-correndo` e o botão Aprovar tem `brilho-passa`; aprovado não tem `borda-correndo` e tem o contorno verde; título com `font-serif`; aprovar chama a API e não importa nem chama confete.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): card de entregável com borda sutil`.

---

### Task 6: Conferência

- [ ] `npm test` (web e core), `typecheck`, `lint`, `next build`.
- [ ] Visual com os prospects copiados: tela de trabalho nos dois temas a 1440 px e 375 px (verdeluz-nuvem e adda-demo), trilha abrindo/fechando fase, Thought Line de conversa antiga.
- [ ] Commit das correções.
