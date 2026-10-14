# Identidade visual Boomer no app — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aplicar a identidade Boomer (tema escuro padrão + claro, vidro, Inter, logo, barra de topo) à interface do app web, sem tocar no material do cliente.

**Architecture:** quase tudo passa por tokens em `packages/ui/src/styles/globals.css` (cores, raios, utilitários `vidro`/`vidro-interno`); os componentes shadcn mudam poucas classes; três peças novas de marca (`FundoBoomer`, `LogoBoomer`, `BarraTopo`) entram no app; os ~12 usos de cor fixa passam para tokens semânticos. Contraste e paleta são vigiados por testes que leem o CSS e o código-fonte.

**Tech Stack:** Next.js 16.3, React 19.2, Tailwind CSS 4 (`@theme inline`, `@utility`), shadcn `base-nova` sobre Base UI, next-themes 0.4, `next/font/google` (Inter), vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-13-identidade-visual-boomer-design.md`

## Global Constraints

- Comandos `npm` rodam em `src/` salvo indicação; testes do app com `npm test -w web`.
- Tema escuro é o padrão; `storageKey` do next-themes = `"tema-boomer"`; `enableSystem` = `false`; temas = `["dark", "light"]`.
- Cores de interface só por token. Paleta Tailwind nomeada (`amber-500`, `zinc-900`…) e `bg-white` ficam proibidos em `apps/web/components` (exceto `modo-dev/`) e `packages/ui/src/components`.
- Laranja `#eb610a` (`primary`) só em: botão primário, etapa atual, links de ação (`link-acao`), foco (`ring`), destaque de menção no compositor e marcações de comentário nos slides.
- Contraste AA (4,5:1) para texto nos dois temas; exceção única: `primary-foreground` sobre `primary` ≥ 3:1.
- Material do cliente (PNG, iframes de relatório, imagens da biblioteca) fica sobre `bg-papel` (branco nos dois temas).
- Raios: `rounded-md` 6 px (chips), `rounded-lg` 8 px (itens), `rounded-xl` 12 px (controles), `rounded-2xl` 16 px (cards).
- Fonte: Inter em `--font-sans`; Geist Mono em `--font-mono`.
- Nada muda em `components/modo-dev/`.
- Commits `feat(web): …` / `feat(ui): …`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Troca de tema na hidratação:** com o tema claro gravado, o logo e o ícone do botão de tema não podem piscar nem gerar aviso de hidratação. Ambos renderizam as duas versões e escondem por CSS (`dark:`). Conferido nas capturas da Task 9, com a tela recarregada no tema claro.
2. **Colunas redimensionáveis com vidro:** arrastar as alças, recolher a trilha e o painel e abrir o visualizador devem continuar funcionando com os cards separados por 12 px. Conferido na Task 6 (Step 5).
3. **Menus e popovers sobre conteúdo:** `DropdownMenu` e `Dialog` usam `popover` sólido. Vidro translúcido sobre o chat ficaria ilegível. Teste de contraste `popover-foreground`/`popover` na Task 1.
4. **Material do cliente com fundo transparente:** PNG transparente na biblioteca, no card de entregável e no visualizador continua legível no tema escuro (`bg-papel`). Teste de paleta (sem `bg-white` solto) na Task 7 e captura na Task 9.
5. **Valor antigo "system" no navegador:** a chave nova `tema-boomer` faz todo mundo abrir no escuro. Teste de `CONFIG_TEMA` na Task 2.

---

## Mapa de arquivos

| Arquivo | Mudança |
|---|---|
| `src/packages/ui/src/styles/globals.css` | Tokens dos dois temas, tokens novos, raios fixos, `@utility vidro`/`vidro-interno` |
| `src/apps/web/lib/contraste.test.ts` | Novo: contraste dos pares de texto lendo o CSS |
| `src/apps/web/lib/tema.ts` + `tema.test.ts` | Novo: `CONFIG_TEMA`, `proximoTema` |
| `src/apps/web/components/theme-provider.tsx` | Usa `CONFIG_TEMA` e `proximoTema` |
| `src/apps/web/components/marca/alternar-tema.tsx` | Novo: botão sol/lua |
| `src/apps/web/components/marca/logo-boomer.tsx` | Novo |
| `src/apps/web/components/marca/fundo-boomer.tsx` | Novo |
| `src/apps/web/components/marca/barra-topo.tsx` | Novo |
| `src/apps/web/components/marca/marca.test.ts` | Novo: SVGs públicos com `viewBox` e cores certas |
| `src/apps/web/public/marca/boomer-logo-{escuro,claro}.svg` | Novos (cópia com `viewBox`) |
| `src/apps/web/app/layout.tsx` | Inter, `FundoBoomer`, `Toaster` sem `richColors` |
| `src/packages/ui/src/components/{card,button,badge,progress,dialog,alert-dialog,bubble,input,textarea,resizable,dropdown-menu}.tsx` | Classes do vidro e dos controles |
| `src/apps/web/components/home/{grade-prospects,card-prospect}.tsx` | Barra de topo, faixa de contexto, hover |
| `src/apps/web/components/trabalho/{area-de-trabalho,trilha-etapas,visualizador-html,visualizador-arquivo,visualizador-apresentacao}.tsx` | Barra de topo, colunas em vidro, trilha |
| `src/apps/web/components/{trabalho/icone-status,trabalho/painel-etapa,sistema/uso-assinatura,cards/previa-roteiro,cards/previa-arquivo,biblioteca/imagem-ampliada,chat/item-conversa,markdown}.tsx` | Tokens semânticos, papel, bolha, markdown |
| `src/apps/web/lib/paleta.test.ts` | Novo: proíbe paleta nomeada e `bg-white` solto |

---

### Task 1: Tokens e teste de contraste

**Files:**
- Create: `src/apps/web/lib/contraste.test.ts`
- Modify: `src/packages/ui/src/styles/globals.css` (arquivo inteiro)

