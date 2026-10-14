# Identidade visual Boomer no app — Design

**Data:** 2026-10-13
**Status:** aprovado em brainstorming (maquete aprovada), aguardando revisão do documento
**Escopo:** uma spec. Aplicar a identidade visual Boomer (derivada do "Design Spec
do Dashboard / Growth Cockpit") à interface do app web (`src/apps/web` +
`src/packages/ui`), com tema escuro padrão e tema claro.

## 1. Objetivo

Hoje o app usa o tema cinza padrão do shadcn (`base-nova`, `neutral`), sem cor
de marca, logo ou barra de topo. O objetivo é que o analista trabalhe numa
interface com a cara da Boomer: fundo escuro azulado com brilhos difusos,
cards de vidro, Inter, laranja só no que importa e o logo no topo.

**Critérios de sucesso:**

- As duas telas (início e área de trabalho) seguem a maquete aprovada nos
  dois temas (§9).
- O app abre no tema escuro; o botão na barra de topo (ou a tecla "d") alterna
  para o claro, e a escolha fica lembrada.
- Nenhuma cor de interface fica fora da paleta desta spec; os ~12 usos de
  cor fixa (`amber-*`, etc.) passam a usar os tokens semânticos.
- O material do cliente (gráficos PNG, imagens, relatórios HTML, prévias de
  slides) continua aparecendo como é, em "papel" branco.
- Texto comum atinge contraste AA (4,5:1) nos dois temas; a única exceção
  aceita é a do §3.4.

**Fora do escopo:** entregáveis do cliente (PNG, PPTX, DOCX, XLSX, benchmark
HTML — seguem `padrao-visual.md` e o molde da agência); o modo dev de
comentários (visual próprio, só em desenvolvimento); KPIs e sparklines do
spec de origem (o app não tem dashboard).

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Temas | Escuro (padrão, fiel ao spec Boomer) + claro (laranja + azul-marinho do logo) |
| 2 | Tema inicial | Sempre escuro; o app deixa de seguir o tema do sistema operacional |
| 3 | Alternar | Botão na barra de topo + tecla "d" (já existe); escolha lembrada |
| 4 | Fonte | Inter (`next/font/google`) no lugar de Geist; Geist Mono continua para código |
| 5 | Logo | SVG enviado pelo usuário, duas versões (escuro e claro), em `public/marca/` |
| 6 | Laranja `#eb610a` | Só em: ação principal (botão primário), etapa atual, links de ação, foco |
| 7 | Material do cliente | Continua em "papel" branco dentro do card |
| 8 | Onde mudar cor | Tokens em `packages/ui/src/styles/globals.css`; componentes só usam tokens |
| 9 | Barra de topo | Componente novo, só com logo, nome da tela e botão de tema; nenhuma ação nova |

## 3. Tokens

### 3.1 Tokens shadcn (existentes, valores novos)

| Token | Escuro (`.dark`) | Claro (`:root`) |
|---|---|---|
| `--background` | `#070a12` | `#f5f6fa` |
| `--foreground` | `#f1f5f9` | `#1e293b` |
| `--card` | `rgb(255 255 255 / 0.035)` | `rgb(255 255 255 / 0.92)` |
| `--card-foreground` | `#f1f5f9` | `#1e293b` |
| `--popover` | `#0f1420` | `#ffffff` |
| `--popover-foreground` | `#f1f5f9` | `#1e293b` |
| `--primary` | `#eb610a` | `#eb610a` |
| `--primary-foreground` | `#ffffff` | `#ffffff` |
| `--secondary` | `rgb(255 255 255 / 0.06)` | `rgb(15 27 61 / 0.05)` |
| `--secondary-foreground` | `#f1f5f9` | `#1e293b` |
| `--muted` | `rgb(255 255 255 / 0.04)` | `rgb(15 27 61 / 0.04)` |
| `--muted-foreground` | `#94a3b8` | `#64748b` |
| `--accent` | `rgb(255 255 255 / 0.07)` | `rgb(15 27 61 / 0.06)` |
| `--accent-foreground` | `#ffffff` | `#0f1b3d` |
| `--destructive` | `#fb7185` | `#e11d48` |
| `--border` | `rgb(255 255 255 / 0.07)` | `rgb(15 27 61 / 0.08)` |
| `--input` | `rgb(255 255 255 / 0.10)` | `rgb(15 27 61 / 0.12)` |
| `--ring` | `rgb(235 97 10 / 0.5)` | `rgb(235 97 10 / 0.45)` |
| `--chart-1..3` | `#eb610a`, `#3987e5`, `#199e70` | iguais |
| `--chart-4..5` | `#94a3b8`, `#64748b` | iguais |
| `--sidebar-*` | alinhados a background/foreground/primary acima | idem |
| `--radius` | `0.5rem` | igual |

