# Redesign visual · PR 5: Administração e diálogo Reportar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Administração (Pessoas, Projetos, Modelos, Skills, Reports, detalhe do projeto) e o diálogo Reportar na linguagem nova: cabeçalho grande por aba com palavra em serifada, abas em pílula, números em serifada com selo de variação, títulos de etapa em serifada e selos coerentes.

**Architecture:** O layout do admin ganha um cabeçalho por aba (texto vindo de uma tabela pura por rota) e a faixa fraca do dithered no topo; o conteúdo continua num painel sólido (`bg-popover`, exigido pelo teste de superfícies). Os componentes de cada aba mudam só na apresentação; comportamento, filtros, rotas e APIs ficam iguais.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Recharts, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md` (seção "Administração"); protótipo `docs/superpowers/specs/assets/redesign-visual/6-admin.html`.

## Global Constraints

- Worktree `.claude/worktrees/redesign-visual`, branch `feat/redesign-visual`; `git branch --show-current` antes de commitar; só arquivos nomeados.
- Conteúdo do admin em painel sólido (`bg-popover`) — teste `lib/superficies.test.ts`.
- Gráficos nunca esticados (teste estático existente); Recharts fica.
- Cores só por tokens (`lib/paleta.test.ts`); sem travessão em textos e comentários (teste do core).
- Testes de web e core verdes ao fechar cada task.

## Review Focus

1. Variação sem período anterior ("sem período anterior") ou com anterior zero: o selo de variação não aparece colorido nem com NaN. → Task 2.
2. Pessoas sem nenhum acesso registrado (data nula): "ativas nos últimos 7 dias" conta certo e não quebra. → Task 2.
3. Aba ativa em sub-rota (`/admin/projetos/<slug>`): a pílula de Projetos continua marcada e o cabeçalho é o de Projetos. → Task 1.
4. Reportar no celular: o diálogo continua rolável e os botões alcançáveis. → Task 4 (classes preservadas).
5. Tema claro: selos de família e de status continuam legíveis (tokens já cobertos por contraste). → Task 3.

---

### Task 1: Cabeçalho e abas do admin

**Files:** Create `src/apps/web/lib/cabecalho-admin.ts`, `src/apps/web/components/admin/cabecalho-admin.tsx`; Modify `src/apps/web/app/admin/layout.tsx`, `src/apps/web/components/admin/abas-admin.tsx`; Test `src/apps/web/lib/cabecalho-admin.test.ts`, `src/apps/web/components/admin/abas-admin.test.ts` (novo)

**Interfaces — Produces:** `cabecalhoDaAba(caminho: string): { titulo: string; destaque: string; frase: string }` — Pessoas: "Pessoas" + "da equipe" + "Quem entra no Growth Cycle e com que papel. Admin vê todos os prospects e administra as pessoas."; Projetos: "Projetos" + "e custos" + "Quanto cada projeto custou, em quanto tempo e onde o dinheiro foi."; Modelos: "Modelos" + "por etapa" + "Vale a partir do próximo turno de cada etapa. Padrão deixa a escolha com o Claude Code."; Skills: "Skills" + "e fluxos" + "Fluxo e texto de cada etapa, subagente e regra. As notas anotam o que melhorar."; Reports: "Reports" + "da equipe" + "Bugs e melhorias enviados pelo botão Reportar, com o print marcado."; outro caminho: "Administração" + "" + "". Sub-rotas usam a aba mãe.

Layout (protótipo `6-admin.html`): `FaixaDithered` no topo (wrapper `relative isolate`); cabeçalho fora do painel: título ~56 px com o destaque em `font-serif italic text-link-acao` e a frase; abas em pílula (segmentado, `rounded-full`, ativa com `bg-accent` e sombra), `aria-current="page"` como hoje; painel sólido `bg-popover rounded-[18px]` com o conteúdo.

- [ ] Step 1: testes — `cabecalhoDaAba` para as cinco rotas, sub-rota e desconhecida; `AbasAdmin` em `/admin/projetos/x` marca Projetos e é pílula (`rounded-full`); `superficies.test` continua passando.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): cabeçalho e abas em pílula na administração`.