**Interfaces:**
- Produces: tokens CSS `--texto-forte`, `--primario-claro`, `--sucesso`, `--sucesso-fundo`, `--aviso`, `--aviso-fundo`, `--perigo-fundo`, `--volume`, `--link-acao`, `--papel`, `--vidro-1`, `--vidro-2`, `--vidro-interno`, `--sombra-card`, `--orb-laranja`, `--orb-azul`, `--orb-verde`, `--pontos`, `--pontos-cor`; classes Tailwind `text-texto-forte`, `bg-sucesso`, `text-sucesso`, `bg-sucesso-fundo`, `text-aviso`, `bg-aviso`, `bg-aviso-fundo`, `border-aviso`, `bg-perigo-fundo`, `bg-volume`, `text-link-acao`, `bg-papel`, `bg-vidro-interno`, `from-primario-claro`; utilitários `vidro` e `vidro-interno`; raios `rounded-md/lg/xl/2xl` = 6/8/12/16 px.

- [ ] **Step 1: Escrever o teste de contraste (falhando)**

Criar `src/apps/web/lib/contraste.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Lê os tokens dos dois temas direto do CSS, para o teste quebrar se alguém mudar uma cor sem olhar o contraste.
const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")

type Cor = { r: number; g: number; b: number; a: number }

function bloco(seletor: ":root" | ".dark"): Record<string, string> {
  const inicio = CSS.search(new RegExp(`^${seletor.replace(".", "\\.")} \\{`, "m"))
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado`)
  const corpo = CSS.slice(inicio, CSS.indexOf("}", inicio))
  return Object.fromEntries([...corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
}

function cor(valor: string): Cor {
  const hex = valor.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgb = valor.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/)
  if (rgb) return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] === undefined ? 1 : +rgb[4] }
  throw new Error(`cor em formato não suportado pelo teste: ${valor}`)
}

/** Compõe uma cor (possivelmente translúcida) sobre um fundo opaco. */
function sobre(frente: Cor, fundo: Cor): Cor {
  const mistura = (f: number, b: number) => f * frente.a + b * (1 - frente.a)
  return { r: mistura(frente.r, fundo.r), g: mistura(frente.g, fundo.g), b: mistura(frente.b, fundo.b), a: 1 }
}

function luminancia({ r, g, b }: Cor): number {
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function contraste(a: Cor, b: Cor): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro! + 0.05) / (escuro! + 0.05)
}