> Raios: hoje o `@theme inline` deriva a escala de `--radius` por
> multiplicação (sm 0,6× … 4xl 2,6×). Passa a fixar os valores do spec:
> `--radius-md: 6px` (chips), `--radius-lg: 8px` (itens internos),
> `--radius-xl: 12px` (controles), `--radius-2xl: 16px` (cards);
> `--radius-sm: 4px`, `--radius-3xl: 20px`, `--radius-4xl: 24px`. Assim
> `rounded-md/lg/xl/2xl` valem exatamente 6/8/12/16 px nos componentes.

### 3.2 Tokens novos (marca e semântica)

Definidos nos dois blocos e expostos no `@theme inline` como cores Tailwind
(`bg-sucesso`, `text-aviso`, etc.):

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--texto-forte` | `#ffffff` | `#0f1b3d` | Títulos de destaque, nome do prospect |
| `--sucesso` / `--sucesso-fundo` | `#34d399` / `rgb(16 185 129 / 0.10)` | `#047857` / `rgb(16 185 129 / 0.12)` | Aprovado, positivo |
| `--aviso` / `--aviso-fundo` | `#fbbf24` / `rgb(251 191 36 / 0.10)` | `#b45309` / `rgb(245 158 11 / 0.12)` | Pendente, desatualizado, alerta de uso |
| `--perigo-fundo` | `rgb(244 63 94 / 0.10)` | `rgb(225 29 72 / 0.10)` | Fundo de chip de erro (texto usa `--destructive`) |
| `--volume` | `#3987e5` | `#2563eb` | Barra de uso da assinatura |
| `--link-acao` | `#f0894a` | `#c2410c` | "Abrir na biblioteca →" e afins |
| `--papel` | `#ffffff` | `#ffffff` | Fundo do material do cliente |
| `--vidro-1` / `--vidro-2` | `rgb(255 255 255 / 0.035)` / `/ 0.01` | `rgb(255 255 255 / 0.92)` / `/ 0.72` | Gradiente dos cards |
| `--vidro-interno` | `rgb(0 0 0 / 0.25)` | `rgb(15 27 61 / 0.03)` | Caixas dentro de cards |
| `--sombra-card` | `0 1px 0 0 rgb(255 255 255 / .04) inset, 0 20px 40px -24px rgb(0 0 0 / .6)` | `0 1px 0 0 #fff inset, 0 18px 36px -26px rgb(15 27 61 / .28)` | Cards |
| `--orb-laranja` / `--orb-azul` / `--orb-verde` | `.09` / `.07` / `.05` | `.10` / `.08` / `.05` | Opacidade dos brilhos |
| `--pontos` / `--pontos-cor` | `.025` / `rgb(255 255 255 / .8)` | `.05` / `rgb(15 27 61 / .55)` | Grade de pontos |

### 3.3 Fonte

`Inter` via `next/font/google` com `variable: "--font-sans"` (substitui Geist).
`Geist_Mono` continua com `--font-mono`, e o `@theme inline` passa a mapear
`--font-mono` (hoje não mapeado). Números em destaque usam `tabular-nums`.

### 3.4 Exceção de contraste aceita

Texto branco sobre o laranja `#eb610a` dá ~3,4:1 — abaixo de 4,5:1 para texto
pequeno. O spec Boomer define exatamente essa combinação para o botão
primário, que usa `font-semibold` e gradiente `#f47a2a → #eb610a`. Fica como
exceção documentada, só para botão primário e chips de marca; nenhum texto
corrido usa essa combinação.

## 4. Temas

- `ThemeProvider` (`components/theme-provider.tsx`): `defaultTheme="dark"`,
  `enableSystem={false}`, `themes={["dark", "light"]}`,
  `storageKey="tema-boomer"`. A chave nova descarta o "system" gravado hoje
  no navegador, para todo mundo começar no escuro.
- `ThemeHotkey` (tecla "d") continua.
- Botão novo `AlternarTema` na barra de topo (ícone `Moon`/`Sun` do lucide,
  estilo botão secundário do spec), com `aria-label` "Mudar para tema claro" /
  "Mudar para tema escuro".
- `<Toaster>` segue o tema (já usa `useTheme`); `richColors` sai, para os
  toasts usarem popover/borda do tema com ícones nas cores semânticas.

## 5. Componentes

### 5.1 `packages/ui` (afeta o app inteiro)

- **Card:** vidro do spec — `rounded-2xl border border-border
  bg-linear-to-b from-(--vidro-1) to-(--vidro-2) shadow-(--sombra-card)
  backdrop-blur-sm` no lugar de `ring-1 ring-foreground/10 bg-card`;
  `transition hover:border-foreground/15` só quando o card é clicável (o
  componente não sabe; fica no `CardProspect`).
