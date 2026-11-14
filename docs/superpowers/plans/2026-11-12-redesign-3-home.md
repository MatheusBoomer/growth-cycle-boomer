# Redesign visual · PR 3: Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home no arranjo B (bento "continue de onde parou" + números) com a barra de filtros do arranjo A acima da grade de cards compactos.

**Architecture:** Regras puras novas em `lib/home.ts` (qual prospect continuar, números do bento, partes do rótulo da etapa). Componentes visuais novos em `components/home/` (anel do ciclo, número que conta, bento). `GradeProspects` é reorganizada em quatro faixas e `CardProspect` fica compacto, mantendo todo o comportamento que os testes atuais protegem (filtros, seções, menu, diálogos, acessibilidade, celular).

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md` (seção "Home"); protótipos `2-home.html` (arranjo B + filtros do A) e `4-modo-claro.html` (home no pérola).

## Global Constraints

- Worktree `.claude/worktrees/redesign-visual`, branch `feat/redesign-visual`. `git branch --show-current` antes do primeiro commit; commitar só arquivos nomeados.
- Número de etapas sempre de `ResumoProspect.totalEtapas`/`concluidas`, nunca fixo. "Em andamento" = `etapaAtual !== null` (regra de `separarPorSituacao`).
- Todos os testes atuais de `grade-prospects`, `card-prospect`, `barra-etapas` e `filtro-prospects` continuam passando; só se ajusta a classe esperada quando a forma mudou, nunca o que o teste protege.
- Cores só por tokens (há teste `lib/paleta.test.ts` que barra cor crua em componente).
- Tudo que se move respeita `prefers-reduced-motion`. Nada de gráfico esticado (o anel é SVG com tamanho explícito).
- Textos em português, verbatim da spec.

## Review Focus

1. Nenhum prospect, ou todos concluídos: o bento não quebra ("Continue de onde parou" some; números mostram 0; card laranja neutro). → testes em Tasks 1 e 4.
2. Prospect "Apresentação final" (rótulo sem número) e rótulos fora do padrão: o card mostra só o título, sem "Etapa undefined". → teste em Task 1.
3. Quem não é admin com várias aprovações: o card laranja aplica o filtro "Com aprovação pendente", que agora existe para todos. → testes em Tasks 4 e 5.
4. Celular (375 px): bento empilha, filtros continuam alvos de 40 px como hoje. → testes atuais de "celular" em Task 5.
5. Movimento reduzido: números aparecem já no valor final e nada entra com desfoque. → testes em Tasks 3 e 5.

---

### Task 1: Regras da home

**Files:** Create `src/apps/web/lib/home.ts`; Test `src/apps/web/lib/home.test.ts`

**Interfaces — Produces:**
- `continuarDeOndeParou(lista: ResumoProspect[]): ResumoProspect | null` — entre os com `etapaAtual !== null`, o de `atualizadoEm` mais recente (data inválida conta como mais antiga); `null` se não houver.
- `numerosDaHome(lista: ResumoProspect[]): { emAndamento: number; concluidos: number; aprovacoes: number; comAprovacao: ResumoProspect[] }` — `aprovacoes` = soma de `pendencias`; `comAprovacao` = os com `pendencias > 0`.
- `partesDoRotulo(rotulo: string): { numero: string | null; titulo: string }` — `"04 · Unidade econômica"` → `{ numero: "04", titulo: "Unidade econômica" }`; `"Apresentação final"` → `{ numero: null, titulo: "Apresentação final" }`.

- [ ] Step 1: testes — os três casos de cada função acima, mais: lista vazia → `null` e zeros; data inválida não vence uma válida; rótulo `"10 · Revisão pós-apresentação"` → número `"10"`.
- [ ] Step 2: rodar e ver falhar (`npx vitest run lib/home.test.ts`).
- [ ] Step 3: implementar.
- [ ] Step 4: rodar → PASS.
- [ ] Step 5: commit `feat(web): regras do bento da home`.

---

### Task 2: Anel do ciclo

**Files:** Create `src/apps/web/components/home/anel-ciclo.tsx`; Test `.../anel-ciclo.test.ts`

**Interfaces — Produces:** `AnelCiclo({ concluidas, total, atual, tamanho }: { concluidas: number; total: number; atual: boolean; tamanho: number })` — `<svg width={tamanho} height={tamanho} role="img" aria-label="N de M etapas concluídas">`, um `<path data-estado>` por etapa (arcos com 7° de vão, começando no topo): `concluida` (`stroke: var(--sucesso)`), `atual` (`var(--primary)`, com `drop-shadow` laranja), `pendente` (`var(--border)` mais forte: `color-mix(in srgb, var(--foreground) 12%, transparent)`). Com `tamanho > 100`, no centro: número em `font-serif` + "/M" apagado + "etapas concluídas".

- [ ] Step 1: testes — 9 etapas com 3 concluídas e atual: 9 paths, estados `3× concluida, 1× atual, 5× pendente`; `aria-label` "3 de 9 etapas concluídas"; tamanho 200 mostra "etapas concluídas", tamanho 26 não; `width`/`height` iguais ao tamanho (nunca 100%).
- [ ] Step 2–4: falhar, implementar, passar.
- [ ] Step 5: commit `feat(web): anel do ciclo`.

---

### Task 3: Número que conta

**Files:** Create `src/apps/web/components/home/numero-animado.tsx`; Test `.../numero-animado.test.ts`

**Interfaces — Produces:** `NumeroAnimado({ valor, className }: { valor: number; className?: string })` — conta de 0 até `valor` em 900 ms (`requestAnimationFrame`, easing cúbico, inteiro), uma vez ao montar; com movimento reduzido mostra `valor` direto. Efeito do Number Ticker da Magic UI, à mão.

- [ ] Step 1: testes (jsdom, rAF falso controlado): começa em 0 e termina em `valor` depois de 900 ms; com movimento reduzido já renderiza `valor`.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): número que conta`.

