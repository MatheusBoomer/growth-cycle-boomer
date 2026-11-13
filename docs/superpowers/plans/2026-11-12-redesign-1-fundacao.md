# Redesign visual · PR 1: Fundação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a base visual do app inteiro (fontes, cores dos temas escuro e claro pérola, formas em pílula, fundo sem ASCII, botão de tema com transição em círculo e barra do topo nova), sem mexer no layout de nenhuma tela.

**Architecture:** Tudo que é base mora em `src/packages/ui` (tokens em `styles/globals.css`, componentes shadcn `base-nova`) e na barra do topo de `src/apps/web/components/marca`. As telas só herdam. Os testes que já leem o `globals.css` (contraste, superfícies, cores de gráfico) são a rede de segurança dos tokens; testes estáticos novos seguem o mesmo estilo da casa (ler arquivo e conferir).

**Tech Stack:** Next.js 16 (`next/font/google`), React 19, Tailwind 4, shadcn `base-nova` (Base UI), next-themes 0.4, Vitest 5 + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-visual-design.md` (protótipos em `docs/superpowers/specs/assets/redesign-visual/`, valores de cor em `4-modo-claro.html` e `6-admin.html`).

## Global Constraints

- Trabalhar na worktree `.claude/worktrees/redesign-visual`, branch `feat/redesign-visual`. Antes do primeiro commit: `git branch --show-current` tem que dizer `feat/redesign-visual`. Commitar só arquivos nomeados.
- Next.js 16 tem mudanças de API: ler `src/apps/web/node_modules/next/dist/docs/` (fontes) antes de mexer em `app/layout.tsx`.
- Textos de interface em português do Brasil.
- Gráfico nunca esticado (o teste estático existente continua passando).
- Tudo que se move respeita `prefers-reduced-motion`.
- Logos (`public/marca/*.svg`) não mudam.
- Este PR não instala `motion` nem componentes das bibliotecas (ficam para o PR 2, que é o primeiro a usá-los); só registra os dois registros no `components.json`.
- Comandos de teste: `npm test` em `src/apps/web` e em `src/packages/core`; `npm run typecheck` e `npm run lint` em `src/apps/web`.

## Review Focus

1. Navegador sem View Transitions (Firefox atual) ou com movimento reduzido: o botão de tema troca na hora, sem erro no console. → testes em Task 6.
2. Tecla **D** (atalho de tema que já existe): usa a mesma troca, com o círculo saindo do centro da tela. → teste em Task 6.
3. Tela estreita (375 px) com admin logado: a barra do topo não estoura; "Administração" vira ícone com nome para leitor de tela, como hoje. → teste em Task 7.
4. Quem não é admin: nenhum menu em pílula aparece (hoje não vê o link). → teste em Task 7.
5. Texto apagado (`--muted-foreground`) sobre popover e chips de aviso/sucesso sobre o fundo da página no pérola: o contraste AA continua valendo. → coberto pelo `contraste.test.ts` existente em Task 2.

---

### Task 1: Ambiente da worktree

**Files:** nenhum.

- [ ] **Step 1: Instalar dependências**

Run (em `src/`): `npm ci`
Expected: termina sem erro (a worktree não tem `node_modules`).

- [ ] **Step 2: Linha de base dos testes**

Run: `npm test` em `src/apps/web` e em `src/packages/core`
Expected: tudo verde. Anotar o total de testes de cada pacote; é a referência para as próximas tasks.

---

### Task 2: Tokens dos dois temas

**Files:**
- Modify: `src/packages/ui/src/styles/globals.css` (blocos `:root` e `.dark`)
- Test: `src/apps/web/lib/temas.test.ts` (novo); `lib/contraste.test.ts`, `lib/superficies.test.ts`, `lib/cores-grafico.test.ts` (existentes, devem continuar passando sem mudança)

**Interfaces:**
- Produces: tokens `--brilho` (cor do brilho de fundo, usada na Task 4) nos dois temas; os demais tokens mantêm os nomes de hoje.

O `:root` passa a ser o **claro pérola** e o `.dark` o **escuro novo**. Valores (os que não aparecem aqui ficam como estão):

| Token | `:root` (pérola) | `.dark` (escuro) |
|---|---|---|
| `--background` | `#f7f6f3` | `#0a0a0b` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--sidebar-foreground` | `#17150f` | `#f4f4f5` |
| `--card` | `#ffffff` | `rgb(255 255 255 / 0.045)` |
| `--popover`, `--sidebar` | `#ffffff` | `#141416` |
| `--muted-foreground` | `#67635b` | `#8b8b93` |
| `--secondary` | `rgb(45 35 20 / 0.05)` | `rgb(255 255 255 / 0.06)` |
| `--muted` | `rgb(45 35 20 / 0.04)` | `rgb(255 255 255 / 0.04)` |
| `--accent`, `--sidebar-accent` | `rgb(45 35 20 / 0.06)` | `rgb(255 255 255 / 0.07)` |
| `--accent-foreground`, `--sidebar-accent-foreground`, `--texto-forte` | `#17150f` | `#ffffff` |
| `--border`, `--sidebar-border` | `rgb(45 35 20 / 0.085)` | `rgb(255 255 255 / 0.08)` |
| `--input` | `rgb(45 35 20 / 0.14)` | `rgb(255 255 255 / 0.14)` |
| `--link-acao` | `#c94d05` | `#ff8a3d` |
| `--sucesso` / `--selo-haiku` | `#10805a` | `#2fbf8c` |
| `--sucesso-fundo` / `--selo-haiku-fundo` | `rgb(16 128 90 / 0.11)` | `rgb(47 191 140 / 0.14)` |
| `--selo-sonnet` / fundo | `#2c6bd0` / `rgb(44 107 208 / 0.1)` | (fica) |
| `--selo-opus` / fundo | `#6d28d9` / `rgb(109 40 217 / 0.09)` | (fica) |
| `--vidro-1` | `rgb(255 255 255 / 0.98)` | `rgb(22 22 24 / 0.94)` |
| `--vidro-2` | `rgb(253 252 250 / 0.97)` | `rgb(15 15 17 / 0.9)` |
| `--vidro-interno` | `rgb(45 35 20 / 0.03)` | (fica) |
| `--sombra-card` | `0 1px 0 0 #ffffff inset, 0 1px 2px rgb(45 35 20 / 0.04), 0 12px 28px -18px rgb(60 45 25 / 0.22)` | (fica) |
| `--brilho` (novo) | `rgb(235 97 10 / 0.1)` | `rgb(235 97 10 / 0.12)` |
| `--orb-*`, `--pontos`, `--pontos-cor` | **remover** | **remover** |

`--primary` continua `#eb610a` nos dois. Se um par do `contraste.test.ts` falhar com esses valores, ajustar só o token que falhou, para o tom mais próximo que passe, e registrar a troca na mensagem de commit.

- [ ] **Step 1: Escrever o teste que fixa a identidade dos temas**

`lib/temas.test.ts`, lendo o CSS com o mesmo `bloco(seletor)` de `contraste.test.ts` (copiar a função):

```ts
it("o claro é o pérola", () => expect(bloco(":root")["--background"]).toBe("#f7f6f3"))
it("o escuro é quase preto neutro", () => expect(bloco(".dark")["--background"]).toBe("#0a0a0b"))
it("os dois temas declaram o brilho de fundo", () => {
  expect(bloco(":root")["--brilho"]).toBe("rgb(235 97 10 / 0.1)")
  expect(bloco(".dark")["--brilho"]).toBe("rgb(235 97 10 / 0.12)")
})
it("os tokens do fundo ASCII saíram", () => expect(CSS).not.toMatch(/--orb-|--pontos/))
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/temas.test.ts` (em `src/apps/web`)
Expected: FAIL nos quatro.

- [ ] **Step 3: Aplicar a tabela no `globals.css`**

- [ ] **Step 4: Rodar os quatro testes de tokens**

Run: `npx vitest run lib/temas.test.ts lib/contraste.test.ts lib/superficies.test.ts lib/cores-grafico.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add src/packages/ui/src/styles/globals.css src/apps/web/lib/temas.test.ts
git commit -m "feat(ui): tokens do escuro novo e do claro pérola"
```

---

### Task 3: Fontes Geist e Instrument Serif

**Files:**
- Modify: `src/apps/web/app/layout.tsx` (troca `Inter` por `Geist`; inclui `Instrument_Serif`)
- Modify: `src/packages/ui/src/styles/globals.css` (`@theme inline`: `--font-heading` e `--font-serif`)
- Test: `src/apps/web/lib/tipografia.test.ts` (novo)

**Interfaces:**
- Produces: utilitário Tailwind `font-serif` (Instrument Serif) para os PRs seguintes; `font-sans` = Geist; `font-mono` = Geist Mono.

- [ ] **Step 1: Escrever o teste**

`lib/tipografia.test.ts` lê `app/layout.tsx` e o `globals.css`:

```ts
it("layout carrega Geist, Geist Mono e Instrument Serif, e não a Inter", () => {
  expect(layout).toMatch(/import \{[^}]*\bGeist\b[^}]*\} from "next\/font\/google"/)
  expect(layout).toMatch(/\bGeist_Mono\b/)
  expect(layout).toMatch(/\bInstrument_Serif\b/)
  expect(layout).not.toMatch(/\bInter\b/)
})
it("Instrument Serif vem com normal e itálico, peso 400, na variável --font-serif", () => {
  expect(layout).toMatch(/Instrument_Serif\(\{[^)]*weight: "400"/)
  expect(layout).toMatch(/style: \["normal", "italic"\]/)
  expect(layout).toMatch(/variable: "--font-serif"/)
})
it("o tema do Tailwind expõe font-serif", () => expect(css).toMatch(/--font-serif:\s*var\(--font-serif\)/))
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tipografia.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`Geist({ subsets: ["latin"], variable: "--font-sans" })`, `Geist_Mono` como hoje, `Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" })`; as três variáveis no `className` do `<html>`. No `@theme inline`, acrescentar `--font-serif: var(--font-serif);`.

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run lib/tipografia.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/app/layout.tsx src/packages/ui/src/styles/globals.css src/apps/web/lib/tipografia.test.ts
git commit -m "feat(ui): Geist e Instrument Serif no lugar da Inter"
```

---

### Task 4: Fim do fundo ASCII, entra o brilho quente

**Files:**
- Delete: `src/apps/web/components/marca/fundo-ondas-ascii.tsx`, `src/apps/web/components/marca/fundo-ondas-ascii.test.ts`
- Modify: `src/apps/web/app/layout.tsx` (tira o `<FundoOndasAscii />` e o import)
- Modify: `src/packages/ui/src/styles/globals.css` (regra de `body` no `@layer base`)
- Test: `src/apps/web/lib/temas.test.ts` (acrescenta casos)

**Interfaces:**
- Consumes: `--brilho` (Task 2).

- [ ] **Step 1: Acrescentar os testes**

```ts
it("o fundo da página é o brilho quente, preso à janela", () => {
  const body = /body\s*\{[^}]*\}/.exec(CSS)![0]
  expect(body).toMatch(/radial-gradient\([^)]*var\(--brilho\)/)
  expect(body).toMatch(/background-attachment:\s*fixed/)
})
it("o layout não monta mais o fundo ASCII", () => expect(layout).not.toMatch(/FundoOndasAscii/))
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/temas.test.ts`
Expected: FAIL nos dois novos.

- [ ] **Step 3: Implementar**

No `body` do `@layer base`: `background-image: radial-gradient(50% 40% at 18% 0%, var(--brilho), transparent 70%); background-attachment: fixed;` (posição e tamanho do protótipo `2-home.html`). Apagar os dois arquivos do fundo ASCII e o uso no layout.

- [ ] **Step 4: Rodar a suíte do web**

Run: `npm test` em `src/apps/web`
Expected: PASS (total = linha de base − testes do fundo ASCII + novos).

- [ ] **Step 5: Commit**

```bash
git add -A src/apps/web/components/marca/fundo-ondas-ascii.tsx src/apps/web/components/marca/fundo-ondas-ascii.test.ts
git add src/apps/web/app/layout.tsx src/packages/ui/src/styles/globals.css src/apps/web/lib/temas.test.ts
git commit -m "feat(ui): sai o fundo ASCII, entra o brilho quente"
```

---

### Task 5: Pílulas nos componentes de base

**Files:**
- Modify: `src/packages/ui/src/components/button.tsx`, `badge.tsx`, `tabs.tsx`, `card.tsx`, `input.tsx`, `select.tsx` (gatilho), `table.tsx`, `toggle-group.tsx`
- Test: `src/apps/web/lib/formas.test.ts` (novo)

**Interfaces:**
- Produces: as mesmas variantes e tamanhos de hoje (nenhum nome muda); só a forma e o acabamento.

Regras (protótipos `2-home.html` e `6-admin.html`):
- **Button:** raio total em todos os tamanhos (tirar os `rounded-lg` dos tamanhos). `default`: laranja sólido `bg-primary`, sem gradiente, com `shadow-[0_8px_22px_-10px_rgb(235_97_10/0.8)]` e anel interno branco a 12%. `outline`: fundo transparente, borda `border-input`, texto `foreground`. `ghost`, `secondary`, `destructive`, `link`, `midia` mantêm o papel.
- **Badge:** raio total; `h-auto py-0.5 px-2.5`, peso 500.
- **Tabs (lista `default`):** vira segmentado em pílula: lista com borda `border-border`, raio total, `p-1`; gatilho ativo com `bg-background` no claro / `bg-accent` no escuro e a sombra do card. A variante `line` continua existindo.
- **Card:** raio 18 px (`rounded-[18px]`), continua com `vidro`.
- **Input e gatilho do Select:** raio total. **Textarea:** `rounded-xl` (fica).
- **Table:** cabeçalho `text-xs text-muted-foreground font-normal`; células com `py-3.5`; só borda horizontal fina; hover da linha `hover:bg-muted`.
- **ToggleGroup:** mesmo segmentado em pílula das Tabs.

- [ ] **Step 1: Escrever o teste**

`lib/formas.test.ts` importa as variantes reais:

```ts
import { buttonVariants } from "@workspace/ui/components/button"
import { badgeVariants } from "@workspace/ui/components/badge"

it("todo tamanho de botão é pílula", () => {
  for (const size of ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
    const cls = buttonVariants({ size })
    expect(cls, size).toContain("rounded-full")
    expect(cls, size).not.toMatch(/\brounded-(lg|xl|md)\b/)
  }
})
it("botão principal é laranja sólido, sem gradiente", () => {
  const cls = buttonVariants({ variant: "default" })
  expect(cls).toContain("bg-primary")
  expect(cls).not.toMatch(/bg-linear|from-primario-claro/)
})
it("selo é pílula", () => expect(badgeVariants({})).toContain("rounded-full"))
```

Mais três casos estáticos lendo os arquivos: `card.tsx` contém `rounded-[18px]`; a lista `default` de `tabs.tsx` contém `rounded-full`; `input.tsx` contém `rounded-full`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/formas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Aplicar as regras nos componentes**

- [ ] **Step 4: Rodar a suíte do web e o typecheck**

Run: `npm test` e `npm run typecheck` em `src/apps/web`
Expected: PASS. Se algum teste de tela que confere classe (`card-prospect`, `grade-prospects`, `painel-projetos`, `lista-projetos`) quebrar por causa da forma nova, atualizar a classe esperada nele, sem mudar o que o teste protege.

- [ ] **Step 5: Commit**

```bash
git add src/packages/ui/src/components src/apps/web/lib/formas.test.ts
git commit -m "feat(ui): botões, abas, selos, campos e tabelas em pílula"
```

---

### Task 6: Troca de tema com círculo

**Files:**
- Create: `src/apps/web/lib/transicao-tema.ts`
- Modify: `src/apps/web/components/marca/alternar-tema.tsx`, `src/apps/web/components/theme-provider.tsx` (atalho D)
- Modify: `src/packages/ui/src/styles/globals.css` (regras de `::view-transition-*`)
- Test: `src/apps/web/lib/transicao-tema.test.ts` (novo, jsdom)
- Modify: `src/apps/web/components.json` (registros)

**Interfaces:**
- Produces: `trocarTemaComCirculo(origem: { x: number; y: number }, aplicar: () => void): void`

Comportamento (efeito do Animated Theme Toggler da Magic UI, feito à mão porque o componente deles mexe na classe `dark` direto e brigaria com o next-themes):
- Sem `document.startViewTransition` ou com `prefers-reduced-motion: reduce`: chama `aplicar()` direto.
- Senão: `document.startViewTransition(() => flushSync(aplicar))` e, no `ready`, `document.documentElement.animate({ clipPath: ["circle(0px at Xpx Ypx)", "circle(Rpx at Xpx Ypx)"] }, { duration: 650, easing: "cubic-bezier(.6,.1,.2,1)", pseudoElement: "::view-transition-new(root)" })`, com R = distância da origem até o canto mais longe da janela.
- `aplicar` do botão: põe/tira a classe `dark` no `<html>` na hora (o next-themes só aplica no efeito, tarde demais para a foto da transição) e chama `setTheme(proximoTema(resolvedTheme))`.
- Origem: centro do botão; no atalho D, centro da janela.
- CSS: `::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }`.
- Botão: `variant="outline"`, `size="icon-sm"` (pílula pela Task 5), mesmo rótulo de acessibilidade de hoje.

- [ ] **Step 1: Escrever os testes**

```ts
it("sem View Transitions, aplica direto", () => { /* document.startViewTransition = undefined → aplicar chamado 1x */ })
it("com movimento reduzido, aplica direto e não anima", () => { /* matchMedia reduce → startViewTransition não chamado */ })
it("com View Transitions, aplica dentro da transição e anima o círculo a partir da origem", async () => {
  // mock: startViewTransition(cb) → chama cb, retorna { ready: Promise.resolve() }; espiar documentElement.animate
  // origem {x: 100, y: 50}, janela 1000×800 → primeiro keyframe "circle(0px at 100px 50px)",
  // R = hypot(900, 750) ≈ 1171.5 → segundo keyframe começa com "circle(1171"
  // opções: duration 650, pseudoElement "::view-transition-new(root)"
})
```

E em `src/apps/web/components/theme-provider.test.ts` (novo, jsdom, com `vi.mock("@/lib/transicao-tema")`):

```ts
it("a tecla D troca o tema com o círculo saindo do centro da janela", ...) // janela 1000×800 → origem {x: 500, y: 400}
it("a tecla D dentro de um campo de texto não troca o tema", ...)          // regra que já existe, agora com teste
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/transicao-tema.test.ts`
Expected: FAIL ("trocarTemaComCirculo is not a function").

- [ ] **Step 3: Implementar `trocarTemaComCirculo` e ligar no botão e no atalho D**

Também registrar no `components.json`: `"registries": { "@magicui": "https://magicui.design/r/{name}.json", "@react-bits": "https://reactbits.dev/r/{name}.json" }`.

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/transicao-tema.test.ts` e `npm test` em `src/apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/transicao-tema.ts src/apps/web/lib/transicao-tema.test.ts src/apps/web/components/marca/alternar-tema.tsx src/apps/web/components/theme-provider.tsx src/apps/web/components/theme-provider.test.ts src/packages/ui/src/styles/globals.css src/apps/web/components.json
git commit -m "feat(web): troca de tema em círculo a partir do botão"
```