- **Button:** `default` vira o primário do spec — `bg-linear-to-b
  from-[#f47a2a] to-primary text-primary-foreground font-semibold
  shadow-lg shadow-orange-900/30 ring-1 ring-inset ring-white/20
  hover:brightness-110`; `outline`/`ghost`/`secondary` ficam no padrão
  "vidro" (`border-border bg-muted hover:bg-accent`). Raio `rounded-xl`.
- **Badge:** raio de chip (`rounded-md`), `font-semibold`; ganha variantes
  `sucesso`, `aviso`, `perigo` (texto do token + fundo do token `-fundo`).
- **Progress:** trilho `bg-muted`, preenchimento `bg-primary` com
  `transition-[width] duration-700 ease-out`.
- **Dialog / AlertDialog:** véu `bg-black/50 backdrop-blur-sm` (hoje
  `bg-black/10`, invisível no escuro); conteúdo usa `popover` + borda +
  `--sombra-card`.
- **Bubble:** as cores relativas ao `--primary` continuam; ajustar os
  coeficientes para chegar ao tom da maquete (escuro: fundo laranja ~14% com
  borda ~25%; claro: ~9% / ~22%).
- **Input / Textarea:** fundo `--vidro-interno`, borda `--input`, foco com
  `ring` laranja.
- **DropdownMenu, popovers:** `bg-popover` sólido (vidro translúcido sobre
  conteúdo fica ilegível).

### 5.2 `apps/web` — peças novas

- **`components/marca/fundo-boomer.tsx`:** camada fixa (`pointer-events-none
  fixed inset-0 -z-10 overflow-hidden`) com os três brilhos (laranja canto
  superior esquerdo, azul à direita a 1/3 da altura, verde embaixo a 1/3 da
  largura; `blur-[120px]`) e a grade de pontos de 22 px. Opacidades dos
  tokens §3.2. Montada no `layout.tsx`, antes do conteúdo.
- **`components/marca/logo-boomer.tsx`:** duas `<img>` (escuro e claro) com
  `dark:hidden` / `hidden dark:block`, para não haver troca visível na
  hidratação. Arquivos em `public/marca/boomer-logo-escuro.svg` e
  `boomer-logo-claro.svg`, copiados de
  `docs/superpowers/specs/assets/identidade-boomer/` com
  `viewBox="26 20 546 126"` acrescentado e `width/height` trocados por
  `546/126` (os originais não têm `viewBox` e trazem margem vazia).
  `alt="Boomer"`.
- **`components/marca/barra-topo.tsx`:** `sticky top-0 z-40 h-13
  border-b border-border bg-background/70 backdrop-blur-xl`; à esquerda o
  logo (altura 20 px, link para `/`), divisor vertical e o título; à direita
  `AlternarTema`. Recebe `titulo` e, opcionalmente, `subtitulo` (nome do
  prospect, em `muted-foreground`). Sem ações de etapa — elas continuam
  onde estão.

### 5.3 `apps/web` — telas

- **Início (`GradeProspects`):** usa `BarraTopo` com "Planejamento
  estratégico"; o `<header>` atual fica só com busca e "Novo prospect"
  (o h1 "Planejamentos estratégicos" vira título da faixa de contexto, no
  estilo eyebrow + título do spec). `CardProspect` ganha `hover:border-
  foreground/15`.
- **Área de trabalho (`AreaDeTrabalho`):** `BarraTopo` com "Planejamento
  estratégico" + `subtitulo` = nome do prospect; altura das colunas passa a
  `calc(100dvh - 3.25rem)`. Trilha, chat e painel viram cards de vidro com
  `gap` de 12 px e padding externo de 12 px; os `ResizableHandle` continuam
  funcionando no espaço entre os cards (sem a linha visível). O link
  "voltar" e o nome do prospect saem da trilha (o logo leva ao início e o
  nome está na barra), e a trilha ganha o eyebrow "PROSPECT" + nome em
  `--texto-forte`, como na maquete.
- **Trilha (`TrilhaEtapas`):** etapa ativa em pílula (`bg-accent` +
  highlight inset); etapa atual com anel laranja; concluídas com ícone em
  `--sucesso`.
- **Status (`IconeStatus`, `PainelEtapa`, `UsoAssinaturaBarra`,
  `PreviaRoteiro`):** `amber-*` → `aviso`; `bg-primary` de "aprovado" →
  `sucesso`; barra de uso: ok `--volume`, alerta `--aviso`, crítico
  `--destructive`.