---

### Task 4: Bento

**Files:** Create `src/apps/web/components/home/bento.tsx`; Test `.../bento.test.ts`

**Interfaces:**
- Consumes: Task 1 (`continuarDeOndeParou`, `numerosDaHome`, `partesDoRotulo`), Task 2 (`AnelCiclo`), Task 3 (`NumeroAnimado`).
- Produces: `Bento({ prospects, aoFiltrarPendentes }: { prospects: ResumoProspect[]; aoFiltrarPendentes: () => void })`.

Layout (protótipo `2-home.html`, arranjo B): grade `lg:grid-cols-[7fr_5fr]` (empilha abaixo de `lg`). Esquerda: card "Continue de onde parou" (rótulo pequeno em caixa alta), nome (~38 px), "Etapa NN" + título da etapa em `font-serif italic text-link-acao` (~40 px), link-botão "Abrir etapa →" (`/prospects/<slug>`), `AnelCiclo tamanho={200}` à direita (some abaixo de `sm`). Sem prospect em andamento, o card mostra "Nenhum projeto em andamento" e o convite do botão "+ Novo prospect" do cabeçalho (sem botão próprio). Direita, grade 2×2: "em andamento" e "concluídos" (números em `font-serif` ~64 px com `NumeroAnimado`), e o card laranja sólido largo (gradiente `from-primario-claro via-primary to-link-acao`, texto escuro): "N aprovação(ões) esperando você · <nome>" quando 1 prospect, "· N projetos" quando vários; com 1 prospect é link para ele; com vários é botão que chama `aoFiltrarPendentes`; com 0 vira card neutro (borda, fundo do card) "Nenhuma aprovação esperando".

