# Fundo de ondas ASCII animadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundo de ondas em ASCII, animado em canvas, com degradê 100% → 0% de cima para baixo, na home, no login e na tela do projeto.

**Architecture:** Uma função pura (`lib/ondas-ascii.ts`) calcula cada célula da grade, as paletas e as dimensões. Um componente cliente com `<canvas>` desenha em lotes e faz o loop. O `FundoBoomer` passa a escolher, por rota, entre as ondas e o fundo atual. O degradê é um `mask-image` CSS no canvas.

**Tech Stack:** Next 16 (App Router), React 19, `next-themes`, Vitest (+ jsdom por arquivo), Tailwind. Sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-09-fundo-ondas-ascii-design.md`

## Global Constraints

- Tudo em `src/apps/web`; comandos rodam de lá (`npm test`, `npm run lint`, `npm run typecheck`).
- `src/apps/web/AGENTS.md`: este Next tem mudanças incompatíveis. Antes de usar `usePathname` ou mexer em componente cliente, ler o guia correspondente em `node_modules/next/dist/docs/`.
- Rampa de caracteres, da menor para a maior intensidade: ` . : - = + * # @`.
- Azul da Boomer no tema claro: `rgb(57 135 229)` (`#3987e5`). Laranja: `#eb610a` = `rgb(235 97 10)`.
- Laranja em cerca de 10–15% das células; opacidade máxima de 0,20 no tema claro e 0,4 no escuro (eram 0,35 e 0,85; reduzidas depois de ver o resultado); neon leve só no escuro (`brilho` da paleta, `shadowBlur`).
- Degradê: `mask-image: linear-gradient(to bottom, #000, transparent)` no canvas, relativo à viewport.
- Células de ~10×18 px no desktop e maiores no celular; teto de ~30 fps; desenho em lotes por faixa de opacidade; linhas que o degradê já esconde não são desenhadas.
- O loop pausa com a aba oculta. Com `prefers-reduced-motion: reduce`, um único quadro estático.
- Sem `getContext("2d")` o componente não renderiza nada.
- Rotas com ondas: `/`, `/login`, `/prospects/*`. Demais rotas (admin etc.) mantêm o fundo atual.
- Fonte do canvas: Geist Mono (`--font-mono`, já carregada no layout).
- Não alterar tokens de tema em `packages/ui`. Texto de interface em português, como o resto do app.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Não incluir `.env.example` nem o `.mp4` da raiz em nenhum commit.

## Review Focus

1. Janela com tamanho 0 (aba minimizada, iframe oculto): não desenha, não divide por zero, não lança. (Task 1: `dimensionarGrade(0, 0)`; Task 2: teste de tamanho 0.)
2. Tela 4K ou monitor ultrawide: o número de células tem teto, senão o quadro estoura o orçamento de 30 fps. (Task 1.)
3. Troca de tema com o loop rodando, ou tema ainda não resolvido no primeiro render (`resolvedTheme` indefinido): usa a paleta clara e nunca lança. (Task 2.)
4. Desmontar o componente (navegar para o admin) deixa um `requestAnimationFrame` pendente e vaza o loop. (Task 2.)
5. Rotas parecidas: `/login/` (barra final) deve ligar; `/prospects` sem slug, `/admin` e `/adminx` não. (Task 3.)

---

### Task 1: Núcleo puro das ondas

**Files:**
- Create: `src/apps/web/lib/ondas-ascii.ts`
- Test: `src/apps/web/lib/ondas-ascii.test.ts`

**Interfaces:**
- Produces:
  - `RAMPA: readonly string[]` — os 9 caracteres ` . : - = + * # @` nessa ordem.
  - `caractereDaIntensidade(intensidade: number): string` — mapeia 0..1 (valores fora são limitados) para a `RAMPA`.
  - `type Celula = { intensidade: number; caractere: string; laranja: boolean }`
  - `celulaOnda(coluna: number, linha: number, t: number, colunas: number, linhas: number): Celula` — `t` em segundos.
  - `type TemaOndas = "claro" | "escuro"`; `type Rgb = readonly [number, number, number]`
  - `PALETAS: Record<TemaOndas, { azul: Rgb; laranja: Rgb; opacidadeMax: number }>`
  - `fatorDeDegrade(linha: number, linhas: number): number` — `1 - linha/linhas`, 0 se `linhas <= 0`.
  - `dimensionarGrade(largura: number, altura: number): { celulaL: number; celulaA: number; colunas: number; linhas: number }`