for (const [nome, seletor] of [["escuro", ".dark"], ["claro", ":root"]] as const) {
  describe(`contraste do tema ${nome}`, () => {
    const t = { ...bloco(":root"), ...(seletor === ".dark" ? bloco(".dark") : {}) }
    const c = (token: string) => {
      const valor = t[token]
      if (!valor) throw new Error(`token ${token} ausente no tema ${nome}`)
      return cor(valor)
    }
    const fundo = c("--background")
    const card = sobre(c("--card"), fundo)
    const pares: [string, string, Cor, Cor, number][] = [
      ["--foreground", "fundo", c("--foreground"), fundo, 4.5],
      ["--muted-foreground", "fundo", c("--muted-foreground"), fundo, 4.5],
      ["--foreground", "card", c("--foreground"), card, 4.5],
      ["--muted-foreground", "card", c("--muted-foreground"), card, 4.5],
      ["--texto-forte", "card", c("--texto-forte"), card, 4.5],
      ["--popover-foreground", "popover", c("--popover-foreground"), c("--popover"), 4.5],
      ["--muted-foreground", "popover", c("--muted-foreground"), c("--popover"), 4.5],
      ["--sucesso", "chip de sucesso", c("--sucesso"), sobre(c("--sucesso-fundo"), card), 4.5],
      ["--aviso", "chip de aviso", c("--aviso"), sobre(c("--aviso-fundo"), card), 4.5],
      ["--destructive", "chip de perigo", c("--destructive"), sobre(c("--perigo-fundo"), card), 4.5],
      ["--link-acao", "card", c("--link-acao"), card, 4.5],
      ["--primary-foreground", "--primary (exceção do botão)", c("--primary-foreground"), c("--primary"), 3],
    ]
    for (const [texto, sobreQue, frente, base, minimo] of pares) {
      it(`${texto} sobre ${sobreQue} ≥ ${minimo}:1`, () => {
        expect(contraste(frente, base)).toBeGreaterThanOrEqual(minimo)
      })
    }
  })
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/contraste`
Expected: FAIL — "cor em formato não suportado pelo teste: oklch(…)" (tokens atuais em oklch, tokens novos ausentes).

- [ ] **Step 3: Reescrever `globals.css`**

Substituir o conteúdo inteiro de `src/packages/ui/src/styles/globals.css` por:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));
@source "../../../apps/**/*.{ts,tsx}";
@source "../../../components/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: var(--font-sans);
    --font-mono: var(--font-mono);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    /* Marca e semântica Boomer */
    --color-texto-forte: var(--texto-forte);
    --color-primario-claro: var(--primario-claro);
    --color-sucesso: var(--sucesso);
    --color-sucesso-fundo: var(--sucesso-fundo);
    --color-aviso: var(--aviso);
    --color-aviso-fundo: var(--aviso-fundo);
    --color-perigo-fundo: var(--perigo-fundo);
    --color-volume: var(--volume);
    --color-link-acao: var(--link-acao);
    --color-papel: var(--papel);
    --color-vidro-interno: var(--vidro-interno);
    /* Raios fixos do spec Boomer: chips 6, itens 8, controles 12, cards 16 */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
    --radius-2xl: 16px;
    --radius-3xl: 20px;
    --radius-4xl: 24px;
}

/* Tema claro: laranja da marca + azul-marinho do logo */
:root {
    --background: #f5f6fa;
    --foreground: #1e293b;
    --card: rgb(255 255 255 / 0.92);
    --card-foreground: #1e293b;
    --popover: #ffffff;
    --popover-foreground: #1e293b;
    --primary: #eb610a;
    --primary-foreground: #ffffff;
    --secondary: rgb(15 27 61 / 0.05);
    --secondary-foreground: #1e293b;
    --muted: rgb(15 27 61 / 0.04);
    --muted-foreground: #5a6578;
    --accent: rgb(15 27 61 / 0.06);
    --accent-foreground: #0f1b3d;
    --destructive: #be123c;
    --border: rgb(15 27 61 / 0.08);
    --input: rgb(15 27 61 / 0.12);
    --ring: rgb(235 97 10 / 0.45);
    --chart-1: #eb610a;
    --chart-2: #3987e5;
    --chart-3: #199e70;
    --chart-4: #94a3b8;
    --chart-5: #64748b;
    --radius: 0.5rem;
    --sidebar: #ffffff;
    --sidebar-foreground: #1e293b;
    --sidebar-primary: #eb610a;
    --sidebar-primary-foreground: #ffffff;
    --sidebar-accent: rgb(15 27 61 / 0.06);
    --sidebar-accent-foreground: #0f1b3d;
    --sidebar-border: rgb(15 27 61 / 0.08);
    --sidebar-ring: rgb(235 97 10 / 0.45);

    --texto-forte: #0f1b3d;
    --primario-claro: #f47a2a;
    --sucesso: #047857;
    --sucesso-fundo: rgb(16 185 129 / 0.12);
    --aviso: #b45309;
    --aviso-fundo: rgb(245 158 11 / 0.12);
    --perigo-fundo: rgb(225 29 72 / 0.08);
    --volume: #2563eb;
    --link-acao: #c2410c;
    --papel: #ffffff;
    --vidro-1: rgb(255 255 255 / 0.92);
    --vidro-2: rgb(255 255 255 / 0.72);
    --vidro-interno: rgb(15 27 61 / 0.03);
    --sombra-card: 0 1px 0 0 #ffffff inset, 0 18px 36px -26px rgb(15 27 61 / 0.28);
    --orb-laranja: 0.1;
    --orb-azul: 0.08;
    --orb-verde: 0.05;
    --pontos: 0.05;
    --pontos-cor: rgb(15 27 61 / 0.55);
}

/* Tema escuro: padrão Boomer (Growth Cockpit) */
.dark {
    --background: #070a12;
    --foreground: #f1f5f9;
    --card: rgb(255 255 255 / 0.035);
    --card-foreground: #f1f5f9;
    --popover: #0f1420;
    --popover-foreground: #f1f5f9;
    --primary: #eb610a;
    --primary-foreground: #ffffff;
    --secondary: rgb(255 255 255 / 0.06);
    --secondary-foreground: #f1f5f9;
    --muted: rgb(255 255 255 / 0.04);
    --muted-foreground: #94a3b8;
    --accent: rgb(255 255 255 / 0.07);
    --accent-foreground: #ffffff;
    --destructive: #fb7185;
    --border: rgb(255 255 255 / 0.07);
    --input: rgb(255 255 255 / 0.1);
    --ring: rgb(235 97 10 / 0.5);
    --sidebar: #0f1420;
    --sidebar-foreground: #f1f5f9;
    --sidebar-primary: #eb610a;
    --sidebar-primary-foreground: #ffffff;
    --sidebar-accent: rgb(255 255 255 / 0.07);
    --sidebar-accent-foreground: #ffffff;
    --sidebar-border: rgb(255 255 255 / 0.07);
    --sidebar-ring: rgb(235 97 10 / 0.5);

    --texto-forte: #ffffff;
    --sucesso: #34d399;
    --sucesso-fundo: rgb(16 185 129 / 0.1);
    --aviso: #fbbf24;
    --aviso-fundo: rgb(251 191 36 / 0.1);
    --perigo-fundo: rgb(244 63 94 / 0.1);
    --volume: #3987e5;
    --link-acao: #f0894a;
    --vidro-1: rgb(255 255 255 / 0.035);
    --vidro-2: rgb(255 255 255 / 0.01);
    --vidro-interno: rgb(0 0 0 / 0.25);
    --sombra-card: 0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 20px 40px -24px rgb(0 0 0 / 0.6);
    --orb-laranja: 0.09;
    --orb-azul: 0.07;
    --orb-verde: 0.05;
    --pontos: 0.025;
    --pontos-cor: rgb(255 255 255 / 0.8);
}

/* Card de vidro: gradiente translúcido, borda fina, luz de 1 px no topo e sombra longa. */
@utility vidro {
    border: 1px solid var(--border);
    background-image: linear-gradient(to bottom, var(--vidro-1), var(--vidro-2));
    box-shadow: var(--sombra-card);
    backdrop-filter: blur(4px);
}

/* Caixa dentro de um card (um nível mais fundo). */
@utility vidro-interno {
    border: 1px solid var(--border);
    background-color: var(--vidro-interno);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    }
  body {
    @apply bg-background text-foreground;
    }
}
```

> O bloco `.dark` não repete `--primario-claro`, `--papel`, `--chart-*` e `--radius`: valem os do `:root`. O teste lê `:root` e sobrepõe `.dark`, como o navegador.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/contraste`
Expected: PASS (24 testes, 12 por tema). Se algum par falhar, ajustar só o tom do token que falhou e registrar o valor novo na spec (§3).

- [ ] **Step 5: Typecheck, testes do app e commit**

Run: `npm run typecheck -w web && npm test -w web`
Expected: sem erros; todos os testes passam.

```bash
git add src/packages/ui/src/styles/globals.css src/apps/web/lib/contraste.test.ts
git commit -m "feat(ui): tokens da identidade Boomer nos temas escuro e claro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tema escuro padrão, botão de tema e fonte Inter

**Files:**
- Create: `src/apps/web/lib/tema.ts`, `src/apps/web/lib/tema.test.ts`
- Create: `src/apps/web/components/marca/alternar-tema.tsx`
- Modify: `src/apps/web/components/theme-provider.tsx`
- Modify: `src/apps/web/app/layout.tsx`

**Interfaces:**
- Produces: `CONFIG_TEMA` (`{ defaultTheme: "dark"; enableSystem: false; themes: ["dark", "light"]; storageKey: "tema-boomer" }`); `proximoTema(atual: string | undefined): "dark" | "light"`; componente `AlternarTema` (sem props).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/apps/web/lib/tema.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { CONFIG_TEMA, proximoTema } from "./tema"

describe("tema", () => {
  it("abre no escuro, sem seguir o sistema, com chave própria", () => {
    expect(CONFIG_TEMA).toEqual({ defaultTheme: "dark", enableSystem: false, themes: ["dark", "light"], storageKey: "tema-boomer" })
  })

  it("alterna entre escuro e claro", () => {
    expect(proximoTema("dark")).toBe("light")
    expect(proximoTema("light")).toBe("dark")
  })

  it("antes de saber o tema (undefined), trata como escuro", () => {
    expect(proximoTema(undefined)).toBe("light")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/tema`
Expected: FAIL — não encontra `./tema`.

- [ ] **Step 3: Implementar `lib/tema.ts`**

```ts
// Tema do app: escuro (padrão Boomer) ou claro. A chave própria descarta o "system" gravado antes.
export const CONFIG_TEMA = {
  defaultTheme: "dark",
  enableSystem: false,
  themes: ["dark", "light"],
  storageKey: "tema-boomer",
} as const satisfies { defaultTheme: string; enableSystem: boolean; themes: readonly string[]; storageKey: string }

export function proximoTema(atual: string | undefined): "dark" | "light" {
  return atual === "light" ? "dark" : "light"
}
```

Ajustar o teste se o `toEqual` reclamar do `readonly` (o `toEqual` compara valores; não deve reclamar).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- lib/tema`
Expected: PASS (3 testes).

- [ ] **Step 5: ThemeProvider com a configuração nova**

Em `src/apps/web/components/theme-provider.tsx`:
- importar `import { CONFIG_TEMA, proximoTema } from "@/lib/tema"`;
- trocar as props do `NextThemesProvider` por:

```tsx
    <NextThemesProvider
      attribute="class"
      defaultTheme={CONFIG_TEMA.defaultTheme}
      enableSystem={CONFIG_TEMA.enableSystem}
      themes={[...CONFIG_TEMA.themes]}
      storageKey={CONFIG_TEMA.storageKey}
      disableTransitionOnChange
      {...props}
    >
```

- no `ThemeHotkey`, trocar `setTheme(resolvedTheme === "dark" ? "light" : "dark")` por `setTheme(proximoTema(resolvedTheme))`.

- [ ] **Step 6: Botão de tema**

Criar `src/apps/web/components/marca/alternar-tema.tsx`:

```tsx
"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@workspace/ui/components/button"
import { proximoTema } from "@/lib/tema"

/** Os dois ícones ficam no HTML e o CSS mostra o certo: nada pisca nem diverge na hidratação. */
export function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Alternar tema claro/escuro (tecla D)"
      title="Alternar tema claro/escuro (tecla D)"
      onClick={() => setTheme(proximoTema(resolvedTheme))}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
```

- [ ] **Step 7: Inter e toasts no layout**

Em `src/apps/web/app/layout.tsx`:
- trocar `import { Geist, Geist_Mono } from "next/font/google"` por `import { Geist_Mono, Inter } from "next/font/google"`;
- trocar `const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })` por `const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })`;
- no `<html>`, trocar `geist.variable` por `inter.variable`;
- trocar `<Toaster richColors />` por `<Toaster />`.

- [ ] **Step 8: Typecheck, lint, testes e commit**

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros (avisos já existentes podem continuar); testes passam.

```bash
git add src/apps/web/lib/tema.ts src/apps/web/lib/tema.test.ts src/apps/web/components/marca/alternar-tema.tsx src/apps/web/components/theme-provider.tsx src/apps/web/app/layout.tsx
git commit -m "feat(web): tema escuro padrão, botão de tema e fonte Inter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Peças de marca — logo, fundo e barra de topo

**Files:**
- Create: `src/apps/web/public/marca/boomer-logo-escuro.svg`, `src/apps/web/public/marca/boomer-logo-claro.svg`
- Create: `src/apps/web/components/marca/marca.test.ts`
- Create: `src/apps/web/components/marca/logo-boomer.tsx`, `fundo-boomer.tsx`, `barra-topo.tsx`
- Modify: `src/apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `AlternarTema` (Task 2); tokens `--orb-*`, `--pontos*` (Task 1).
- Produces: `LogoBoomer({ className?: string })`; `FundoBoomer()`; `BarraTopo({ titulo: string; subtitulo?: string })`.

- [ ] **Step 1: Escrever o teste dos SVGs (falhando)**

Criar `src/apps/web/components/marca/marca.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const pasta = path.resolve(import.meta.dirname, "../../public/marca")
const ler = (nome: string) => readFileSync(path.join(pasta, nome), "utf-8")
const cores = (svg: string) => [...new Set([...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]))]

describe("logos públicos da Boomer", () => {
  it("versão para fundo escuro: 'bo' branco e 'omer' laranja, recortada", () => {
    const svg = ler("boomer-logo-escuro.svg")
    expect(svg).toContain('viewBox="26 20 546 126"')
    expect(cores(svg)).toEqual(["#FEFEFE", "#EB610A"])
  })

  it("versão para fundo claro: 'bo' laranja e 'omer' azul-marinho, recortada", () => {
    const svg = ler("boomer-logo-claro.svg")
    expect(svg).toContain('viewBox="26 20 546 126"')
    expect(cores(svg)).toEqual(["#E9600B", "#20315E"])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- components/marca`
Expected: FAIL — ENOENT em `public/marca/boomer-logo-escuro.svg`.

- [ ] **Step 3: Copiar os logos com `viewBox`**

Run (na raiz do repositório):

```bash
mkdir -p src/apps/web/public/marca
for v in escuro claro; do
  sed -e 's/<svg version="1.1"/<svg viewBox="26 20 546 126" version="1.1"/' \
      -e 's/width="595" height="184"/width="546" height="126"/' \
      docs/superpowers/specs/assets/identidade-boomer/boomer-logo-$v.svg > src/apps/web/public/marca/boomer-logo-$v.svg
done
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w web -- components/marca`
Expected: PASS (2 testes).

- [ ] **Step 5: Componentes de marca**

Criar `src/apps/web/components/marca/logo-boomer.tsx`:

```tsx
import { cn } from "@workspace/ui/lib/utils"

/** As duas versões vão no HTML e o tema escolhe por CSS: nenhuma troca visível na hidratação. */
export function LogoBoomer({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno, sem otimização */}
      <img src="/marca/boomer-logo-claro.svg" alt="Boomer" className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
      <img src="/marca/boomer-logo-escuro.svg" alt="Boomer" className="hidden h-full w-auto dark:block" />
    </span>
  )
}
```

Criar `src/apps/web/components/marca/fundo-boomer.tsx`:

```tsx
/** Fundo fixo da marca: três brilhos difusos (laranja, azul, verde) e uma grade de pontos quase invisível. */
export function FundoBoomer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full blur-[120px]" style={{ background: "rgb(235 97 10 / var(--orb-laranja))" }} />
      <div className="absolute top-1/3 -right-32 size-[480px] rounded-full blur-[120px]" style={{ background: "rgb(57 135 229 / var(--orb-azul))" }} />
      <div className="absolute bottom-0 left-1/3 size-[360px] rounded-full blur-[120px]" style={{ background: "rgb(25 158 112 / var(--orb-verde))" }} />
      <div
        className="absolute inset-0"
        style={{ opacity: "var(--pontos)", backgroundImage: "radial-gradient(var(--pontos-cor) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
    </div>
  )
}
```

Criar `src/apps/web/components/marca/barra-topo.tsx`:

```tsx
import Link from "next/link"
import { AlternarTema } from "./alternar-tema"
import { LogoBoomer } from "./logo-boomer"

/** Barra fixa no topo: logo (volta ao início), nome da tela e o botão de tema. Sem ações de etapa. */
export function BarraTopo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="bg-background/70 sticky top-0 z-40 flex h-13 shrink-0 items-center gap-3.5 border-b px-4 backdrop-blur-xl">
      <Link href="/" aria-label="Boomer · voltar aos prospects" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <LogoBoomer />
      </Link>
      <div aria-hidden className="bg-border h-4.5 w-px" />
      <p className="min-w-0 truncate text-xs font-semibold">
        {titulo}
        {subtitulo && <span className="text-muted-foreground font-medium"> · {subtitulo}</span>}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <AlternarTema />
      </div>
    </header>
  )
}
```

- [ ] **Step 6: Fundo no layout**

Em `src/apps/web/app/layout.tsx`, importar `import { FundoBoomer } from "@/components/marca/fundo-boomer"` e colocar `<FundoBoomer />` como primeiro filho do `<ThemeProvider>`, antes de `{children}`.

- [ ] **Step 7: Typecheck, lint, testes e commit**

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; testes passam.

```bash
git add src/apps/web/public/marca src/apps/web/components/marca src/apps/web/app/layout.tsx
git commit -m "feat(web): logo, fundo e barra de topo da Boomer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Componentes de `packages/ui` no estilo Boomer

**Files:**
- Modify: `src/packages/ui/src/components/card.tsx` (classe do `Card`)
- Modify: `src/packages/ui/src/components/button.tsx` (base e variantes)
- Modify: `src/packages/ui/src/components/badge.tsx` (base e variantes novas)
- Modify: `src/packages/ui/src/components/progress.tsx` (`ProgressIndicator`)
- Modify: `src/packages/ui/src/components/dialog.tsx`, `alert-dialog.tsx` (véu e conteúdo)
- Modify: `src/packages/ui/src/components/bubble.tsx` (variante `tinted`)
- Modify: `src/packages/ui/src/components/input.tsx`, `textarea.tsx`
- Modify: `src/packages/ui/src/components/resizable.tsx` (`ResizableHandle`)

**Interfaces:**
- Consumes: utilitários `vidro`, tokens e cores da Task 1.
- Produces: `Badge` com variantes novas `sucesso`, `aviso`, `perigo`; `ResizableHandle` com 12 px de largura e fundo transparente (os cards de vidro ficam separados pela própria alça).

Sem teste unitário (só classes); a verificação é typecheck, lint, testes e as capturas da Task 9.

- [ ] **Step 1: Card de vidro**

Em `card.tsx`, no `Card`, trocar o trecho `overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10` por `overflow-hidden rounded-2xl vidro py-(--card-spacing) text-sm text-card-foreground`, e trocar `*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl` por `*:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl`. No `CardHeader` trocar `rounded-t-xl` por `rounded-t-2xl`; no `CardFooter` trocar `rounded-b-xl border-t bg-muted/50` por `rounded-b-2xl border-t bg-muted`. No `CardTitle` trocar `font-medium` por `font-semibold tracking-tight`.

- [ ] **Step 2: Botões**

Em `button.tsx`:
- na string base, trocar `rounded-lg` por `rounded-xl`;
- `default`: `"bg-linear-to-b from-primario-claro to-primary font-semibold text-primary-foreground shadow-[0_8px_18px_-8px_rgb(124_45_18/0.6)] ring-1 ring-white/20 ring-inset hover:brightness-110"`;
- `outline`: `"border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"`;
- `secondary`: `"bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent"`;
- `ghost`: `"hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"`;
- `destructive`: `"bg-perigo-fundo text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20"`;
- `link`: `"text-link-acao underline-offset-4 hover:underline"`;
- nos tamanhos `xs`, `sm`, `icon-xs`, `icon-sm`, trocar `rounded-[min(var(--radius-md),10px)]` e `rounded-[min(var(--radius-md),12px)]` por `rounded-lg`.

- [ ] **Step 3: Badges (chips)**

Em `badge.tsx`:
- na base, trocar `rounded-4xl` por `rounded-md`, `px-2` por `px-1.5`, `font-medium` por `font-semibold tabular-nums`;
- `default`: `"bg-primary/10 text-link-acao [a]:hover:bg-primary/20"`;
- `secondary`: `"bg-muted text-muted-foreground [a]:hover:bg-accent"`;
- `destructive`: `"bg-perigo-fundo text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20"`;
- `outline`: `"border-border text-muted-foreground [a]:hover:bg-accent [a]:hover:text-foreground"`;
- `ghost`: `"hover:bg-accent hover:text-foreground"`;
- `link`: `"text-link-acao underline-offset-4 hover:underline"`;
- acrescentar:

```ts
        sucesso: "bg-sucesso-fundo text-sucesso",
        aviso: "bg-aviso-fundo text-aviso",
        perigo: "bg-perigo-fundo text-destructive",
```

- [ ] **Step 4: Progresso, diálogos e campos**

- `progress.tsx`: no `ProgressTrack`, `h-1` → `h-1.5`; no `ProgressIndicator`, `"h-full bg-primary transition-all"` → `"h-full rounded-full bg-primary transition-[width] duration-700 ease-out"`.
- `dialog.tsx` e `alert-dialog.tsx`: no véu, `bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs` → `bg-black/50 duration-100 supports-backdrop-filter:backdrop-blur-sm`; no conteúdo, `rounded-xl bg-popover` → `rounded-2xl bg-popover` e `ring-1 ring-foreground/10` → `border border-border shadow-(--sombra-card)`.
- `dropdown-menu.tsx`: nas duas superfícies (linhas com `bg-popover`), `ring-1 ring-foreground/10` → `border border-border` (o fundo `bg-popover` continua sólido).
- `input.tsx`: `rounded-lg border border-input bg-transparent` → `rounded-xl border border-input bg-vidro-interno`; remover `dark:bg-input/30 dark:disabled:bg-input/80`.
- `textarea.tsx`: `rounded-lg border border-input bg-transparent` → `rounded-xl border border-input bg-vidro-interno`; remover `dark:bg-input/30 dark:disabled:bg-input/80`.

- [ ] **Step 5: Bolha "tinted" (mensagens do analista)**

Em `bubble.tsx`, substituir a string da variante `tinted` por:

```ts
          "*:data-[slot=bubble-content]:border *:data-[slot=bubble-content]:border-primary/25 *:data-[slot=bubble-content]:bg-primary/9 *:data-[slot=bubble-content]:text-foreground dark:*:data-[slot=bubble-content]:bg-primary/14 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/15 dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/20",
```

- [ ] **Step 6: Alça entre colunas**

Em `resizable.tsx`, no `ResizableHandle`, trocar o início da string `"relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2` por `"group/alca relative flex w-3 items-center justify-center bg-transparent ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2`, e `aria-[orientation=horizontal]:h-px` por `aria-[orientation=horizontal]:h-3`, `aria-[orientation=horizontal]:after:h-1` por `aria-[orientation=horizontal]:after:h-3`. A pega (`withHandle`) vira `<div className="z-10 flex h-8 w-1 shrink-0 rounded-full bg-border transition-colors group-hover/alca:bg-muted-foreground/50" />`.

- [ ] **Step 7: Typecheck, lint, testes e commit**

Run: `npm run typecheck && npm run lint && npm test -w web`
Expected: sem erros; testes passam.

```bash
git add src/packages/ui/src/components
git commit -m "feat(ui): vidro, botões, chips e campos no estilo Boomer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tela inicial (lista de prospects)

**Files:**
- Modify: `src/apps/web/components/home/grade-prospects.tsx`
- Modify: `src/apps/web/components/home/card-prospect.tsx`

**Interfaces:**
- Consumes: `BarraTopo` (Task 3); `Badge` variantes `sucesso`/`aviso` (Task 4).

- [ ] **Step 1: Barra de topo e faixa de contexto**

Em `grade-prospects.tsx`, importar `import { BarraTopo } from "@/components/marca/barra-topo"` e trocar o `return (` inteiro por:

```tsx
  return (
    <>
      <BarraTopo titulo="Planejamento estratégico" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">Prospects</p>
            <h1 className="text-texto-forte mt-1 text-2xl font-semibold tracking-tight">Planejamentos estratégicos</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input className="w-64" placeholder="Buscar prospect…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <DialogoNovoProspect />
          </div>
        </header>
        {/* … o restante (Empty / nenhum filtrado / grade) continua igual … */}
      </div>
    </>
  )
```

O bloco condicional (`prospects.length === 0 ? … : filtrados.length === 0 ? … : …`) entra no lugar do comentário sem mudanças.

- [ ] **Step 2: Card do prospect**

Em `card-prospect.tsx`:
- trocar a `className` do `Card` por `"has-[a:focus-visible]:ring-ring relative transition duration-300 hover:border-foreground/15 has-[a:focus-visible]:ring-2"`;
- no `CardTitle`, acrescentar `className="text-texto-forte"`;
- trocar `<Badge variant={concluido ? "default" : "secondary"}>` por `<Badge variant={concluido ? "sucesso" : "secondary"}>`;
- trocar `<Badge variant="outline">` (pendências) por `<Badge variant="aviso">`;
- no `CardFooter`, `className="text-muted-foreground text-xs"` → `className="text-muted-foreground text-[11px]"`.

- [ ] **Step 3: Typecheck, lint, testes e commit**

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; testes passam.

```bash
git add src/apps/web/components/home
git commit -m "feat(web): tela inicial com barra de topo e cards de vidro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Área de trabalho em cards de vidro

**Files:**
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx`
- Modify: `src/apps/web/components/trabalho/trilha-etapas.tsx`
- Modify: `src/apps/web/components/trabalho/visualizador-html.tsx`, `visualizador-arquivo.tsx`, `visualizador-apresentacao.tsx`

**Interfaces:**
- Consumes: `BarraTopo` (Task 3); utilitário `vidro`; `ResizableHandle` de 12 px (Task 4).

- [ ] **Step 1: Barra de topo e moldura**

Em `area-de-trabalho.tsx`:
- importar `import { BarraTopo } from "@/components/marca/barra-topo"`;
- trocar `<div className={cn("relative h-svh", arrastando && "[&_iframe]:pointer-events-none")} onPointerDownCapture={aoApertar}>` por:

```tsx
      <div className="flex h-svh flex-col">
        <BarraTopo titulo="Planejamento estratégico" subtitulo={dados.estado.prospect.nome} />
        <div className={cn("relative min-h-0 flex-1 p-3", arrastando && "[&_iframe]:pointer-events-none")} onPointerDownCapture={aoApertar}>
```

  e fechar o `</div>` extra antes de `</ContextoVisualizador.Provider>`.

- [ ] **Step 2: Cada coluna vira um card**

Ainda em `area-de-trabalho.tsx`:
- trilha: `<div ref={trilhaCaixaRef} className="h-full">` → `<div ref={trilhaCaixaRef} className="vidro h-full overflow-hidden rounded-2xl">`;
- chat: `<main className="flex h-full min-h-0 flex-col">` → `<main className="vidro flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">`; no `<header>` do chat, `border-b px-4 py-3` continua; no `<h1>`, `className="font-semibold"` → `className="text-sm font-semibold tracking-tight"`;
- visualizador: `{telaCheia ? null : painelVisualizador}` → `{telaCheia ? null : <div className="vidro h-full overflow-hidden rounded-2xl">{painelVisualizador}</div>}`;
- painel da etapa: `<PainelEtapa slug={slug} etapa={etapa} dados={dados} />` → `<div className="vidro h-full overflow-hidden rounded-2xl"><PainelEtapa slug={slug} etapa={etapa} dados={dados} /></div>`;
- arquivo: envolver `{arquivoAberto && (<VisualizadorArquivo … />)}` em `<div className="vidro h-full overflow-hidden rounded-2xl">…</div>` só quando `arquivoAberto` (o `&&` fica por fora do `div`).
- tela cheia: `<div className="fixed inset-0 z-40">{painelVisualizador}</div>` → `<div className="bg-background fixed inset-0 z-40">{painelVisualizador}</div>`.

- [ ] **Step 3: Biblioteca sobre as colunas**

Trocar `<div className="bg-background absolute inset-y-0 right-0 z-30 border-l" style={{ left: larguraTrilha }}>` por:

```tsx
          <div
            className="vidro bg-background/95 absolute inset-y-3 right-3 z-30 overflow-hidden rounded-2xl backdrop-blur-xl"
            // 12 px de borda externa + largura do card da trilha + 12 px da alça.
            style={{ left: larguraTrilha > 0 ? larguraTrilha + 24 : 12 }}
          >
```

- [ ] **Step 4: Visualizadores sem fundo próprio**

Nos três visualizadores, a `<section className="bg-background flex h-full min-h-0 flex-col" …>` passa a `<section className="flex h-full min-h-0 flex-col" …>` (o card de vidro, ou o `bg-background` da tela cheia, dá o fundo).

- [ ] **Step 5: Trilha**

Em `trilha-etapas.tsx`:
- remover o `Button` "Prospects" (voltar) e os imports `ArrowLeftIcon` e `Link` que ficarem sem uso;
- trocar `<h2 className="px-2 pt-2 pb-3 font-semibold">{estado.prospect.nome}</h2>` por:

```tsx
      <p className="text-muted-foreground px-2 pt-1 text-[10px] font-medium tracking-[0.14em] uppercase">Prospect</p>
      <h2 className="text-texto-forte px-2 pt-1 pb-3 text-base font-semibold tracking-tight">{estado.prospect.nome}</h2>
```

- nos dois títulos de seção ("Etapas" e "Arquivos"), `text-xs font-medium tracking-wide uppercase` → `text-[10px] font-medium tracking-[0.14em] uppercase`;
- etapa selecionada e biblioteca aberta: `"bg-muted font-medium"` → `"bg-accent text-texto-forte font-medium shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]"`;
- os botões de etapa ganham `rounded-lg text-muted-foreground` na `className` base (o selecionado sobrepõe com `text-texto-forte`).

- [ ] **Step 6: Typecheck, lint, testes e verificação de colunas**

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; testes passam.

Verificação (Review Focus 2): `npm run dev` em `src/`, abrir um prospect e conferir: arrastar as duas alças, recolher e expandir trilha e painel pelos botões do cabeçalho do chat, abrir um relatório (visualizador) e um arquivo na coluna direita, abrir a Biblioteca e a tela cheia do visualizador. Nada pode ficar sobreposto nem sem fundo.

- [ ] **Step 7: Commit**

```bash
git add src/apps/web/components/trabalho
git commit -m "feat(web): área de trabalho em cards de vidro com barra de topo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cores semânticas, papel do cliente e markdown

**Files:**
- Create: `src/apps/web/lib/paleta.test.ts`
- Modify: `src/apps/web/components/trabalho/icone-status.tsx`, `trabalho/painel-etapa.tsx`, `sistema/uso-assinatura.tsx`, `cards/previa-roteiro.tsx`, `cards/previa-arquivo.tsx`, `biblioteca/imagem-ampliada.tsx`, `trabalho/visualizador-html.tsx`, `trabalho/visualizador-arquivo.tsx`, `chat/item-conversa.tsx`, `markdown.tsx`

**Interfaces:**
- Consumes: tokens da Task 1; `Bubble` variante `tinted` (Task 4).

- [ ] **Step 1: Teste de paleta (falhando)**

Criar `src/apps/web/lib/paleta.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Cor de interface só por token: nada de paleta nomeada do Tailwind nem bg-white solto.
// O modo dev de comentários tem visual próprio e fica de fora.
const RAIZES = [
  path.resolve(import.meta.dirname, "../components"),
  path.resolve(import.meta.dirname, "../../../packages/ui/src/components"),
]
const IGNORAR = /[\\/]modo-dev[\\/]/
const PALETA =
  /\b(?:bg|text|border|ring|from|to|via|shadow|fill|stroke|outline|decoration|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\bbg-white\b/g

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) && !nome.endsWith(".test.ts") ? [caminho] : []
  })
}

describe("paleta da interface", () => {
  it("nenhum componente usa cor fora dos tokens", () => {
    const achados = RAIZES.flatMap(arquivos)
      .filter((f) => !IGNORAR.test(f))
      .flatMap((f) => [...readFileSync(f, "utf-8").matchAll(PALETA)].map((m) => `${path.basename(f)}: ${m[0]}`))
    expect(achados).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w web -- lib/paleta`
Expected: FAIL listando `icone-status.tsx: text-amber-500`, `painel-etapa.tsx: bg-amber-500`, `uso-assinatura.tsx: bg-amber-500`, `previa-roteiro.tsx: border-amber-500`, `bg-amber-500`, `text-amber-600`, `bg-white`, e os `bg-white` de `previa-arquivo`, `imagem-ampliada`, `visualizador-html`, `visualizador-arquivo` (×2).

- [ ] **Step 3: Status**

- `icone-status.tsx`: `concluida` → `text-sucesso`; `desatualizada` → `text-aviso`; `em_andamento`/`pronta` → `text-primary` (continua: é a etapa em curso).
- `painel-etapa.tsx`: `const COR = { pendente: "bg-amber-500", aprovado: "bg-primary", substituido: "bg-muted-foreground/40" }` → `{ pendente: "bg-aviso", aprovado: "bg-sucesso", substituido: "bg-muted-foreground/40" }`.
- `uso-assinatura.tsx`: `const COR = { ok: "bg-primary", alerta: "bg-amber-500", critico: "bg-destructive" }` → `{ ok: "bg-volume", alerta: "bg-aviso", critico: "bg-destructive" }`; a seção: `border-t px-2 pt-3` continua; o rótulo `text-xs font-medium tracking-wide uppercase` → `text-[10px] font-medium tracking-[0.14em] uppercase`.
- `previa-roteiro.tsx`: `border-amber-500/60 bg-amber-500/5` → `border-aviso/60 bg-aviso-fundo`; `text-amber-600` → `text-aviso`.

- [ ] **Step 4: Papel do cliente**

Trocar `bg-white` por `bg-papel` em: `previa-arquivo.tsx:49`, `previa-roteiro.tsx` (miniatura), `imagem-ampliada.tsx:89`, `visualizador-html.tsx` (iframe), `visualizador-arquivo.tsx` (img e iframe). Onde houver `rounded-md border`, manter.

- [ ] **Step 5: Mensagens do analista**

Em `item-conversa.tsx`: `<Bubble variant="default" align="end">` → `<Bubble variant="tinted" align="end">`; no botão de menção do `TextoComMencoes`, `bg-primary-foreground/15 hover:bg-primary-foreground/25` → `bg-foreground/8 hover:bg-foreground/15`.

- [ ] **Step 6: Markdown**

Em `markdown.tsx`, na string de classes:
- `[&_code]:font-mono [&_code]:text-xs` → `[&_code]:font-mono [&_code]:text-xs [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-vidro-interno [&_pre]:p-3`;
- `[&_th]:border` → `[&_th]:border [&_th]:bg-muted`; acrescentar `[&_td]:tabular-nums`;
- `[&_a]:underline` → `[&_a]:text-link-acao [&_a]:underline [&_a]:underline-offset-2`;
- acrescentar `[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-4`.

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -w web -- lib/paleta`
Expected: PASS.

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; todos os testes passam.

- [ ] **Step 8: Commit**

```bash
git add src/apps/web/lib/paleta.test.ts src/apps/web/components
git commit -m "feat(web): cores semânticas, papel do cliente e markdown no tema Boomer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Títulos de painel e status da etapa

**Files:**
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx` (cabeçalho do chat)
- Modify: `src/apps/web/components/trabalho/painel-etapa.tsx` (títulos de seção)

**Interfaces:**
- Consumes: tokens da Task 1.

- [ ] **Step 1: Ler os cabeçalhos atuais**

Run: `grep -n "<h2\|<h3\|text-xs font-medium tracking-wide uppercase" src/apps/web/components/trabalho/painel-etapa.tsx`
Expected: lista dos títulos de seção do painel (entregáveis, insumos).

- [ ] **Step 2: Títulos de seção no padrão do spec**

Em `painel-etapa.tsx`, cada título de seção passa a `className="text-sm font-semibold tracking-tight"` e a linha de apoio logo abaixo (quando houver) a `text-muted-foreground mt-0.5 text-xs`. Os rótulos em caixa alta (`text-xs font-medium tracking-wide uppercase`) passam a `text-[10px] font-medium tracking-[0.14em] uppercase`.

- [ ] **Step 3: Badge de status no cabeçalho do chat**

Em `area-de-trabalho.tsx`, `<Badge variant="secondary">{ROTULO_STATUS[estadoEtapa.status]}</Badge>` → `<Badge variant={estadoEtapa.status === "concluida" ? "sucesso" : estadoEtapa.status === "desatualizada" ? "aviso" : "secondary"}>{ROTULO_STATUS[estadoEtapa.status]}</Badge>`.

- [ ] **Step 4: Typecheck, lint, testes e commit**

Run: `npm run typecheck -w web && npm run lint -w web && npm test -w web`
Expected: sem erros; testes passam.

```bash
git add src/apps/web/components/trabalho
git commit -m "feat(web): títulos de painel e status no padrão Boomer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação visual nos dois temas

**Files:**
- Create (fora do repositório, no scratchpad da sessão): `capturas.mjs`

**Interfaces:**
- Consumes: tudo das Tasks 1–8.

- [ ] **Step 1: Script de capturas**

Criar `<scratchpad>/capturas.mjs` (Chrome headless via CDP, mesmo método do modo dev):

```js
// Uso: node capturas.mjs <porta-cdp> <url-base> <pasta-saida>
import { writeFileSync } from "node:fs"

const [porta, base, saida] = process.argv.slice(2)
const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
const ws = new WebSocket(alvos.find((a) => a.type === "page").webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener("open", r, { once: true }))
let seq = 0
const pend = new Map()
const avisos = []
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
    avisos.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200))
})
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const avaliar = async (e) => (await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
const foto = async (nome) => writeFileSync(`${saida}/${nome}.png`, Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).result.data, "base64"))

await cdp("Page.enable"); await cdp("Runtime.enable")
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await cdp("Page.navigate", { url: base }); await esperar(5000)
const prospect = await avaliar(`document.querySelector('a[href^="/prospects/"]')?.getAttribute("href")`)
console.log("prospect:", prospect)

for (const tema of ["dark", "light"]) {
  await avaliar(`localStorage.setItem("tema-boomer", "${tema}")`)
  for (const [nome, url] of [["inicio", base], ["trabalho", base.replace(/\/$/, "") + prospect]]) {
    await cdp("Page.navigate", { url }); await esperar(6000)
    console.log(tema, nome, "classe html:", await avaliar(`document.documentElement.className`))
    await foto(`${tema}-${nome}`)
  }
}
console.log("avisos do console:", avisos)
ws.close()
```

- [ ] **Step 2: Rodar as capturas**

Com `npm run dev` rodando em `src/` e o Chrome headless aberto com `--remote-debugging-port=9333`:

Run: `node <scratchpad>/capturas.mjs 9333 http://127.0.0.1:3000/ <scratchpad>`
Expected: 4 PNGs (`dark-inicio`, `dark-trabalho`, `light-inicio`, `light-trabalho`); a classe do `<html>` contém `dark` nas duas primeiras e `light` nas duas últimas; "avisos do console" sem erro de hidratação.

- [ ] **Step 3: Conferir contra o checklist**

Abrir as quatro capturas e conferir, item por item, o checklist do §9 da spec (fundo e brilhos, vidro, laranja só onde deve, verde/âmbar/rosa/azul, títulos, raios, ícones, barra de topo, papel branco). Anotar no ledger qualquer item fora e corrigir antes de seguir.

- [ ] **Step 4: Material do cliente**

No app, nos dois temas: abrir um gráfico na Biblioteca (imagem ampliada), um entregável do tipo gráfico no chat, um relatório HTML no visualizador e a prévia de slides. Todos legíveis, o material do cliente sobre papel branco e os slides sem moldura branca.

- [ ] **Step 5: Verificação final**

Run (em `src/`): `npm run typecheck && npm run lint && npm test`
Expected: tudo verde.

Se algum ajuste foi necessário nos Steps 3–4, commitar:

```bash
git add -A src/apps/web src/packages/ui
git commit -m "fix(web): ajustes da verificação visual do tema Boomer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