- **Cabeçalhos de painel:** caixinha de ícone do spec (`size-8 rounded-lg
  bg-muted ring-1 ring-border`, ícone lucide 16 px em `muted-foreground`)
  onde hoje há ícone solto.
- **Links de ação** ("Abrir…", "Ver…"): `text-link-acao`.

### 5.4 Material do cliente ("papel")

Continuam com fundo branco: `previa-arquivo.tsx`, `visualizador-html.tsx`
(iframe), `visualizador-arquivo.tsx` (img e iframe),
`biblioteca/imagem-ampliada.tsx`, `card-imagem.tsx`, miniaturas de
`previa-roteiro.tsx`. Troca `bg-white` por `bg-papel rounded-lg ring-1
ring-border` para padronizar. As prévias de slide (`visualizador-
apresentacao.tsx`) já são escuras e ficam como estão.

### 5.5 Markdown (`components/markdown.tsx`)

- `code` inline: `rounded-md bg-muted px-1 py-0.5`.
- `pre`: `rounded-lg bg-(--vidro-interno) border border-border p-3
  overflow-x-auto`.
- Tabelas: cabeçalho `bg-muted`, bordas `border-border`, `tabular-nums` nas
  células.
- `blockquote`: borda esquerda `border-primary/40`, texto
  `muted-foreground`.
- Links: `text-link-acao underline-offset-2`.

## 6. Dados e estado

Nenhum dado novo. O único estado é a escolha de tema, gravada pelo
`next-themes` no `localStorage` com a chave `tema-boomer`.

## 7. Erros e casos de borda

| Situação | Comportamento |
|---|---|
| `localStorage` indisponível | `next-themes` cai no padrão (escuro) |
| Primeira visita | Escuro |
| Valor antigo "system" gravado | Ignorado (chave nova) |
| PNG transparente do cliente | Legível: fica sobre `--papel` branco |
| Relatório HTML com fundo próprio | Iframe continua sobre papel branco; o HTML pinta o próprio fundo |
| Menu ou popover sobre conteúdo | Fundo sólido `popover`, nunca vidro translúcido |
| Navegador sem `backdrop-filter` | Cards ficam com o gradiente translúcido, sem desfoque; continua legível |

## 8. Testes e verificação

- **Contraste (vitest):** `lib/contraste.test.ts` lê os tokens de
  `globals.css` (os dois temas) e verifica ≥ 4,5:1 para os pares de texto:
  `foreground`/`background`, `muted-foreground`/`background`,
  `foreground` e `muted-foreground` sobre o card composto com o fundo,
  `popover-foreground`/`popover`, `sucesso`, `aviso` e `destructive` sobre
  os respectivos `-fundo` compostos com o card; `link-acao`/`background`.
  `primary-foreground`/`primary` é verificado contra ≥ 3:1 (exceção §3.4).
- **Tema (vitest + jsdom ou unidade):** `AlternarTema` troca entre "dark" e
  "light" e mostra o rótulo certo.
- **Typecheck, lint e testes** existentes verdes.
- **Visual:** capturas automatizadas (Chrome headless, mesmo método do modo
  dev) da home e da área de trabalho de um prospect de teste, nos dois
  temas, conferidas contra a maquete aprovada e o checklist do §9.
- **Material do cliente:** abrir um gráfico na biblioteca, um relatório HTML
  e a prévia de slides nos dois temas.

## 9. Checklist visual (adaptado do spec Boomer)

1. Escuro: fundo `#070a12` + 3 brilhos + pontos a 2,5%. Claro: `#f5f6fa` +
   brilhos mais fracos + pontos a 5%.
2. Todo card = vidro (gradiente, borda, highlight inset de 1 px, sombra longa).
3. Laranja só em: botão primário, etapa atual, links de ação, foco.
4. Verde = aprovado; âmbar = pendente; rosa = erro; azul = volume.
5. Títulos `font-semibold tracking-tight`; rótulos pequenos em
   `muted-foreground`; `tabular-nums` em números.
6. Raios: 16 (cards) / 12 (controles) / 8 (itens) / 6 (chips).
7. Ícones lucide neutros, 16 px; em cabeçalho de painel, dentro da caixinha.
8. Barra de topo translúcida com `backdrop-blur-xl` e linha inferior.
9. Material do cliente sempre em papel branco.
10. Interface em PT-BR (já é).

## 10. Referências

- Spec de origem: "Boomer · Design Spec do Dashboard (Growth Cockpit)",
  enviado pelo usuário em 2026-10-13 (tokens, fundo, componentes,
  tipografia).
- Maquete aprovada: `.superpowers/brainstorm/82717-1791937013/content/
  temas-area-de-trabalho.html` (local, fora do git).
- Logos: `docs/superpowers/specs/assets/identidade-boomer/`.
