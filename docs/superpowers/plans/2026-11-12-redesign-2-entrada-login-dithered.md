# Redesign visual · PR 2: Entrada, login e fundo dithered — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entrada "Bem-vindo ao Growth *Cycle*" que toca só logo depois de um login de verdade, login B centrado e editorial, e o fundo dithered B sutil no login e na entrada.

**Architecture:** O fundo dithered e a faixa de cor do texto (Dia Text Reveal) são portados dos protótipos aprovados (`7-fundo-dithered.html`, `2-home.html`), sem dependência nova: um componente de canvas WebGL2 com o shader do protótipo e um componente de texto com animação CSS. A entrada é um componente cliente montado pela home quando o retorno do Google deixou o cookie `gc-boas-vindas`; ela apaga o cookie ao montar, então refresh ou abrir já logado nunca a mostram.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, WebGL2, next-themes, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md` (seções "Fundo dithered", "Entrada", "Login (opção B)"); protótipos `docs/superpowers/specs/assets/redesign-visual/2-home.html` (entrada, velocidade final), `5-login.html` (login B), `7-fundo-dithered.html` (primeiro quadro: B sutil).

## Global Constraints

- Worktree `.claude/worktrees/redesign-visual`, branch `feat/redesign-visual` (já contém o PR 1 e a `main` local aponta para ele). `git branch --show-current` antes do primeiro commit; commitar só arquivos nomeados.
- Sem dependência nova (nada de `motion`, `ogl` ou `three`).
- Tudo que se move respeita `prefers-reduced-motion`.
- Dithered: React Bits `Dither` versão B sutil — 4 tons, Bayer 8×8, pixel 2 px CSS, intensidade 0,6, velocidade 0,6; paleta escura `#0a0a0b → #120b07 → #4a1f08 → #9a420e`, pérola `#f7f6f3 → #f2e9e0 → #ead2bd → #dba57c`; centro limpo; rastro do mouse discreto; sem ondas de clique; pausa fora da tela e com aba escondida; sem WebGL2 não desenha nada (fica o brilho quente do PR 1). Não entra na tela de trabalho.
- Entrada só logo após login de verdade (cookie gravado em `/auth/callback`); nunca em refresh, já logado, outra aba, troca de tela ou modo `PLANEJAMENTO_AUTH=off`. Clique ou Esc pula.
- Textos em português do Brasil, verbatim da spec.

## Review Focus

1. Navegador sem WebGL2 (ou contexto perdido): login e entrada abrem sem erro, só com o brilho quente. → teste em Task 2.
2. Movimento reduzido: a entrada não toca (a home aparece direto) e o dithered fica parado. → testes em Tasks 2 e 3.
3. O cookie de boas-vindas não pode prender a entrada em loop: some ao montar, mesmo se a pessoa sair da home no meio. → teste em Task 3.
4. Login com erro (`?erro=dominio` / `?erro=falha`): a mensagem continua aparecendo, abaixo do botão. → teste em Task 5.
5. Retorno do Google com erro não grava o cookie de boas-vindas (senão a entrada tocaria depois de um login recusado e um segundo login certo). → teste em Task 4.

---

### Task 1: Texto com faixa de cor (Dia Text Reveal)

**Files:**
- Create: `src/apps/web/components/marca/texto-revelado.tsx`
- Modify: `src/packages/ui/src/styles/globals.css` (classe `texto-revelado` e `@keyframes`)
- Test: `src/apps/web/components/marca/texto-revelado.test.ts`

**Interfaces:**
- Produces: `TextoRevelado({ children, atraso = 0, corBase, className }: { children: ReactNode; atraso?: number; corBase?: string; className?: string })` — `<span>` com a classe `texto-revelado`, `style` com `--atraso: <atraso>s` e `--cor-base` quando dada.

CSS (do protótipo, velocidade final): `background-image: linear-gradient(90deg, var(--cor-base, currentColor) 0% 42%, #ffd29a 45%, #ff8a3d 48%, #eb610a 51%, #5b9df0 55%, transparent 60% 100%)`, `background-size: 260% 100%`, `background-clip: text`, `color: transparent`, animação `revelar 1.07s cubic-bezier(.6,.1,.2,1) var(--atraso) forwards` de `background-position: 100% 0` para `0% 0`. Com `prefers-reduced-motion: reduce`: sem animação, `color: var(--cor-base, currentColor)` e sem gradiente.

- [ ] **Step 1: Teste** — renderiza `TextoRevelado` com `atraso={0.33}` e `corBase="var(--muted-foreground)"`; espera `class` contendo `texto-revelado`, `style` contendo `--atraso: 0.33s` e `--cor-base: var(--muted-foreground)`. Segundo caso estático: `globals.css` tem `@keyframes revelar` e um bloco `prefers-reduced-motion` que zera a animação de `.texto-revelado`.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run components/marca/texto-revelado.test.ts` → FAIL.
- [ ] **Step 3: Implementar componente e CSS.**
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(web): texto com faixa de cor da entrada`.