---

### Task 2: Números grandes e Pessoas

**Files:** Modify `src/apps/web/components/admin/painel/numeros-grandes.tsx`, `src/apps/web/components/admin/tabela-pessoas.tsx`; Create `src/apps/web/lib/numeros-pessoas.ts`; Test `numeros-grandes.test.ts` (casos novos), `src/apps/web/lib/numeros-pessoas.test.ts`

**Interfaces — Produces:**
- `tomDaVariacao(atual: number, anterior: number, subirEhRuim: boolean): "ruim" | "bom" | "neutro"` — neutro quando não há anterior válido (mesma regra de `textoVariacao`) ou variação 0.
- `numerosDePessoas(pessoas: { papel: string; ultimoAcesso: string | null }[], agora: Date): { total: number; admins: number; ativas7d: number }`.

Números (protótipo): valor em `font-serif` ~44–54 px; detalhe com a variação numa pílula (`ruim`: `bg-aviso-fundo text-aviso`; `bom`: `bg-sucesso-fundo text-sucesso`; neutro: texto apagado). Custo e tempo: subir é ruim. Pessoas: três números no topo ("Pessoas com acesso", "Admins", "Ativas nos últimos 7 dias") com o mesmo visual, acima da tabela.

- [ ] Step 1: testes de `tomDaVariacao` (subiu custo → ruim; caiu → bom; sem anterior → neutro; 0% → neutro) e `numerosDePessoas` (nulo não conta como ativa; 7 dias exatos conta); números grandes renderizam a pílula com a classe do tom.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): números grandes em serifada com selo de variação`.

---

### Task 3: Modelos e Skills

**Files:** Modify `src/apps/web/components/admin/cartao-etapa-modelos.tsx`, `src/apps/web/components/admin/selo-modelo.tsx`, `src/apps/web/components/admin/barra-esforco.tsx`, `src/apps/web/components/admin/catalogo-skills.tsx`; Test `src/apps/web/components/admin/admin-visual.test.ts` (novo, estático)

Modelos: título da etapa em `font-serif` (~24 px) com "Etapa NN" pequeno em cima; selo de modelo em pílula (`rounded-full`, altura automática como o Badge); régua de esforço com segmentos acesos em `bg-primary`. Skills: título do item em `font-serif` (~30 px); contagem de notas abertas como pílula laranja (`bg-aviso-fundo text-link-acao`, mono).

- [ ] Step 1: testes estáticos das classes (`selo-modelo` com `rounded-full`; esforço aceso `bg-primary`; título da etapa e do item de skill com `font-serif`).
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): modelos e skills na linguagem nova`.

---

### Task 4: Reports e diálogo Reportar

**Files:** Modify `src/apps/web/components/admin/reports/painel-reports.tsx`, `src/apps/web/components/admin/reports/detalhe-report.tsx`, `src/apps/web/components/reports/dialogo-report.tsx`; Test `src/apps/web/components/reports/reports-visual.test.ts` (novo, estático)

Lista de reports em cards finos (sem `divide-y` de tabela: itens `rounded-[14px]` com hover), filtros de tipo em segmentado e status em pílulas, "Copiar para o Claude". Detalhe continua no painel lateral, com título "[Bug] *Report #12*" (número em serifada). Diálogo: título "Reportar *um bug ou ideia*" (destaque em serifada laranja), tipo em segmentado de pílula, Enviar com o botão principal (laranja). Comportamento igual.

- [ ] Step 1: testes estáticos (título do diálogo com o destaque; grupo de tipo com `rounded-full`; lista sem `divide-y`; título do detalhe com `font-serif`).
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): reports e diálogo Reportar na linguagem nova`.

---

### Task 5: Conferência

- [ ] `npm test` (web e core), `typecheck`, `lint`, `next build`.
- [ ] Visual local do que roda sem nuvem (Skills e cabeçalhos/abas de todas as rotas), nos dois temas, 1440 e 375 px.
- [ ] Commit das correções.