- [ ] **Step 1: Write the failing tests** em `lib/ondas-ascii.test.ts`:

```ts
it("celulaOnda é determinística")                       // mesma entrada → mesmo objeto (toEqual)
it("intensidade em [0,1] e caractere pertence à RAMPA") // colunas 0..59, linhas 0..29, t em [0, 3.7, 120.5]
it("caractereDaIntensidade: 0 → ' ', 1 → '@', monotônica e limita fora de [0,1]")
it("laranja fica entre 8% e 20% das células visíveis")  // visível = caractere !== " "; amostra grade 80×40 em t = 0, 5, 40
it("paletas: claro usa o azul e o laranja da Boomer; escuro é mais luminoso; opacidadeMax claro ≤ 0.35 e menor que a do escuro")
it("fatorDeDegrade: (0,60) → 1, (30,60) → 0.5, (60,60) → 0, (5,0) → 0")
it("dimensionarGrade desktop: (1440,900) → 10×18, 144 colunas, 50 linhas")
it("dimensionarGrade celular: (390,844) → 14×24, 28 colunas, 36 linhas")
it("dimensionarGrade 4K respeita o teto: (3840,2160) → colunas*linhas ≤ 20000 e a grade ainda cobre a janela")
it("dimensionarGrade(0,0) → colunas 0 e linhas 0, sem NaN")
```

- [ ] **Step 2: Run** `npx vitest run lib/ondas-ascii.test.ts`. Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implement** o módulo com as assinaturas acima. `celulaOnda`: soma de 2–3 senoides lentas com a fase deslocada pela coluna (listras verticais que ondulam), multiplicada por um fator radial que concentra o miolo no centro da grade; `laranja` vem de um segundo ruído lento comparado a um limiar, ajustado até o teste das frações passar. `dimensionarGrade`: células 10×18 para `largura >= 768`, senão 14×24; `colunas = ceil(largura/celulaL)`, `linhas = ceil(altura/celulaA)`; se `colunas*linhas > 20000`, multiplica as duas dimensões da célula por um mesmo fator até caber, mantendo a proporção.

- [ ] **Step 4: Run** `npx vitest run lib/ondas-ascii.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/ondas-ascii.ts src/apps/web/lib/ondas-ascii.test.ts
git commit -m "feat(fundo): núcleo puro das ondas ASCII (campo, paletas, degradê, grade)"
```

---

### Task 2: Componente de canvas

**Files:**
- Create: `src/apps/web/components/marca/fundo-ondas-ascii.tsx`
- Test: `src/apps/web/components/marca/fundo-ondas-ascii.test.ts`