---

### Task 2: Fundo dithered

**Files:**
- Create: `src/apps/web/lib/dithered.ts` (paleta, parâmetros e o shader como strings)
- Create: `src/apps/web/components/marca/fundo-dithered.tsx`
- Test: `src/apps/web/lib/dithered.test.ts`, `src/apps/web/components/marca/fundo-dithered.test.ts`

**Interfaces:**
- Produces: `paletaDithered(tema: "dark" | "light"): readonly [string, string, string, string]`; `PARAMETROS_DITHERED = { tons: 4, pixel: 2, intensidade: 0.6, velocidade: 0.6 } as const`; `SHADER_VERTICE`, `SHADER_FRAGMENTO` (strings GLSL ES 3.00, portadas do modo "ondas" de `7-fundo-dithered.html`, com a matriz de Bayer por bits).
- Produces: `FundoDithered({ intensidade = 0.6, centroLimpo = false, className }: { intensidade?: number; centroLimpo?: boolean; className?: string })` — `<canvas aria-hidden>` absoluto, `pointer-events-none`, `-z-10`, preenchendo o pai. O pai precisa ser `relative isolate`.

Comportamento: tema por `useTheme().resolvedTheme`; DPR limitado a 2; `IntersectionObserver` e `visibilitychange` pausam o laço; movimento reduzido desenha um quadro só (tempo 0) e para; `getContext("webgl2")` nulo → não desenha e não lança; rastro do mouse (apaga o padrão perto do cursor, `pointermove` no pai, amortecido); limpa recursos no desmonte.

- [ ] **Step 1: Testes**
  - `dithered.test.ts`: `paletaDithered("dark")` igual a `["#0a0a0b", "#120b07", "#4a1f08", "#9a420e"]`; `paletaDithered("light")` igual a `["#f7f6f3", "#f2e9e0", "#ead2bd", "#dba57c"]`; `PARAMETROS_DITHERED` igual a `{ tons: 4, pixel: 2, intensidade: 0.6, velocidade: 0.6 }`; `SHADER_FRAGMENTO` contém `#version 300 es` e a função `bay(`.
  - `fundo-dithered.test.ts` (jsdom, `HTMLCanvasElement.prototype.getContext` devolvendo `null`, `next-themes` mockado): monta sem lançar; o canvas existe com `aria-hidden="true"` e classe `pointer-events-none`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(web): fundo dithered B sutil`.

---

### Task 3: Componente da entrada

**Files:**
- Create: `src/apps/web/lib/boas-vindas.ts`, `src/apps/web/components/home/entrada.tsx`
- Modify: `src/apps/web/components/marca/relogio.tsx` (exporta o hook)
- Test: `src/apps/web/components/home/entrada.test.ts`

**Interfaces:**
- Produces: `COOKIE_BOAS_VINDAS = "gc-boas-vindas"`; `apagarCookieBoasVindas(): void` (grava `gc-boas-vindas=; Max-Age=0; Path=/`).
- Produces: `useHoraSaoPaulo(): string | null` em `relogio.tsx` (o `Relogio` passa a usá-lo).
- Produces: `Entrada({ emAndamento }: { emAndamento: number })`.
- Consumes: `TextoRevelado` (Task 1), `FundoDithered` (Task 2), `LogoBoomer`.

Layout (protótipo `2-home.html`, camada de entrada): sobreposição `fixed inset-0 z-50 bg-background`, com `FundoDithered intensidade={0.75}`; em cima, logo à esquerda e pílula mono "HH:MM em São Paulo" à direita; embaixo, "Bem-vindo ao" (`TextoRevelado` em `font-serif italic`, cor base `var(--muted-foreground)`, ~52 px), "Growth" (`TextoRevelado` atraso 0,17, Geist 600, `clamp(80px, 15.5vw, 222px)`, `tracking-[-0.07em]`, `leading-[.82]`) + "Cycle" (`TextoRevelado` atraso 0,33, `font-serif italic`, cor base `var(--primary)`); rodapé "Diagnóstico · Metas · Mídia · Plano de ação" e "N projetos em andamento" (1 → "1 projeto em andamento"). Tempo: aos 2400 ms começa a sair (600 ms: `opacity 0`, `blur(12px)`, `scale(1.04)`), depois desmonta. Clique ou Esc começam a saída na hora. Ao montar: `apagarCookieBoasVindas()`. Com movimento reduzido: apaga o cookie e não renderiza nada.

- [ ] **Step 1: Testes** (jsdom, timers falsos, `matchMedia` mockado):
  - "mostra Growth Cycle e o total em andamento" (`emAndamento: 8` → texto "8 projetos em andamento"; `1` → "1 projeto em andamento").
  - "apaga o cookie de boas-vindas ao montar" (`document.cookie` sem `gc-boas-vindas=1` depois de montar com ele gravado).
  - "some sozinha depois de 3 s" (avança 2400 + 600 ms → nada renderizado).
  - "Esc pula" (keydown Escape, avança 600 ms → nada renderizado).
  - "com movimento reduzido não aparece, mas apaga o cookie".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(web): entrada Bem-vindo ao Growth Cycle`.