- [ ] Step 1: testes: continuar mostra o prospect mais recente e o link certo; sem em andamento mostra o vazio; números 2/1; laranja com 1 → `<a href="/prospects/x">`; com 2 → botão que chama `aoFiltrarPendentes`; com 0 → texto "Nenhuma aprovação esperando" e sem link/botão.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): bento da home`.

---

### Task 5: Grade da home reorganizada

**Files:** Modify `src/apps/web/components/home/grade-prospects.tsx`, `src/apps/web/lib/filtro-prospects.ts` (se precisar), `src/packages/ui/src/styles/globals.css` (classe `surgir`); Test `src/apps/web/components/home/grade-prospects.test.ts` (casos novos + ajustes de classe)

**Interfaces — Consumes:** `Bento` (Task 4). Mantém a assinatura de `GradeProspects`.

Faixas (protótipo `2-home.html`):
1. Cabeçalho: selo em pílula "N em andamento · N aprovação(ões) pendente(s)" (ponto âmbar quando há pendência); `h1` "Seus Growth *Cycles*" (`Cycles` em `font-serif italic text-link-acao`), ~56–64 px; à direita "Cliente de teste" (admin) e "+ Novo prospect", como hoje.
2. `Bento` (some quando não há nenhum prospect: fica o vazio atual "Nenhum Growth Cycle ainda").
3. Filtros: segmentado em pílula — admin: "Todos · Meus · Com aprovação pendente" (Meus ↔ analista "meus"; Pendente ↔ `soPendentes`), mais o select de analista atual; quem não é admin: "Todos · Com aprovação pendente". Busca em pílula "Buscar prospect, etapa ou analista" (para quem não é admin: "Buscar prospect ou etapa"), atalho ⌘K/Ctrl+K foca a busca; etapa e ordenação à direita. O filtro de pendência passa a valer para todos (`soPendentes` sem `admin &&`).
4. Seções "Em andamento" (linha fina após o título) e "Concluídos" recolhida, como hoje, com cards em `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

Entrada escalonada: cada faixa com a classe `surgir` e `--i` (0..3): `opacity 0 → 1`, `translateY(14px) → 0`, `blur(8px) → 0`, 700 ms, atraso `--i × 70 ms`; parado com movimento reduzido.

- [ ] Step 1: testes novos: título "Seus Growth Cycles"; selo do cabeçalho com as contagens; quem não é admin vê o segmentado sem "Meus" e consegue filtrar pendentes; admin "Meus" no segmentado filtra como o select fazia; ⌘K foca a busca; o card laranja com vários aplica o filtro de pendentes (via `Bento`). Ajustar só classes esperadas dos testes de "celular" se a forma mudou.
- [ ] Step 2–4.
- [ ] Step 5: commit `feat(web): home em bento com filtros`.

---

### Task 6: Card compacto

**Files:** Modify `src/apps/web/components/home/card-prospect.tsx`, `src/apps/web/components/home/barra-etapas.tsx` (pulso na atual), `src/packages/ui/src/styles/globals.css` (classes `luz-mouse` e `borda-correndo`); Test `card-prospect.test.ts`, `barra-etapas.test.ts` (casos novos)

Card (protótipo `2-home.html`, grade compacta): nome e menu "···"; analista (admin, como hoje); "Etapa NN" pequeno + título em `font-serif italic` (~19 px) via `partesDoRotulo` (concluído: "Concluído" verde, como hoje); `BarraEtapas` com o segmento atual pulsando leve (classe `animate-pulse` suave, parada com movimento reduzido); selos "N aprovação(ões) pendente(s)" e "Teste"; rodapé "N de M etapas · <quando>". Luz que segue o mouse (Magic Card): `--mx/--my` atualizados em `pointermove`, gradiente radial `rgb(235 97 10 / .12)` a 260 px, só no hover. Com pendência, borda sutil correndo (classe `borda-correndo`: mesmos valores do entregável da spec — faixa âmbar ~28% e laranja ~38% sobre linha de 7%, uma volta a cada 9 s; parada com movimento reduzido).

- [ ] Step 1: testes novos: rótulo "04 · Unidade econômica" vira "Etapa 04" + "Unidade econômica"; "Apresentação final" sem "Etapa"; card com pendência tem `borda-correndo`, sem pendência não; segmento atual da barra tem a classe de pulso.
- [ ] Step 2–4 (os testes atuais do card continuam passando).
- [ ] Step 5: commit `feat(web): card compacto da home`.

---

### Task 7: Conferência

- [ ] `npm test` (web e core), `typecheck`, `lint`, `next build`.
- [ ] Visual com os prospects copiados na worktree: home nos dois temas a 1440, 960 e 375 px; hover nos cards; card laranja com 1 e com vários.
- [ ] Commit das correções.