**Interfaces:**
- Consumes (Task 1): `celulaOnda`, `PALETAS`, `fatorDeDegrade`, `dimensionarGrade`, `type TemaOndas`.
- Consumes: `useTheme` de `next-themes` (`resolvedTheme === "dark"` → `"escuro"`, senão `"claro"`).
- Produces: `export function FundoOndasAscii(): JSX.Element | null` — cliente (`"use client"`), sem props.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment jsdom`, mesmo padrão de `components/home/card-prospect.test.ts`; `vi.mock("next-themes")`; contexto 2D falso com `vi.fn()` em `fillText`, `fillStyle` e `clearRect`, instalado em `HTMLCanvasElement.prototype.getContext`; `matchMedia` e `requestAnimationFrame`/`cancelAnimationFrame` espionados):

```ts
it("sem getContext não renderiza canvas")                          // getContext → null; querySelector("canvas") é null
it("renderiza canvas aria-hidden, pointer-events-none, com mask-image de degradê")
it("reduced-motion: desenha um quadro (fillText chamado) e não agenda requestAnimationFrame")
it("janela com tamanho 0: não desenha e não lança")                // innerWidth/innerHeight = 0
it("tema ainda não resolvido (resolvedTheme undefined) usa a paleta clara e não lança")
it("trocar o tema reaproveita o loop: sem novo requestAnimationFrame além do agendamento normal e com a cor nova")
it("desmontar chama cancelAnimationFrame com o id pendente")
it("aba oculta pausa: com document.hidden, nenhum novo quadro é agendado; ao voltar, retoma")
```

- [ ] **Step 2: Run** `npx vitest run components/marca/fundo-ondas-ascii.test.ts`. Expected: FAIL, componente inexistente.

- [ ] **Step 3: Implement `FundoOndasAscii`.** Canvas `fixed inset-0 -z-10`, `aria-hidden`, `pointer-events-none`, `style={{ maskImage, WebkitMaskImage }}` com o degradê da Global Constraints. Em `useEffect`: pegar o contexto (se `null`, marcar estado e retornar `null` no render); medir `window.innerWidth/innerHeight` com `devicePixelRatio`; recalcular a grade em `resize`; loop com `requestAnimationFrame` limitado a ~30 fps pelo timestamp; desenhar agrupando células por faixa de opacidade (8 faixas, `intensidade * opacidadeMax`) e por cor, um `fillStyle` por lote, só linhas com `fatorDeDegrade >= 0.05`; `font` = `var(--font-mono)` resolvido via `getComputedStyle`, com fallback `monospace`. A paleta entra por `ref`, para trocar de tema sem reiniciar o loop. `visibilitychange` cancela e retoma o loop. Cleanup remove os listeners e cancela o `requestAnimationFrame`.

- [ ] **Step 4: Run** `npx vitest run components/marca/fundo-ondas-ascii.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/components/marca/fundo-ondas-ascii.tsx src/apps/web/components/marca/fundo-ondas-ascii.test.ts
git commit -m "feat(fundo): componente de canvas das ondas ASCII com degradê, pausa e reduced-motion"
```

---

### Task 3: Seleção por rota no FundoBoomer

**Files:**
- Create: `src/apps/web/lib/rota-ondas.ts`
- Test: `src/apps/web/lib/rota-ondas.test.ts`
- Modify: `src/apps/web/components/marca/fundo-boomer.tsx` (hoje componente de servidor sem estado; vira cliente)

**Interfaces:**
- Consumes (Task 2): `FundoOndasAscii`.
- Produces: `rotaUsaOndas(caminho: string): boolean`.

- [ ] **Step 1: Write the failing test** em `lib/rota-ondas.test.ts`:

```ts
it.each(["/", "/login", "/login/", "/prospects/iszi", "/prospects/iszi/"])("%s usa ondas", (c) => expect(rotaUsaOndas(c)).toBe(true))
it.each(["/admin", "/admin/skills", "/adminx", "/prospects", "/prospects/", "/api/x", "/auth/entrar"])("%s não usa", (c) => expect(rotaUsaOndas(c)).toBe(false))
```

- [ ] **Step 2: Run** `npx vitest run lib/rota-ondas.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `rotaUsaOndas`** em `lib/rota-ondas.ts`: ignora a barra final; verdadeira para `/`, `/login` e `/prospects/<slug>` (com ou sem sub-caminho, mas exigindo slug não vazio).

- [ ] **Step 4: Run** o teste. Expected: PASS.