---

### Task 7: Barra do topo nova

**Files:**
- Create: `src/apps/web/components/marca/navegacao-principal.tsx`, `src/apps/web/components/marca/relogio.tsx`, `src/apps/web/lib/relogio.ts`
- Modify: `src/apps/web/components/marca/barra-topo.tsx`
- Delete: `src/apps/web/components/marca/link-administracao.tsx` e o teste (as regras dele passam para o teste novo)
- Test: `src/apps/web/components/marca/navegacao-principal.test.ts`, `src/apps/web/lib/relogio.test.ts`

**Interfaces:**
- Produces: `NavegacaoPrincipal(): JSX.Element | null`; `Relogio(): JSX.Element`; `horaEmSaoPaulo(d: Date): string` (formato `HH:MM`, fuso `America/Sao_Paulo`).
- `BarraTopo` mantém a assinatura `{ titulo, subtitulo?, extra? }`; nenhuma tela muda de chamada.

Layout (protótipo `6-admin.html`, barra do topo): logo à esquerda + `titulo · subtitulo` como hoje; **no centro, só para admin**, o menu em pílula "Prospects" (`/`) · "Administração" (`/admin/pessoas`), item ativo pelo `usePathname()` (`/admin*` → Administração; o resto → Prospects) com `aria-current="page"`; à direita, na ordem: `BotaoReportar`, `extra`, `Relogio` (pílula em fonte mono), `MenuConta`, `AlternarTema`. Fundo da barra: transparente com desfoque, sem a borda de baixo.