---

### Task 4: Cookie gravado no login e entrada montada pela home

**Files:**
- Modify: `src/apps/web/app/auth/callback/route.ts` (grava o cookie só no sucesso)
- Modify: `src/apps/web/app/page.tsx` (lê o cookie com `cookies()` de `next/headers` e monta `<Entrada>` junto da grade)
- Test: `src/apps/web/app/auth/callback/route.test.ts`, `src/apps/web/app/page.test.tsx` (casos novos)

**Interfaces:**
- Consumes: `COOKIE_BOAS_VINDAS` (Task 3), `Entrada` (Task 3), `separarPorSituacao` de `lib/filtro-prospects` (já existe) para contar os em andamento.

Cookie no sucesso: `gc-boas-vindas=1`, `path: "/"`, `maxAge: 120`, `sameSite: "lax"`, `httpOnly: false` (o cliente precisa apagá-lo), `secure` igual ao dos outros cookies da rota.

- [ ] **Step 1: Testes**
  - callback: "no sucesso grava o cookie de boas-vindas" (`r.cookies.get("gc-boas-vindas")` com `value: "1"`, `maxAge: 120`, `path: "/"`, `httpOnly: false`); "em erro=dominio e erro=falha não grava" (`r.cookies.get("gc-boas-vindas")` indefinido).
  - home (mock de `next/headers`): "com o cookie de boas-vindas monta a entrada com o total em andamento"; "sem o cookie não monta a entrada".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `npx vitest run app/auth/callback/route.test.ts app/page.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(web): entrada toca só logo depois do login`.

---

### Task 5: Login B

**Files:**
- Create: `src/apps/web/lib/fases.ts`
- Modify: `src/apps/web/components/login/cartao-login.tsx` (reescrita), `src/apps/web/app/login/page.tsx` (passa as fases)
- Modify: `src/packages/ui/src/styles/globals.css` (classe `brilho-passa` do botão)
- Test: `src/apps/web/lib/fases.test.ts`, `src/apps/web/app/login/page.test.ts` (casos novos)

**Interfaces:**
- Produces: `fasesEmOrdem(etapas: { fase: string }[]): string[]` (únicas, na ordem do catálogo).
- `CartaoLogin({ href, mensagemDeErro, fases }: { href: string; mensagemDeErro: string | null; fases: string[] })`.
- Consumes: `FundoDithered` (Task 2), `useHoraSaoPaulo` (Task 3), `carregarCatalogo` + `raizDoProjeto` (existentes).

Layout (protótipo `5-login.html`, opção B, com fundo do `7-fundo-dithered.html`): `main` em tela inteira `relative isolate`, `FundoDithered centroLimpo`; topo com logo e pílula do relógio; centro: selo "Growth Cycle · acesso da equipe" com ponto verde; título "Do diagnóstico ao" / "*contrato fechado.*" (segunda linha `font-serif italic text-link-acao`), ~88 px, duas linhas; texto "Entre com a sua conta Google da Boomer para continuar os planejamentos."; botão-link em pílula "Entrar com Google" (mantém `<a>` comum para `/auth/entrar`), fundo `foreground`, texto `background`, G colorido, classe `brilho-passa`; alerta de erro abaixo do botão; rodapé com `fases.join(" · ")` numa pílula translúcida.

- [ ] **Step 1: Testes**
  - `fasesEmOrdem` com etapas de fases repetidas → `["Contexto", "Diagnóstico", ...]` sem repetição, na ordem.
  - login: "mostra o título e o botão para /auth/entrar"; "com ?erro=dominio mostra a mensagem do domínio abaixo do botão" (posição: o índice do texto da mensagem no HTML é maior que o do "Entrar com Google"); "o rodapé lista as fases do catálogo, inclusive Pós-apresentação".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `npx vitest run lib/fases.test.ts app/login/page.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(web): login B centrado com fundo dithered`.

---

### Task 6: Conferência do PR

- [ ] `npm test` em `src/apps/web` e `src/packages/core`; `npm run typecheck` e `npm run lint` em `src/apps/web`; `next build`.
- [ ] Visual: login (forçando `PLANEJAMENTO_AUTH=google` não é possível sem Supabase; conferir a tela de login renderizando o componente numa rota temporária **não commitada** ou pelo teste de HTML) e a entrada (gravar o cookie `gc-boas-vindas=1` no navegador e abrir a home), nos dois temas.
- [ ] Commit das correções, se houver.