- [ ] **Step 5: Modify `FundoBoomer`** (`"use client"`, `usePathname` de `next/navigation`): se `rotaUsaOndas(pathname)`, renderiza só `<FundoOndasAscii />`; senão, o JSX atual sem alteração. Manter o comentário de topo do arquivo, atualizado para citar as duas variantes. Rodar `npm test`, `npm run lint` e `npm run typecheck`. Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web/lib/rota-ondas.ts src/apps/web/lib/rota-ondas.test.ts src/apps/web/components/marca/fundo-boomer.tsx
git commit -m "feat(fundo): ondas ASCII na home, no login e na tela do projeto"
```

---

### Task 4: Verificação visual e ajuste fino

**Files:**
- Modify (só se o visual pedir): `src/apps/web/lib/ondas-ascii.ts` (constantes de limiar, rampa de opacidade e paletas).

**Interfaces:**
- Consumes: tudo das Tasks 1–3.

- [ ] **Step 1:** Subir o app (skill `run`) e capturar 1440×900 nos temas claro e escuro: home (`/`), tela do projeto (`/prospects/<slug>` de um prospect existente) e login. Se o ambiente local não tiver login ligado, `/login` redireciona para `/`: registrar que o login foi coberto só pelo teste de rota.
- [ ] **Step 2:** Conferir contra o spec: degradê 100% no topo e 0% na base; azul dominante com laranja só em detalhes; texto da home e painéis de vidro do projeto legíveis; tema escuro luminoso. Ajustar as constantes se algo fugir e repetir as capturas.
- [ ] **Step 3:** Conferir no navegador: aba oculta pausa (CPU cai), `prefers-reduced-motion` congela o quadro, e as rotas `/admin/*` seguem com o fundo antigo.
- [ ] **Step 4:** Rodar `npm test`, `npm run lint` e `npm run typecheck` em `src/apps/web`. Expected: tudo verde.
- [ ] **Step 5: Commit** (se houve ajuste)

```bash
git add src/apps/web/lib/ondas-ascii.ts
git commit -m "fix(fundo): ajuste fino visual das ondas ASCII"
```

---

### Task 5: Revisão — ondas da esquerda para a direita e fundo único no app inteiro

Revisão pedida depois de ver o resultado (ver "Histórico de revisões" no spec). Substitui, onde houver conflito, o degradê vertical e a seleção por rota das Tasks 1–3.

**Files:**
- Modify: `src/apps/web/lib/ondas-ascii.ts`, `src/apps/web/lib/ondas-ascii.test.ts`
- Modify: `src/apps/web/components/marca/fundo-ondas-ascii.tsx`, `src/apps/web/components/marca/fundo-ondas-ascii.test.ts`
- Modify: `src/apps/web/app/layout.tsx` (troca `<FundoBoomer />` por `<FundoOndasAscii />`)
- Delete: `src/apps/web/components/marca/fundo-boomer.tsx`, `src/apps/web/lib/rota-ondas.ts`, `src/apps/web/lib/rota-ondas.test.ts`

**Interfaces:**
- Consumes (Task 1): `celulaOnda`, `fatorDeDegrade`, `dimensionarGrade`, `PALETAS`.
- Produces: `fatorDeDegrade(posicao: number, total: number): number` (mesma regra, parâmetros renomeados: 1 no início, 0 no fim). `celulaOnda` mantém a assinatura.

- [ ] **Step 1: Write the failing tests**

`lib/ondas-ascii.test.ts` (novos):
```ts
it("as ondas avançam para a direita: o melhor deslocamento entre dois quadros é positivo")
// perfil de intensidade de uma linha em t e t+1s (grade 120×40, várias linhas e tempos);
// a correlação cruzada máxima entre deslocamentos inteiros de -6 a +6 colunas fica em s > 0.
it("a esquerda é mais intensa que a direita: média do terço esquerdo > média do terço direito")
it("o fundo cobre a altura: média do terço inferior ≥ 50% da média do terço superior")
```
`components/marca/fundo-ondas-ascii.test.ts` (trocar/acrescentar):
```ts
it("a máscara é horizontal") // className contém "mask-image:linear-gradient(to_right,#000,transparent)"
it("não desenha nas colunas que o degradê já escondeu e desenha por toda a largura útil")
// com innerWidth 1024: todo x de fillText ≤ 0.96 * 1024 e algum x > 0.5 * 1024
```
Remover `lib/rota-ondas.test.ts` junto com o módulo.

- [ ] **Step 2: Run** `npx vitest run lib/ondas-ascii.test.ts components/marca/fundo-ondas-ascii.test.ts`. Expected: FAIL nos quatro testes novos/alterados.

- [ ] **Step 3: Implement.** `celulaOnda`: a fase da listra passa a `coluna * 1.15 - t * v` e todo termo com `x` e `t` avança para +x; o envelope passa a ter centro em x≈0.2–0.3, sigma horizontal largo, e sigma vertical grande o bastante para cobrir a altura. `fatorDeDegrade` com parâmetros `posicao, total`. O componente percorre as colunas como laço externo, interrompe quando `fatorDeDegrade(coluna, colunas) < DEGRADE_MINIMO` e usa a máscara `to_right`. `layout.tsx` usa `FundoOndasAscii` direto; apagar `fundo-boomer.tsx` e a seleção por rota.

- [ ] **Step 4: Run** os dois arquivos de teste, depois `npm test`, `npm run lint` e `npm run typecheck` em `src/apps/web`. Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add -A src/apps/web/lib src/apps/web/components/marca src/apps/web/app/layout.tsx docs/superpowers
git commit -m "feat(fundo): ondas da esquerda para a direita e fundo único no app inteiro"
```