- [ ] **Step 1: Escrever os testes**

`relogio.test.ts`:
```ts
it("formata em São Paulo com dois dígitos", () => expect(horaEmSaoPaulo(new Date("2026-11-12T00:04:00Z"))).toBe("21:04"))
```

`navegacao-principal.test.ts` (mesmo `montar` do teste de `link-administracao`, com `vi.mock("next/navigation", () => ({ usePathname: () => caminho }))`):
```ts
it("quem não é admin não vê o menu", ...)                                   // raiz sem <nav>
it("admin vê Prospects e Administração com os destinos certos", ...)        // hrefs "/" e "/admin/pessoas"
it("em /admin/projetos, Administração é a página atual", ...)              // aria-current="page" só nele
it("no celular, Administração fica só ícone e o nome vai para leitor de tela", ...) // svg com "sm:hidden", span com "max-sm:sr-only"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/relogio.test.ts components/marca/navegacao-principal.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar os três e montar a barra**

`Relogio` atualiza a cada 30 s e renderiza vazio no servidor (evita diferença de hidratação), preenchendo no primeiro efeito.

- [ ] **Step 4: Rodar a suíte, o typecheck e o lint**

Run: `npm test`, `npm run typecheck`, `npm run lint` em `src/apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/components/marca src/apps/web/lib/relogio.ts src/apps/web/lib/relogio.test.ts
git commit -m "feat(web): barra do topo com menu em pílula e relógio"
```

---

### Task 8: Conferência final do PR

**Files:** nenhum (só correções que a conferência pedir).

- [ ] **Step 1: Suítes e build**

Run: `npm test` em `src/apps/web` e em `src/packages/core`; `npm run build` em `src/apps/web`
Expected: tudo verde; build sem erro.

- [ ] **Step 2: Conferir no app**

Subir local (`PLANEJAMENTO_AUTH=off PLANEJAMENTO_DADOS=fs npm run dev` em `src/apps/web`, porta livre) e olhar home, tela de trabalho e admin nos dois temas, com o DevTools emulando `prefers-reduced-motion`. Esperado: fontes novas, cores do protótipo, pílulas, fundo sem ASCII, troca de tema em círculo (e direta com movimento reduzido), nada quebrado em 375 px.

- [ ] **Step 3: Commit das correções, se houver, e push só quando o usuário pedir.**
