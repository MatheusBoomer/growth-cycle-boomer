# Interface do Planejamento Estratégico — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o protótipo local da interface web (estilo Cowork) que conduz as etapas 01–08 + apresentação final do planejamento estratégico, com cards de aprovação, cards de insumo e liberação automática de etapas, rodando o Claude Code headless com a assinatura do analista.

**Architecture:** Um pacote de domínio em TypeScript (`@workspace/core`) concentra catálogo de etapas, máquina de estados, armazenamento em disco, dossiê, executor do agente e os serviços que orquestram tudo; ele não sabe nada de Next. O app Next.js (`src/apps/web`) só expõe rotas finas sobre esses serviços e a UI em shadcn (Base UI). O agente é o `claude -p` em stream-json, com um servidor MCP próprio (`@workspace/mcp-planejamento`) cujas ferramentas viram cards, e um hook que bloqueia escrita fora da pasta do prospect.

**Tech Stack:** Next.js 16.3 (App Router, route handlers, SSE), React 19, shadcn `base-nova` (Base UI) + Tailwind 4, TypeScript 5, Vitest 5, Node ≥ 22.18 (roda `.ts` direto por type stripping), `@modelcontextprotocol/sdk` 1.x + zod 4, `trash` 10, `react-markdown` + `remark-gfm`, Python 3.9+ com openpyxl/pandas/matplotlib + pytest, Claude Code CLI ≥ 2.1.

**Spec:** `docs/superpowers/specs/2026-09-28-interface-planejamento-design.md`

## Global Constraints

- Todos os comandos npm rodam **dentro de `src/`** (workspaces npm, `packageManager: npm@11`). Comandos Python e git rodam na **raiz do projeto**.
- Node ≥ 22.18 (a máquina tem 26.x): o servidor MCP e o hook rodam como `node arquivo.ts` sem build. Nesses dois arquivos use só sintaxe TypeScript apagável (sem `enum`, sem parameter properties, sem namespaces) e importe com extensão.
- Python: compatível com 3.9 — `from __future__ import annotations`, sem `match`, sem `X | Y` fora de anotações.
- Next.js 16.3 **não é o Next que você conhece**: antes de escrever rota ou página, leia `src/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` e `.../03-layouts-and-pages.md`. `params` é `Promise`; use os helpers globais `RouteContext<'/rota/[x]'>` e `PageProps<'/rota/[x]'>`.
- shadcn é `base-nova` (Base UI): composição por `render={<Button />}`, nunca `asChild`; quando `render` vira elemento não-botão, passe `nativeButton={false}`. Adicione componentes com `npx shadcn@latest add <nomes> -c apps/web` a partir de `src/` (eles caem em `src/packages/ui/src/components/`). Leia `.agents/skills/shadcn/rules/*.md` antes de compor UI.
- Chat usa `MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker` do shadcn (ver `.agents/skills/shadcn/rules/chat.md`) — nunca contêiner de scroll feito à mão.
- Texto da UI em pt-BR. Mensagens ao analista nunca citam caminho interno de arquivo, exceto nomes finais de entregáveis e downloads.
- O agente nunca grava fora de `clientes/<slug>/`, nunca em `entrega/ativos-aprovados/`, nunca em `.app/` fora de `.app/rascunhos/`. Só o app grava `entrega/ativos-aprovados/`, `.app/estado.json`, `.app/conversas/`, `.app/propostas/` e `contexto/status-planejamento.md`.
- Nome de entregável aprovado é estável, sem versão (`-v2`, `-final`…); uma nova aprovação sobrescreve a anterior no mesmo caminho.
- PII: nunca registrar, logar ou devolver ao usuário valores de CPF, e-mail, telefone, endereço ou cartão — mensagens de validação citam só coluna e número de linha.
- Dados de prospects reais nunca entram no git (`.gitignore` da raiz já exclui `clientes/*` exceto `_template/` e `clientes/**/.app/`).
- O executor v1 remove `ANTHROPIC_API_KEY` do ambiente do processo filho — o protótipo usa a assinatura logada no Claude Code.
- O servidor de desenvolvimento escuta só em `127.0.0.1` (dados de prospect e ações de exclusão não podem ficar expostos na rede local).
- Commit ao fim de cada tarefa, com a linha `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` no fim da mensagem.

## Review Focus

- **Nome de prospect só com símbolos ou acentos** (`"!!!"`, `"Ção"`, `"Iszi Cosméticos"`): o slug sai correto ou vira erro claro "precisa ter pelo menos uma letra ou número" — nunca uma pasta vazia ou `clientes/`. Testes na Task 1 e na Task 11.
- **Caminhos com espaço** (a raiz real é `.../Projetos Boomer/...`): o comando do hook e o `--mcp-config` precisam funcionar com espaço no caminho. Testes na Task 12 (aspas no comando) e na Task 13 (hook executado de uma pasta com espaço).
- **`arquivo_rascunho` em formatos variados** vindos do agente (absoluto, relativo à raiz `clientes/<slug>/...`, relativo ao prospect, `../` escapando, fora de `.app/rascunhos/`): normalizado ou recusado com mensagem que o agente entende. Teste na Task 11.
- **Duas ações simultâneas no mesmo prospect** (o agente chama uma ferramenta enquanto o analista clica em Aprovar): nenhuma atualização do `estado.json` se perde. Teste na Task 11.
- **App fechado ou processo morto no meio de um turno**: ao reabrir, o chat mostra "Resposta interrompida" com "Tentar de novo", nunca "Pensando…" para sempre. Teste na Task 11.

---

## Estrutura de arquivos

```
.claude/skills/_shared/
  etapas.json                         # NOVO — catálogo de etapas e insumos (Task 2)
  modelos-insumo/README.md            # NOVO — onde colocar os modelos oficiais (Task 10)
  modelos-insumo/schemas.json         # NOVO — regras do validador por insumo (Task 10)
  regras-de-validacao.md              # MOD — Regra 6 estendida + Regra 7 (Task 20)
.claude/skills/06-briefing-e-benchmark/SKILL.md   # MOD (Task 20)
.claude/skills/08-plano-de-acao/SKILL.md          # MOD (Task 20)
clientes/_template/contexto/decisoes/README.md    # NOVO (Task 20)
scripts/validar_insumo.py              # NOVO (Task 10)
scripts/tests/test_validar_insumo.py   # NOVO (Task 10)
README.md, CLAUDE.md                   # MOD (Task 20)

src/package.json, src/turbo.json       # MOD — script/tarefa "test" (Task 1)
src/packages/core/                     # NOVO — domínio, sem Next
  package.json, tsconfig.json, vitest.config.ts, eslint.config.js
  src/tipos.ts            # tipos compartilhados (seguro para o cliente)
  src/erros.ts            # erros de domínio com status HTTP
  src/slug.ts             # normalizarSlug (seguro para o cliente)
  src/catalogo.ts         # carregar/validar etapas.json, navegação entre etapas
  src/maquina-estados.ts  # transições de etapa, condições do Concluir, cascata
  src/entregaveis.ts      # propor/aprovar/ajustar, destino aprovado (seguro para o cliente)
  src/insumos.ts          # registro de insumo, destino, extensão
  src/status-md.ts        # render e importação do status-planejamento.md
  src/armazenamento.ts    # FsArmazenamento (pasta clientes/)
  src/dossie.ts           # overrides do prospect + dossiê
  src/prompts.ts          # system prompt do modo interface, prompt inicial, mensagens automáticas
  src/validador.ts        # wrapper do scripts/validar_insumo.py
  src/barramento.ts       # pub/sub em memória por prospect
  src/atividade.ts        # texto amigável para cada ferramenta que o agente usa
  src/servico-planejamento.ts  # orquestra estado, arquivos, ferramentas MCP
  src/servico-turnos.ts        # roda turnos do agente, fila automática, tokens
  src/executor/tipos.ts, stream-json.ts, claude-cli.ts, fake.ts
  test/…                  # Vitest
src/packages/mcp-planejamento/         # NOVO — processos que o `claude` inicia
  package.json, vitest.config.ts
  src/servidor.ts         # servidor MCP stdio (repassa ao app)
  src/hook-escrita.ts     # hook PreToolUse de escrita
  test/hook-escrita.test.ts
src/apps/web/
  package.json, next.config.ts         # MOD (Task 14)
  app/layout.tsx, app/page.tsx         # MOD (Task 16)
  app/prospects/[slug]/page.tsx        # NOVO (Task 17)
  app/api/…                            # NOVO — rotas (Tasks 14–15)
  lib/servidor.ts, lib/http.ts, lib/api.ts
  hooks/use-area-de-trabalho.ts
  components/markdown.tsx
  components/home/*, components/sistema/*, components/trabalho/*, components/chat/*, components/cards/*
```

---

### Task 1: Pacote `@workspace/core` e normalização de slug

**Files:**
- Create: `src/packages/core/package.json`, `src/packages/core/tsconfig.json`, `src/packages/core/vitest.config.ts`, `src/packages/core/eslint.config.js`
- Create: `src/packages/core/src/slug.ts`
- Test: `src/packages/core/test/slug.test.ts`
- Modify: `src/package.json` (script `test`), `src/turbo.json` (tarefa `test`)

**Interfaces:**
- Consumes: nada.
- Produces: `normalizarSlug(nome: string): string` em `@workspace/core/slug`. Pacote exporta `"./*": "./src/*.ts"` e `"./executor/*": "./src/executor/*.ts"`.

- [ ] **Step 1: Criar o pacote**

`src/packages/core/package.json`:

```json
{
  "name": "@workspace/core",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint"
  },
  "dependencies": {
    "trash": "^10.1.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@workspace/eslint-config": "*",
    "@workspace/typescript-config": "*",
    "eslint": "^9",
    "typescript": "^5",
    "vitest": "^5"
  },
  "exports": {
    "./*": "./src/*.ts",
    "./executor/*": "./src/executor/*.ts"
  }
}
```

`src/packages/core/tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "types": ["node"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`src/packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
  },
})
```

`src/packages/core/eslint.config.js`:

```js
import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default config
```

Em `src/package.json`, adicionar em `scripts`: `"test": "turbo test"`. Em `src/turbo.json`, adicionar em `tasks`: `"test": {}`.

Rodar: `cd src && npm install`
Expected: instala vitest e trash sem erro.

- [ ] **Step 2: Escrever o teste que falha**

`src/packages/core/test/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { normalizarSlug } from "../src/slug"

describe("normalizarSlug", () => {
  it.each([
    ["Iszi Cosméticos", "iszi-cosmeticos"],
    ["  Adda  ", "adda"],
    ["Sottile & Jalecos", "sottile-jalecos"],
    ["Ção--Teste", "cao-teste"],
    ["Loja 123!", "loja-123"],
    ["Marca_Nova  Brasil", "marca-nova-brasil"],
    ["!!!", ""],
    ["🚀", ""],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarSlug(entrada)).toBe(esperado)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/slug.test.ts`
Expected: FAIL — `Cannot find module '../src/slug'`.

- [ ] **Step 4: Implementar**

`src/packages/core/src/slug.ts`:

```ts
/** Mesmas regras da skill criar-prospect: minúsculo, sem acento, espaço vira hífen. */
export function normalizarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run test/slug.test.ts`
Expected: PASS (8 testes). Note: `"Sottile & Jalecos"` vira `sottile--jalecos` antes do colapso de hífens — o `replace(/-+/g, "-")` resolve.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core src/package.json src/turbo.json src/package-lock.json
git commit -m "feat(core): cria pacote de domínio e normalização de slug

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tipos, erros e catálogo de etapas

**Files:**
- Create: `.claude/skills/_shared/etapas.json`
- Create: `src/packages/core/src/tipos.ts`, `src/packages/core/src/erros.ts`, `src/packages/core/src/catalogo.ts`
- Create: `src/packages/core/test/ajuda.ts`
- Test: `src/packages/core/test/catalogo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (usado por todas as tarefas seguintes):
  - `tipos.ts`: `ORDEM_ETAPAS`, `EtapaId`, `StatusEtapa`, `TIPOS_ENTREGAVEL`, `TipoEntregavel`, `InsumoCatalogo`, `RefInsumo`, `EtapaCatalogo`, `Catalogo`, `EstadoEtapa`, `StatusEntregavel`, `Entregavel`, `StatusInsumo`, `EstadoInsumo`, `ItemFila`, `Estado`, `EventoConversa`, `EventoTempoReal`, `ResultadoValidacao`, `ResumoProspect`, `RespostaEstado` (formas exatas abaixo).
  - `erros.ts`: `ErroDominio(message, codigo, status)`, `TransicaoInvalida`, `ErroProspectExistente(slug)`, `ErroTurnoAtivo`, `ErroEntrada`, `ErroCaminhoForaDoProspect(caminho)`, `ErroNaoEncontrado`, `ehErroDominio(e): e is ErroDominio`.
  - `catalogo.ts`: `CAMINHO_CATALOGO`, `carregarCatalogo(raiz): Catalogo`, `validarCatalogo(c): void`, `etapaDoCatalogo(c, id): EtapaCatalogo`, `insumoDoCatalogo(c, id): InsumoCatalogo`, `etapaAnterior(id): EtapaId | null`, `proximaEtapa(id): EtapaId | null`.
  - `test/ajuda.ts`: `RAIZ` (raiz do projeto), `catalogoReal()`.

- [ ] **Step 1: Escrever o catálogo**

`.claude/skills/_shared/etapas.json` (o "Antes de começar" de cada skill e este arquivo descrevem a mesma exigência — mudou um, muda o outro):

```json
{
  "etapas": [
    {
      "id": "01",
      "numero": "01",
      "titulo": "Preparação de contexto",
      "rotuloStatus": "01 · Preparação de contexto",
      "descricao": "Limpa a transcrição do kickoff e os materiais pré-reunião, separando o que é conteúdo de negócio do que é ruído de reunião.",
      "skill": "01-preparacao-de-contexto",
      "insumos": [
        { "id": "kickoff-transcricao", "obrigatorio": true },
        { "id": "formulario-cliente", "obrigatorio": false },
        { "id": "site", "obrigatorio": true }
      ]
    },
    {
      "id": "02",
      "numero": "02",
      "titulo": "Contextualização estratégica",
      "rotuloStatus": "02 · Contextualização estratégica",
      "descricao": "Constrói o entendimento do negócio — modelo, produto, público, posicionamento, hipóteses e gargalos — antes de qualquer número.",
      "skill": "02-contextualizacao-estrategica",
      "insumos": []
    },
    {
      "id": "03",
      "numero": "03",
      "titulo": "Diagnóstico de performance",
      "rotuloStatus": "03 · Diagnóstico de performance",
      "descricao": "Analisa 12 meses de mídia paga, receita, sessões, conversão e a Curva ABC de produtos, com gráficos conferidos um a um.",
      "skill": "03-diagnostico-performance",
      "insumos": [
        { "id": "historico-mensal", "obrigatorio": true },
        { "id": "produtos-curva-abc", "obrigatorio": false }
      ]
    },
    {
      "id": "04",
      "numero": "04",
      "titulo": "Unidade econômica",
      "rotuloStatus": "04 · Unidade econômica",
      "descricao": "Calcula CAC, LTV histórico e a relação LTV/CAC a partir do histórico de vendas por cliente.",
      "skill": "04-unidade-economica",
      "insumos": [{ "id": "clientes-historico", "obrigatorio": true }]
    },
    {
      "id": "05",
      "numero": "05",
      "titulo": "Metas e cenários",
      "rotuloStatus": "05 · Metas e cenários",
      "descricao": "Define a meta, quebra mês a mês pela sazonalidade real e monta os cenários Pessimista, Realista e Otimista.",
      "skill": "05-metas-e-cenarios",
      "insumos": []
    },
    {
      "id": "06",
      "numero": "06",
      "titulo": "Briefing e benchmark",
      "rotuloStatus": "06 · Briefing e benchmark",
      "descricao": "Consolida o briefing do planejamento e pesquisa os concorrentes.",
      "skill": "06-briefing-e-benchmark",
      "insumos": []
    },
    {
      "id": "07",
      "numero": "07",
      "titulo": "Mídia paga",
      "rotuloStatus": "07 · Mídia paga",
      "descricao": "Planeja verba por plataforma, estratégia por Curva ABC, calendário anual, ROAS esperado e redução de dependência.",
      "skill": "07-midia-paga",
      "insumos": [{ "id": "prints-campanhas", "obrigatorio": false }]
    },
    {
      "id": "08",
      "numero": "08",
      "titulo": "Plano de ação",
      "rotuloStatus": "08 · Plano de ação",
      "descricao": "Organiza tudo o que foi proposto num plano de ação priorizado, com responsável, prazo e forma de execução.",
      "skill": "08-plano-de-acao",
      "insumos": []
    },
    {
      "id": "final",
      "numero": "",
      "titulo": "Apresentação final",
      "rotuloStatus": "Apresentação final",
      "descricao": "Monta a apresentação no Canva a partir de tudo o que foi aprovado.",
      "skill": null,
      "insumos": []
    }
  ],
  "insumos": [
    {
      "id": "kickoff-transcricao",
      "nome": "Transcrição do kickoff",
      "descricao": "Transcrição bruta da reunião de kickoff, do jeito que saiu da ferramenta de gravação.",
      "instrucao": "Não precisa limpar nada: a limpeza é o trabalho desta etapa.",
      "tipo": "arquivo",
      "formatos": [".docx", ".pdf", ".md", ".txt"],
      "modelo": null,
      "destino": "contexto/brutos/kickoff-transcricao-bruta",
      "validador": null,
      "sensivel": false
    },
    {
      "id": "formulario-cliente",
      "nome": "Formulário pré-kickoff",
      "descricao": "Formulário que o prospect respondeu antes da reunião, se existir.",
      "instrucao": "Opcional. Envie em Word ou PDF.",
      "tipo": "arquivo",
      "formatos": [".docx", ".pdf", ".md"],
      "modelo": null,
      "destino": "contexto/brutos/formulario-cliente",
      "validador": null,
      "sensivel": false
    },
    {
      "id": "site",
      "nome": "Site / e-commerce",
      "descricao": "Link da versão pública do site do prospect.",
      "instrucao": "Use o endereço completo, começando com https://",
      "tipo": "link",
      "formatos": [],
      "modelo": null,
      "destino": "contexto/site-referencia.md",
      "validador": null,
      "sensivel": false
    },
    {
      "id": "historico-mensal",
      "nome": "Histórico mensal — últimos 12 meses",
      "descricao": "Investimento, receita captada e aprovada, ROAS, sessões e conversão, quebrados por Google e Meta.",
      "instrucao": "Preencha só as colunas marcadas como “Preench. Manual”; as de fórmula calculam sozinhas.",
      "tipo": "arquivo",
      "formatos": [".xlsx"],
      "modelo": "historico-mensal.xlsx",
      "destino": "dados/historico-mensal",
      "validador": "historico-mensal",
      "sensivel": false
    },
    {
      "id": "produtos-curva-abc",
      "nome": "Relatório de produtos vendidos no ano",
      "descricao": "Faturamento por produto no período, usado na Curva ABC.",
      "instrucao": "Exporte da plataforma do e-commerce e mantenha os nomes das colunas do modelo.",
      "tipo": "arquivo",
      "formatos": [".xlsx"],
      "modelo": "produtos-curva-abc.xlsx",
      "destino": "dados/produtos-curva-abc",
      "validador": "produtos-curva-abc",
      "sensivel": false
    },
    {
      "id": "clientes-historico",
      "nome": "Histórico de vendas por cliente",
      "descricao": "Uma linha por cliente, com o maior histórico possível: ID ou nome, número de pedidos e valor total gasto.",
      "instrucao": "Antes de enviar, apague CPF, e-mail, telefone, endereço e dados de cartão.",
      "tipo": "arquivo",
      "formatos": [".xlsx"],
      "modelo": "clientes-historico.xlsx",
      "destino": "dados/clientes-historico",
      "validador": "clientes-historico",
      "sensivel": true
    },
    {
      "id": "prints-campanhas",
      "nome": "Prints das campanhas",
      "descricao": "Prints das plataformas de anúncio, para a análise de estrutura de campanha.",
      "instrucao": "Opcional. Pode enviar vários arquivos.",
      "tipo": "arquivo",
      "formatos": [".png", ".jpg", ".jpeg", ".pdf"],
      "modelo": null,
      "destino": "contexto/brutos/prints-campanhas/",
      "validador": null,
      "sensivel": false
    }
  ]
}
```

- [ ] **Step 2: Tipos e erros**

`src/packages/core/src/tipos.ts` (sem nenhum import — é importado por componentes cliente):

```ts
export const ORDEM_ETAPAS = ["01", "02", "03", "04", "05", "06", "07", "08", "final"] as const
export type EtapaId = (typeof ORDEM_ETAPAS)[number]

export type StatusEtapa =
  | "bloqueada"
  | "liberada"
  | "em_andamento"
  | "pronta"
  | "concluida"
  | "desatualizada"

export const TIPOS_ENTREGAVEL = ["grafico", "tabela", "secao", "planilha", "documento", "html"] as const
export type TipoEntregavel = (typeof TIPOS_ENTREGAVEL)[number]

export interface InsumoCatalogo {
  id: string
  nome: string
  descricao: string
  instrucao: string
  tipo: "arquivo" | "link"
  formatos: string[]
  modelo: string | null
  /** Sem extensão (o app acrescenta a do arquivo enviado); termina em "/" quando é pasta. */
  destino: string
  validador: string | null
  sensivel: boolean
}

export interface RefInsumo {
  id: string
  obrigatorio: boolean
}

export interface EtapaCatalogo {
  id: EtapaId
  numero: string
  titulo: string
  rotuloStatus: string
  descricao: string
  skill: string | null
  insumos: RefInsumo[]
}

export interface Catalogo {
  etapas: EtapaCatalogo[]
  insumos: InsumoCatalogo[]
}

export interface EstadoEtapa {
  status: StatusEtapa
  sessionId: string | null
  iniciadaEm: string | null
  concluidaEm: string | null
  /** O agente chamou sinalizar_etapa_pronta desde a última mensagem do analista. */
  sinalizada: boolean
  resumoDecisoes: string | null
  handoff: string | null
  origem: "app" | "terminal"
  observacao: string | null
}

export type StatusEntregavel = "pendente" | "aprovado" | "substituido"

export interface Entregavel {
  id: string
  etapa: EtapaId
  tipo: TipoEntregavel
  titulo: string
  /** Cópia congelada em .app/propostas/<id><ext>, relativa à pasta do prospect. */
  arquivoRascunho: string
  nomeFinal: string
  status: StatusEntregavel
  ajustePedido: string | null
  criadoEm: string
  decididoEm: string | null
}

export type StatusInsumo = "pendente" | "invalido" | "valido"

export interface EstadoInsumo {
  etapa: EtapaId
  insumoId: string
  status: StatusInsumo
  problemas: string[]
  avisos: string[]
  resumo: string | null
  /** Relativo à pasta do prospect. */
  arquivo: string | null
  atualizadoEm: string
}

export interface ItemFila {
  etapa: EtapaId
  texto: string
}

export interface Estado {
  versao: 1
  prospect: { slug: string; nome: string; site: string | null; criadoEm: string }
  etapas: Record<EtapaId, EstadoEtapa>
  entregaveis: Entregavel[]
  insumos: EstadoInsumo[]
  filaAutomatica: ItemFila[]
  atualizadoEm: string
}

export type EventoConversa =
  | { tipo: "turno_inicio"; em: string }
  | { tipo: "mensagem_analista"; texto: string; automatica: boolean; em: string }
  | { tipo: "texto_agente"; texto: string; em: string }
  | { tipo: "atividade"; nome: string; detalhe: string; em: string }
  | { tipo: "card_entregavel"; entregavelId: string; em: string }
  | { tipo: "card_insumo"; insumoId: string; em: string }
  | { tipo: "aviso"; nivel: "info" | "alerta" | "erro"; texto: string; em: string }
  | { tipo: "turno_fim"; status: "ok" | "interrompido" | "erro"; detalhe: string | null; em: string }

export type EventoTempoReal =
  | { tipo: "delta"; etapa: EtapaId; texto: string }
  | { tipo: "conversa"; etapa: EtapaId; evento: EventoConversa }
  | { tipo: "estado" }
  | { tipo: "turno"; etapa: EtapaId; ativo: boolean }

export interface ResultadoValidacao {
  ok: boolean
  problemas: string[]
  avisos: string[]
  resumo: string | null
}

export interface ResumoProspect {
  slug: string
  nome: string
  etapaAtual: EtapaId | null
  rotuloEtapaAtual: string
  concluidas: number
  totalEtapas: number
  pendencias: number
  atualizadoEm: string
}

export interface RespostaEstado {
  estado: Estado
  catalogo: Catalogo
  condicoes: Record<EtapaId, string[]>
  turnoAtivo: EtapaId | null
  modelosDisponiveis: string[]
}
```

`src/packages/core/src/erros.ts`:

```ts
export class ErroDominio extends Error {
  readonly codigo: string
  readonly status: number
  constructor(message: string, codigo: string, status: number) {
    super(message)
    this.name = new.target.name
    this.codigo = codigo
    this.status = status
  }
}

export class TransicaoInvalida extends ErroDominio {
  constructor(message: string) {
    super(message, "transicao_invalida", 409)
  }
}

export class ErroProspectExistente extends ErroDominio {
  readonly slug: string
  constructor(slug: string) {
    super(`Já existe um prospect "${slug}".`, "prospect_existente", 409)
    this.slug = slug
  }
}

export class ErroTurnoAtivo extends ErroDominio {
  constructor() {
    super("O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.", "turno_ativo", 409)
  }
}

export class ErroEntrada extends ErroDominio {
  constructor(message: string) {
    super(message, "entrada_invalida", 400)
  }
}

export class ErroCaminhoForaDoProspect extends ErroDominio {
  constructor(caminho: string) {
    super(`Caminho fora da pasta do prospect: ${caminho}`, "caminho_fora", 400)
  }
}

export class ErroNaoEncontrado extends ErroDominio {
  constructor(message: string) {
    super(message, "nao_encontrado", 404)
  }
}

/** Checagem por forma, não por instanceof: o Next pode carregar este módulo mais de uma vez. */
export function ehErroDominio(e: unknown): e is ErroDominio {
  return (
    e instanceof Error &&
    typeof (e as ErroDominio).codigo === "string" &&
    typeof (e as ErroDominio).status === "number"
  )
}
```

- [ ] **Step 3: Escrever o teste do catálogo**

`src/packages/core/test/ajuda.ts`:

```ts
import { fileURLToPath } from "node:url"
import { carregarCatalogo } from "../src/catalogo"

/** Raiz do projeto de planejamento (src/packages/core/test → ../../../../). */
export const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url))

export function catalogoReal() {
  return carregarCatalogo(RAIZ)
}
```

`src/packages/core/test/catalogo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { etapaAnterior, etapaDoCatalogo, insumoDoCatalogo, proximaEtapa, validarCatalogo } from "../src/catalogo"
import type { Catalogo } from "../src/tipos"
import { catalogoReal } from "./ajuda"

describe("catálogo", () => {
  it("carrega o etapas.json real com as 9 etapas na ordem", () => {
    const c = catalogoReal()
    expect(c.etapas.map((e) => e.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "final"])
    expect(etapaDoCatalogo(c, "03").skill).toBe("03-diagnostico-performance")
    expect(insumoDoCatalogo(c, "clientes-historico").sensivel).toBe(true)
  })

  it("recusa etapa referenciando insumo inexistente", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas[0]!.insumos.push({ id: "nao-existe", obrigatorio: true })
    expect(() => validarCatalogo(c)).toThrow(/nao-existe/)
  })

  it("recusa etapas fora de ordem", () => {
    const c = structuredClone(catalogoReal()) as Catalogo
    c.etapas.reverse()
    expect(() => validarCatalogo(c)).toThrow(/ordem/)
  })

  it("navega entre etapas", () => {
    expect(etapaAnterior("01")).toBeNull()
    expect(etapaAnterior("final")).toBe("08")
    expect(proximaEtapa("08")).toBe("final")
    expect(proximaEtapa("final")).toBeNull()
  })

  it("erra com mensagem clara para id desconhecido", () => {
    expect(() => insumoDoCatalogo(catalogoReal(), "xyz")).toThrow(/xyz/)
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/catalogo.test.ts`
Expected: FAIL — módulo `../src/catalogo` não existe.

- [ ] **Step 5: Implementar**

`src/packages/core/src/catalogo.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"
import { ORDEM_ETAPAS, type Catalogo, type EtapaCatalogo, type EtapaId, type InsumoCatalogo } from "./tipos"

export const CAMINHO_CATALOGO = ".claude/skills/_shared/etapas.json"

export function carregarCatalogo(raiz: string): Catalogo {
  const bruto = JSON.parse(readFileSync(path.join(raiz, CAMINHO_CATALOGO), "utf8")) as Catalogo
  validarCatalogo(bruto)
  return bruto
}

export function validarCatalogo(c: Catalogo): void {
  const ids = c.etapas.map((e) => e.id)
  if (ids.join(",") !== ORDEM_ETAPAS.join(",")) {
    throw new Error(
      `etapas.json: as etapas devem ser exatamente ${ORDEM_ETAPAS.join(", ")}, nessa ordem (recebido: ${ids.join(", ")})`,
    )
  }
  const insumos = new Set(c.insumos.map((i) => i.id))
  for (const e of c.etapas) {
    for (const r of e.insumos) {
      if (!insumos.has(r.id)) throw new Error(`etapas.json: a etapa ${e.id} referencia o insumo inexistente "${r.id}"`)
    }
  }
  for (const i of c.insumos) {
    if (i.tipo === "arquivo" && i.formatos.length === 0) {
      throw new Error(`etapas.json: o insumo "${i.id}" é arquivo mas não lista formatos aceitos`)
    }
  }
}

export function etapaDoCatalogo(c: Catalogo, id: EtapaId): EtapaCatalogo {
  const e = c.etapas.find((x) => x.id === id)
  if (!e) throw new Error(`Etapa desconhecida no catálogo: ${id}`)
  return e
}

export function insumoDoCatalogo(c: Catalogo, id: string): InsumoCatalogo {
  const i = c.insumos.find((x) => x.id === id)
  if (!i) throw new Error(`Insumo desconhecido no catálogo: ${id}`)
  return i
}

export function etapaAnterior(id: EtapaId): EtapaId | null {
  const i = ORDEM_ETAPAS.indexOf(id)
  return i > 0 ? ORDEM_ETAPAS[i - 1]! : null
}

export function proximaEtapa(id: EtapaId): EtapaId | null {
  const i = ORDEM_ETAPAS.indexOf(id)
  return i >= 0 && i < ORDEM_ETAPAS.length - 1 ? ORDEM_ETAPAS[i + 1]! : null
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS em todos os testes; typecheck sem erro.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/_shared/etapas.json src/packages/core
git commit -m "feat(core): catálogo de etapas e insumos, tipos e erros de domínio

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Máquina de estados das etapas

**Files:**
- Create: `src/packages/core/src/maquina-estados.ts`
- Create: `src/packages/core/src/insumos.ts` (só `registrarInsumo` nesta tarefa; o resto na Task 4)
- Test: `src/packages/core/test/maquina-estados.test.ts`

**Interfaces:**
- Consumes: `tipos.ts`, `erros.ts` (`TransicaoInvalida`), `catalogo.ts` (`etapaAnterior`, `etapaDoCatalogo`, `insumoDoCatalogo`).
- Produces:
  - `etapaVazia(status): EstadoEtapa`
  - `estadoInicial(prospect: { slug; nome; site: string | null }, em: string): Estado`
  - `comEtapa(estado, id, mudancas: Partial<EstadoEtapa>, em): Estado`
  - `recalcularLiberacoes(estado): Estado`
  - `iniciarEtapa(estado, id, em): Estado`
  - `condicoesConcluir(estado, id, catalogo): string[]` (vazio = pode concluir)
  - `reavaliarPronta(estado, id, catalogo, em): Estado`
  - `sinalizarPronta(estado, id, { resumoDecisoes, handoff }, catalogo, em): { estado; faltando: string[] }`
  - `registrarMensagemAnalista(estado, id, em): Estado`
  - `concluirEtapa(estado, id, catalogo, em): Estado`
  - `reabrirEtapa(estado, id, em): { estado; afetadasEmAndamento: EtapaId[] }`
  - `confirmarValida(estado, id, em): Estado`, `revisarEtapa(estado, id, em): Estado`
  - `insumos.ts`: `registrarInsumo(estado, dados: { etapa; insumoId; status; problemas; avisos; resumo; arquivo }, em): Estado`

- [ ] **Step 1: Escrever os testes**

`src/packages/core/test/maquina-estados.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { TransicaoInvalida } from "../src/erros"
import { registrarInsumo } from "../src/insumos"
import {
  concluirEtapa,
  condicoesConcluir,
  confirmarValida,
  estadoInicial,
  iniciarEtapa,
  reabrirEtapa,
  registrarMensagemAnalista,
  revisarEtapa,
  sinalizarPronta,
} from "../src/maquina-estados"
import { ORDEM_ETAPAS, type Estado, type EtapaId } from "../src/tipos"
import { catalogoReal } from "./ajuda"

const EM = "2026-09-28T10:00:00.000Z"
const cat = catalogoReal()
const novo = () => estadoInicial({ slug: "x", nome: "X", site: null }, EM)

function comInsumosObrigatorios(e: Estado, etapa: EtapaId): Estado {
  let r = e
  for (const ref of etapaDoCatalogo(cat, etapa).insumos.filter((i) => i.obrigatorio)) {
    r = registrarInsumo(
      r,
      { etapa, insumoId: ref.id, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "x" },
      EM,
    )
  }
  return r
}

/** Leva a etapa até concluída; se ela já está em andamento (ex.: reaberta), não inicia de novo. */
function concluir(e: Estado, etapa: EtapaId): Estado {
  let r = e.etapas[etapa].status === "liberada" ? iniciarEtapa(e, etapa, EM) : e
  r = comInsumosObrigatorios(r, etapa)
  r = sinalizarPronta(r, etapa, { resumoDecisoes: `decisões ${etapa}`, handoff: `handoff ${etapa}` }, cat, EM).estado
  return concluirEtapa(r, etapa, cat, EM)
}

function concluirAte(ate: EtapaId): Estado {
  let e = novo()
  for (const id of ORDEM_ETAPAS) {
    e = concluir(e, id)
    if (id === ate) break
  }
  return e
}

describe("máquina de estados", () => {
  it("começa com a 01 liberada e o resto bloqueado", () => {
    const e = novo()
    expect(e.etapas["01"].status).toBe("liberada")
    for (const id of ORDEM_ETAPAS.slice(1)) expect(e.etapas[id].status).toBe("bloqueada")
  })

  it("só inicia etapa liberada", () => {
    expect(() => iniciarEtapa(novo(), "02", EM)).toThrow(TransicaoInvalida)
    expect(iniciarEtapa(novo(), "01", EM).etapas["01"].status).toBe("em_andamento")
  })

  it("sinalizar sem os insumos obrigatórios mantém em andamento e lista o que falta", () => {
    const e = iniciarEtapa(novo(), "01", EM)
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.estado.etapas["01"].status).toBe("em_andamento")
    expect(r.faltando).toContain("Enviar: Transcrição do kickoff")
    expect(r.faltando).not.toContain("O agente ainda não sinalizou que a etapa está completa")
  })

  it("sinalizar com tudo pronto leva a pronta", () => {
    const e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.faltando).toEqual([])
    expect(r.estado.etapas["01"].status).toBe("pronta")
  })

  it("entregável pendente bloqueia a conclusão", () => {
    let e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    e = {
      ...e,
      entregaveis: [
        {
          id: "a",
          etapa: "01",
          tipo: "secao",
          titulo: "Transcrição limpa",
          arquivoRascunho: ".app/propostas/a.md",
          nomeFinal: "transcricao",
          status: "pendente",
          ajustePedido: null,
          criadoEm: EM,
          decididoEm: null,
        },
      ],
    }
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.faltando).toEqual(["Aprovar: Transcrição limpa"])
    expect(r.estado.etapas["01"].status).toBe("em_andamento")
  })

  it("mensagem do analista depois de pronta volta para em andamento e zera o sinal", () => {
    const e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    const pronta = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM).estado
    const depois = registrarMensagemAnalista(pronta, "01", EM)
    expect(depois.etapas["01"].status).toBe("em_andamento")
    expect(depois.etapas["01"].sinalizada).toBe(false)
    expect(condicoesConcluir(depois, "01", cat)).toContain("O agente ainda não sinalizou que a etapa está completa")
  })

  it("concluir libera a próxima; concluir fora de pronta falha", () => {
    expect(() => concluirEtapa(iniciarEtapa(novo(), "01", EM), "01", cat, EM)).toThrow(TransicaoInvalida)
    const e = concluir(novo(), "01")
    expect(e.etapas["01"].status).toBe("concluida")
    expect(e.etapas["01"].concluidaEm).toBe(EM)
    expect(e.etapas["02"].status).toBe("liberada")
  })

  it("reabrir marca as posteriores concluídas como desatualizadas e avisa as em andamento", () => {
    let e = concluirAte("03")
    e = iniciarEtapa(e, "04", EM)
    const r = reabrirEtapa(e, "02", EM)
    expect(r.estado.etapas["02"].status).toBe("em_andamento")
    expect(r.estado.etapas["03"].status).toBe("desatualizada")
    expect(r.estado.etapas["04"].status).toBe("em_andamento")
    expect(r.afetadasEmAndamento).toEqual(["04"])
  })

  it("reabrir bloqueia de novo uma etapa seguinte que só estava liberada", () => {
    const e = concluirAte("03")
    expect(e.etapas["04"].status).toBe("liberada")
    const r = reabrirEtapa(e, "03", EM)
    expect(r.estado.etapas["04"].status).toBe("bloqueada")
  })

  it("confirmar e revisar resolvem a desatualizada", () => {
    const e = reabrirEtapa(concluirAte("03"), "02", EM).estado
    expect(confirmarValida(e, "03", EM).etapas["03"].status).toBe("concluida")
    expect(revisarEtapa(e, "03", EM).etapas["03"].status).toBe("em_andamento")
    expect(() => confirmarValida(e, "02", EM)).toThrow(TransicaoInvalida)
  })

  it("a apresentação final só libera sem nenhuma etapa desatualizada", () => {
    let e = concluirAte("08")
    expect(e.etapas.final.status).toBe("liberada")
    e = reabrirEtapa(e, "03", EM).estado
    expect(e.etapas.final.status).toBe("bloqueada")
    e = concluir(e, "03")
    expect(e.etapas.final.status).toBe("bloqueada")
    for (const id of ["04", "05", "06", "07", "08"] as const) e = confirmarValida(e, id, EM)
    expect(e.etapas.final.status).toBe("liberada")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/maquina-estados.test.ts`
Expected: FAIL — módulos `../src/maquina-estados` e `../src/insumos` não existem.

- [ ] **Step 3: Implementar `registrarInsumo`**

`src/packages/core/src/insumos.ts`:

```ts
import type { Estado, EtapaId, StatusInsumo } from "./tipos"

export interface DadosInsumo {
  etapa: EtapaId
  insumoId: string
  status: StatusInsumo
  problemas: string[]
  avisos: string[]
  resumo: string | null
  arquivo: string | null
}

export function registrarInsumo(estado: Estado, dados: DadosInsumo, em: string): Estado {
  const outros = estado.insumos.filter((i) => !(i.etapa === dados.etapa && i.insumoId === dados.insumoId))
  return { ...estado, insumos: [...outros, { ...dados, atualizadoEm: em }], atualizadoEm: em }
}
```

- [ ] **Step 4: Implementar a máquina de estados**

`src/packages/core/src/maquina-estados.ts`:

```ts
import { etapaAnterior, etapaDoCatalogo, insumoDoCatalogo } from "./catalogo"
import { TransicaoInvalida } from "./erros"
import { ORDEM_ETAPAS, type Catalogo, type Estado, type EstadoEtapa, type EtapaId, type StatusEtapa } from "./tipos"

export function etapaVazia(status: StatusEtapa): EstadoEtapa {
  return {
    status,
    sessionId: null,
    iniciadaEm: null,
    concluidaEm: null,
    sinalizada: false,
    resumoDecisoes: null,
    handoff: null,
    origem: "app",
    observacao: null,
  }
}

export function estadoInicial(prospect: { slug: string; nome: string; site: string | null }, em: string): Estado {
  const etapas = {} as Record<EtapaId, EstadoEtapa>
  for (const id of ORDEM_ETAPAS) etapas[id] = etapaVazia(id === "01" ? "liberada" : "bloqueada")
  return {
    versao: 1,
    prospect: { ...prospect, criadoEm: em },
    etapas,
    entregaveis: [],
    insumos: [],
    filaAutomatica: [],
    atualizadoEm: em,
  }
}

export function comEtapa(estado: Estado, id: EtapaId, mudancas: Partial<EstadoEtapa>, em: string): Estado {
  return { ...estado, etapas: { ...estado.etapas, [id]: { ...estado.etapas[id], ...mudancas } }, atualizadoEm: em }
}

function exigir(estado: Estado, id: EtapaId, permitidos: StatusEtapa[], acao: string): void {
  const atual = estado.etapas[id].status
  if (!permitidos.includes(atual)) {
    throw new TransicaoInvalida(`Não dá para ${acao} a etapa ${id}: ela está "${atual.replace("_", " ")}".`)
  }
}

/** Uma etapa está liberada se, e só se, a anterior está concluída (e, para a final, nada está desatualizado). */
export function recalcularLiberacoes(estado: Estado): Estado {
  const existeDesatualizada = ORDEM_ETAPAS.some((id) => estado.etapas[id].status === "desatualizada")
  let novo = estado
  for (const id of ORDEM_ETAPAS) {
    const anterior = etapaAnterior(id)
    const podeLiberar =
      anterior === null ||
      (novo.etapas[anterior].status === "concluida" && (id !== "final" || !existeDesatualizada))
    const status = novo.etapas[id].status
    if (status === "bloqueada" && podeLiberar) novo = comEtapa(novo, id, { status: "liberada" }, novo.atualizadoEm)
    else if (status === "liberada" && !podeLiberar) novo = comEtapa(novo, id, { status: "bloqueada" }, novo.atualizadoEm)
  }
  return novo
}

export function iniciarEtapa(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["liberada"], "iniciar")
  return comEtapa(estado, id, { status: "em_andamento", iniciadaEm: em, sinalizada: false }, em)
}

export function condicoesConcluir(estado: Estado, id: EtapaId, catalogo: Catalogo): string[] {
  const faltando: string[] = []
  for (const ref of etapaDoCatalogo(catalogo, id).insumos) {
    if (!ref.obrigatorio) continue
    const recebido = estado.insumos.find((i) => i.etapa === id && i.insumoId === ref.id)
    if (recebido?.status !== "valido") faltando.push(`Enviar: ${insumoDoCatalogo(catalogo, ref.id).nome}`)
  }
  for (const e of estado.entregaveis) {
    if (e.etapa === id && e.status === "pendente") faltando.push(`Aprovar: ${e.titulo}`)
  }
  if (!estado.etapas[id].sinalizada) faltando.push("O agente ainda não sinalizou que a etapa está completa")
  return faltando
}

export function reavaliarPronta(estado: Estado, id: EtapaId, catalogo: Catalogo, em: string): Estado {
  const status = estado.etapas[id].status
  if (status !== "em_andamento" && status !== "pronta") return estado
  const novoStatus = condicoesConcluir(estado, id, catalogo).length === 0 ? "pronta" : "em_andamento"
  return novoStatus === status ? estado : comEtapa(estado, id, { status: novoStatus }, em)
}

export function sinalizarPronta(
  estado: Estado,
  id: EtapaId,
  dados: { resumoDecisoes: string; handoff: string },
  catalogo: Catalogo,
  em: string,
): { estado: Estado; faltando: string[] } {
  exigir(estado, id, ["em_andamento", "pronta"], "sinalizar")
  const marcado = comEtapa(
    estado,
    id,
    { sinalizada: true, resumoDecisoes: dados.resumoDecisoes, handoff: dados.handoff },
    em,
  )
  const novo = reavaliarPronta(marcado, id, catalogo, em)
  return { estado: novo, faltando: condicoesConcluir(novo, id, catalogo) }
}

export function registrarMensagemAnalista(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["em_andamento", "pronta"], "enviar mensagem para")
  return comEtapa(estado, id, { status: "em_andamento", sinalizada: false }, em)
}

export function concluirEtapa(estado: Estado, id: EtapaId, catalogo: Catalogo, em: string): Estado {
  exigir(estado, id, ["pronta"], "concluir")
  const faltando = condicoesConcluir(estado, id, catalogo)
  if (faltando.length > 0) throw new TransicaoInvalida(`Ainda falta: ${faltando.join("; ")}`)
  return recalcularLiberacoes(comEtapa(estado, id, { status: "concluida", concluidaEm: em }, em))
}

export function reabrirEtapa(
  estado: Estado,
  id: EtapaId,
  em: string,
): { estado: Estado; afetadasEmAndamento: EtapaId[] } {
  exigir(estado, id, ["concluida"], "reabrir")
  let novo = comEtapa(estado, id, { status: "em_andamento", sinalizada: false, concluidaEm: null }, em)
  const afetadas: EtapaId[] = []
  for (const outra of ORDEM_ETAPAS.slice(ORDEM_ETAPAS.indexOf(id) + 1)) {
    const s = novo.etapas[outra].status
    if (s === "concluida") novo = comEtapa(novo, outra, { status: "desatualizada" }, em)
    else if (s === "em_andamento" || s === "pronta") afetadas.push(outra)
  }
  return { estado: recalcularLiberacoes(novo), afetadasEmAndamento: afetadas }
}

export function confirmarValida(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["desatualizada"], "confirmar")
  return recalcularLiberacoes(comEtapa(estado, id, { status: "concluida" }, em))
}

export function revisarEtapa(estado: Estado, id: EtapaId, em: string): Estado {
  exigir(estado, id, ["desatualizada"], "revisar")
  return recalcularLiberacoes(comEtapa(estado, id, { status: "em_andamento", sinalizada: false }, em))
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS em todos os testes.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): máquina de estados das etapas com condições de conclusão e cascata

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Entregáveis e regras de insumo

**Files:**
- Create: `src/packages/core/src/entregaveis.ts`
- Modify: `src/packages/core/src/insumos.ts` (acrescentar funções)
- Test: `src/packages/core/test/entregaveis.test.ts`, `src/packages/core/test/insumos.test.ts`

**Interfaces:**
- Consumes: `tipos.ts`, `erros.ts`.
- Produces:
  - `entregaveis.ts` (sem import de `node:*` — usado no cliente): `EXTENSAO_POR_TIPO: Record<TipoEntregavel, string>`, `normalizarNomeFinal(tipo, nomeFinal, etapa): string`, `destinoAprovado(e: Pick<Entregavel, "tipo" | "nomeFinal" | "etapa">): string`, `DadosProposta`, `proporEntregavel(estado, dados: DadosProposta, id, em): Estado`, `aprovarEntregavel(estado, id, em): Estado`, `pedirAjuste(estado, id, texto, em): Estado`, `encontrarEntregavel(estado, id): Entregavel`.
  - `insumos.ts` (sem `node:*`): `extensao(nome): string`, `extensaoAceita(insumo, nomeArquivo): boolean`, `nomeSeguro(nome): string`, `destinoInsumo(insumo, nomeArquivo): string`.

- [ ] **Step 1: Escrever os testes**

`src/packages/core/test/entregaveis.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  aprovarEntregavel,
  destinoAprovado,
  normalizarNomeFinal,
  pedirAjuste,
  proporEntregavel,
} from "../src/entregaveis"
import { ErroEntrada, TransicaoInvalida } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"

const EM = "2026-09-28T10:00:00.000Z"
const base = () => estadoInicial({ slug: "x", nome: "X", site: null }, EM)
const proposta = (nomeFinal = "investimento-total-mensal") => ({
  etapa: "03" as const,
  tipo: "grafico" as const,
  titulo: "Investimento total — mensal",
  arquivoRascunho: ".app/propostas/p1.png",
  nomeFinal,
})

describe("destino do entregável aprovado", () => {
  it("segue as pastas e nomes usados hoje no Claude Code", () => {
    expect(destinoAprovado({ tipo: "grafico", nomeFinal: "roas-global-google-meta", etapa: "03" })).toBe(
      "entrega/ativos-aprovados/graficos/roas-global-google-meta.png",
    )
    expect(destinoAprovado({ tipo: "tabela", nomeFinal: "tabela-cenarios-projecao", etapa: "05" })).toBe(
      "entrega/ativos-aprovados/graficos/tabela-cenarios-projecao.png",
    )
    expect(destinoAprovado({ tipo: "secao", nomeFinal: "macro-financeiro", etapa: "03" })).toBe(
      "entrega/ativos-aprovados/secoes/03-macro-financeiro.md",
    )
    expect(destinoAprovado({ tipo: "planilha", nomeFinal: "projecao-de-cenarios", etapa: "05" })).toBe(
      "entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx",
    )
    expect(destinoAprovado({ tipo: "documento", nomeFinal: "plano-de-acao-estrategico", etapa: "08" })).toBe(
      "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx",
    )
    expect(destinoAprovado({ tipo: "html", nomeFinal: "benchmark", etapa: "06" })).toBe(
      "entrega/ativos-aprovados/benchmark/benchmark.html",
    )
  })
})

describe("normalizarNomeFinal", () => {
  it("tira extensão e o prefixo da etapa em seções", () => {
    expect(normalizarNomeFinal("grafico", "taxa-de-quebra-mensal.png", "03")).toBe("taxa-de-quebra-mensal")
    expect(normalizarNomeFinal("secao", "03-macro-financeiro", "03")).toBe("macro-financeiro")
  })
  it.each(["Investimento Mensal", "grafico_1", "roas-v2", "analise-final", ""])("recusa %s", (nome) => {
    expect(() => normalizarNomeFinal("grafico", nome, "03")).toThrow(ErroEntrada)
  })
})

describe("ciclo do entregável", () => {
  it("nova proposta com o mesmo nome substitui a pendente", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = proporEntregavel(e, { ...proposta(), arquivoRascunho: ".app/propostas/p2.png" }, "p2", EM)
    expect(e.entregaveis.map((x) => [x.id, x.status])).toEqual([
      ["p1", "substituido"],
      ["p2", "pendente"],
    ])
  })

  it("recusa arquivo com extensão errada para o tipo", () => {
    expect(() =>
      proporEntregavel(base(), { ...proposta(), arquivoRascunho: ".app/propostas/p1.md" }, "p1", EM),
    ).toThrow(ErroEntrada)
  })

  it("aprovar marca aprovado e aposenta a aprovação anterior do mesmo destino", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = aprovarEntregavel(e, "p1", EM)
    e = proporEntregavel(e, { ...proposta(), arquivoRascunho: ".app/propostas/p2.png" }, "p2", EM)
    expect(e.entregaveis.find((x) => x.id === "p1")!.status).toBe("aprovado")
    e = aprovarEntregavel(e, "p2", EM)
    expect(e.entregaveis.find((x) => x.id === "p1")!.status).toBe("substituido")
    expect(e.entregaveis.find((x) => x.id === "p2")!.status).toBe("aprovado")
    expect(() => aprovarEntregavel(e, "p2", EM)).toThrow(TransicaoInvalida)
  })

  it("pedir ajuste mantém pendente e guarda o texto", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = pedirAjuste(e, "p1", "trocar para barras", EM)
    expect(e.entregaveis[0]).toMatchObject({ status: "pendente", ajustePedido: "trocar para barras" })
    expect(() => pedirAjuste(e, "p1", "   ", EM)).toThrow(ErroEntrada)
  })
})
```

`src/packages/core/test/insumos.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { insumoDoCatalogo } from "../src/catalogo"
import { destinoInsumo, extensaoAceita, nomeSeguro } from "../src/insumos"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("insumos", () => {
  it("monta o destino com a extensão do arquivo enviado", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "historico-mensal"), "Planilha Final.XLSX")).toBe(
      "dados/historico-mensal.xlsx",
    )
    expect(destinoInsumo(insumoDoCatalogo(cat, "kickoff-transcricao"), "reuniao.pdf")).toBe(
      "contexto/brutos/kickoff-transcricao-bruta.pdf",
    )
  })

  it("mantém o nome original (seguro) quando o destino é pasta", () => {
    expect(destinoInsumo(insumoDoCatalogo(cat, "prints-campanhas"), "Campanha Março (1).png")).toBe(
      "contexto/brutos/prints-campanhas/Campanha_Marco_1_.png",
    )
  })

  it("aceita só os formatos do catálogo", () => {
    const ins = insumoDoCatalogo(cat, "historico-mensal")
    expect(extensaoAceita(ins, "a.xlsx")).toBe(true)
    expect(extensaoAceita(ins, "a.csv")).toBe(false)
    expect(extensaoAceita(ins, "sem-extensao")).toBe(false)
  })

  it("nomeSeguro remove diretórios", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/entregaveis.test.ts test/insumos.test.ts`
Expected: FAIL — exports inexistentes.

- [ ] **Step 3: Implementar `entregaveis.ts`**

```ts
import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "./erros"
import { TIPOS_ENTREGAVEL, type Entregavel, type Estado, type EtapaId, type TipoEntregavel } from "./tipos"

export const EXTENSAO_POR_TIPO: Record<TipoEntregavel, string> = {
  grafico: ".png",
  tabela: ".png",
  secao: ".md",
  planilha: ".xlsx",
  documento: ".docx",
  html: ".html",
}

const PASTA_POR_TIPO: Record<TipoEntregavel, string> = {
  grafico: "graficos",
  tabela: "graficos",
  secao: "secoes",
  planilha: "projecao",
  documento: "plano-de-acao",
  html: "benchmark",
}

const NOME_FINAL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const NOME_VERSIONADO = /-(?:v\d+|final|novo|nova|revisado|revisada)$/

export function normalizarNomeFinal(tipo: TipoEntregavel, nomeFinal: string, etapa: EtapaId): string {
  let nome = nomeFinal.trim().toLowerCase()
  const ext = EXTENSAO_POR_TIPO[tipo]
  if (nome.endsWith(ext)) nome = nome.slice(0, -ext.length)
  if (tipo === "secao" && nome.startsWith(`${etapa}-`)) nome = nome.slice(etapa.length + 1)
  if (!NOME_FINAL.test(nome)) {
    throw new ErroEntrada(
      `nome_final "${nomeFinal}" inválido: use só letras minúsculas, números e hífens (ex.: investimento-total-mensal).`,
    )
  }
  if (NOME_VERSIONADO.test(nome)) {
    throw new ErroEntrada(
      `nome_final "${nomeFinal}" parece versionado. Use o nome estável: uma nova aprovação sobrescreve a anterior.`,
    )
  }
  return nome
}

export function destinoAprovado(e: Pick<Entregavel, "tipo" | "nomeFinal" | "etapa">): string {
  const nome = e.tipo === "secao" ? `${e.etapa}-${e.nomeFinal}` : e.nomeFinal
  return `entrega/ativos-aprovados/${PASTA_POR_TIPO[e.tipo]}/${nome}${EXTENSAO_POR_TIPO[e.tipo]}`
}

export interface DadosProposta {
  etapa: EtapaId
  tipo: TipoEntregavel
  titulo: string
  arquivoRascunho: string
  nomeFinal: string
}

export function proporEntregavel(estado: Estado, dados: DadosProposta, id: string, em: string): Estado {
  if (!TIPOS_ENTREGAVEL.includes(dados.tipo)) {
    throw new ErroEntrada(`tipo "${dados.tipo}" inválido. Use um de: ${TIPOS_ENTREGAVEL.join(", ")}.`)
  }
  if (!dados.titulo.trim()) throw new ErroEntrada("titulo é obrigatório.")
  const nomeFinal = normalizarNomeFinal(dados.tipo, dados.nomeFinal, dados.etapa)
  const ext = EXTENSAO_POR_TIPO[dados.tipo]
  if (!dados.arquivoRascunho.toLowerCase().endsWith(ext)) {
    throw new ErroEntrada(`Um entregável do tipo "${dados.tipo}" precisa ser um arquivo ${ext}.`)
  }
  const destino = destinoAprovado({ tipo: dados.tipo, nomeFinal, etapa: dados.etapa })
  const entregaveis: Entregavel[] = estado.entregaveis.map((e) =>
    e.status === "pendente" && destinoAprovado(e) === destino ? { ...e, status: "substituido", decididoEm: em } : e,
  )
  entregaveis.push({
    id,
    etapa: dados.etapa,
    tipo: dados.tipo,
    titulo: dados.titulo.trim(),
    arquivoRascunho: dados.arquivoRascunho,
    nomeFinal,
    status: "pendente",
    ajustePedido: null,
    criadoEm: em,
    decididoEm: null,
  })
  return { ...estado, entregaveis, atualizadoEm: em }
}

export function encontrarEntregavel(estado: Estado, id: string): Entregavel {
  const e = estado.entregaveis.find((x) => x.id === id)
  if (!e) throw new ErroNaoEncontrado(`Entregável ${id} não encontrado.`)
  return e
}

export function aprovarEntregavel(estado: Estado, id: string, em: string): Estado {
  const alvo = encontrarEntregavel(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(`O entregável "${alvo.titulo}" não está aguardando aprovação.`)
  }
  const destino = destinoAprovado(alvo)
  const entregaveis: Entregavel[] = estado.entregaveis.map((e) => {
    if (e.id === id) return { ...e, status: "aprovado", decididoEm: em }
    if (e.status === "aprovado" && destinoAprovado(e) === destino) return { ...e, status: "substituido" }
    return e
  })
  return { ...estado, entregaveis, atualizadoEm: em }
}

export function pedirAjuste(estado: Estado, id: string, texto: string, em: string): Estado {
  const alvo = encontrarEntregavel(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(`O entregável "${alvo.titulo}" não está aguardando aprovação.`)
  }
  if (!texto.trim()) throw new ErroEntrada("Descreva o ajuste que você quer.")
  return {
    ...estado,
    entregaveis: estado.entregaveis.map((e) => (e.id === id ? { ...e, ajustePedido: texto.trim() } : e)),
    atualizadoEm: em,
  }
}
```

- [ ] **Step 4: Acrescentar ao `insumos.ts`**

Acrescente no fim de `src/packages/core/src/insumos.ts` (e `InsumoCatalogo` ao import de tipos):

```ts
export function extensao(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? ""
  const i = base.lastIndexOf(".")
  return i > 0 ? base.slice(i).toLowerCase() : ""
}

export function extensaoAceita(insumo: InsumoCatalogo, nomeArquivo: string): boolean {
  return insumo.formatos.includes(extensao(nomeArquivo))
}

export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() || "arquivo"
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
}

export function destinoInsumo(insumo: InsumoCatalogo, nomeArquivo: string): string {
  if (insumo.tipo === "link") return insumo.destino
  if (insumo.destino.endsWith("/")) return `${insumo.destino}${nomeSeguro(nomeArquivo)}`
  return `${insumo.destino}${extensao(nomeArquivo)}`
}
```

A linha de import fica: `import type { Estado, EtapaId, InsumoCatalogo, StatusInsumo } from "./tipos"`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): regras de entregáveis (destino estável, substituição) e de insumos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `status-planejamento.md` — gerar e importar

**Files:**
- Create: `src/packages/core/src/status-md.ts`
- Test: `src/packages/core/test/status-md.test.ts`

**Interfaces:**
- Consumes: `maquina-estados.ts` (`estadoInicial`, `comEtapa`, `recalcularLiberacoes`), `tipos.ts`.
- Produces: `renderStatusMd(estado, catalogo): string`; `importarStatusMd(md, catalogo, prospect: { slug; nome; site }, em): Estado` (etapas ✅ viram `concluida` com `origem: "terminal"`; o bloco "Próximo passo" vira o `handoff` da última concluída; a data da linha "00 · Criar prospect" vira `prospect.criadoEm`).

- [ ] **Step 1: Escrever os testes**

`src/packages/core/test/status-md.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { concluirEtapa, estadoInicial, iniciarEtapa, sinalizarPronta } from "../src/maquina-estados"
import { registrarInsumo } from "../src/insumos"
import { importarStatusMd, renderStatusMd } from "../src/status-md"
import { catalogoReal } from "./ajuda"

const EM = "2026-09-28T10:00:00.000Z"
const cat = catalogoReal()

const MD_TERMINAL = `# Status do Planejamento — Adda

| Etapa | Status | Concluída em | Observação |
|---|---|---|---|
| 00 · Criar prospect | ✅ | 2026-09-21 | |
| 01 · Preparação de contexto | ✅ | 2026-09-21 | |
| 02 · Contextualização estratégica | ✅ | 2026-09-21 | |
| 03 · Diagnóstico de performance | ✅ | 2026-09-22 | Histórico insuficiente (3/12 meses com dado) |
| 04 · Unidade econômica | ⬜ | | |
| 05 · Metas e cenários | ⬜ | | |
| 06 · Briefing e benchmark | ⬜ | | |
| 07 · Mídia paga | ⬜ | | |
| 08 · Plano de ação | ⬜ | | |
| Apresentação final | ⬜ | | |

## Próximo passo

Preciso de uma planilha (Excel) com o histórico de vendas por cliente.
`

describe("status-planejamento.md", () => {
  it("importa um prospect feito no terminal", () => {
    const e = importarStatusMd(MD_TERMINAL, cat, { slug: "adda", nome: "Adda", site: null }, EM)
    expect(e.prospect.criadoEm).toBe("2026-09-21")
    expect(e.etapas["03"]).toMatchObject({
      status: "concluida",
      origem: "terminal",
      concluidaEm: "2026-09-22",
      observacao: "Histórico insuficiente (3/12 meses com dado)",
      handoff: "Preciso de uma planilha (Excel) com o histórico de vendas por cliente.",
    })
    expect(e.etapas["04"].status).toBe("liberada")
    expect(e.etapas["05"].status).toBe("bloqueada")
  })

  it("renderiza a tabela no formato atual e o handoff da última concluída", () => {
    let e = estadoInicial({ slug: "x", nome: "Iszi", site: null }, EM)
    e = iniciarEtapa(e, "01", EM)
    for (const id of ["kickoff-transcricao", "site"]) {
      e = registrarInsumo(e, { etapa: "01", insumoId: id, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "x" }, EM)
    }
    e = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "Me mande a planilha X." }, cat, EM).estado
    e = concluirEtapa(e, "01", cat, EM)
    const md = renderStatusMd(e, cat)
    expect(md).toContain("# Status do Planejamento — Iszi")
    expect(md).toContain("| 00 · Criar prospect | ✅ | 2026-09-28 | |")
    expect(md).toContain("| 01 · Preparação de contexto | ✅ | 2026-09-28 |  |")
    expect(md).toContain("| 02 · Contextualização estratégica | ⬜ |  |  |")
    expect(md).toMatch(/## Próximo passo\n\nMe mande a planilha X\./)
  })

  it("ida e volta preserva etapas concluídas e handoff", () => {
    const e = importarStatusMd(MD_TERMINAL, cat, { slug: "adda", nome: "Adda", site: null }, EM)
    const de_novo = importarStatusMd(renderStatusMd(e, cat), cat, { slug: "adda", nome: "Adda", site: null }, EM)
    expect(de_novo.etapas["03"].status).toBe("concluida")
    expect(de_novo.etapas["03"].handoff).toBe(e.etapas["03"].handoff)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/status-md.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`src/packages/core/src/status-md.ts`:

```ts
import { comEtapa, estadoInicial, recalcularLiberacoes } from "./maquina-estados"
import { ORDEM_ETAPAS, type Catalogo, type Estado, type StatusEtapa } from "./tipos"

const ICONE: Record<StatusEtapa, string> = {
  concluida: "✅",
  desatualizada: "⚠️",
  em_andamento: "🔄",
  pronta: "🔄",
  liberada: "⬜",
  bloqueada: "⬜",
}

const PROXIMO_PADRAO =
  "(a skill mais recente concluída reescreve este bloco com o que falta\npreparar para a etapa seguinte — mesmo pedido apresentado no chat)"

export function renderStatusMd(estado: Estado, catalogo: Catalogo): string {
  const linhas = [
    `# Status do Planejamento — ${estado.prospect.nome}`,
    "",
    "Gerado pela interface a partir de `.app/estado.json` a cada mudança de etapa",
    "(ver Regra 6 em `.claude/skills/_shared/regras-de-validacao.md`). Não editar manualmente.",
    "",
    "| Etapa | Status | Concluída em | Observação |",
    "|---|---|---|---|",
    `| 00 · Criar prospect | ✅ | ${estado.prospect.criadoEm.slice(0, 10)} | |`,
  ]
  for (const cat of catalogo.etapas) {
    const e = estado.etapas[cat.id]
    const obs = (e.observacao ?? "").replace(/\|/g, "/")
    linhas.push(`| ${cat.rotuloStatus} | ${ICONE[e.status]} | ${e.concluidaEm?.slice(0, 10) ?? ""} | ${obs} |`)
  }
  const ultima = [...catalogo.etapas]
    .reverse()
    .find((c) => estado.etapas[c.id].status === "concluida" && estado.etapas[c.id].handoff)
  linhas.push("", "## Próximo passo", "", ultima ? estado.etapas[ultima.id].handoff!.trim() : PROXIMO_PADRAO, "")
  return linhas.join("\n")
}

const LINHA_TABELA = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/

export function importarStatusMd(
  md: string,
  catalogo: Catalogo,
  prospect: { slug: string; nome: string; site: string | null },
  em: string,
): Estado {
  let estado = estadoInicial(prospect, em)
  for (const linha of md.split("\n")) {
    const m = linha.match(LINHA_TABELA)
    if (!m) continue
    const [, rotulo, icone = "", data = "", obs = ""] = m
    if (rotulo === "00 · Criar prospect" && data) {
      estado = { ...estado, prospect: { ...estado.prospect, criadoEm: data } }
      continue
    }
    const cat = catalogo.etapas.find((c) => c.rotuloStatus === rotulo)
    if (!cat) continue
    if (icone.startsWith("✅")) {
      estado = comEtapa(
        estado,
        cat.id,
        { status: "concluida", concluidaEm: data || null, origem: "terminal", observacao: obs || null },
        em,
      )
    } else if (obs) {
      estado = comEtapa(estado, cat.id, { observacao: obs }, em)
    }
  }
  const proximo = md.split(/^## Próximo passo\s*$/m)[1]?.trim()
  const ultima = [...ORDEM_ETAPAS].reverse().find((id) => estado.etapas[id].status === "concluida")
  if (ultima && proximo && !proximo.startsWith("(a skill")) {
    estado = comEtapa(estado, ultima, { handoff: proximo }, em)
  }
  return recalcularLiberacoes(estado)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): gera e importa o status-planejamento.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Armazenamento em disco (`FsArmazenamento`)

**Files:**
- Create: `src/packages/core/src/armazenamento.ts`
- Modify: `src/packages/core/test/ajuda.ts` (acrescentar `raizTemporaria`)
- Test: `src/packages/core/test/armazenamento.test.ts`

**Interfaces:**
- Consumes: `erros.ts`, `tipos.ts`.
- Produces: `class FsArmazenamento` com `constructor(raiz: string, moverParaLixeira?: (abs: string) => Promise<void>)` e:
  `raiz`, `pastaClientes`, `pastaProspect(slug)`, `listarSlugs()`, `existe(slug)`, `criarPasta(slug)` (lança `ErroProspectExistente`), `excluir(slug)`, `caminhoAbsoluto(slug, rel)` (lança `ErroCaminhoForaDoProspect`), `relativoAoProspect(slug, caminho): string` (em `/`), `lerEstado(slug)`, `gravarEstado(slug, estado)`, `lerTexto(slug, rel)`, `gravarTexto(slug, rel, conteudo)`, `gravarBinario(slug, rel, dados: Uint8Array)`, `existeArquivo(slug, rel)`, `copiar(slug, relOrigem, relDestino)`, `moverParaDentro(slug, absOrigem, relDestino)`, `listarArquivos(slug, relDir)`, `listarAprovados(slug)`, `anexarConversa(slug, etapa, evento)`, `lerConversa(slug, etapa)`.
  `test/ajuda.ts` ganha `raizTemporaria(): Promise<string>` (pasta temporária com `clientes/_template` real e `.claude/skills/_shared/modelos-insumo/`).

- [ ] **Step 1: Estender `ajuda.ts`**

`src/packages/core/test/ajuda.ts` completo:

```ts
import { cp, mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { carregarCatalogo } from "../src/catalogo"

/** Raiz do projeto de planejamento (src/packages/core/test → ../../../../). */
export const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url))

export function catalogoReal() {
  return carregarCatalogo(RAIZ)
}

/** Raiz descartável com o _template real — o nome tem espaço, como a raiz de verdade. */
export async function raizTemporaria(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "planejamento com espaço-"))
  await cp(path.join(RAIZ, "clientes/_template"), path.join(dir, "clientes/_template"), { recursive: true })
  await mkdir(path.join(dir, ".claude/skills/_shared/modelos-insumo"), { recursive: true })
  return dir
}
```

- [ ] **Step 2: Escrever os testes**

`src/packages/core/test/armazenamento.test.ts`:

```ts
import { existsSync } from "node:fs"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { ErroCaminhoForaDoProspect, ErroProspectExistente } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"
import { raizTemporaria } from "./ajuda"

let raiz: string
let lixeira: string[]
let arm: FsArmazenamento

beforeEach(async () => {
  raiz = await raizTemporaria()
  lixeira = []
  arm = new FsArmazenamento(raiz, async (p) => {
    lixeira.push(p)
  })
})

describe("FsArmazenamento", () => {
  it("cria a pasta a partir do _template e recusa sobrescrever", async () => {
    await arm.criarPasta("iszi")
    expect(existsSync(path.join(raiz, "clientes/iszi/contexto/status-planejamento.md"))).toBe(true)
    await expect(arm.criarPasta("iszi")).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("lista prospects ignorando _template e pastas ocultas", async () => {
    await arm.criarPasta("b")
    await arm.criarPasta("a")
    await mkdir(path.join(raiz, "clientes/.lixo"))
    expect(await arm.listarSlugs()).toEqual(["a", "b"])
  })

  it("grava o estado de forma atômica e lê de volta", async () => {
    await arm.criarPasta("a")
    const e = estadoInicial({ slug: "a", nome: "A", site: null }, "2026-09-28T00:00:00.000Z")
    await arm.gravarEstado("a", e)
    expect(await arm.lerEstado("a")).toEqual(e)
    const arquivos = await readdir(path.join(raiz, "clientes/a/.app"))
    expect(arquivos).toEqual(["estado.json"])
  })

  it("recusa caminho que escapa da pasta do prospect", async () => {
    await arm.criarPasta("a")
    expect(() => arm.caminhoAbsoluto("a", "../b/x.md")).toThrow(ErroCaminhoForaDoProspect)
    expect(() => arm.caminhoAbsoluto("a", "/etc/passwd")).toThrow(ErroCaminhoForaDoProspect)
  })

  it("normaliza caminhos relativos à raiz, absolutos e relativos ao prospect", async () => {
    await arm.criarPasta("a")
    const esperado = ".app/rascunhos/g.png"
    expect(arm.relativoAoProspect("a", ".app/rascunhos/g.png")).toBe(esperado)
    expect(arm.relativoAoProspect("a", "clientes/a/.app/rascunhos/g.png")).toBe(esperado)
    expect(arm.relativoAoProspect("a", path.join(raiz, "clientes/a/.app/rascunhos/g.png"))).toBe(esperado)
    expect(() => arm.relativoAoProspect("a", "clientes/b/x.png")).toThrow(ErroCaminhoForaDoProspect)
  })

  it("anexa e lê a conversa, ignorando linha corrompida", async () => {
    await arm.criarPasta("a")
    await arm.anexarConversa("a", "03", { tipo: "turno_inicio", em: "t1" })
    await writeFile(path.join(raiz, "clientes/a/.app/conversas/03.jsonl"), "{quebrado\n", { flag: "a" })
    await arm.anexarConversa("a", "03", { tipo: "texto_agente", texto: "oi", em: "t2" })
    expect((await arm.lerConversa("a", "03")).map((e) => e.tipo)).toEqual(["turno_inicio", "texto_agente"])
    expect(await arm.lerConversa("a", "04")).toEqual([])
  })

  it("lista aprovados sem README e .DS_Store", async () => {
    await arm.criarPasta("a")
    await arm.gravarTexto("a", "entrega/ativos-aprovados/secoes/03-macro.md", "x")
    await arm.gravarBinario("a", "entrega/ativos-aprovados/graficos/roas.png", new Uint8Array([1]))
    expect(await arm.listarAprovados("a")).toEqual([
      "entrega/ativos-aprovados/graficos/roas.png",
      "entrega/ativos-aprovados/secoes/03-macro.md",
    ])
  })

  it("copia e move para dentro da pasta", async () => {
    await arm.criarPasta("a")
    await arm.gravarTexto("a", ".app/rascunhos/s.md", "texto")
    await arm.copiar("a", ".app/rascunhos/s.md", "entrega/ativos-aprovados/secoes/03-s.md")
    expect(await arm.lerTexto("a", "entrega/ativos-aprovados/secoes/03-s.md")).toBe("texto")
    const fora = path.join(raiz, "tmp-upload.xlsx")
    await writeFile(fora, "bin")
    await arm.moverParaDentro("a", fora, "dados/historico-mensal.xlsx")
    expect(existsSync(fora)).toBe(false)
    expect(await arm.existeArquivo("a", "dados/historico-mensal.xlsx")).toBe(true)
  })

  it("excluir manda a pasta para a lixeira", async () => {
    await arm.criarPasta("a")
    await arm.excluir("a")
    expect(lixeira).toEqual([path.join(raiz, "clientes", "a")])
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/armazenamento.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`src/packages/core/src/armazenamento.ts`:

```ts
import { randomUUID } from "node:crypto"
import { appendFile, copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { ErroCaminhoForaDoProspect, ErroNaoEncontrado, ErroProspectExistente } from "./erros"
import type { Estado, EtapaId, EventoConversa } from "./tipos"

const ARQUIVO_ESTADO = ".app/estado.json"
const IGNORAR = new Set(["README.md", ".DS_Store"])

export type MoverParaLixeira = (caminhoAbsoluto: string) => Promise<void>

async function lixeiraDoSistema(caminho: string): Promise<void> {
  const { default: trash } = await import("trash")
  await trash(caminho)
}

async function existeCaminho(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function codigoErro(e: unknown): string | undefined {
  return (e as NodeJS.ErrnoException | undefined)?.code
}

const emBarras = (p: string) => p.split(path.sep).join("/")

export class FsArmazenamento {
  readonly raiz: string
  readonly pastaClientes: string
  private readonly moverParaLixeira: MoverParaLixeira

  constructor(raiz: string, moverParaLixeira: MoverParaLixeira = lixeiraDoSistema) {
    this.raiz = raiz
    this.pastaClientes = path.join(raiz, "clientes")
    this.moverParaLixeira = moverParaLixeira
  }

  pastaProspect(slug: string): string {
    return path.join(this.pastaClientes, slug)
  }

  async listarSlugs(): Promise<string[]> {
    const itens = await readdir(this.pastaClientes, { withFileTypes: true })
    return itens
      .filter((i) => i.isDirectory() && !i.name.startsWith("_") && !i.name.startsWith("."))
      .map((i) => i.name)
      .sort()
  }

  existe(slug: string): Promise<boolean> {
    return existeCaminho(this.pastaProspect(slug))
  }

  async criarPasta(slug: string): Promise<void> {
    const destino = this.pastaProspect(slug)
    if (await existeCaminho(destino)) throw new ErroProspectExistente(slug)
    await cp(path.join(this.pastaClientes, "_template"), destino, {
      recursive: true,
      errorOnExist: true,
      force: false,
      filter: (origem) => path.basename(origem) !== ".DS_Store",
    })
  }

  async excluir(slug: string): Promise<void> {
    const pasta = this.pastaProspect(slug)
    if (!(await existeCaminho(pasta))) throw new ErroNaoEncontrado(`Prospect ${slug} não existe.`)
    await this.moverParaLixeira(pasta)
  }

  caminhoAbsoluto(slug: string, relativo: string): string {
    const pasta = this.pastaProspect(slug)
    const abs = path.resolve(pasta, relativo)
    const rel = path.relative(pasta, abs)
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new ErroCaminhoForaDoProspect(relativo)
    return abs
  }

  /** Aceita caminho absoluto, relativo à raiz ("clientes/<slug>/...") ou relativo ao prospect. */
  relativoAoProspect(slug: string, caminho: string): string {
    const pasta = this.pastaProspect(slug)
    const prefixoRaiz = `clientes/${slug}/`
    const abs = path.isAbsolute(caminho)
      ? caminho
      : caminho.startsWith(prefixoRaiz) || caminho.startsWith("clientes/")
        ? path.join(this.raiz, caminho)
        : path.join(pasta, caminho)
    const rel = path.relative(pasta, path.resolve(abs))
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new ErroCaminhoForaDoProspect(caminho)
    return emBarras(rel)
  }

  async lerEstado(slug: string): Promise<Estado | null> {
    const texto = await this.lerTexto(slug, ARQUIVO_ESTADO)
    return texto ? (JSON.parse(texto) as Estado) : null
  }

  gravarEstado(slug: string, estado: Estado): Promise<void> {
    return this.gravarTexto(slug, ARQUIVO_ESTADO, JSON.stringify(estado, null, 2))
  }

  async lerTexto(slug: string, rel: string): Promise<string | null> {
    try {
      return await readFile(this.caminhoAbsoluto(slug, rel), "utf8")
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return null
      throw e
    }
  }

  async gravarTexto(slug: string, rel: string, conteudo: string): Promise<void> {
    await this.gravarAtomico(this.caminhoAbsoluto(slug, rel), conteudo)
  }

  async gravarBinario(slug: string, rel: string, dados: Uint8Array): Promise<void> {
    await this.gravarAtomico(this.caminhoAbsoluto(slug, rel), dados)
  }

  private async gravarAtomico(abs: string, conteudo: string | Uint8Array): Promise<void> {
    await mkdir(path.dirname(abs), { recursive: true })
    const tmp = `${abs}.${randomUUID()}.tmp`
    await writeFile(tmp, conteudo)
    await rename(tmp, abs)
  }

  existeArquivo(slug: string, rel: string): Promise<boolean> {
    return existeCaminho(this.caminhoAbsoluto(slug, rel))
  }

  async copiar(slug: string, relOrigem: string, relDestino: string): Promise<void> {
    const origem = this.caminhoAbsoluto(slug, relOrigem)
    const destino = this.caminhoAbsoluto(slug, relDestino)
    await mkdir(path.dirname(destino), { recursive: true })
    const tmp = `${destino}.${randomUUID()}.tmp`
    await copyFile(origem, tmp)
    await rename(tmp, destino)
  }

  /** Copia e apaga (a origem costuma estar em outro disco, o tmp do sistema). */
  async moverParaDentro(slug: string, absOrigem: string, relDestino: string): Promise<void> {
    const destino = this.caminhoAbsoluto(slug, relDestino)
    await mkdir(path.dirname(destino), { recursive: true })
    await copyFile(absOrigem, destino)
    await rm(absOrigem, { force: true })
  }

  async listarArquivos(slug: string, relDir: string): Promise<string[]> {
    try {
      const itens = await readdir(this.caminhoAbsoluto(slug, relDir), { withFileTypes: true })
      return itens.filter((i) => i.isFile() && !IGNORAR.has(i.name)).map((i) => i.name).sort()
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
  }

  async listarAprovados(slug: string): Promise<string[]> {
    const pasta = this.pastaProspect(slug)
    try {
      const itens = await readdir(this.caminhoAbsoluto(slug, "entrega/ativos-aprovados"), {
        recursive: true,
        withFileTypes: true,
      })
      return itens
        .filter((i) => i.isFile() && !IGNORAR.has(i.name))
        .map((i) => emBarras(path.relative(pasta, path.join(i.parentPath, i.name))))
        .sort()
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
  }

  async anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    const abs = this.caminhoAbsoluto(slug, `.app/conversas/${etapa}.jsonl`)
    await mkdir(path.dirname(abs), { recursive: true })
    await appendFile(abs, `${JSON.stringify(evento)}\n`, "utf8")
  }

  async lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    const texto = await this.lerTexto(slug, `.app/conversas/${etapa}.jsonl`)
    if (!texto) return []
    return texto
      .split("\n")
      .filter(Boolean)
      .flatMap((linha) => {
        try {
          return [JSON.parse(linha) as EventoConversa]
        } catch {
          return []
        }
      })
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): armazenamento de prospects em disco com escrita atômica

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Dossiê e prompts do modo interface

**Files:**
- Create: `src/packages/core/src/dossie.ts`, `src/packages/core/src/prompts.ts`
- Test: `src/packages/core/test/dossie.test.ts`, `src/packages/core/test/prompts.test.ts`

**Interfaces:**
- Consumes: `tipos.ts` (`EtapaCatalogo`).
- Produces:
  - `dossie.ts`: `extrairOverrides(claudeMd: string | null): string | null`; `AnteriorDossie { rotulo; origem; resumo: string | null; desatualizada: boolean }`; `EntradaDossie { nome; slug; site; anteriores; aprovados: string[]; overrides; contextoPersistido: string[]; insumosRecebidos: { nome; arquivo }[] }`; `montarDossie(e): string`.
  - `prompts.ts`: `systemPromptModoInterface({ slug, etapa: EtapaCatalogo }): string`; `promptInicialEtapa({ slug, etapa, dossie }): string`; `mensagemAprovacao(titulo, nomeFinal, destinoRelRaiz): string`; `mensagemAjuste(titulo, nomeFinal, texto): string`; `mensagemInsumoRecebido(nome, arquivoRelRaiz, resumo): string`; `mensagemEtapaAnteriorAlterada(rotulo): string`.

- [ ] **Step 1: Escrever os testes**

`src/packages/core/test/dossie.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { extrairOverrides, montarDossie } from "../src/dossie"
import { RAIZ } from "./ajuda"

describe("dossiê", () => {
  it("ignora a seção de overrides padrão do template", () => {
    const template = readFileSync(path.join(RAIZ, "clientes/_template/CLAUDE.md"), "utf8")
    expect(extrairOverrides(template)).toBeNull()
    expect(extrairOverrides(null)).toBeNull()
  })

  it("extrai um override real", () => {
    const md = "# Adda\n\n## Overrides específicos deste prospect\n\n- Mês 1 é outubro/2026.\n\n## Outra\n\nx"
    expect(extrairOverrides(md)).toBe("- Mês 1 é outubro/2026.")
  })

  it("monta o dossiê com decisões, overrides, contexto e aprovados", () => {
    const texto = montarDossie({
      nome: "Adda",
      slug: "adda",
      site: "https://addabr.com/",
      anteriores: [
        { rotulo: "01 · Preparação de contexto", origem: "app", resumo: "Transcrição limpa.", desatualizada: false },
        { rotulo: "02 · Contextualização estratégica", origem: "terminal", resumo: null, desatualizada: true },
      ],
      aprovados: ["entrega/ativos-aprovados/secoes/02-contexto.md"],
      overrides: "- Mês 1 é outubro/2026.",
      contextoPersistido: ["contexto/kickoff-transcricao.md"],
      insumosRecebidos: [{ nome: "Histórico mensal", arquivo: "dados/historico-mensal.xlsx" }],
    })
    expect(texto).toContain("Transcrição limpa.")
    expect(texto).toContain("Etapa feita no terminal")
    expect(texto).toContain("desatualizada")
    expect(texto).toContain("- Mês 1 é outubro/2026.")
    expect(texto).toContain("`clientes/adda/contexto/kickoff-transcricao.md`")
    expect(texto).toContain("`clientes/adda/entrega/ativos-aprovados/secoes/02-contexto.md`")
    expect(texto).toContain("`clientes/adda/dados/historico-mensal.xlsx`")
  })
})
```

`src/packages/core/test/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { promptInicialEtapa, systemPromptModoInterface } from "../src/prompts"
import { catalogoReal } from "./ajuda"

const cat = catalogoReal()

describe("prompts", () => {
  it("o system prompt cita a pasta, a etapa e as três ferramentas", () => {
    const s = systemPromptModoInterface({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03") })
    expect(s).toContain("clientes/iszi/.app/rascunhos/")
    expect(s).toContain("03 · Diagnóstico de performance")
    for (const f of ["propor_entregavel", "solicitar_insumo", "sinalizar_etapa_pronta"]) expect(s).toContain(f)
  })

  it("o prompt inicial manda usar a skill da etapa e inclui o dossiê", () => {
    const p = promptInicialEtapa({ slug: "iszi", etapa: etapaDoCatalogo(cat, "03"), dossie: "DOSSIE-AQUI" })
    expect(p).toContain("`03-diagnostico-performance`")
    expect(p).toContain("DOSSIE-AQUI")
  })

  it("a etapa final aciona o subagente designer-apresentacao", () => {
    const p = promptInicialEtapa({ slug: "iszi", etapa: etapaDoCatalogo(cat, "final"), dossie: "" })
    expect(p).toContain("designer-apresentacao")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/dossie.test.ts test/prompts.test.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `dossie.ts`**

```ts
export function extrairOverrides(claudeMd: string | null): string | null {
  if (!claudeMd) return null
  const partes = claudeMd.split(/^## Overrides específicos deste prospect\s*$/m)
  if (partes.length < 2) return null
  const secao = partes[1]!.split(/^## /m)[0]!.trim()
  if (!secao || secao.includes("Esta seção normalmente fica vazia")) return null
  return secao
}

export interface AnteriorDossie {
  rotulo: string
  origem: "app" | "terminal"
  resumo: string | null
  desatualizada: boolean
}

export interface EntradaDossie {
  nome: string
  slug: string
  site: string | null
  anteriores: AnteriorDossie[]
  aprovados: string[]
  overrides: string | null
  contextoPersistido: string[]
  insumosRecebidos: { nome: string; arquivo: string }[]
}

export function montarDossie(e: EntradaDossie): string {
  const caminho = (rel: string) => `\`clientes/${e.slug}/${rel}\``
  const partes: string[] = [
    `**Prospect:** ${e.nome} (pasta \`clientes/${e.slug}/\`)${e.site ? ` · site: ${e.site}` : ""}`,
  ]
  if (e.overrides) partes.push("### Overrides deste prospect (valem sobre as regras padrão)", e.overrides)
  partes.push("### Decisões das etapas anteriores")
  if (e.anteriores.length === 0) partes.push("Nenhuma — esta é a primeira etapa.")
  for (const a of e.anteriores) {
    partes.push(`#### ${a.rotulo}${a.desatualizada ? " ⚠️ desatualizada (uma etapa anterior foi reaberta)" : ""}`)
    partes.push(
      a.resumo?.trim() ||
        (a.origem === "terminal"
          ? "Etapa feita no terminal, sem resumo de decisões. Consulte os arquivos de contexto e os ativos aprovados abaixo."
          : "Sem resumo registrado."),
    )
  }
  if (e.contextoPersistido.length > 0) {
    partes.push("### Contexto persistido (leia antes de começar)", e.contextoPersistido.map((c) => `- ${caminho(c)}`).join("\n"))
  }
  partes.push(
    "### Ativos já aprovados",
    e.aprovados.length > 0 ? e.aprovados.map((a) => `- ${caminho(a)}`).join("\n") : "Nenhum ainda.",
  )
  if (e.insumosRecebidos.length > 0) {
    partes.push(
      "### Insumos já recebidos nesta etapa",
      e.insumosRecebidos.map((i) => `- ${i.nome}: ${caminho(i.arquivo)}`).join("\n"),
    )
  }
  return partes.join("\n\n")
}
```

- [ ] **Step 4: Implementar `prompts.ts`**

```ts
import type { EtapaCatalogo } from "./tipos"

export function systemPromptModoInterface({ slug, etapa }: { slug: string; etapa: EtapaCatalogo }): string {
  const pasta = `clientes/${slug}/`
  const trabalho = etapa.skill
    ? `skill \`${etapa.skill}\``
    : "subagente `designer-apresentacao` (ver `.claude/commands/apresentacao-final.md`)"
  return `# Modo interface — Planejamento Estratégico

Você está rodando dentro da interface web do planejamento, não no terminal. O analista vê o chat e cards com botões. Estas regras complementam \`.claude/skills/_shared/regras-de-validacao.md\` (Regra 7):

- Prospect: \`${slug}\`, pasta \`${pasta}\`. Etapa atual: ${etapa.rotuloStatus} (${trabalho}). Trabalhe só nesta etapa.
- Salve todo gráfico, tabela, texto ou arquivo que precisa de aprovação em \`${pasta}.app/rascunhos/\` e chame \`propor_entregavel\`. Nunca grave em \`entrega/ativos-aprovados/\`: o app faz isso quando o analista aprova. Depois de propor, encerre a resposta e espere — a decisão chega como nova mensagem.
- Não peça "ok" ou "aprovado" em texto para gráficos e seções: o card substitui isso. Perguntas estratégicas e de esclarecimento continuam normais no chat.
- Para pedir um arquivo ao analista, chame \`solicitar_insumo\` com o id do catálogo, em vez de descrever caminho de pasta.
- Não edite \`contexto/status-planejamento.md\` nem nada em \`.app/\` fora de \`.app/rascunhos/\`.
- Quando o critério de conclusão for atingido, chame \`sinalizar_etapa_pronta\` com o resumo das decisões (markdown) e o texto de handoff para a próxima etapa (o mesmo do "Encerramento e handoff" da skill, sem citar caminhos). Se a ferramenta disser que falta algo, resolva o que depender de você e espere o resto.
- Nunca reproduza CPF, e-mail, telefone, endereço ou dado de cartão.`
}

export function promptInicialEtapa({
  slug,
  etapa,
  dossie,
}: {
  slug: string
  etapa: EtapaCatalogo
  dossie: string
}): string {
  const acao = etapa.skill
    ? `Use a skill \`${etapa.skill}\` e siga o processo dela do início.`
    : "Acione o subagente `designer-apresentacao` para montar a apresentação final, usando só `entrega/ativos-aprovados/` (ver `.claude/commands/apresentacao-final.md`)."
  return `Vamos trabalhar na ${etapa.rotuloStatus} do prospect \`${slug}\`.

${acao}

## Dossiê das etapas anteriores

${dossie}`
}

export function mensagemAprovacao(titulo: string, nomeFinal: string, destino: string): string {
  return `O analista APROVOU o entregável “${titulo}” (${nomeFinal}). O app já salvou em \`${destino}\`. Siga para o próximo passo da skill.`
}

export function mensagemAjuste(titulo: string, nomeFinal: string, texto: string): string {
  return `O analista pediu AJUSTE no entregável “${titulo}” (${nomeFinal}): “${texto}”. Refaça, salve em .app/rascunhos/ e proponha de novo com o mesmo nome_final.`
}

export function mensagemInsumoRecebido(nome: string, arquivo: string, resumo: string | null): string {
  return `O analista enviou “${nome}” e o arquivo passou na validação: \`${arquivo}\`${resumo ? ` (${resumo})` : ""}. Pode seguir.`
}

export function mensagemEtapaAnteriorAlterada(rotulo: string): string {
  return `Aviso do app: a etapa ${rotulo} foi reaberta pelo analista. O que for aprovado lá pode mudar as bases desta etapa; releia \`contexto/decisoes/\` e os ativos aprovados antes de seguir.`
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): dossiê entre etapas e prompts do modo interface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Contrato do executor, parser de stream-json e executor falso

**Files:**
- Create: `src/packages/core/src/executor/tipos.ts`, `src/packages/core/src/executor/stream-json.ts`, `src/packages/core/src/executor/fake.ts`
- Create: `src/packages/core/test/fixtures/stream-oi.jsonl`
- Test: `src/packages/core/test/stream-json.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `EventoExecutor` = `{tipo:"sessao"; sessionId}` | `{tipo:"texto_delta"; texto}` | `{tipo:"texto"; texto}` | `{tipo:"ferramenta"; id; nome; entrada: unknown}` | `{tipo:"ferramenta_resultado"; id; erro: boolean}` | `{tipo:"limite"; status: string; resetsAt: number | null}` | `{tipo:"fim"; ok: boolean; erro: string | null; sessionId: string | null}`.
  - `PedidoTurno { cwd; mensagem; sessionId: string | null; systemPrompt; mcpConfig; settings; allowedTools: string[] }`.
  - `interface Executor { executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> }`.
  - `parseLinhaStreamJson(linha: string): EventoExecutor[]`.
  - `fake.ts`: `type Roteiro = (pedido, sinal) => AsyncIterable<EventoExecutor>`; `class FakeExecutor { pedidos: PedidoTurno[]; constructor(roteiro: Roteiro) }`; `roteiroSimples(texto, sessionId?): Roteiro`; `criarExecutorDemo(): Executor`.

- [ ] **Step 1: Contrato do executor**

`src/packages/core/src/executor/tipos.ts`:

```ts
export type EventoExecutor =
  | { tipo: "sessao"; sessionId: string }
  | { tipo: "texto_delta"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramenta"; id: string; nome: string; entrada: unknown }
  | { tipo: "ferramenta_resultado"; id: string; erro: boolean }
  | { tipo: "limite"; status: string; resetsAt: number | null }
  | { tipo: "fim"; ok: boolean; erro: string | null; sessionId: string | null }

export interface PedidoTurno {
  cwd: string
  mensagem: string
  sessionId: string | null
  systemPrompt: string
  /** JSON (string) passado em --mcp-config. */
  mcpConfig: string
  /** JSON (string) passado em --settings (hook de escrita). */
  settings: string
  allowedTools: string[]
}

/** Fronteira trocável: v1 é o CLI headless; a Fase 2 troca por Agent SDK sem mexer no resto. */
export interface Executor {
  executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor>
}
```

- [ ] **Step 2: Fixture com a forma real do stream-json**

`src/packages/core/test/fixtures/stream-oi.jsonl` (formato capturado do `claude -p --output-format stream-json --verbose --include-partial-messages` 2.1.251; uma linha por evento):

```
{"type":"system","subtype":"hook_started","hook_id":"h1","hook_name":"SessionStart","hook_event":"SessionStart","session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","uuid":"u0"}
{"type":"system","subtype":"init","cwd":"/tmp","session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","tools":["Read"],"mcp_servers":[],"model":"claude-haiku-4-5-20251001","permissionMode":"default","apiKeySource":"none","uuid":"u1"}
{"type":"stream_event","event":{"type":"message_start","message":{"id":"msg_1"}},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u2"}
{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u3"}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":""}},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u4"}
{"type":"assistant","message":{"id":"msg_1","role":"assistant","content":[{"type":"thinking","thinking":"","signature":"sig"}]},"parent_tool_use_id":null,"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","uuid":"u5"}
{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u6"}
{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"oi"}},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u7"}
{"type":"assistant","message":{"id":"msg_1","role":"assistant","content":[{"type":"text","text":"oi"}]},"parent_tool_use_id":null,"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","uuid":"u8"}
{"type":"stream_event","event":{"type":"message_stop"},"session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","parent_tool_use_id":null,"uuid":"u9"}
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1790651400,"rateLimitType":"five_hour"},"uuid":"u10"}
{"type":"result","subtype":"success","is_error":false,"result":"oi","stop_reason":"end_turn","session_id":"3201404c-ffd2-469d-bfbf-c6dbedbde0d6","total_cost_usd":0.07,"uuid":"u11"}
```

- [ ] **Step 3: Escrever os testes**

`src/packages/core/test/stream-json.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseLinhaStreamJson } from "../src/executor/stream-json"

const SID = "3201404c-ffd2-469d-bfbf-c6dbedbde0d6"
const linhas = readFileSync(new URL("./fixtures/stream-oi.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)

describe("parseLinhaStreamJson", () => {
  it("extrai sessão, delta, texto e fim do stream real", () => {
    expect(linhas.flatMap(parseLinhaStreamJson)).toEqual([
      { tipo: "sessao", sessionId: SID },
      { tipo: "texto_delta", texto: "oi" },
      { tipo: "texto", texto: "oi" },
      { tipo: "fim", ok: true, erro: null, sessionId: SID },
    ])
  })

  it("converte tool_use e tool_result", () => {
    const uso = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: null,
      message: { content: [{ type: "tool_use", id: "t1", name: "mcp__planejamento__propor_entregavel", input: { tipo: "grafico" } }] },
    })
    const resultado = JSON.stringify({
      type: "user",
      parent_tool_use_id: null,
      message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "x" }] },
    })
    expect(parseLinhaStreamJson(uso)).toEqual([
      { tipo: "ferramenta", id: "t1", nome: "mcp__planejamento__propor_entregavel", entrada: { tipo: "grafico" } },
    ])
    expect(parseLinhaStreamJson(resultado)).toEqual([{ tipo: "ferramenta_resultado", id: "t1", erro: true }])
  })

  it("ignora o que vem de subagentes", () => {
    const linha = JSON.stringify({ type: "assistant", parent_tool_use_id: "t9", message: { content: [{ type: "text", text: "interno" }] } })
    expect(parseLinhaStreamJson(linha)).toEqual([])
  })

  it("avisa limite quando o status não é allowed", () => {
    const linha = JSON.stringify({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: 1790651400 } })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "limite", status: "rejected", resetsAt: 1790651400 }])
  })

  it("resultado com erro vira fim com mensagem", () => {
    const linha = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, session_id: SID })
    expect(parseLinhaStreamJson(linha)).toEqual([{ tipo: "fim", ok: false, erro: "error_during_execution", sessionId: SID }])
  })

  it("linha que não é JSON é ignorada", () => {
    expect(parseLinhaStreamJson("{quebrado")).toEqual([])
    expect(parseLinhaStreamJson("")).toEqual([])
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/stream-json.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 5: Implementar o parser**

`src/packages/core/src/executor/stream-json.ts`:

```ts
import type { EventoExecutor } from "./tipos"

// O stream-json do Claude Code é um formato externo e sem tipos publicados: lemos como JSON solto
// e validamos campo a campo.
type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string | null => (typeof v === "string" ? v : null)

export function parseLinhaStreamJson(linha: string): EventoExecutor[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(linha)
  } catch {
    return []
  }
  const o = obj(bruto)
  if (!o || o.parent_tool_use_id) return []

  switch (o.type) {
    case "system": {
      const sid = str(o.session_id)
      return o.subtype === "init" && sid ? [{ tipo: "sessao", sessionId: sid }] : []
    }
    case "stream_event": {
      const e = obj(o.event)
      const delta = obj(e?.delta)
      const texto = str(delta?.text)
      return e?.type === "content_block_delta" && delta?.type === "text_delta" && texto !== null
        ? [{ tipo: "texto_delta", texto }]
        : []
    }
    case "assistant": {
      const conteudo = obj(o.message)?.content
      if (!Array.isArray(conteudo)) return []
      return conteudo.flatMap((b): EventoExecutor[] => {
        const bloco = obj(b)
        if (bloco?.type === "text" && typeof bloco.text === "string") return [{ tipo: "texto", texto: bloco.text }]
        if (bloco?.type === "tool_use") {
          return [{ tipo: "ferramenta", id: String(bloco.id), nome: String(bloco.name), entrada: bloco.input ?? {} }]
        }
        return []
      })
    }
    case "user": {
      const conteudo = obj(o.message)?.content
      if (!Array.isArray(conteudo)) return []
      return conteudo.flatMap((b): EventoExecutor[] => {
        const bloco = obj(b)
        return bloco?.type === "tool_result"
          ? [{ tipo: "ferramenta_resultado", id: String(bloco.tool_use_id), erro: bloco.is_error === true }]
          : []
      })
    }
    case "rate_limit_event": {
      const info = obj(o.rate_limit_info)
      const status = str(info?.status)
      if (!status || status === "allowed") return []
      return [{ tipo: "limite", status, resetsAt: typeof info?.resetsAt === "number" ? info.resetsAt : null }]
    }
    case "result": {
      const ok = o.subtype === "success" && o.is_error !== true
      return [
        {
          tipo: "fim",
          ok,
          erro: ok ? null : (str(o.result) || str(o.subtype) || "erro desconhecido"),
          sessionId: str(o.session_id),
        },
      ]
    }
    default:
      return []
  }
}
```

- [ ] **Step 6: Executor falso e de demonstração**

`src/packages/core/src/executor/fake.ts`:

```ts
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

export type Roteiro = (pedido: PedidoTurno, sinal: AbortSignal) => AsyncIterable<EventoExecutor>

/** Executor para testes: grava os pedidos e reproduz o roteiro dado. */
export class FakeExecutor implements Executor {
  readonly pedidos: PedidoTurno[] = []
  private readonly roteiro: Roteiro

  constructor(roteiro: Roteiro) {
    this.roteiro = roteiro
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    this.pedidos.push(pedido)
    yield* this.roteiro(pedido, sinal)
  }
}

export function roteiroSimples(texto: string, sessionId = "sessao-demo"): Roteiro {
  return async function* () {
    yield { tipo: "sessao", sessionId }
    yield { tipo: "texto_delta", texto }
    yield { tipo: "texto", texto }
    yield { tipo: "fim", ok: true, erro: null, sessionId }
  }
}

/**
 * Liga com PLANEJAMENTO_EXECUTOR=demo: permite mexer na UI sem gastar a assinatura.
 * Uma mensagem "demo:propor <tipo> <caminho relativo à raiz>" faz o demo chamar
 * propor_entregavel de verdade (pelo mesmo endpoint que o servidor MCP usa), para ver o card.
 */
export function criarExecutorDemo(): Executor {
  return new FakeExecutor(async function* (pedido, sinal) {
    const comando = pedido.mensagem.match(/demo:propor\s+(\S+)\s+(\S+)/)
    if (comando) {
      const [, tipo, caminho] = comando
      const env = (JSON.parse(pedido.mcpConfig) as { mcpServers: { planejamento: { env: Record<string, string> } } })
        .mcpServers.planejamento.env
      const resposta = await fetch(`${env.PLANEJAMENTO_APP_URL}/api/interno/ferramentas`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.PLANEJAMENTO_TOKEN}` },
        body: JSON.stringify({
          ferramenta: "propor_entregavel",
          entrada: { tipo, titulo: `Demonstração (${tipo})`, arquivo_rascunho: caminho, nome_final: `demonstracao-${tipo}` },
        }),
      })
      const { mensagem } = (await resposta.json()) as { mensagem?: string }
      yield* roteiroSimples(`Modo demonstração: ${mensagem ?? "sem resposta"}`)(pedido, sinal)
      return
    }
    const texto = `Modo demonstração (sem Claude). Recebi: “${pedido.mensagem.slice(0, 200)}”`
    yield* roteiroSimples(texto)(pedido, sinal)
  })
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): contrato do executor, parser do stream-json e executor falso

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Executor real — `claude -p` como processo filho

**Files:**
- Create: `src/packages/core/src/executor/claude-cli.ts`
- Create: `src/packages/core/test/fixtures/claude-falso.mjs`
- Test: `src/packages/core/test/claude-cli.test.ts`

**Interfaces:**
- Consumes: `executor/tipos.ts`, `executor/stream-json.ts`.
- Produces: `montarArgsClaude(p: PedidoTurno): string[]`; `class ClaudeCliExecutor implements Executor` com `constructor(opcoes?: { comando?: string; prefixoArgs?: string[] })`.

- [ ] **Step 1: CLI falso para os testes**

`src/packages/core/test/fixtures/claude-falso.mjs`:

```js
// Finge ser o `claude -p`: lê a mensagem do stdin e imprime as linhas de $FIXTURE.
// $DORMIR_MS faz esperar antes de imprimir (teste de "Parar"). $ARGS_SAIDA grava os argv recebidos.
import { readFileSync, writeFileSync } from "node:fs"

let entrada = ""
for await (const parte of process.stdin) entrada += parte
if (process.env.ARGS_SAIDA) writeFileSync(process.env.ARGS_SAIDA, JSON.stringify({ argv: process.argv.slice(2), entrada }))
if (process.env.DORMIR_MS) await new Promise((r) => setTimeout(r, Number(process.env.DORMIR_MS)))
if (process.env.FIXTURE) process.stdout.write(readFileSync(process.env.FIXTURE, "utf8"))
if (process.env.STDERR) process.stderr.write(process.env.STDERR)
process.exit(Number(process.env.SAIDA ?? 0))
```

- [ ] **Step 2: Escrever os testes**

`src/packages/core/test/claude-cli.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { ClaudeCliExecutor, montarArgsClaude } from "../src/executor/claude-cli"
import type { EventoExecutor, PedidoTurno } from "../src/executor/tipos"

const FALSO = fileURLToPath(new URL("./fixtures/claude-falso.mjs", import.meta.url))
const FIXTURE = fileURLToPath(new URL("./fixtures/stream-oi.jsonl", import.meta.url))

const pedido = (sessionId: string | null = null): PedidoTurno => ({
  cwd: tmpdir(),
  mensagem: "olá",
  sessionId,
  systemPrompt: "SP",
  mcpConfig: '{"mcpServers":{}}',
  settings: '{"hooks":{}}',
  allowedTools: ["Read", "Bash(python3 *)"],
})

async function coletar(it: AsyncIterable<EventoExecutor>) {
  const r: EventoExecutor[] = []
  for await (const e of it) r.push(e)
  return r
}

const falso = () => new ClaudeCliExecutor({ comando: process.execPath, prefixoArgs: [FALSO] })

afterEach(() => {
  for (const v of ["FIXTURE", "DORMIR_MS", "ARGS_SAIDA", "STDERR", "SAIDA"]) delete process.env[v]
})

describe("montarArgsClaude", () => {
  it("monta print + stream-json e só usa --resume com sessão", () => {
    const sem = montarArgsClaude(pedido())
    expect(sem.slice(0, 5)).toEqual(["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"])
    expect(sem).toContain("--mcp-config")
    expect(sem[sem.indexOf("--allowedTools") + 1]).toBe("Read,Bash(python3 *)")
    expect(sem).not.toContain("--resume")
    const com = montarArgsClaude(pedido("abc"))
    expect(com.slice(-2)).toEqual(["--resume", "abc"])
  })
})

describe("ClaudeCliExecutor", () => {
  it("passa a mensagem pelo stdin e converte o stdout em eventos", async () => {
    const saida = path.join(await mkdtemp(path.join(tmpdir(), "cli-")), "args.json")
    process.env.FIXTURE = FIXTURE
    process.env.ARGS_SAIDA = saida
    const eventos = await coletar(falso().executar(pedido(), new AbortController().signal))
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto_delta", "texto", "fim"])
    const recebido = JSON.parse(readFileSync(saida, "utf8")) as { argv: string[]; entrada: string }
    expect(recebido.entrada).toBe("olá")
    expect(recebido.argv).toContain("--append-system-prompt")
  })

  it("sem evento result, gera fim com o stderr", async () => {
    process.env.STDERR = "falhou feio"
    process.env.SAIDA = "1"
    const eventos = await coletar(falso().executar(pedido(), new AbortController().signal))
    expect(eventos).toEqual([{ tipo: "fim", ok: false, erro: "falhou feio", sessionId: null }])
  })

  it("abortar mata o processo e encerra como interrompido", async () => {
    process.env.DORMIR_MS = "5000"
    process.env.FIXTURE = FIXTURE
    const controle = new AbortController()
    setTimeout(() => controle.abort(), 200)
    const inicio = Date.now()
    const eventos = await coletar(falso().executar(pedido(), controle.signal))
    expect(Date.now() - inicio).toBeLessThan(3000)
    expect(eventos.at(-1)).toMatchObject({ tipo: "fim", ok: false, erro: "Interrompido pelo analista." })
  })

  it("comando inexistente vira erro legível", async () => {
    const exec = new ClaudeCliExecutor({ comando: "comando-que-nao-existe-xyz" })
    const eventos = await coletar(exec.executar(pedido(), new AbortController().signal))
    expect(eventos).toEqual([
      { tipo: "fim", ok: false, erro: expect.stringContaining("Claude Code não encontrado"), sessionId: null },
    ])
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/claude-cli.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`src/packages/core/src/executor/claude-cli.ts`:

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"
import { parseLinhaStreamJson } from "./stream-json"
import type { EventoExecutor, Executor, PedidoTurno } from "./tipos"

export interface OpcoesClaudeCli {
  comando?: string
  /** Só para testes: argumentos antes dos do claude (ex.: o script do CLI falso). */
  prefixoArgs?: string[]
}

export function montarArgsClaude(p: PedidoTurno): string[] {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--append-system-prompt",
    p.systemPrompt,
    "--mcp-config",
    p.mcpConfig,
    "--settings",
    p.settings,
    "--allowedTools",
    p.allowedTools.join(","),
  ]
  if (p.sessionId) args.push("--resume", p.sessionId)
  return args
}

export class ClaudeCliExecutor implements Executor {
  private readonly opcoes: OpcoesClaudeCli

  constructor(opcoes: OpcoesClaudeCli = {}) {
    this.opcoes = opcoes
  }

  async *executar(pedido: PedidoTurno, sinal: AbortSignal): AsyncIterable<EventoExecutor> {
    const env = { ...process.env }
    // v1 (protótipo): usa a assinatura logada no Claude Code, nunca uma chave de API paga.
    delete env.ANTHROPIC_API_KEY

    const filho: ChildProcessWithoutNullStreams = spawn(
      this.opcoes.comando ?? "claude",
      [...(this.opcoes.prefixoArgs ?? []), ...montarArgsClaude(pedido)],
      { cwd: pedido.cwd, env, stdio: ["pipe", "pipe", "pipe"] },
    )
    const falhaAoIniciar = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      filho.once("error", resolve)
      filho.once("spawn", () => resolve(null))
    })
    if (falhaAoIniciar) {
      yield {
        tipo: "fim",
        ok: false,
        erro:
          falhaAoIniciar.code === "ENOENT"
            ? "Claude Code não encontrado. Instale e faça login com `claude auth login`."
            : falhaAoIniciar.message,
        sessionId: null,
      }
      return
    }

    let stderr = ""
    filho.stderr.on("data", (d) => {
      stderr = (stderr + String(d)).slice(-4000)
    })
    const saida = new Promise<number | null>((resolve) => filho.once("close", (codigo) => resolve(codigo)))
    const abortar = () => filho.kill("SIGTERM")
    sinal.addEventListener("abort", abortar, { once: true })
    filho.stdin.on("error", () => {})
    filho.stdin.end(pedido.mensagem)

    let viuFim = false
    try {
      for await (const linha of createInterface({ input: filho.stdout })) {
        for (const evento of parseLinhaStreamJson(linha)) {
          if (evento.tipo === "fim") viuFim = true
          yield evento
        }
      }
      const codigo = await saida
      if (!viuFim) {
        yield {
          tipo: "fim",
          ok: false,
          erro: sinal.aborted
            ? "Interrompido pelo analista."
            : stderr.trim() || `O Claude Code encerrou sem resposta (código ${codigo}).`,
          sessionId: null,
        }
      }
    } finally {
      sinal.removeEventListener("abort", abortar)
      if (filho.exitCode === null) filho.kill("SIGTERM")
    }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): executor que roda o claude -p headless com a assinatura

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Validador de insumos (Python) e wrapper TS

**Files:**
- Create: `scripts/validar_insumo.py`, `scripts/tests/test_validar_insumo.py`
- Create: `.claude/skills/_shared/modelos-insumo/schemas.json`, `.claude/skills/_shared/modelos-insumo/README.md`
- Create: `src/packages/core/src/validador.ts`
- Test: `src/packages/core/test/validador.test.ts`

**Interfaces:**
- Consumes: `tipos.ts` (`ResultadoValidacao`).
- Produces:
  - CLI: `python3 scripts/validar_insumo.py --insumo <id> --arquivo <caminho> [--schemas <json>] [--modelos <dir>]` → imprime `{"ok", "problemas", "avisos", "resumo"}` e sai com 0; sai com 2 em erro de uso.
  - Python: `validar(insumo_id, arquivo, schemas_path, modelos_dir) -> dict`.
  - TS: `criarValidadorPython(raiz: string, python = "python3"): (p: { insumoId; arquivoAbs }) => Promise<ResultadoValidacao>`.

- [ ] **Step 1: Regras por insumo**

`.claude/skills/_shared/modelos-insumo/schemas.json`:

```json
{
  "historico-mensal": {
    "modelo": "historico-mensal.xlsx",
    "linha_marcadores": 1,
    "marcador_obrigatorio": "Preench. Manual",
    "linha_cabecalho": 2,
    "coluna_mes": "DATA",
    "meses_esperados": 12,
    "colunas_obrigatorias": ["DATA"],
    "sensivel": false
  },
  "produtos-curva-abc": {
    "modelo": "produtos-curva-abc.xlsx",
    "linha_cabecalho": 1,
    "colunas_obrigatorias": ["PRODUTO", "VALOR TOTAL VENDAS"],
    "min_linhas": 1,
    "sensivel": false
  },
  "clientes-historico": {
    "modelo": "clientes-historico.xlsx",
    "linha_cabecalho": 1,
    "colunas_obrigatorias": ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
    "min_linhas": 1,
    "sensivel": true
  }
}
```

`.claude/skills/_shared/modelos-insumo/README.md`:

```markdown
# Modelos oficiais de insumo

Coloque aqui os modelos em branco que o analista baixa na interface, com
exatamente estes nomes:

- `historico-mensal.xlsx` — Skill 03. Linha 1 com os marcadores
  "Fórmula" / "Preench. Manual"; linha 2 com o cabeçalho; coluna `DATA` com o mês.
- `produtos-curva-abc.xlsx` — Skill 03 (Curva ABC). Cabeçalho na linha 1.
- `clientes-historico.xlsx` — Skill 04. Cabeçalho na linha 1. Sem nenhuma coluna de dado pessoal.

Quando o modelo existe, o validador (`scripts/validar_insumo.py`) exige as
mesmas colunas do modelo — no histórico mensal, as marcadas "Preench. Manual".
Sem o modelo, ele cai para `colunas_obrigatorias` de `schemas.json` e avisa
o analista. Se mudar um modelo, confira `schemas.json` (linha do cabeçalho,
nome da coluna de mês).
```

- [ ] **Step 2: Escrever os testes Python**

`scripts/tests/test_validar_insumo.py`:

```python
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from validar_insumo import validar  # noqa: E402

MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO",
         "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]


def salvar(caminho: Path, linhas: list[list]) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    for linha in linhas:
        ws.append(linha)
    wb.save(caminho)
    return caminho


@pytest.fixture()
def ambiente(tmp_path: Path):
    modelos = tmp_path / "modelos"
    modelos.mkdir()
    schemas = tmp_path / "schemas.json"
    schemas.write_text((RAIZ / ".claude/skills/_shared/modelos-insumo/schemas.json").read_text(encoding="utf-8"),
                       encoding="utf-8")
    salvar(modelos / "historico-mensal.xlsx", [
        [None, None, "Fórmula", "Preench. Manual", "Preench. Manual"],
        [None, "DATA ", "INVESTIMENTO TOTAL", "INVESTIMENTO META", "SESSOES META"],
    ])
    salvar(modelos / "clientes-historico.xlsx", [["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"]])
    return tmp_path, schemas, modelos


def historico(tmp_path: Path, meses: int = 12, vazio_em: str | None = None) -> Path:
    linhas = [
        [None, None, "Fórmula", "Preench. Manual", "Preench. Manual"],
        [None, "DATA", "INVESTIMENTO TOTAL", "INVESTIMENTO META", "SESSOES META"],
    ]
    for mes in MESES[:meses]:
        linhas.append([2025, mes, 100.0, 100.0, None if mes == vazio_em else 500])
    return salvar(tmp_path / "enviado.xlsx", linhas)


def test_historico_completo(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp), schemas, modelos)
    assert r["ok"] is True, r
    assert r["resumo"] == "12 meses (JANEIRO a DEZEMBRO)"


def test_historico_faltando_meses(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp, meses=10), schemas, modelos)
    assert r["ok"] is False
    assert "Esperados 12 meses, encontrados 10." in r["problemas"]


def test_historico_coluna_manual_vazia(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp, vazio_em="MARÇO"), schemas, modelos)
    assert "Coluna “SESSOES META” vazia em MARÇO." in r["problemas"]


def test_coluna_do_modelo_ausente(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "e.xlsx", [["x"], [None, "DATA", "INVESTIMENTO TOTAL", "INVESTIMENTO META"]] +
                     [[2025, m, 1, 1] for m in MESES])
    r = validar("historico-mensal", arquivo, schemas, modelos)
    assert any("SESSOES META" in p and "não encontrada" in p for p in r["problemas"])


def test_clientes_com_email_nao_vaza_valor(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
        [1, "Ana Souza", 2, 300.0],
        [2, "bruno@exemplo.com", 1, 90.0],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is False
    texto = " ".join(r["problemas"])
    assert "e-mail" in texto and "linha 3" in texto
    assert "bruno@exemplo.com" not in texto


def test_cabecalho_de_dado_pessoal(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)", "CPF"],
        [1, "Ana", 2, 300.0, None],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert any("“CPF”" in p for p in r["problemas"])


def test_sem_modelo_usa_schema_e_avisa(ambiente):
    tmp, schemas, modelos = ambiente
    (modelos / "clientes-historico.xlsx").unlink()
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
        [1, "Ana", 2, 300.0],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is True
    assert r["resumo"] == "1 linha de dados"
    assert r["avisos"]


def test_arquivo_que_nao_e_excel(ambiente):
    tmp, schemas, modelos = ambiente
    falso = tmp / "falso.xlsx"
    falso.write_text("isto não é excel", encoding="utf-8")
    r = validar("clientes-historico", falso, schemas, modelos)
    assert r["ok"] is False
    assert "Não consegui abrir" in r["problemas"][0]


def test_cli_imprime_json(ambiente):
    tmp, schemas, modelos = ambiente
    saida = subprocess.run(
        [sys.executable, str(RAIZ / "scripts/validar_insumo.py"), "--insumo", "historico-mensal",
         "--arquivo", str(historico(tmp)), "--schemas", str(schemas), "--modelos", str(modelos)],
        capture_output=True, text=True, check=True,
    )
    assert json.loads(saida.stdout)["ok"] is True
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'validar_insumo'`.

- [ ] **Step 4: Implementar o validador**

`scripts/validar_insumo.py`:

```python
#!/usr/bin/env python3
"""
scripts/validar_insumo.py — confere uma planilha de insumo contra o modelo oficial.

Chamado pela interface ao receber um upload (e utilizável pelas skills no
terminal). Nunca imprime valores de célula: mensagens citam só coluna e linha,
para não reproduzir dado pessoal (ver CLAUDE.md raiz).

    python3 scripts/validar_insumo.py --insumo historico-mensal --arquivo planilha.xlsx

Saída (stdout): {"ok": bool, "problemas": [...], "avisos": [...], "resumo": str | null}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
SCHEMAS_PADRAO = RAIZ / ".claude/skills/_shared/modelos-insumo/schemas.json"
MODELOS_PADRAO = RAIZ / ".claude/skills/_shared/modelos-insumo"

PADROES_PII = {
    "CPF": re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
    "e-mail": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "telefone": re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b"),
    "cartão": re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),
}
CABECALHOS_PII = [re.compile(p) for p in (
    r"\bcpf\b", r"\be-?mail\b", r"\btelefone\b", r"\bcelular\b", r"\bendereco\b", r"\bcep\b", r"\bcartao\b",
)]


def normalizar(texto: Any) -> str:
    t = unicodedata.normalize("NFD", str(texto or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t).strip().lower()


def vazio(valor: Any) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def ler_linha(ws, numero: int) -> List[str]:
    for linha in ws.iter_rows(min_row=numero, max_row=numero, values_only=True):
        return ["" if v is None else str(v).strip() for v in linha]
    return []


def colunas_esperadas(schema: Dict[str, Any], modelos_dir: Path) -> Tuple[List[str], bool]:
    modelo = modelos_dir / schema["modelo"]
    if not modelo.exists():
        return list(schema.get("colunas_obrigatorias", [])), False
    wb = openpyxl.load_workbook(modelo, data_only=True)
    ws = wb.worksheets[0]
    cabecalho = ler_linha(ws, schema["linha_cabecalho"])
    if "linha_marcadores" in schema:
        marcadores = ler_linha(ws, schema["linha_marcadores"])
        alvo = normalizar(schema["marcador_obrigatorio"])
        obrigatorias = [c for c, m in zip(cabecalho, marcadores) if c and normalizar(m) == alvo]
        return list(schema.get("colunas_obrigatorias", [])) + obrigatorias, True
    return [c for c in cabecalho if c], True


def validar(insumo_id: str, arquivo: Path, schemas_path: Path, modelos_dir: Path) -> Dict[str, Any]:
    schemas = json.loads(Path(schemas_path).read_text(encoding="utf-8"))
    schema = schemas.get(insumo_id)
    if schema is None:
        return {"ok": False, "problemas": [f"Não há regra de validação para “{insumo_id}”."], "avisos": [], "resumo": None}
    try:
        # sem read_only: exportações de e-commerce costumam vir sem a dimensão da planilha,
        # e o modo read_only então enxerga só a primeira célula
        wb = openpyxl.load_workbook(arquivo, data_only=True)
    except Exception:
        return {"ok": False, "avisos": [], "resumo": None,
                "problemas": ["Não consegui abrir a planilha. Confirme que é um arquivo Excel (.xlsx) e que não está protegido por senha."]}

    ws = wb.worksheets[0]
    linha_cab = int(schema["linha_cabecalho"])
    cabecalho = ler_linha(ws, linha_cab)
    indice = {normalizar(c): i for i, c in enumerate(cabecalho) if c}
    obrigatorias, tem_modelo = colunas_esperadas(schema, Path(modelos_dir))
    problemas: List[str] = []
    avisos: List[str] = []
    if not tem_modelo:
        avisos.append("O modelo oficial desta planilha ainda não está no projeto; conferi só as colunas básicas.")

    faltando = [c for c in dict.fromkeys(obrigatorias) if normalizar(c) not in indice]
    for c in faltando:
        problemas.append(f"Coluna “{c}” não encontrada na linha {linha_cab}. Use o modelo sem renomear as colunas.")
    for c in cabecalho:
        if c and any(p.search(normalizar(c)) for p in CABECALHOS_PII):
            problemas.append(f"A coluna “{c}” parece conter dado pessoal. Apague essa coluna antes de enviar.")

    linhas = list(ws.iter_rows(min_row=linha_cab + 1, values_only=True))
    resumo: Optional[str] = None

    if "coluna_mes" in schema:
        i_mes = indice.get(normalizar(schema["coluna_mes"]))
        if i_mes is not None:
            meses = [l for l in linhas if i_mes < len(l) and not vazio(l[i_mes])][: int(schema["meses_esperados"])]
            if len(meses) < int(schema["meses_esperados"]):
                problemas.append(f"Esperados {schema['meses_esperados']} meses, encontrados {len(meses)}.")
            for c in dict.fromkeys(obrigatorias):
                i = indice.get(normalizar(c))
                if i is None or i == i_mes:
                    continue
                vazios = [str(l[i_mes]).strip() for l in meses if i >= len(l) or vazio(l[i])]
                if vazios:
                    problemas.append(f"Coluna “{c}” vazia em {', '.join(vazios)}.")
            if meses:
                resumo = f"{len(meses)} meses ({str(meses[0][i_mes]).strip()} a {str(meses[-1][i_mes]).strip()})"
    else:
        dados = [(n, l) for n, l in enumerate(linhas, start=linha_cab + 1) if any(not vazio(v) for v in l)]
        if len(dados) < int(schema.get("min_linhas", 1)):
            problemas.append("A planilha não tem linhas de dados abaixo do cabeçalho.")
        resumo = f"{len(dados)} linha{'s' if len(dados) != 1 else ''} de dados"
        if schema.get("sensivel"):
            for tipo, padrao in PADROES_PII.items():
                achados: Dict[str, List[int]] = {}
                for numero, linha in dados:
                    for i, valor in enumerate(linha):
                        if isinstance(valor, str) and padrao.search(valor):
                            coluna = cabecalho[i] if i < len(cabecalho) and cabecalho[i] else f"coluna {i + 1}"
                            achados.setdefault(coluna, []).append(numero)
                for coluna, numeros in achados.items():
                    lista = ", ".join(str(n) for n in numeros[:5]) + ("…" if len(numeros) > 5 else "")
                    rotulo = "linha" if len(numeros) == 1 else "linhas"
                    problemas.append(f"Encontrei o que parece ser {tipo} na coluna “{coluna}” ({rotulo} {lista}). Remova antes de enviar.")

    return {"ok": not problemas, "problemas": problemas, "avisos": avisos, "resumo": resumo}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--insumo", required=True)
    parser.add_argument("--arquivo", required=True)
    parser.add_argument("--schemas", default=str(SCHEMAS_PADRAO))
    parser.add_argument("--modelos", default=str(MODELOS_PADRAO))
    args = parser.parse_args(argv)
    resultado = validar(args.insumo, Path(args.arquivo), Path(args.schemas), Path(args.modelos))
    json.dump(resultado, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests -q`
Expected: PASS (9 testes).

- [ ] **Step 6: Wrapper TypeScript (teste primeiro)**

`src/packages/core/test/validador.test.ts`:

```ts
import { writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { criarValidadorPython } from "../src/validador"
import { RAIZ } from "./ajuda"

describe("criarValidadorPython", () => {
  it("devolve o JSON do script", async () => {
    const falso = path.join(tmpdir(), `falso-${Date.now()}.xlsx`)
    await writeFile(falso, "não é excel")
    const r = await criarValidadorPython(RAIZ)({ insumoId: "clientes-historico", arquivoAbs: falso })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain("Não consegui abrir")
  })

  it("Python ausente vira problema legível", async () => {
    const r = await criarValidadorPython(RAIZ, "python-que-nao-existe")({ insumoId: "x", arquivoAbs: "/x" })
    expect(r).toMatchObject({ ok: false, problemas: [expect.stringContaining("Python 3")] })
  })
})
```

Run: `cd src/packages/core && npx vitest run test/validador.test.ts` → FAIL (módulo inexistente).

`src/packages/core/src/validador.ts`:

```ts
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { ResultadoValidacao } from "./tipos"

const exec = promisify(execFile)

export type Validar = (p: { insumoId: string; arquivoAbs: string }) => Promise<ResultadoValidacao>

export function criarValidadorPython(raiz: string, python = "python3"): Validar {
  const script = path.join(raiz, "scripts", "validar_insumo.py")
  return async ({ insumoId, arquivoAbs }) => {
    try {
      const { stdout } = await exec(python, [script, "--insumo", insumoId, "--arquivo", arquivoAbs], {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      })
      return JSON.parse(stdout) as ResultadoValidacao
    } catch {
      return {
        ok: false,
        problemas: ["Não consegui rodar a validação da planilha. Confira se o Python 3 com openpyxl está instalado."],
        avisos: [],
        resumo: null,
      }
    }
  }
}
```

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/validar_insumo.py scripts/tests .claude/skills/_shared/modelos-insumo src/packages/core
git commit -m "feat: validador de insumos contra o modelo oficial, com detecção de PII

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `ServicoPlanejamento` — estado, arquivos, ações e ferramentas MCP

**Files:**
- Create: `src/packages/core/src/barramento.ts`, `src/packages/core/src/servico-planejamento.ts`
- Test: `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 2–7 e 10 (`Validar`).
- Produces:
  - `class Barramento { assinar(slug, fn: (ev: EventoTempoReal) => void): () => void; publicar(slug, ev): void }`
  - `PASTA_MODELOS = ".claude/skills/_shared/modelos-insumo"`
  - `interface ConexaoTurnos { aoEnfileirar(slug): void; estaOcupado(slug): boolean }`
  - `interface RespostaFerramenta { ok: boolean; mensagem: string }`
  - `class ServicoPlanejamento` com `constructor({ armazenamento, catalogo, barramento, validar, agora?, gerarId? })` e os métodos públicos:
    `conectarTurnos(c)`, `estado(slug)`, `respostaEstado(slug, turnoAtivo)`, `listarProspects()`, `criarProspect(nome, site: string | null): Promise<string>`, `excluirProspect(slug, confirmacao)`, `iniciarEtapa(slug, etapa)`, `registrarMensagemAnalista(slug, etapa)`, `definirSessao(slug, etapa, sessionId)`, `concluirEtapa(slug, etapa)`, `reabrirEtapa(slug, etapa)`, `confirmarValida(slug, etapa)`, `revisarEtapa(slug, etapa)`, `aprovarEntregavel(slug, id)`, `pedirAjuste(slug, id, texto)`, `receberInsumoArquivo(slug, etapa, insumoId, arquivoTempAbs, nomeOriginal): Promise<ResultadoValidacao>`, `receberInsumoLink(slug, etapa, insumoId, url): Promise<ResultadoValidacao>`, `salvarAnexo(slug, nomeOriginal, dados: Uint8Array): Promise<string>`, `registrarConversa(slug, etapa, evento)`, `conversa(slug, etapa): Promise<EventoConversa[]>`, `enfileirar(slug, etapa, texto)`, `retirarFila(slug): Promise<ItemFila | null>`, `dossie(slug, etapa): Promise<string>`, `ferramenta(ctx: { slug; etapa }, nome, entrada): Promise<RespostaFerramenta>`.

- [ ] **Step 1: Barramento**

`src/packages/core/src/barramento.ts`:

```ts
import type { EventoTempoReal } from "./tipos"

type Ouvinte = (evento: EventoTempoReal) => void

/** Pub/sub em memória por prospect — alimenta o SSE da interface. */
export class Barramento {
  private readonly ouvintes = new Map<string, Set<Ouvinte>>()

  assinar(slug: string, ouvinte: Ouvinte): () => void {
    const conjunto = this.ouvintes.get(slug) ?? new Set<Ouvinte>()
    conjunto.add(ouvinte)
    this.ouvintes.set(slug, conjunto)
    return () => {
      conjunto.delete(ouvinte)
    }
  }

  publicar(slug: string, evento: EventoTempoReal): void {
    for (const ouvinte of this.ouvintes.get(slug) ?? []) {
      try {
        ouvinte(evento)
      } catch {
        // conexão SSE já fechada: ignorar
      }
    }
  }
}
```

- [ ] **Step 2: Escrever os testes**

`src/packages/core/test/servico-planejamento.test.ts`:

```ts
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroEntrada, ErroProspectExistente, ErroTurnoAtivo } from "../src/erros"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import type { EventoTempoReal, ResultadoValidacao } from "../src/tipos"
import { catalogoReal, raizTemporaria } from "./ajuda"

let raiz: string
let servico: ServicoPlanejamento
let barramento: Barramento
let eventos: EventoTempoReal[]
let enfileirados: string[]
let ocupado: boolean
let proximaValidacao: ResultadoValidacao
let contador: number

beforeEach(async () => {
  raiz = await raizTemporaria()
  barramento = new Barramento()
  eventos = []
  enfileirados = []
  ocupado = false
  contador = 0
  proximaValidacao = { ok: true, problemas: [], avisos: [], resumo: "12 meses (JANEIRO a DEZEMBRO)" }
  servico = new ServicoPlanejamento({
    armazenamento: new FsArmazenamento(raiz, async () => {}),
    catalogo: catalogoReal(),
    barramento,
    validar: async () => proximaValidacao,
    agora: () => "2026-09-28T10:00:00.000Z",
    gerarId: () => `id${++contador}`,
  })
  servico.conectarTurnos({ aoEnfileirar: (s) => enfileirados.push(s), estaOcupado: () => ocupado })
})

const ctx03 = { slug: "iszi-cosmeticos", etapa: "03" as const }

async function prospectNaEtapa03() {
  const slug = await servico.criarProspect("Iszi Cosméticos", "https://iszi.com.br")
  const e = await servico.estado(slug)
  // atalho de teste: marca 01 e 02 como concluídas direto no arquivo
  e.etapas["01"].status = "concluida"
  e.etapas["02"].status = "concluida"
  e.etapas["03"].status = "liberada"
  await writeFile(path.join(raiz, "clientes", slug, ".app/estado.json"), JSON.stringify(e))
  await servico.iniciarEtapa(slug, "03")
  return slug
}

async function rascunho(slug: string, nome: string, conteudo = "png") {
  const dir = path.join(raiz, "clientes", slug, ".app/rascunhos")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, nome), conteudo)
}

describe("criar e excluir prospect", () => {
  it("cria pasta, estado, status, título do CLAUDE.md e registra o site", async () => {
    const slug = await servico.criarProspect("  Iszi Cosméticos ", "https://iszi.com.br")
    expect(slug).toBe("iszi-cosmeticos")
    const pasta = path.join(raiz, "clientes", slug)
    expect(await readFile(path.join(pasta, "CLAUDE.md"), "utf8")).toMatch(/^# Iszi Cosméticos/)
    expect(await readFile(path.join(pasta, "contexto/site-referencia.md"), "utf8")).toContain("**Link:** https://iszi.com.br/")
    expect(await readFile(path.join(pasta, "contexto/status-planejamento.md"), "utf8")).toContain("| 00 · Criar prospect | ✅ |")
    const e = await servico.estado(slug)
    expect(e.insumos.find((i) => i.insumoId === "site")?.status).toBe("valido")
  })

  it.each(["", "   ", "!!!", "Template"])("recusa nome inválido %j", async (nome) => {
    await expect(servico.criarProspect(nome, null)).rejects.toBeInstanceOf(ErroEntrada)
  })

  it("recusa site sem http(s) e nome repetido", async () => {
    await expect(servico.criarProspect("A", "iszi.com.br")).rejects.toBeInstanceOf(ErroEntrada)
    await servico.criarProspect("A", null)
    await expect(servico.criarProspect("a", null)).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("exclusão exige confirmação exata e nenhum turno ativo", async () => {
    const slug = await servico.criarProspect("A", null)
    await expect(servico.excluirProspect(slug, "b")).rejects.toBeInstanceOf(ErroEntrada)
    ocupado = true
    await expect(servico.excluirProspect(slug, "a")).rejects.toBeInstanceOf(ErroTurnoAtivo)
    ocupado = false
    await servico.excluirProspect(slug, "a")
  })
})

describe("prospect antigo, feito no terminal", () => {
  it("importa do status-planejamento.md e reconhece insumos já na pasta", async () => {
    const pasta = path.join(raiz, "clientes", "adda")
    await mkdir(path.join(pasta, "contexto"), { recursive: true })
    await mkdir(path.join(pasta, "dados"), { recursive: true })
    await writeFile(path.join(pasta, "CLAUDE.md"), "# Adda\n")
    await writeFile(path.join(pasta, "dados/historico-mensal.xlsx"), "x")
    await writeFile(
      path.join(pasta, "contexto/status-planejamento.md"),
      "| 00 · Criar prospect | ✅ | 2026-09-21 | |\n| 01 · Preparação de contexto | ✅ | 2026-09-21 | |\n| 02 · Contextualização estratégica | ✅ | 2026-09-21 | |\n",
    )
    const [resumo] = await servico.listarProspects()
    expect(resumo).toMatchObject({ slug: "adda", nome: "Adda", etapaAtual: "03", concluidas: 2 })
    const e = await servico.estado("adda")
    expect(e.etapas["01"].origem).toBe("terminal")
    expect(e.insumos.find((i) => i.insumoId === "historico-mensal")?.status).toBe("valido")
  })
})

describe("ferramentas do agente", () => {
  it("propor_entregavel recusa arquivo inexistente ou fora de rascunhos", async () => {
    const slug = await prospectNaEtapa03()
    const base = { tipo: "grafico", titulo: "Investimento", nome_final: "investimento-total-mensal" }
    const semArquivo = await servico.ferramenta(ctx03, "propor_entregavel", { ...base, arquivo_rascunho: ".app/rascunhos/nao.png" })
    expect(semArquivo).toMatchObject({ ok: false, mensagem: expect.stringContaining("não encontrado") })
    const fora = await servico.ferramenta(ctx03, "propor_entregavel", { ...base, arquivo_rascunho: "../outro/x.png" })
    expect(fora.ok).toBe(false)
    await writeFile(path.join(raiz, "clientes", slug, "dados/g.png"), "x")
    const foraRascunho = await servico.ferramenta(ctx03, "propor_entregavel", { ...base, arquivo_rascunho: "dados/g.png" })
    expect(foraRascunho).toMatchObject({ ok: false, mensagem: expect.stringContaining(".app/rascunhos/") })
  })

  it("propor_entregavel aceita caminho absoluto ou relativo à raiz, congela a cópia e cria o card", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png", "versao-1")
    const r = await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento total — mensal",
      arquivo_rascunho: path.join(raiz, "clientes", slug, ".app/rascunhos/g.png"),
      nome_final: "investimento-total-mensal",
    })
    expect(r.ok).toBe(true)
    await rascunho(slug, "g.png", "versao-2")
    const e = await servico.estado(slug)
    expect(e.entregaveis[0]).toMatchObject({ id: "id1", status: "pendente", arquivoRascunho: ".app/propostas/id1.png" })
    expect(await readFile(path.join(raiz, "clientes", slug, ".app/propostas/id1.png"), "utf8")).toBe("versao-1")
    expect((await servico.conversa(slug, "03")).at(-1)).toMatchObject({ tipo: "card_entregavel", entregavelId: "id1" })
  })

  it("aprovar copia para ativos-aprovados e enfileira a mensagem ao agente", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    await servico.aprovarEntregavel(slug, "id1")
    expect(existsSync(path.join(raiz, "clientes", slug, "entrega/ativos-aprovados/graficos/investimento-total-mensal.png"))).toBe(true)
    expect(enfileirados).toEqual([slug])
    expect((await servico.retirarFila(slug))?.texto).toContain("APROVOU")
    expect(await servico.retirarFila(slug)).toBeNull()
  })

  it("solicitar_insumo só aceita insumo da etapa", async () => {
    const slug = await prospectNaEtapa03()
    expect((await servico.ferramenta(ctx03, "solicitar_insumo", { insumo_id: "clientes-historico" })).ok).toBe(false)
    expect((await servico.ferramenta(ctx03, "solicitar_insumo", { insumo_id: "historico-mensal" })).ok).toBe(true)
    expect((await servico.conversa(slug, "03")).at(-1)).toMatchObject({ tipo: "card_insumo", insumoId: "historico-mensal" })
  })

  it("sinalizar lista o que falta; concluir grava o arquivo de decisões e libera a 04", async () => {
    const slug = await prospectNaEtapa03()
    const sinal = { resumo_decisoes: "- ROAS médio 7,68x", handoff_proxima: "Me manda a planilha de clientes." }
    const antes = await servico.ferramenta(ctx03, "sinalizar_etapa_pronta", sinal)
    expect(antes.mensagem).toContain("Histórico mensal")
    const temp = path.join(raiz, "upload.xlsx")
    await writeFile(temp, "x")
    await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "Histórico.xlsx")
    expect((await servico.estado(slug)).etapas["03"].status).toBe("pronta")
    await servico.concluirEtapa(slug, "03")
    const decisoes = await readFile(path.join(raiz, "clientes", slug, "contexto/decisoes/03-diagnostico-performance.md"), "utf8")
    expect(decisoes).toContain("- ROAS médio 7,68x")
    expect((await servico.estado(slug)).etapas["04"].status).toBe("liberada")
  })

  it("ferramenta desconhecida e entrada sem campo obrigatório viram erro para o agente", async () => {
    await prospectNaEtapa03()
    expect((await servico.ferramenta(ctx03, "xyz", {})).ok).toBe(false)
    expect((await servico.ferramenta(ctx03, "propor_entregavel", { tipo: "grafico" })).mensagem).toContain("titulo")
  })
})

describe("insumos", () => {
  it("formato errado é recusado sem chamar o validador", async () => {
    const slug = await prospectNaEtapa03()
    const temp = path.join(raiz, "upload.csv")
    await writeFile(temp, "x")
    const r = await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.csv")
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain(".xlsx")
    expect(existsSync(temp)).toBe(false)
  })

  it("planilha inválida fica registrada com os problemas e não vai para dados/", async () => {
    const slug = await prospectNaEtapa03()
    proximaValidacao = { ok: false, problemas: ["Esperados 12 meses, encontrados 10."], avisos: [], resumo: null }
    const temp = path.join(raiz, "upload.xlsx")
    await writeFile(temp, "x")
    await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx")
    const e = await servico.estado(slug)
    expect(e.insumos.find((i) => i.insumoId === "historico-mensal")).toMatchObject({ status: "invalido" })
    expect(existsSync(path.join(raiz, "clientes", slug, "dados/historico-mensal.xlsx"))).toBe(false)
  })
})

describe("robustez", () => {
  it("duas mutações simultâneas não perdem atualização", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "a.png")
    await rascunho(slug, "b.png")
    await Promise.all([
      servico.ferramenta(ctx03, "propor_entregavel", { tipo: "grafico", titulo: "A", arquivo_rascunho: ".app/rascunhos/a.png", nome_final: "grafico-a" }),
      servico.ferramenta(ctx03, "propor_entregavel", { tipo: "grafico", titulo: "B", arquivo_rascunho: ".app/rascunhos/b.png", nome_final: "grafico-b" }),
      servico.enfileirar(slug, "03", "mensagem"),
    ])
    const e = await servico.estado(slug)
    expect(e.entregaveis.map((x) => x.titulo).sort()).toEqual(["A", "B"])
    expect(e.filaAutomatica).toHaveLength(1)
  })

  it("turno sem fim e sem processo ativo aparece como interrompido", async () => {
    const slug = await prospectNaEtapa03()
    await servico.registrarConversa(slug, "03", { tipo: "turno_inicio", em: "t" })
    await servico.registrarConversa(slug, "03", { tipo: "texto_agente", texto: "Começando…", em: "t" })
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "interrompido" })
    expect((await servico.conversa(slug, "03")).filter((e) => e.tipo === "turno_fim")).toHaveLength(1)
  })

  it("publica estado a cada gravação", async () => {
    const slug = await servico.criarProspect("A", null)
    barramento.assinar(slug, (ev) => eventos.push(ev))
    await servico.iniciarEtapa(slug, "01")
    expect(eventos.map((e) => e.tipo)).toContain("estado")
    expect(eventos.map((e) => e.tipo)).toContain("conversa")
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-planejamento.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`src/packages/core/src/servico-planejamento.ts`:

```ts
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"
import type { FsArmazenamento } from "./armazenamento"
import type { Barramento } from "./barramento"
import { etapaDoCatalogo, insumoDoCatalogo } from "./catalogo"
import { extrairOverrides, montarDossie, type AnteriorDossie } from "./dossie"
import {
  aprovarEntregavel,
  destinoAprovado,
  encontrarEntregavel,
  EXTENSAO_POR_TIPO,
  pedirAjuste,
  proporEntregavel,
} from "./entregaveis"
import { ehErroDominio, ErroEntrada, ErroNaoEncontrado, ErroTurnoAtivo } from "./erros"
import { destinoInsumo, extensao, extensaoAceita, nomeSeguro, registrarInsumo } from "./insumos"
import * as me from "./maquina-estados"
import { mensagemAjuste, mensagemAprovacao, mensagemEtapaAnteriorAlterada, mensagemInsumoRecebido } from "./prompts"
import { normalizarSlug } from "./slug"
import { importarStatusMd, renderStatusMd } from "./status-md"
import {
  ORDEM_ETAPAS,
  TIPOS_ENTREGAVEL,
  type Catalogo,
  type Estado,
  type EtapaId,
  type EventoConversa,
  type InsumoCatalogo,
  type ItemFila,
  type RespostaEstado,
  type ResultadoValidacao,
  type ResumoProspect,
  type TipoEntregavel,
} from "./tipos"
import type { Validar } from "./validador"

export const PASTA_MODELOS = ".claude/skills/_shared/modelos-insumo"
const CONTEXTO_PERSISTIDO = [
  "contexto/kickoff-transcricao.md",
  "contexto/contextualizacao-estrategica.md",
  "contexto/site-referencia.md",
]
const ARQUIVO_STATUS = "contexto/status-planejamento.md"

export interface DependenciasServico {
  armazenamento: FsArmazenamento
  catalogo: Catalogo
  barramento: Barramento
  validar: Validar
  agora?: () => string
  gerarId?: () => string
}

export interface ConexaoTurnos {
  aoEnfileirar: (slug: string) => void
  estaOcupado: (slug: string) => boolean
}

export interface RespostaFerramenta {
  ok: boolean
  mensagem: string
}

function campoTexto(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !valor.trim()) throw new ErroEntrada(`Campo obrigatório ausente: ${campo}`)
  return valor.trim()
}

function validarUrl(url: string): string {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    throw new ErroEntrada("Site inválido. Use o endereço completo, começando com https://")
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ErroEntrada("Site inválido. Use o endereço completo, começando com https://")
  }
  return u.toString()
}

function ultimoIndice<T>(lista: T[], teste: (x: T) => boolean): number {
  for (let i = lista.length - 1; i >= 0; i--) if (teste(lista[i]!)) return i
  return -1
}

export class ServicoPlanejamento {
  private readonly arm: FsArmazenamento
  private readonly catalogo: Catalogo
  private readonly barramento: Barramento
  private readonly validar: Validar
  private readonly agora: () => string
  private readonly gerarId: () => string
  private readonly exclusoes = new Map<string, Promise<unknown>>()
  private turnos: ConexaoTurnos = { aoEnfileirar: () => {}, estaOcupado: () => false }

  constructor(d: DependenciasServico) {
    this.arm = d.armazenamento
    this.catalogo = d.catalogo
    this.barramento = d.barramento
    this.validar = d.validar
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.gerarId = d.gerarId ?? (() => randomUUID())
  }

  conectarTurnos(conexao: ConexaoTurnos): void {
    this.turnos = conexao
  }

  // ---------- núcleo: um prospect por vez, estado sempre salvo junto com o status.md ----------

  /** Serializa operações por prospect (evita perder atualização do estado.json). */
  private exclusivo<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const anterior = this.exclusoes.get(slug) ?? Promise.resolve()
    const atual = anterior.then(fn, fn)
    this.exclusoes.set(
      slug,
      atual.catch(() => {}),
    )
    return atual
  }

  private async carregar(slug: string): Promise<Estado> {
    if (!(await this.arm.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não existe.`)
    const salvo = await this.arm.lerEstado(slug)
    if (salvo) return salvo
    const md = await this.arm.lerTexto(slug, ARQUIVO_STATUS)
    const claudeMd = await this.arm.lerTexto(slug, "CLAUDE.md")
    const titulo = claudeMd?.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const nome = titulo && titulo !== "[Nome do Prospect]" ? titulo : slug
    const prospect = { slug, nome, site: null }
    let estado = md
      ? importarStatusMd(md, this.catalogo, prospect, this.agora())
      : me.estadoInicial(prospect, this.agora())
    estado = await this.detectarInsumosExistentes(slug, estado)
    await this.salvar(slug, estado)
    return estado
  }

  private async salvar(slug: string, estado: Estado): Promise<void> {
    await this.arm.gravarEstado(slug, estado)
    await this.arm.gravarTexto(slug, ARQUIVO_STATUS, renderStatusMd(estado, this.catalogo))
    this.barramento.publicar(slug, { tipo: "estado" })
  }

  private mutar<T>(slug: string, fn: (e: Estado) => Promise<{ estado: Estado; resultado: T }> | { estado: Estado; resultado: T }): Promise<T> {
    return this.exclusivo(slug, async () => {
      const { estado, resultado } = await fn(await this.carregar(slug))
      await this.salvar(slug, estado)
      return resultado
    })
  }

  private async detectarInsumosExistentes(slug: string, estado: Estado): Promise<Estado> {
    let novo = estado
    for (const etapa of this.catalogo.etapas) {
      if (novo.etapas[etapa.id].status === "concluida") continue
      for (const ref of etapa.insumos) {
        const insumo = insumoDoCatalogo(this.catalogo, ref.id)
        const arquivo = await this.encontrarNoDisco(slug, insumo)
        if (!arquivo) continue
        novo = registrarInsumo(
          novo,
          {
            etapa: etapa.id,
            insumoId: insumo.id,
            status: "valido",
            problemas: [],
            avisos: ["O arquivo já estava na pasta do prospect e não passou pela validação da interface."],
            resumo: null,
            arquivo,
          },
          this.agora(),
        )
      }
    }
    return novo
  }

  private async encontrarNoDisco(slug: string, insumo: InsumoCatalogo): Promise<string | null> {
    if (insumo.tipo === "link") {
      const texto = await this.arm.lerTexto(slug, insumo.destino)
      return texto && /\*\*Link:\*\*\s*https?:\/\//.test(texto) ? insumo.destino : null
    }
    if (insumo.destino.endsWith("/")) {
      return (await this.arm.listarArquivos(slug, insumo.destino)).length > 0 ? insumo.destino : null
    }
    for (const formato of insumo.formatos) {
      const rel = `${insumo.destino}${formato}`
      if (await this.arm.existeArquivo(slug, rel)) return rel
    }
    return null
  }

  private async gravarLink(slug: string, destino: string, url: string): Promise<void> {
    const atual = (await this.arm.lerTexto(slug, destino)) ?? "# Referência do E-commerce\n\n**Link:**\n"
    const novo = /\*\*Link:\*\*.*$/m.test(atual)
      ? atual.replace(/\*\*Link:\*\*.*$/m, `**Link:** ${url}`)
      : `${atual.trimEnd()}\n\n**Link:** ${url}\n`
    await this.arm.gravarTexto(slug, destino, novo)
  }

  // ---------- leitura ----------

  estado(slug: string): Promise<Estado> {
    return this.exclusivo(slug, () => this.carregar(slug))
  }

  async respostaEstado(slug: string, turnoAtivo: EtapaId | null): Promise<RespostaEstado> {
    const estado = await this.estado(slug)
    const condicoes = Object.fromEntries(
      ORDEM_ETAPAS.map((id) => [id, me.condicoesConcluir(estado, id, this.catalogo)]),
    ) as Record<EtapaId, string[]>
    const modelosDisponiveis = this.catalogo.insumos
      .filter((i) => i.modelo && existsSync(path.join(this.arm.raiz, PASTA_MODELOS, i.modelo)))
      .map((i) => i.id)
    return { estado, catalogo: this.catalogo, condicoes, turnoAtivo, modelosDisponiveis }
  }

  async listarProspects(): Promise<ResumoProspect[]> {
    const resumos: ResumoProspect[] = []
    for (const slug of await this.arm.listarSlugs()) {
      try {
        resumos.push(this.resumir(await this.estado(slug)))
      } catch (e) {
        console.error(`Não consegui ler o prospect ${slug}:`, e)
      }
    }
    return resumos.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  }

  private resumir(e: Estado): ResumoProspect {
    const prioridades = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
    let atual: EtapaId | null = null
    for (const grupo of prioridades) {
      atual = ORDEM_ETAPAS.find((id) => grupo.includes(e.etapas[id].status)) ?? null
      if (atual) break
    }
    return {
      slug: e.prospect.slug,
      nome: e.prospect.nome,
      etapaAtual: atual,
      rotuloEtapaAtual: atual ? etapaDoCatalogo(this.catalogo, atual).rotuloStatus : "Planejamento concluído",
      concluidas: ORDEM_ETAPAS.filter((id) => id !== "final" && e.etapas[id].status === "concluida").length,
      totalEtapas: ORDEM_ETAPAS.length - 1,
      pendencias: e.entregaveis.filter((x) => x.status === "pendente").length,
      atualizadoEm: e.atualizadoEm,
    }
  }

  async dossie(slug: string, etapa: EtapaId): Promise<string> {
    const estado = await this.estado(slug)
    const anteriores: AnteriorDossie[] = []
    for (const id of ORDEM_ETAPAS.slice(0, ORDEM_ETAPAS.indexOf(etapa))) {
      const ee = estado.etapas[id]
      if (ee.status !== "concluida" && ee.status !== "desatualizada") continue
      const cat = etapaDoCatalogo(this.catalogo, id)
      const resumo =
        ee.resumoDecisoes ?? (cat.skill ? await this.arm.lerTexto(slug, `contexto/decisoes/${cat.skill}.md`) : null)
      anteriores.push({ rotulo: cat.rotuloStatus, origem: ee.origem, resumo, desatualizada: ee.status === "desatualizada" })
    }
    const contextoPersistido: string[] = []
    for (const c of CONTEXTO_PERSISTIDO) if (await this.arm.existeArquivo(slug, c)) contextoPersistido.push(c)
    const insumosRecebidos = estado.insumos
      .filter((i) => i.etapa === etapa && i.status === "valido" && i.arquivo)
      .map((i) => ({ nome: insumoDoCatalogo(this.catalogo, i.insumoId).nome, arquivo: i.arquivo! }))
    return montarDossie({
      nome: estado.prospect.nome,
      slug,
      site: estado.prospect.site,
      anteriores,
      aprovados: await this.arm.listarAprovados(slug),
      overrides: extrairOverrides(await this.arm.lerTexto(slug, "CLAUDE.md")),
      contextoPersistido,
      insumosRecebidos,
    })
  }

  // ---------- prospects ----------

  async criarProspect(nome: string, site: string | null): Promise<string> {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) throw new ErroEntrada("Informe o nome do prospect.")
    const slug = normalizarSlug(nomeLimpo)
    if (!slug) throw new ErroEntrada("O nome precisa ter pelo menos uma letra ou número.")
    if (slug === "template") throw new ErroEntrada("Esse nome é reservado. Escolha outro.")
    const siteLimpo = site ? validarUrl(site) : null
    await this.arm.criarPasta(slug)
    const claudeMd = await this.arm.lerTexto(slug, "CLAUDE.md")
    if (claudeMd) await this.arm.gravarTexto(slug, "CLAUDE.md", claudeMd.replace("# [Nome do Prospect]", `# ${nomeLimpo}`))
    return this.exclusivo(slug, async () => {
      let estado = me.estadoInicial({ slug, nome: nomeLimpo, site: siteLimpo }, this.agora())
      if (siteLimpo) {
        await this.gravarLink(slug, "contexto/site-referencia.md", siteLimpo)
        estado = registrarInsumo(
          estado,
          { etapa: "01", insumoId: "site", status: "valido", problemas: [], avisos: [], resumo: siteLimpo, arquivo: "contexto/site-referencia.md" },
          this.agora(),
        )
      }
      await this.salvar(slug, estado)
      return slug
    })
  }

  async excluirProspect(slug: string, confirmacao: string): Promise<void> {
    if (confirmacao.trim() !== slug) {
      throw new ErroEntrada("Digite o nome da pasta exatamente como aparece para confirmar.")
    }
    if (this.turnos.estaOcupado(slug)) throw new ErroTurnoAtivo()
    await this.exclusivo(slug, () => this.arm.excluir(slug))
    this.exclusoes.delete(slug)
  }

  // ---------- etapas ----------

  async iniciarEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.iniciarEtapa(e, etapa, this.agora()), resultado: undefined }))
    await this.registrarConversa(slug, etapa, {
      tipo: "aviso",
      nivel: "info",
      texto: "Etapa iniciada. O agente recebeu o dossiê das etapas anteriores.",
      em: this.agora(),
    })
  }

  async registrarMensagemAnalista(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.registrarMensagemAnalista(e, etapa, this.agora()), resultado: undefined }))
  }

  async definirSessao(slug: string, etapa: EtapaId, sessionId: string): Promise<void> {
    await this.mutar(slug, (e) => ({
      estado: e.etapas[etapa].sessionId === sessionId ? e : me.comEtapa(e, etapa, { sessionId }, this.agora()),
      resultado: undefined,
    }))
  }

  async concluirEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, async (e) => {
      const novo = me.concluirEtapa(e, etapa, this.catalogo, this.agora())
      const cat = etapaDoCatalogo(this.catalogo, etapa)
      const resumo = novo.etapas[etapa].resumoDecisoes
      if (resumo && cat.skill) {
        await this.arm.gravarTexto(slug, `contexto/decisoes/${cat.skill}.md`, `# Decisões — ${cat.rotuloStatus}\n\n${resumo.trim()}\n`)
      }
      return { estado: novo, resultado: undefined }
    })
  }

  async reabrirEtapa(slug: string, etapa: EtapaId): Promise<void> {
    const afetadas = await this.mutar(slug, (e) => {
      const r = me.reabrirEtapa(e, etapa, this.agora())
      return { estado: r.estado, resultado: r.afetadasEmAndamento }
    })
    const rotulo = etapaDoCatalogo(this.catalogo, etapa).rotuloStatus
    for (const outra of afetadas) {
      await this.registrarConversa(slug, outra, {
        tipo: "aviso",
        nivel: "alerta",
        texto: `A etapa ${rotulo} foi reaberta. O que for aprovado lá pode mudar as bases desta etapa.`,
        em: this.agora(),
      })
      await this.enfileirar(slug, outra, mensagemEtapaAnteriorAlterada(rotulo))
    }
  }

  async confirmarValida(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.confirmarValida(e, etapa, this.agora()), resultado: undefined }))
  }

  async revisarEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.revisarEtapa(e, etapa, this.agora()), resultado: undefined }))
  }

  // ---------- entregáveis ----------

  async aprovarEntregavel(slug: string, id: string): Promise<void> {
    const aprovado = await this.mutar(slug, async (e) => {
      const alvo = encontrarEntregavel(e, id)
      let novo = aprovarEntregavel(e, id, this.agora())
      const destino = destinoAprovado(alvo)
      await this.arm.copiar(slug, alvo.arquivoRascunho, destino)
      novo = me.reavaliarPronta(novo, alvo.etapa, this.catalogo, this.agora())
      return { estado: novo, resultado: { ...alvo, destino } }
    })
    await this.enfileirar(
      slug,
      aprovado.etapa,
      mensagemAprovacao(aprovado.titulo, aprovado.nomeFinal, `clientes/${slug}/${aprovado.destino}`),
    )
  }

  async pedirAjuste(slug: string, id: string, texto: string): Promise<void> {
    const alvo = await this.mutar(slug, (e) => {
      const entregavel = encontrarEntregavel(e, id)
      let novo = pedirAjuste(e, id, texto, this.agora())
      novo = me.registrarMensagemAnalista(novo, entregavel.etapa, this.agora())
      return { estado: novo, resultado: entregavel }
    })
    await this.enfileirar(slug, alvo.etapa, mensagemAjuste(alvo.titulo, alvo.nomeFinal, texto.trim()))
  }

  // ---------- insumos e anexos ----------

  private insumoDaEtapa(etapa: EtapaId, insumoId: string): InsumoCatalogo {
    const cat = etapaDoCatalogo(this.catalogo, etapa)
    if (!cat.insumos.some((r) => r.id === insumoId)) {
      throw new ErroEntrada(
        `O insumo "${insumoId}" não pertence a esta etapa. Ids válidos aqui: ${cat.insumos.map((r) => r.id).join(", ") || "nenhum"}.`,
      )
    }
    return insumoDoCatalogo(this.catalogo, insumoId)
  }

  async receberInsumoArquivo(
    slug: string,
    etapa: EtapaId,
    insumoId: string,
    arquivoTemp: string,
    nomeOriginal: string,
  ): Promise<ResultadoValidacao> {
    const insumo = this.insumoDaEtapa(etapa, insumoId)
    if (insumo.tipo !== "arquivo") throw new ErroEntrada("Este insumo é um link, não um arquivo.")
    let resultado: ResultadoValidacao
    if (!extensaoAceita(insumo, nomeOriginal)) {
      resultado = { ok: false, problemas: [`Formato não aceito. Envie ${insumo.formatos.join(" ou ")}.`], avisos: [], resumo: null }
    } else if (insumo.validador) {
      resultado = await this.validar({ insumoId, arquivoAbs: arquivoTemp })
    } else {
      resultado = { ok: true, problemas: [], avisos: [], resumo: nomeOriginal }
    }
    let destino: string | null = null
    if (resultado.ok) {
      destino = destinoInsumo(insumo, nomeOriginal)
      await this.arm.moverParaDentro(slug, arquivoTemp, destino)
    } else {
      await rm(arquivoTemp, { force: true })
    }
    await this.registrarResultadoInsumo(slug, etapa, insumo, resultado, destino)
    return resultado
  }

  async receberInsumoLink(slug: string, etapa: EtapaId, insumoId: string, url: string): Promise<ResultadoValidacao> {
    const insumo = this.insumoDaEtapa(etapa, insumoId)
    if (insumo.tipo !== "link") throw new ErroEntrada("Este insumo é um arquivo, não um link.")
    const limpo = validarUrl(url)
    await this.gravarLink(slug, insumo.destino, limpo)
    const resultado: ResultadoValidacao = { ok: true, problemas: [], avisos: [], resumo: limpo }
    await this.registrarResultadoInsumo(slug, etapa, insumo, resultado, insumo.destino)
    return resultado
  }

  private async registrarResultadoInsumo(
    slug: string,
    etapa: EtapaId,
    insumo: InsumoCatalogo,
    resultado: ResultadoValidacao,
    destino: string | null,
  ): Promise<void> {
    const emAndamento = await this.mutar(slug, (e) => {
      let novo = registrarInsumo(
        e,
        {
          etapa,
          insumoId: insumo.id,
          status: resultado.ok ? "valido" : "invalido",
          problemas: resultado.problemas,
          avisos: resultado.avisos,
          resumo: resultado.resumo,
          arquivo: destino,
        },
        this.agora(),
      )
      novo = me.reavaliarPronta(novo, etapa, this.catalogo, this.agora())
      const s = novo.etapas[etapa].status
      return { estado: novo, resultado: s === "em_andamento" || s === "pronta" }
    })
    if (resultado.ok && destino && emAndamento) {
      await this.enfileirar(slug, etapa, mensagemInsumoRecebido(insumo.nome, `clientes/${slug}/${destino}`, resultado.resumo))
    }
  }

  async salvarAnexo(slug: string, nomeOriginal: string, dados: Uint8Array): Promise<string> {
    const rel = `.app/anexos/${Date.now()}-${nomeSeguro(nomeOriginal)}`
    await this.arm.gravarBinario(slug, rel, dados)
    return `clientes/${slug}/${rel}`
  }

  // ---------- conversa e fila automática ----------

  async registrarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    await this.arm.anexarConversa(slug, etapa, evento)
    this.barramento.publicar(slug, { tipo: "conversa", etapa, evento })
  }

  async conversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    const eventos = await this.arm.lerConversa(slug, etapa)
    const inicio = ultimoIndice(eventos, (e) => e.tipo === "turno_inicio")
    const fim = ultimoIndice(eventos, (e) => e.tipo === "turno_fim")
    if (inicio > fim && !this.turnos.estaOcupado(slug)) {
      const interrompido: EventoConversa = {
        tipo: "turno_fim",
        status: "interrompido",
        detalhe: "O app foi fechado ou o processo parou antes de o agente terminar.",
        em: this.agora(),
      }
      await this.arm.anexarConversa(slug, etapa, interrompido)
      eventos.push(interrompido)
    }
    return eventos
  }

  async enfileirar(slug: string, etapa: EtapaId, texto: string): Promise<void> {
    await this.mutar(slug, (e) => ({
      estado: { ...e, filaAutomatica: [...e.filaAutomatica, { etapa, texto }], atualizadoEm: this.agora() },
      resultado: undefined,
    }))
    this.turnos.aoEnfileirar(slug)
  }

  /** Tira da fila tudo o que é da primeira etapa com pendência e junta numa mensagem só. */
  async retirarFila(slug: string): Promise<ItemFila | null> {
    return this.mutar(slug, (e) => {
      const primeiro = e.filaAutomatica[0]
      if (!primeiro) return { estado: e, resultado: null }
      const daEtapa = e.filaAutomatica.filter((i) => i.etapa === primeiro.etapa)
      const resto = e.filaAutomatica.filter((i) => i.etapa !== primeiro.etapa)
      return {
        estado: { ...e, filaAutomatica: resto, atualizadoEm: this.agora() },
        resultado: { etapa: primeiro.etapa, texto: daEtapa.map((i) => i.texto).join("\n\n") },
      }
    })
  }

  // ---------- ferramentas do MCP "planejamento" ----------

  async ferramenta(ctx: { slug: string; etapa: EtapaId }, nome: string, entrada: unknown): Promise<RespostaFerramenta> {
    try {
      const dados = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>
      if (nome === "propor_entregavel") return await this.ferramentaPropor(ctx.slug, ctx.etapa, dados)
      if (nome === "solicitar_insumo") return await this.ferramentaSolicitar(ctx.slug, ctx.etapa, dados)
      if (nome === "sinalizar_etapa_pronta") return await this.ferramentaSinalizar(ctx.slug, ctx.etapa, dados)
      return { ok: false, mensagem: `Ferramenta desconhecida: ${nome}` }
    } catch (e) {
      if (ehErroDominio(e)) return { ok: false, mensagem: e.message }
      throw e
    }
  }

  private async ferramentaPropor(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const tipo = campoTexto(d.tipo, "tipo") as TipoEntregavel
    const titulo = campoTexto(d.titulo, "titulo")
    const arquivo = campoTexto(d.arquivo_rascunho, "arquivo_rascunho")
    const nomeFinal = campoTexto(d.nome_final, "nome_final")
    if (!TIPOS_ENTREGAVEL.includes(tipo)) {
      throw new ErroEntrada(`tipo "${tipo}" inválido. Use um de: ${TIPOS_ENTREGAVEL.join(", ")}.`)
    }
    const rel = this.arm.relativoAoProspect(slug, arquivo)
    if (!rel.startsWith(".app/rascunhos/")) {
      throw new ErroEntrada(`Salve o arquivo em clientes/${slug}/.app/rascunhos/ antes de propor (recebido: ${arquivo}).`)
    }
    if (!(await this.arm.existeArquivo(slug, rel))) {
      throw new ErroEntrada(`Arquivo não encontrado: clientes/${slug}/${rel}. Gere o arquivo antes de propor.`)
    }
    const ext = extensao(rel)
    if (ext !== EXTENSAO_POR_TIPO[tipo]) {
      throw new ErroEntrada(`Um entregável do tipo "${tipo}" precisa ser ${EXTENSAO_POR_TIPO[tipo]} (recebido: ${ext || "sem extensão"}).`)
    }
    const id = this.gerarId()
    const copia = `.app/propostas/${id}${ext}`
    await this.mutar(slug, async (e) => {
      const novo = proporEntregavel(e, { etapa, tipo, titulo, arquivoRascunho: copia, nomeFinal }, id, this.agora())
      await this.arm.copiar(slug, rel, copia)
      return { estado: me.reavaliarPronta(novo, etapa, this.catalogo, this.agora()), resultado: undefined }
    })
    await this.registrarConversa(slug, etapa, { tipo: "card_entregavel", entregavelId: id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Entregável "${titulo}" enviado para aprovação (id ${id}). Encerre sua resposta agora e aguarde: a decisão do analista chega como nova mensagem.`,
    }
  }

  private async ferramentaSolicitar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const insumo = this.insumoDaEtapa(etapa, campoTexto(d.insumo_id, "insumo_id"))
    await this.registrarConversa(slug, etapa, { tipo: "card_insumo", insumoId: insumo.id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Pedido de "${insumo.nome}" mostrado ao analista, com o modelo para baixar quando houver. Aguarde: quando o arquivo passar na validação você recebe uma mensagem com o caminho.`,
    }
  }

  private async ferramentaSinalizar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const resumoDecisoes = campoTexto(d.resumo_decisoes, "resumo_decisoes")
    const handoff = campoTexto(d.handoff_proxima, "handoff_proxima")
    const faltando = await this.mutar(slug, (e) => {
      const r = me.sinalizarPronta(e, etapa, { resumoDecisoes, handoff }, this.catalogo, this.agora())
      return { estado: r.estado, resultado: r.faltando }
    })
    if (faltando.length > 0) {
      return {
        ok: true,
        mensagem: `Sinal registrado, mas a etapa ainda não pode ser concluída. Falta: ${faltando.join("; ")}. Aprovações e envios dependem do analista: avise o que falta em uma frase e encerre.`,
      }
    }
    await this.registrarConversa(slug, etapa, {
      tipo: "aviso",
      nivel: "info",
      texto: "O agente terminou o trabalho desta etapa. Confira os entregáveis e clique em Concluir etapa.",
      em: this.agora(),
    })
    return { ok: true, mensagem: "Etapa pronta para conclusão. Faça um fechamento curto para o analista e encerre." }
  }
}
```

Nota: em `ferramentaPropor`, a validação do nome (`normalizarNomeFinal`) acontece dentro de `proporEntregavel` antes da cópia congelada — se o nome for inválido, nada é copiado.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): serviço de planejamento — estado, entregáveis, insumos e ferramentas do agente

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `ServicoTurnos` — rodar o agente, fila automática e tokens do MCP

**Files:**
- Create: `src/packages/core/src/atividade.ts`, `src/packages/core/src/servico-turnos.ts`
- Test: `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Consumes: `ServicoPlanejamento` (Task 11), `Executor`/`PedidoTurno` (Task 8), `Barramento`, `prompts.ts`, `catalogo.ts`.
- Produces:
  - `descreverAtividade(nome: string, entrada: unknown, raiz: string): { nome: string; detalhe: string } | null`
  - `FERRAMENTAS_PERMITIDAS: string[]`, `aspasShell(s): string`, `montarMcpConfig(config, token): string`, `montarSettingsHook(config, pastaProspect): string`
  - `interface ConfigTurnos { raiz; urlApp; caminhoServidorMcp; caminhoHook; comandoNode }`
  - `class ServicoTurnos` com `constructor({ servico, executor, barramento, catalogo, config, agora? })` e `ativo(slug): EtapaId | null`, `contextoDoToken(token): { slug; etapa } | null`, `iniciar(slug, etapa)`, `enviarMensagem(slug, etapa, texto)`, `parar(slug)`, `processarFila(slug)`, `aguardarOcioso(slug)`.

- [ ] **Step 1: Atividade legível**

`src/packages/core/src/atividade.ts`:

```ts
import path from "node:path"

/** Linha curta mostrada no chat ("Lendo dados/historico-mensal.xlsx"). null = não mostrar. */
export function descreverAtividade(nome: string, entrada: unknown, raiz: string): { nome: string; detalhe: string } | null {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>
  const rel = (p: unknown) => (typeof p === "string" ? (path.isAbsolute(p) ? path.relative(raiz, p) : p) : "")
  if (nome.startsWith("mcp__planejamento__") || nome === "TodoWrite") return null
  if (nome === "Skill") return { nome, detalhe: `Usando a skill ${String(e.skill ?? e.command ?? "")}`.trim() }
  if (nome === "Agent" || nome === "Task") return { nome, detalhe: `Acionando o subagente ${String(e.subagent_type ?? "")}`.trim() }
  if (nome === "Read") return { nome, detalhe: `Lendo ${rel(e.file_path)}` }
  if (nome === "Write" || nome === "Edit" || nome === "MultiEdit") return { nome, detalhe: `Escrevendo ${rel(e.file_path)}` }
  if (nome === "Bash") return { nome, detalhe: `Rodando: ${String(e.command ?? "").slice(0, 80)}` }
  if (nome === "Glob" || nome === "Grep") return { nome, detalhe: "Procurando arquivos" }
  if (nome.startsWith("mcp__firecrawl") || nome === "WebSearch" || nome === "WebFetch") return { nome, detalhe: "Pesquisando na web" }
  if (nome.includes("Canva")) return { nome, detalhe: "Trabalhando no Canva" }
  return { nome, detalhe: nome }
}
```

- [ ] **Step 2: Escrever os testes**

`src/packages/core/test/servico-turnos.test.ts`:

```ts
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroTurnoAtivo } from "../src/erros"
import { FakeExecutor, roteiroSimples, type Roteiro } from "../src/executor/fake"
import type { PedidoTurno } from "../src/executor/tipos"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { aspasShell, montarMcpConfig, montarSettingsHook, ServicoTurnos, type ConfigTurnos } from "../src/servico-turnos"
import { catalogoReal, raizTemporaria } from "./ajuda"

let raiz: string
let servico: ServicoPlanejamento
let barramento: Barramento
let config: ConfigTurnos

beforeEach(async () => {
  raiz = await raizTemporaria()
  barramento = new Barramento()
  servico = new ServicoPlanejamento({
    armazenamento: new FsArmazenamento(raiz, async () => {}),
    catalogo: catalogoReal(),
    barramento,
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
  })
  config = {
    raiz,
    urlApp: "http://127.0.0.1:3000",
    caminhoServidorMcp: path.join(raiz, "src/packages/mcp-planejamento/src/servidor.ts"),
    caminhoHook: path.join(raiz, "src/packages/mcp-planejamento/src/hook-escrita.ts"),
    comandoNode: "/usr/local/bin/node",
  }
})

function turnos(roteiro: Roteiro) {
  const executor = new FakeExecutor(roteiro)
  const t = new ServicoTurnos({ servico, executor, barramento, catalogo: catalogoReal(), config })
  return { t, executor }
}

const tokenDo = (p: PedidoTurno) =>
  (JSON.parse(p.mcpConfig) as { mcpServers: { planejamento: { env: { PLANEJAMENTO_TOKEN: string } } } }).mcpServers
    .planejamento.env.PLANEJAMENTO_TOKEN

describe("configuração passada ao claude", () => {
  it("aspas sobrevivem a espaço e apóstrofo no caminho", () => {
    expect(aspasShell("/a/Projetos Boomer/x")).toBe("'/a/Projetos Boomer/x'")
    expect(aspasShell("/a/d'ávila")).toBe("'/a/d'\\''ávila'")
  })

  it("hook e MCP apontam para os arquivos certos", () => {
    const settings = JSON.parse(montarSettingsHook(config, path.join(raiz, "clientes/iszi"))) as {
      hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] }
    }
    const hook = settings.hooks.PreToolUse[0]!
    expect(hook.matcher).toBe("Write|Edit|MultiEdit|NotebookEdit")
    expect(hook.hooks[0]!.command).toBe(
      [config.comandoNode, config.caminhoHook, path.join(raiz, "clientes/iszi")].map(aspasShell).join(" "),
    )
    const mcp = JSON.parse(montarMcpConfig(config, "tok")) as { mcpServers: { planejamento: { args: string[]; env: Record<string, string> } } }
    expect(mcp.mcpServers.planejamento.args).toEqual([config.caminhoServidorMcp])
    expect(mcp.mcpServers.planejamento.env).toEqual({ PLANEJAMENTO_APP_URL: config.urlApp, PLANEJAMENTO_TOKEN: "tok" })
  })
})

describe("turnos", () => {
  it("iniciar manda o prompt inicial, grava a sessão e a conversa", async () => {
    const { t, executor } = turnos(roteiroSimples("Olá, vamos começar.", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const pedido = executor.pedidos[0]!
    expect(pedido.sessionId).toBeNull()
    expect(pedido.mensagem).toContain("`01-preparacao-de-contexto`")
    expect(pedido.systemPrompt).toContain("clientes/iszi/.app/rascunhos/")
    expect(pedido.cwd).toBe(raiz)
    expect((await servico.estado(slug)).etapas["01"].sessionId).toBe("sessao-1")
    const tipos = (await servico.conversa(slug, "01")).map((e) => e.tipo)
    expect(tipos).toEqual(["aviso", "turno_inicio", "texto_agente", "turno_fim"])
  })

  it("a segunda mensagem retoma a sessão e manda só o texto", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "01", "segue a transcrição")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos[1]).toMatchObject({ sessionId: "sessao-1", mensagem: "segue a transcrição" })
  })

  it("ferramenta chamada no meio do turno usa o token do turno", async () => {
    let resposta = ""
    const { t } = turnos(async function* (pedido) {
      yield { tipo: "sessao", sessionId: "s" }
      const ctx = t.contextoDoToken(tokenDo(pedido))!
      resposta = (await servico.ferramenta(ctx, "solicitar_insumo", { insumo_id: "kickoff-transcricao" })).mensagem
      yield { tipo: "fim", ok: true, erro: null, sessionId: "s" }
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(resposta).toContain("Transcrição do kickoff")
    expect(t.contextoDoToken("qualquer")).toBeNull()
  })

  it("recusa mensagem com turno ativo e Parar interrompe", async () => {
    const { t } = turnos(async function* (_p, sinal) {
      yield { tipo: "sessao", sessionId: "s" }
      await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    expect(t.ativo(slug)).toBe("01")
    await expect(t.enviarMensagem(slug, "01", "oi")).rejects.toBeInstanceOf(ErroTurnoAtivo)
    t.parar(slug)
    await t.aguardarOcioso(slug)
    expect(t.ativo(slug)).toBeNull()
    expect((await servico.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "interrompido" })
  })

  it("item na fila dispara um turno automático", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "s"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await servico.enfileirar(slug, "01", "O analista APROVOU o entregável X.")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos.at(-1)!.mensagem).toContain("APROVOU")
    const conversa = await servico.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "mensagem_analista")).toMatchObject({ automatica: true })
  })

  it("erro do executor vira turno_fim com detalhe e limite vira aviso", async () => {
    const { t } = turnos(async function* () {
      yield { tipo: "limite", status: "rejected", resetsAt: 1790651400 }
      yield { tipo: "fim", ok: false, erro: "usage limit reached", sessionId: null }
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const conversa = await servico.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "aviso" && e.nivel === "erro")).toBeTruthy()
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "erro", detalhe: "usage limit reached" })
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-turnos.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`src/packages/core/src/servico-turnos.ts`:

```ts
import { randomUUID } from "node:crypto"
import path from "node:path"
import { descreverAtividade } from "./atividade"
import type { Barramento } from "./barramento"
import { etapaDoCatalogo } from "./catalogo"
import { ErroTurnoAtivo } from "./erros"
import type { Executor, PedidoTurno } from "./executor/tipos"
import { promptInicialEtapa, systemPromptModoInterface } from "./prompts"
import type { ServicoPlanejamento } from "./servico-planejamento"
import type { Catalogo, EtapaId, EventoConversa } from "./tipos"

/** Tudo o que o agente pode usar sem pedir permissão (o modo -p não pergunta). */
export const FERRAMENTAS_PERMITIDAS = [
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Glob",
  "Grep",
  "Skill",
  "Agent",
  "Task",
  "TodoWrite",
  "WebSearch",
  "WebFetch",
  "Bash(python3 *)",
  "Bash(pandoc *)",
  "Bash(ls *)",
  "Bash(mkdir *)",
  "Bash(cat *)",
  "Bash(head *)",
  "Bash(wc *)",
  "mcp__planejamento",
  "mcp__firecrawl",
  "mcp__claude_ai_Canva",
]

export interface ConfigTurnos {
  raiz: string
  urlApp: string
  caminhoServidorMcp: string
  caminhoHook: string
  comandoNode: string
}

export interface DependenciasTurnos {
  servico: ServicoPlanejamento
  executor: Executor
  barramento: Barramento
  catalogo: Catalogo
  config: ConfigTurnos
  agora?: () => string
}

export function aspasShell(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function montarMcpConfig(config: ConfigTurnos, token: string): string {
  return JSON.stringify({
    mcpServers: {
      planejamento: {
        command: config.comandoNode,
        args: [config.caminhoServidorMcp],
        env: { PLANEJAMENTO_APP_URL: config.urlApp, PLANEJAMENTO_TOKEN: token },
      },
    },
  })
}

export function montarSettingsHook(config: ConfigTurnos, pastaProspect: string): string {
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|NotebookEdit",
          hooks: [
            { type: "command", command: [config.comandoNode, config.caminhoHook, pastaProspect].map(aspasShell).join(" ") },
          ],
        },
      ],
    },
  })
}

function horario(resetsAt: number | null): string {
  return resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
}

export class ServicoTurnos {
  private readonly servico: ServicoPlanejamento
  private readonly executor: Executor
  private readonly barramento: Barramento
  private readonly catalogo: Catalogo
  private readonly config: ConfigTurnos
  private readonly agora: () => string
  private readonly ativos = new Map<string, { etapa: EtapaId; controle: AbortController }>()
  private readonly tokens = new Map<string, { slug: string; etapa: EtapaId }>()
  /** Trabalho em andamento por prospect (turnos e disparos da fila) — base do aguardarOcioso. */
  private readonly pendentes = new Map<string, Set<Promise<void>>>()

  constructor(d: DependenciasTurnos) {
    this.servico = d.servico
    this.executor = d.executor
    this.barramento = d.barramento
    this.catalogo = d.catalogo
    this.config = d.config
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.servico.conectarTurnos({
      aoEnfileirar: (slug) => this.acompanhar(slug, this.processarFila(slug)),
      estaOcupado: (slug) => this.ativos.has(slug),
    })
  }

  private acompanhar(slug: string, trabalho: Promise<void>): void {
    const conjunto = this.pendentes.get(slug) ?? new Set<Promise<void>>()
    this.pendentes.set(slug, conjunto)
    const rastreado: Promise<void> = trabalho
      .catch((e) => console.error(`Turno do prospect ${slug} falhou:`, e))
      .finally(() => {
        conjunto.delete(rastreado)
        if (conjunto.size === 0 && this.pendentes.get(slug) === conjunto) this.pendentes.delete(slug)
      })
    conjunto.add(rastreado)
  }

  ativo(slug: string): EtapaId | null {
    return this.ativos.get(slug)?.etapa ?? null
  }

  contextoDoToken(token: string): { slug: string; etapa: EtapaId } | null {
    return this.tokens.get(token) ?? null
  }

  async iniciar(slug: string, etapa: EtapaId): Promise<void> {
    if (this.ativos.has(slug)) throw new ErroTurnoAtivo()
    await this.servico.iniciarEtapa(slug, etapa)
    this.emSegundoPlano(slug, etapa, null)
  }

  async enviarMensagem(slug: string, etapa: EtapaId, texto: string): Promise<void> {
    if (this.ativos.has(slug)) throw new ErroTurnoAtivo()
    await this.servico.registrarMensagemAnalista(slug, etapa)
    await this.registrar(slug, etapa, { tipo: "mensagem_analista", texto, automatica: false, em: this.agora() })
    this.emSegundoPlano(slug, etapa, texto)
  }

  parar(slug: string): void {
    this.ativos.get(slug)?.controle.abort()
  }

  async processarFila(slug: string): Promise<void> {
    if (this.ativos.has(slug)) return
    const item = await this.servico.retirarFila(slug)
    if (!item || this.ativos.has(slug)) return
    await this.registrar(slug, item.etapa, { tipo: "mensagem_analista", texto: item.texto, automatica: true, em: this.agora() })
    this.emSegundoPlano(slug, item.etapa, item.texto)
  }

  /** Para testes e para o desligamento: espera o turno atual e os que a fila disparar. */
  async aguardarOcioso(slug: string): Promise<void> {
    while (this.pendentes.get(slug)?.size) await Promise.all([...this.pendentes.get(slug)!])
  }

  private registrar(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    return this.servico.registrarConversa(slug, etapa, evento)
  }

  private emSegundoPlano(slug: string, etapa: EtapaId, texto: string | null): void {
    const controle = new AbortController()
    this.ativos.set(slug, { etapa, controle })
    this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: true })
    this.acompanhar(
      slug,
      this.executarTurno(slug, etapa, texto, controle.signal)
        .catch((e) => console.error(`Turno do prospect ${slug} falhou:`, e))
        .finally(() => {
          this.ativos.delete(slug)
          this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: false })
        })
        // o próximo turno (se houver fila) é registrado em `pendentes` antes deste sair de lá
        .then(() => this.processarFila(slug)),
    )
  }

  private async executarTurno(slug: string, etapa: EtapaId, texto: string | null, sinal: AbortSignal): Promise<void> {
    const estado = await this.servico.estado(slug)
    const etapaCat = etapaDoCatalogo(this.catalogo, etapa)
    let sessionId = estado.etapas[etapa].sessionId
    const mensagem = sessionId
      ? (texto ?? "Continue de onde parou.")
      : [promptInicialEtapa({ slug, etapa: etapaCat, dossie: await this.servico.dossie(slug, etapa) }), texto]
          .filter(Boolean)
          .join("\n\n---\n\n")

    const token = randomUUID()
    this.tokens.set(token, { slug, etapa })
    const pedido: PedidoTurno = {
      cwd: this.config.raiz,
      mensagem,
      sessionId,
      systemPrompt: systemPromptModoInterface({ slug, etapa: etapaCat }),
      mcpConfig: montarMcpConfig(this.config, token),
      settings: montarSettingsHook(this.config, path.join(this.config.raiz, "clientes", slug)),
      allowedTools: FERRAMENTAS_PERMITIDAS,
    }

    await this.registrar(slug, etapa, { tipo: "turno_inicio", em: this.agora() })
    let terminou = false
    try {
      for await (const ev of this.executor.executar(pedido, sinal)) {
        if (ev.tipo === "sessao" && ev.sessionId !== sessionId) {
          sessionId = ev.sessionId
          await this.servico.definirSessao(slug, etapa, ev.sessionId)
        } else if (ev.tipo === "texto_delta") {
          this.barramento.publicar(slug, { tipo: "delta", etapa, texto: ev.texto })
        } else if (ev.tipo === "texto" && ev.texto.trim()) {
          await this.registrar(slug, etapa, { tipo: "texto_agente", texto: ev.texto, em: this.agora() })
        } else if (ev.tipo === "ferramenta") {
          const atividade = descreverAtividade(ev.nome, ev.entrada, this.config.raiz)
          if (atividade) await this.registrar(slug, etapa, { tipo: "atividade", ...atividade, em: this.agora() })
        } else if (ev.tipo === "limite") {
          const hora = horario(ev.resetsAt)
          await this.registrar(slug, etapa, {
            tipo: "aviso",
            nivel: ev.status === "rejected" ? "erro" : "alerta",
            texto:
              ev.status === "rejected"
                ? `O limite de uso da sua assinatura do Claude foi atingido.${hora ? ` Ele renova às ${hora}.` : ""} Depois disso, clique em Tentar de novo.`
                : `Você está chegando perto do limite de uso da assinatura do Claude.${hora ? ` Ele renova às ${hora}.` : ""}`,
            em: this.agora(),
          })
        } else if (ev.tipo === "fim") {
          terminou = true
          if (ev.sessionId && ev.sessionId !== sessionId) await this.servico.definirSessao(slug, etapa, ev.sessionId)
          await this.registrar(slug, etapa, {
            tipo: "turno_fim",
            status: sinal.aborted ? "interrompido" : ev.ok ? "ok" : "erro",
            detalhe: ev.ok ? null : ev.erro,
            em: this.agora(),
          })
        }
      }
      if (!terminou) {
        await this.registrar(slug, etapa, {
          tipo: "turno_fim",
          status: sinal.aborted ? "interrompido" : "erro",
          detalhe: sinal.aborted ? "Interrompido pelo analista." : "O agente parou sem concluir a resposta.",
          em: this.agora(),
        })
      }
    } catch (e) {
      await this.registrar(slug, etapa, {
        tipo: "turno_fim",
        status: sinal.aborted ? "interrompido" : "erro",
        detalhe: e instanceof Error ? e.message : String(e),
        em: this.agora(),
      })
    } finally {
      this.tokens.delete(token)
    }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: PASS; eslint só com avisos (a config usa `only-warn`).

- [ ] **Step 6: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): serviço de turnos — executa o agente, fila automática e tokens do MCP

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Pacote `@workspace/mcp-planejamento` — servidor MCP e hook de escrita

**Files:**
- Create: `src/packages/mcp-planejamento/package.json`, `src/packages/mcp-planejamento/vitest.config.ts`
- Create: `src/packages/mcp-planejamento/src/servidor.ts`, `src/packages/mcp-planejamento/src/hook-escrita.ts`
- Test: `src/packages/mcp-planejamento/test/hook-escrita.test.ts`

**Interfaces:**
- Consumes: HTTP `POST {PLANEJAMENTO_APP_URL}/api/interno/ferramentas` com `Authorization: Bearer <token>` e corpo `{ ferramenta, entrada }`, resposta `{ ok, mensagem }` (implementado na Task 15).
- Produces: processo `node servidor.ts` (stdio MCP) com as ferramentas `propor_entregavel { tipo, titulo, arquivo_rascunho, nome_final }`, `solicitar_insumo { insumo_id }`, `sinalizar_etapa_pronta { resumo_decisoes, handoff_proxima }`; processo `node hook-escrita.ts <pastaProspect>` (exit 2 = bloqueia); `decidirEscrita(caminho, cwd, pastaProspect): { permitir; motivo }`.

- [ ] **Step 1: Criar o pacote**

`src/packages/mcp-planejamento/package.json`:

```json
{
  "name": "@workspace/mcp-planejamento",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.31.0",
    "zod": "^4"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^5"
  }
}
```

`src/packages/mcp-planejamento/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({ test: { include: ["test/**/*.test.ts"], testTimeout: 20000 } })
```

Run: `cd src && npm install` → Expected: sem erro.

- [ ] **Step 2: Escrever os testes do hook**

`src/packages/mcp-planejamento/test/hook-escrita.test.ts`:

```ts
import { spawnSync } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { decidirEscrita } from "../src/hook-escrita.ts"

const HOOK = fileURLToPath(new URL("../src/hook-escrita.ts", import.meta.url))
const PASTA = "/raiz/clientes/iszi"

describe("decidirEscrita", () => {
  it.each([
    [".app/rascunhos/g.png", true],
    ["contexto/kickoff-transcricao.md", true],
    ["CLAUDE.md", true],
    ["entrega/ativos-aprovados/graficos/g.png", false],
    [".app/estado.json", false],
    [".app/propostas/x.png", false],
    ["contexto/status-planejamento.md", false],
    ["../adda/CLAUDE.md", false],
    ["/tmp/x.txt", false],
  ])("%s → permitir=%s", (caminho, permitir) => {
    expect(decidirEscrita(caminho, PASTA, PASTA).permitir).toBe(permitir)
  })

  it("resolve caminho relativo ao cwd do agente (raiz do projeto)", () => {
    expect(decidirEscrita("clientes/iszi/.app/rascunhos/a.md", "/raiz", PASTA).permitir).toBe(true)
    expect(decidirEscrita("clientes/adda/x.md", "/raiz", PASTA).permitir).toBe(false)
  })
})

describe("hook executado pelo node, com espaço no caminho", () => {
  it("bloqueia com exit 2 e explica no stderr; libera com exit 0", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "Projetos Boomer-"))
    const pasta = path.join(raiz, "clientes", "iszi")
    const rodar = (arquivo: string) =>
      spawnSync(process.execPath, [HOOK, pasta], {
        input: JSON.stringify({ cwd: raiz, tool_name: "Write", tool_input: { file_path: arquivo } }),
        encoding: "utf8",
      })
    const bloqueado = rodar(path.join(pasta, "entrega/ativos-aprovados/graficos/g.png"))
    expect(bloqueado.status).toBe(2)
    expect(bloqueado.stderr).toContain("propor_entregavel")
    expect(rodar(path.join(pasta, ".app/rascunhos/g.png")).status).toBe(0)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/mcp-planejamento && npx vitest run`
Expected: FAIL — arquivo inexistente.

- [ ] **Step 4: Implementar o hook**

`src/packages/mcp-planejamento/src/hook-escrita.ts` (roda com `node hook-escrita.ts <pasta>`; só sintaxe TypeScript apagável):

```ts
// Hook PreToolUse (Write/Edit) do modo interface: o agente só escreve dentro da pasta do
// prospect e nunca nas áreas que pertencem ao app. Exit 2 bloqueia e o stderr vai para o agente.
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface DecisaoEscrita {
  permitir: boolean
  motivo: string | null
}

export function decidirEscrita(caminho: string, cwd: string, pastaProspect: string): DecisaoEscrita {
  const abs = path.resolve(cwd, caminho)
  const rel = path.relative(pastaProspect, abs).split(path.sep).join("/")
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      permitir: false,
      motivo: `Escrita bloqueada: ${abs} fica fora da pasta do prospect (${pastaProspect}). No modo interface, grave só dentro dela; rascunhos vão em .app/rascunhos/.`,
    }
  }
  if (rel.startsWith("entrega/ativos-aprovados/")) {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: entrega/ativos-aprovados/ é gravada só pelo app quando o analista aprova. Salve em .app/rascunhos/ e chame propor_entregavel.",
    }
  }
  if (rel.startsWith(".app/") && !rel.startsWith(".app/rascunhos/")) {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: .app/ pertence ao app. Use só .app/rascunhos/ para seus arquivos.",
    }
  }
  if (rel === "contexto/status-planejamento.md") {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: o status é gerado pelo app. Para encerrar a etapa, chame sinalizar_etapa_pronta.",
    }
  }
  return { permitir: true, motivo: null }
}

async function principal(): Promise<void> {
  const pasta = process.argv[2]
  if (!pasta) {
    process.stderr.write("hook-escrita: informe a pasta do prospect como argumento.\n")
    process.exit(2)
  }
  let bruto = ""
  for await (const parte of process.stdin) bruto += String(parte)
  const entrada = JSON.parse(bruto || "{}") as { cwd?: string; tool_input?: { file_path?: string; notebook_path?: string } }
  const caminho = entrada.tool_input?.file_path ?? entrada.tool_input?.notebook_path
  if (!caminho) return
  const decisao = decidirEscrita(caminho, entrada.cwd ?? process.cwd(), path.resolve(pasta))
  if (!decisao.permitir) {
    process.stderr.write(`${decisao.motivo}\n`)
    process.exit(2)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await principal()
}
```

- [ ] **Step 5: Implementar o servidor MCP**

`src/packages/mcp-planejamento/src/servidor.ts`:

```ts
// Servidor MCP "planejamento": as ferramentas que viram cards na interface.
// Só repassa cada chamada ao app local, que valida e grava. Roda com `node servidor.ts`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const URL_APP = process.env.PLANEJAMENTO_APP_URL
const TOKEN = process.env.PLANEJAMENTO_TOKEN
if (!URL_APP || !TOKEN) {
  process.stderr.write("mcp-planejamento: PLANEJAMENTO_APP_URL e PLANEJAMENTO_TOKEN são obrigatórios.\n")
  process.exit(1)
}

async function chamarApp(ferramenta: string, entrada: unknown) {
  try {
    const resposta = await fetch(`${URL_APP}/api/interno/ferramentas`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ ferramenta, entrada }),
    })
    const corpo = (await resposta.json()) as { ok?: boolean; mensagem?: string; erro?: string }
    const texto = corpo.mensagem ?? corpo.erro ?? `Resposta inesperada da interface (HTTP ${resposta.status}).`
    return { content: [{ type: "text" as const, text: texto }], isError: corpo.ok !== true }
  } catch (e) {
    return {
      content: [{ type: "text" as const, text: `Não consegui falar com a interface (${String(e)}). Avise o analista.` }],
      isError: true,
    }
  }
}

const servidor = new McpServer({ name: "planejamento", version: "0.1.0" })

servidor.registerTool(
  "propor_entregavel",
  {
    title: "Propor entregável para aprovação",
    description:
      "Mostra ao analista um card com Aprovar / Pedir ajuste para um gráfico, tabela, seção de texto, planilha, documento ou HTML já salvo em clientes/<slug>/.app/rascunhos/. Substitui pedir 'ok' no chat. Depois de chamar, encerre a resposta e espere a decisão, que chega como nova mensagem.",
    inputSchema: {
      tipo: z
        .enum(["grafico", "tabela", "secao", "planilha", "documento", "html"])
        .describe("grafico/tabela = PNG; secao = .md; planilha = .xlsx; documento = .docx; html = .html"),
      titulo: z.string().describe("Título curto que o analista vê no card"),
      arquivo_rascunho: z.string().describe("Caminho do arquivo em clientes/<slug>/.app/rascunhos/"),
      nome_final: z
        .string()
        .describe("Nome estável, em kebab-case e sem versão (ex.: investimento-total-mensal). Seções recebem o prefixo da etapa automaticamente."),
    },
  },
  async (args) => chamarApp("propor_entregavel", args),
)

servidor.registerTool(
  "solicitar_insumo",
  {
    title: "Pedir um arquivo ao analista",
    description:
      "Mostra ao analista o card de envio de um insumo do catálogo (com o modelo para baixar, quando existir). Use em vez de descrever caminhos de pasta. Ids: kickoff-transcricao, formulario-cliente, site, historico-mensal, produtos-curva-abc, clientes-historico, prints-campanhas.",
    inputSchema: { insumo_id: z.string().describe("Id do insumo no catálogo da etapa atual") },
  },
  async (args) => chamarApp("solicitar_insumo", args),
)

servidor.registerTool(
  "sinalizar_etapa_pronta",
  {
    title: "Sinalizar que a etapa atingiu o critério de conclusão",
    description:
      "Chame quando o critério de conclusão da skill for atingido. O app guarda o resumo (vira o dossiê das próximas etapas) e o handoff, e libera o botão Concluir se não faltar nada.",
    inputSchema: {
      resumo_decisoes: z.string().describe("Markdown com as decisões e números aprovados nesta etapa"),
      handoff_proxima: z
        .string()
        .describe("Texto ao analista dizendo o que preparar para a próxima etapa, sem citar caminhos de arquivo"),
    },
  },
  async (args) => chamarApp("sinalizar_etapa_pronta", args),
)

await servidor.connect(new StdioServerTransport())
```

Se `registerTool` reclamar do formato do `inputSchema` na versão instalada, confira a assinatura em `src/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` (a 1.31 aceita o shape de zod 4 como acima).

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src/packages/mcp-planejamento && npx vitest run`
Expected: PASS.

Checagem manual do servidor (lista as ferramentas via protocolo MCP):

```bash
cd src/packages/mcp-planejamento
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | PLANEJAMENTO_APP_URL=http://127.0.0.1:9 PLANEJAMENTO_TOKEN=x timeout 5 node src/servidor.ts
```

Expected: a resposta de `id: 2` lista `propor_entregavel`, `solicitar_insumo` e `sinalizar_etapa_pronta`.

- [ ] **Step 7: Commit**

```bash
git add src/packages/mcp-planejamento src/package-lock.json
git commit -m "feat(mcp): servidor MCP planejamento e hook que bloqueia escrita fora do prospect

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: App Next — ligação com o núcleo, rotas de prospects e de sistema

**Files:**
- Modify: `src/apps/web/package.json` (deps + `dev` em 127.0.0.1 + `typecheck` com typegen), `src/apps/web/next.config.ts`
- Create: `src/apps/web/lib/servidor.ts`, `src/apps/web/lib/http.ts`
- Create: `src/apps/web/app/api/prospects/route.ts`, `src/apps/web/app/api/prospects/[slug]/route.ts`, `src/apps/web/app/api/prospects/[slug]/abrir-pasta/route.ts`, `src/apps/web/app/api/sistema/route.ts`

**Interfaces:**
- Consumes: `@workspace/core/*` (Tasks 1–12).
- Produces:
  - `servidor(): { raiz; catalogo; armazenamento; barramento; servico; turnos }` (singleton em `globalThis`; só importar em código de servidor).
  - `json(dados, status?)`, `respostaDeErro(e)`, `lerJson<T>(req)`, `validarEtapa(etapa: string): EtapaId`.
  - `GET /api/prospects` → `ResumoProspect[]`; `POST /api/prospects {nome, site}` → `201 {slug}` | `409 {erro, codigo: "prospect_existente", slug}` | `400 {erro}`.
  - `DELETE /api/prospects/[slug] {confirmacao}` → `{ok: true}`; `POST /api/prospects/[slug]/abrir-pasta` → `{ok: true}`.
  - `GET /api/sistema` → `{ claude: { instalado, versao, logado, metodo, plano }, python: { ok, detalhe } }`.

- [ ] **Step 1: Dependências e configuração**

Em `src/apps/web/package.json`:
- `dependencies`: acrescentar `"@workspace/core": "*"`, `"react-markdown": "^10"`, `"remark-gfm": "^4"`, `"sonner": "^2"`.
- `scripts.dev`: `"next dev --hostname 127.0.0.1"`; `scripts.start`: `"next start --hostname 127.0.0.1"`; `scripts.typecheck`: `"next typegen && tsc --noEmit"`.

`src/apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  // `trash` chama um binário do macOS pelo caminho do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["trash"],
}

export default nextConfig
```

Run: `cd src && npm install` → Expected: sem erro.

- [ ] **Step 2: Singleton do servidor e utilitários HTTP**

`src/apps/web/lib/servidor.ts`:

```ts
import path from "node:path"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { ClaudeCliExecutor } from "@workspace/core/executor/claude-cli"
import { criarExecutorDemo } from "@workspace/core/executor/fake"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"
import { ServicoTurnos } from "@workspace/core/servico-turnos"
import type { Catalogo } from "@workspace/core/tipos"
import { criarValidadorPython } from "@workspace/core/validador"

interface Servidor {
  raiz: string
  catalogo: Catalogo
  armazenamento: FsArmazenamento
  barramento: Barramento
  servico: ServicoPlanejamento
  turnos: ServicoTurnos
}

// Um só conjunto de serviços por processo, mesmo que o Next carregue este módulo em mais de uma rota.
const registro = globalThis as unknown as { __planejamento?: Servidor }

/** Só para código de servidor (rotas e páginas). Nunca importar em componente "use client". */
export function servidor(): Servidor {
  if (registro.__planejamento) return registro.__planejamento
  // `next dev` roda em src/apps/web → a raiz do projeto de planejamento fica três níveis acima.
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  const catalogo = carregarCatalogo(raiz)
  const armazenamento = new FsArmazenamento(raiz)
  const barramento = new Barramento()
  const servico = new ServicoPlanejamento({ armazenamento, catalogo, barramento, validar: criarValidadorPython(raiz) })
  const executor = process.env.PLANEJAMENTO_EXECUTOR === "demo" ? criarExecutorDemo() : new ClaudeCliExecutor()
  const pastaMcp = path.join(raiz, "src/packages/mcp-planejamento/src")
  const turnos = new ServicoTurnos({
    servico,
    executor,
    barramento,
    catalogo,
    config: {
      raiz,
      urlApp: process.env.PLANEJAMENTO_APP_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`,
      caminhoServidorMcp: path.join(pastaMcp, "servidor.ts"),
      caminhoHook: path.join(pastaMcp, "hook-escrita.ts"),
      comandoNode: process.execPath,
    },
  })
  registro.__planejamento = { raiz, catalogo, armazenamento, barramento, servico, turnos }
  return registro.__planejamento
}
```

`src/apps/web/lib/http.ts`:

```ts
import { ehErroDominio, ErroEntrada, ErroNaoEncontrado } from "@workspace/core/erros"
import { ORDEM_ETAPAS, type EtapaId } from "@workspace/core/tipos"

export function json(dados: unknown, status = 200): Response {
  return Response.json(dados, { status })
}

export function respostaDeErro(e: unknown): Response {
  if (ehErroDominio(e)) {
    const extra = "slug" in e && typeof e.slug === "string" ? { slug: e.slug } : {}
    return Response.json({ erro: e.message, codigo: e.codigo, ...extra }, { status: e.status })
  }
  console.error(e)
  return Response.json(
    { erro: "Erro inesperado no servidor. Veja o terminal onde o app está rodando.", codigo: "erro_interno" },
    { status: 500 },
  )
}

export async function lerJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ErroEntrada("Corpo da requisição inválido.")
  }
}

export function validarEtapa(etapa: string): EtapaId {
  if (!(ORDEM_ETAPAS as readonly string[]).includes(etapa)) throw new ErroNaoEncontrado(`Etapa desconhecida: ${etapa}`)
  return etapa as EtapaId
}
```

- [ ] **Step 3: Rotas de prospects**

`src/apps/web/app/api/prospects/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function GET() {
  try {
    return json(await servidor().servico.listarProspects())
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function POST(req: Request) {
  try {
    const { nome, site } = await lerJson<{ nome?: string; site?: string }>(req)
    const slug = await servidor().servico.criarProspect(nome ?? "", site?.trim() || null)
    return json({ slug }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`src/apps/web/app/api/prospects/[slug]/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function DELETE(req: Request, ctx: RouteContext<"/api/prospects/[slug]">) {
  try {
    const { slug } = await ctx.params
    const { confirmacao } = await lerJson<{ confirmacao?: string }>(req)
    await servidor().servico.excluirProspect(slug, confirmacao ?? "")
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`src/apps/web/app/api/prospects/[slug]/abrir-pasta/route.ts`:

```ts
import { execFile } from "node:child_process"
import { ErroNaoEncontrado } from "@workspace/core/erros"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/abrir-pasta">) {
  try {
    const { slug } = await ctx.params
    const { armazenamento } = servidor()
    if (!(await armazenamento.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não existe.`)
    execFile("open", [armazenamento.pastaProspect(slug)])
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 4: Rota de verificação do sistema**

`src/apps/web/app/api/sistema/route.ts`:

```ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)
export const dynamic = "force-dynamic"

export async function GET() {
  const claude = { instalado: false, versao: null as string | null, logado: false, metodo: null as string | null, plano: null as string | null }
  try {
    const { stdout } = await exec("claude", ["--version"], { timeout: 10_000 })
    claude.instalado = true
    claude.versao = stdout.trim()
  } catch {
    // não instalado
  }
  if (claude.instalado) {
    let saida = ""
    try {
      saida = (await exec("claude", ["auth", "status"], { timeout: 15_000 })).stdout
    } catch (e) {
      saida = (e as { stdout?: string }).stdout ?? ""
    }
    try {
      const s = JSON.parse(saida) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string }
      claude.logado = s.loggedIn === true
      claude.metodo = s.authMethod ?? null
      claude.plano = s.subscriptionType ?? null
    } catch {
      // saída inesperada: tratar como não logado
    }
  }
  let python = { ok: true, detalhe: null as string | null }
  try {
    await exec("python3", ["-c", "import openpyxl, pandas, matplotlib"], { timeout: 20_000 })
  } catch {
    python = { ok: false, detalhe: "Python 3 com openpyxl, pandas e matplotlib não foi encontrado." }
  }
  return Response.json({ claude, python })
}
```

(Não devolva o e-mail do `claude auth status` — a interface não precisa dele.)

- [ ] **Step 5: Verificar com o servidor rodando**

```bash
cd src/apps/web && npm run dev
```

Em outro terminal:

```bash
curl -s http://127.0.0.1:3000/api/sistema | python3 -m json.tool
curl -s http://127.0.0.1:3000/api/prospects | python3 -m json.tool
curl -s -X POST http://127.0.0.1:3000/api/prospects -H 'content-type: application/json' -d '{"nome":"Teste Interface","site":"https://exemplo.com"}'
curl -s -X POST http://127.0.0.1:3000/api/prospects -H 'content-type: application/json' -d '{"nome":"teste interface"}'
curl -s -X DELETE http://127.0.0.1:3000/api/prospects/teste-interface -H 'content-type: application/json' -d '{"confirmacao":"teste-interface"}'
```

Expected: `/api/sistema` com `claude.instalado: true, logado: true, metodo: "claude.ai"`, `python.ok: true`; a listagem traz `adda`, `sottile-jalecos`, `sottile-teste` (importados do `status-planejamento.md`, cada um ganha `.app/estado.json`); o primeiro POST devolve `{"slug":"teste-interface"}`; o segundo, `409` com `"codigo":"prospect_existente"`; o DELETE devolve `{"ok":true}` e a pasta aparece na Lixeira do macOS.

Run também: `cd src/apps/web && npm run typecheck` → Expected: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web src/package-lock.json
git commit -m "feat(web): liga o app ao núcleo e expõe rotas de prospects e de sistema

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Rotas das etapas — estado, SSE, conversa, ações, uploads, arquivos e ferramentas

**Files:**
- Create em `src/apps/web/app/api/`:
  - `prospects/[slug]/estado/route.ts`
  - `prospects/[slug]/eventos/route.ts`
  - `prospects/[slug]/etapas/[etapa]/conversa/route.ts`
  - `prospects/[slug]/etapas/[etapa]/acoes/route.ts`
  - `prospects/[slug]/etapas/[etapa]/mensagens/route.ts`
  - `prospects/[slug]/etapas/[etapa]/insumos/[insumoId]/route.ts`
  - `prospects/[slug]/etapas/[etapa]/anexos/route.ts`
  - `prospects/[slug]/entregaveis/[id]/route.ts`
  - `prospects/[slug]/arquivo/route.ts`
  - `modelos/[insumoId]/route.ts`
  - `interno/ferramentas/route.ts`

**Interfaces:**
- Consumes: `servidor()`, `lib/http.ts` (Task 14); `ServicoPlanejamento`, `ServicoTurnos` (Tasks 11–12).
- Produces (usado pela UI, Tasks 16–19):
  - `GET .../estado` → `RespostaEstado`
  - `GET .../eventos` → SSE, cada `data:` é um `EventoTempoReal`
  - `GET .../etapas/[etapa]/conversa` → `{ eventos: EventoConversa[] }`
  - `POST .../etapas/[etapa]/acoes {acao: "iniciar"|"concluir"|"reabrir"|"confirmar"|"revisar"|"parar"}` → `{ok: true}`
  - `POST .../etapas/[etapa]/mensagens {texto}` → `202 {ok: true}`
  - `POST .../etapas/[etapa]/insumos/[insumoId]` multipart `arquivo` **ou** JSON `{url}` → `ResultadoValidacao`
  - `POST .../etapas/[etapa]/anexos` multipart `arquivo` → `{caminho}`
  - `POST .../entregaveis/[id] {acao: "aprovar"} | {acao: "ajuste", texto}` → `{ok: true}`
  - `GET .../arquivo?caminho=<rel ao prospect>&download=1?` → bytes
  - `GET /api/modelos/[insumoId]` → `.xlsx` | 404
  - `POST /api/interno/ferramentas` (Bearer token do turno) `{ferramenta, entrada}` → `{ok, mensagem}`

- [ ] **Step 1: Estado, eventos e conversa**

`prospects/[slug]/estado/route.ts`:

```ts
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/estado">) {
  try {
    const { slug } = await ctx.params
    const { servico, turnos } = servidor()
    return json(await servico.respostaEstado(slug, turnos.ativo(slug)))
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`prospects/[slug]/eventos/route.ts`:

```ts
import type { EventoTempoReal } from "@workspace/core/tipos"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export async function GET(req: Request, ctx: RouteContext<"/api/prospects/[slug]/eventos">) {
  const { slug } = await ctx.params
  const { barramento } = servidor()
  const codificador = new TextEncoder()
  let encerrar = () => {}
  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      const escrever = (texto: string) => {
        try {
          controle.enqueue(codificador.encode(texto))
        } catch {
          encerrar()
        }
      }
      escrever(": conectado\n\n")
      const desinscrever = barramento.assinar(slug, (ev: EventoTempoReal) => escrever(`data: ${JSON.stringify(ev)}\n\n`))
      const batimento = setInterval(() => escrever(": ping\n\n"), 15_000)
      encerrar = () => {
        desinscrever()
        clearInterval(batimento)
      }
      req.signal.addEventListener("abort", () => {
        encerrar()
        try {
          controle.close()
        } catch {
          // já fechado
        }
      })
    },
    cancel() {
      encerrar()
    },
  })
  return new Response(fluxo, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  })
}
```

`prospects/[slug]/etapas/[etapa]/conversa/route.ts`:

```ts
import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/conversa">) {
  try {
    const { slug, etapa } = await ctx.params
    return json({ eventos: await servidor().servico.conversa(slug, validarEtapa(etapa)) })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 2: Ações, mensagens e entregáveis**

`prospects/[slug]/etapas/[etapa]/acoes/route.ts`:

```ts
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/acoes">) {
  try {
    const { slug, etapa: bruta } = await ctx.params
    const etapa = validarEtapa(bruta)
    const { acao } = await lerJson<{ acao?: string }>(req)
    const { servico, turnos } = servidor()
    switch (acao) {
      case "iniciar":
        await turnos.iniciar(slug, etapa)
        break
      case "concluir":
        await servico.concluirEtapa(slug, etapa)
        break
      case "reabrir":
        await servico.reabrirEtapa(slug, etapa)
        break
      case "confirmar":
        await servico.confirmarValida(slug, etapa)
        break
      case "revisar":
        await servico.revisarEtapa(slug, etapa)
        break
      case "parar":
        turnos.parar(slug)
        break
      default:
        throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    }
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`prospects/[slug]/etapas/[etapa]/mensagens/route.ts`:

```ts
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/mensagens">) {
  try {
    const { slug, etapa } = await ctx.params
    const { texto } = await lerJson<{ texto?: string }>(req)
    if (!texto?.trim()) throw new ErroEntrada("Escreva uma mensagem.")
    await servidor().turnos.enviarMensagem(slug, validarEtapa(etapa), texto.trim())
    return json({ ok: true }, 202)
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`prospects/[slug]/entregaveis/[id]/route.ts`:

```ts
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/entregaveis/[id]">) {
  try {
    const { slug, id } = await ctx.params
    const { acao, texto } = await lerJson<{ acao?: string; texto?: string }>(req)
    const { servico } = servidor()
    if (acao === "aprovar") await servico.aprovarEntregavel(slug, id)
    else if (acao === "ajuste") await servico.pedirAjuste(slug, id, texto ?? "")
    else throw new ErroEntrada(`Ação desconhecida: ${acao}`)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 3: Uploads (insumos e anexos)**

`prospects/[slug]/etapas/[etapa]/insumos/[insumoId]/route.ts`:

```ts
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/insumos/[insumoId]">) {
  try {
    const { slug, etapa: bruta, insumoId } = await ctx.params
    const etapa = validarEtapa(bruta)
    const { servico } = servidor()
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const arquivo = (await req.formData()).get("arquivo")
      if (!(arquivo instanceof File)) throw new ErroEntrada("Nenhum arquivo enviado.")
      const temp = path.join(tmpdir(), `insumo-${randomUUID()}${path.extname(arquivo.name)}`)
      await writeFile(temp, new Uint8Array(await arquivo.arrayBuffer()))
      return json(await servico.receberInsumoArquivo(slug, etapa, insumoId, temp, arquivo.name))
    }
    const { url } = await lerJson<{ url?: string }>(req)
    return json(await servico.receberInsumoLink(slug, etapa, insumoId, url ?? ""))
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`prospects/[slug]/etapas/[etapa]/anexos/route.ts`:

```ts
import { ErroEntrada } from "@workspace/core/erros"
import { json, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/anexos">) {
  try {
    const { slug, etapa } = await ctx.params
    validarEtapa(etapa)
    const arquivo = (await req.formData()).get("arquivo")
    if (!(arquivo instanceof File)) throw new ErroEntrada("Nenhum arquivo enviado.")
    const caminho = await servidor().servico.salvarAnexo(slug, arquivo.name, new Uint8Array(await arquivo.arrayBuffer()))
    return json({ caminho })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 4: Arquivos e modelos**

`prospects/[slug]/arquivo/route.ts`:

```ts
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/prospects/[slug]/arquivo">) {
  try {
    const { slug } = await ctx.params
    const caminho = req.nextUrl.searchParams.get("caminho") ?? ""
    const download = req.nextUrl.searchParams.get("download") === "1"
    const abs = servidor().armazenamento.caminhoAbsoluto(slug, caminho)
    let dados: Buffer
    try {
      dados = await readFile(abs)
    } catch {
      return json({ erro: "Arquivo não encontrado." }, 404)
    }
    const headers: Record<string, string> = {
      "content-type": TIPOS[path.extname(abs).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    }
    if (download) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`
    return new Response(new Uint8Array(dados), { headers })
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

`modelos/[insumoId]/route.ts`:

```ts
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PASTA_MODELOS } from "@workspace/core/servico-planejamento"
import { json } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export async function GET(_req: Request, ctx: RouteContext<"/api/modelos/[insumoId]">) {
  const { insumoId } = await ctx.params
  const { catalogo, raiz } = servidor()
  const insumo = catalogo.insumos.find((i) => i.id === insumoId)
  if (!insumo?.modelo) return json({ erro: "Este insumo não tem modelo." }, 404)
  try {
    const dados = await readFile(path.join(raiz, PASTA_MODELOS, insumo.modelo))
    return new Response(new Uint8Array(dados), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`modelo-${insumo.modelo}`)}`,
      },
    })
  } catch {
    return json({ erro: "O modelo oficial desta planilha ainda não foi colocado no projeto." }, 404)
  }
}
```

- [ ] **Step 5: Endpoint interno das ferramentas do agente**

`interno/ferramentas/route.ts`:

```ts
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

/** Chamado só pelo servidor MCP "planejamento", com o token do turno em andamento. */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const { turnos, servico } = servidor()
  const ctx = turnos.contextoDoToken(token)
  if (!ctx) return json({ ok: false, mensagem: "Token inválido ou turno já encerrado." }, 401)
  try {
    const { ferramenta, entrada } = await lerJson<{ ferramenta?: string; entrada?: unknown }>(req)
    return json(await servico.ferramenta(ctx, ferramenta ?? "", entrada))
  } catch (e) {
    return respostaDeErro(e)
  }
}
```

- [ ] **Step 6: Verificar o fluxo com o executor de demonstração**

```bash
cd src/apps/web && PLANEJAMENTO_EXECUTOR=demo npm run dev
```

Em outro terminal (deixe um `curl -N http://127.0.0.1:3000/api/prospects/demo/eventos` aberto num terceiro para ver o SSE):

```bash
B=http://127.0.0.1:3000/api/prospects
curl -s -X POST $B -H 'content-type: application/json' -d '{"nome":"Demo","site":"https://exemplo.com"}'
curl -s -X POST $B/demo/etapas/01/acoes -H 'content-type: application/json' -d '{"acao":"iniciar"}'
sleep 1; curl -s $B/demo/etapas/01/conversa | python3 -m json.tool
curl -s -X POST $B/demo/etapas/01/mensagens -H 'content-type: application/json' -d '{"texto":"oi"}'
echo 'transcricao' > /tmp/kick.txt
curl -s -F arquivo=@/tmp/kick.txt $B/demo/etapas/01/insumos/kickoff-transcricao
curl -s "$B/demo/estado" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['estado']['etapas']['01'], d['condicoes']['01'])"
curl -s -X POST http://127.0.0.1:3000/api/interno/ferramentas -H 'authorization: Bearer errado' -d '{}'
curl -s "$B/demo/arquivo?caminho=../adda/CLAUDE.md"
```

Expected: a conversa mostra `aviso`, `turno_inicio`, `texto_agente` ("Modo demonstração…"), `turno_fim`; o SSE imprime `estado`, `turno`, `delta` e `conversa`; o insumo volta `{"ok":true,…}`; as condições da 01 listam só "O agente ainda não sinalizou…"; o endpoint interno responde 401; o `arquivo` com `../` responde 400 (`caminho_fora`). Exclua o prospect `demo` pela API no fim.

Run: `cd src/apps/web && npm run typecheck` → sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): rotas de etapa — estado, SSE, conversa, ações, uploads e ferramentas do agente

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: UI — componentes shadcn, layout, home de prospects e verificação do sistema

**Files:**
- Modify: `src/apps/web/app/layout.tsx`, `src/apps/web/app/page.tsx`
- Create: `src/apps/web/lib/api.ts`, `src/apps/web/components/markdown.tsx`
- Create: `src/apps/web/components/home/grade-prospects.tsx`, `card-prospect.tsx`, `dialogo-novo-prospect.tsx`, `dialogo-excluir-prospect.tsx`
- Create: `src/apps/web/components/sistema/verificacao-sistema.tsx`

**Interfaces:**
- Consumes: rotas das Tasks 14–15; tipos de `@workspace/core/tipos`; `normalizarSlug` de `@workspace/core/slug`.
- Produces: `api` (cliente HTTP: `criarProspect`, `excluirProspect`, `abrirPasta`, `acaoEtapa`, `enviarMensagem`, `aprovar`, `pedirAjuste`, `enviarInsumo`, `enviarLink`, `enviarAnexo`), `urlArquivo(slug, caminho, download?)`, `mensagemDeErro(e)`, `ErroApi`; `<Markdown>{texto}</Markdown>`.

- [ ] **Step 1: Adicionar os componentes shadcn**

Leia antes `.agents/skills/shadcn/SKILL.md`, `rules/composition.md`, `rules/base-vs-radix.md`, `rules/chat.md` e `rules/icons.md`.

```bash
cd src
npx shadcn@latest add card dialog alert-dialog input label textarea badge progress dropdown-menu sonner skeleton empty spinner field alert separator message-scroller message bubble attachment marker -c apps/web
```

Expected: arquivos novos em `src/packages/ui/src/components/`. Se algum nome não existir no registro, rode `npx shadcn@latest search <nome>` e use o equivalente. Depois de instalar, abra `dialog.tsx`, `dropdown-menu.tsx`, `empty.tsx`, `message-scroller.tsx` e `attachment.tsx` e confira os nomes exportados usados abaixo (ex.: se `DialogContent` aceita `showCloseButton`).

- [ ] **Step 2: Cliente HTTP e Markdown**

`src/apps/web/lib/api.ts`:

```ts
import type { EtapaId, ResultadoValidacao } from "@workspace/core/tipos"

export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string | null
  readonly dados: Record<string, unknown>
  constructor(message: string, status: number, codigo: string | null, dados: Record<string, unknown>) {
    super(message)
    this.status = status
    this.codigo = codigo
    this.dados = dados
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) {
    throw new ErroApi(
      typeof corpo.erro === "string" ? corpo.erro : `Erro ${r.status}`,
      r.status,
      typeof corpo.codigo === "string" ? corpo.codigo : null,
      corpo,
    )
  }
  return corpo as T
}

const comJson = (metodo: string, corpo: unknown): RequestInit => ({
  method: metodo,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(corpo),
})

function multipart(arquivo: File): RequestInit {
  const dados = new FormData()
  dados.set("arquivo", arquivo)
  return { method: "POST", body: dados }
}

const base = (slug: string) => `/api/prospects/${encodeURIComponent(slug)}`
export type AcaoEtapa = "iniciar" | "concluir" | "reabrir" | "confirmar" | "revisar" | "parar"

export const api = {
  criarProspect: (nome: string, site: string) => chamar<{ slug: string }>("/api/prospects", comJson("POST", { nome, site })),
  excluirProspect: (slug: string, confirmacao: string) => chamar(base(slug), comJson("DELETE", { confirmacao })),
  abrirPasta: (slug: string) => chamar(`${base(slug)}/abrir-pasta`, { method: "POST" }),
  acaoEtapa: (slug: string, etapa: EtapaId, acao: AcaoEtapa) => chamar(`${base(slug)}/etapas/${etapa}/acoes`, comJson("POST", { acao })),
  enviarMensagem: (slug: string, etapa: EtapaId, texto: string) =>
    chamar(`${base(slug)}/etapas/${etapa}/mensagens`, comJson("POST", { texto })),
  aprovar: (slug: string, id: string) => chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "aprovar" })),
  pedirAjuste: (slug: string, id: string, texto: string) =>
    chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "ajuste", texto })),
  enviarInsumo: (slug: string, etapa: EtapaId, insumoId: string, arquivo: File) =>
    chamar<ResultadoValidacao>(`${base(slug)}/etapas/${etapa}/insumos/${insumoId}`, multipart(arquivo)),
  enviarLink: (slug: string, etapa: EtapaId, insumoId: string, url: string) =>
    chamar<ResultadoValidacao>(`${base(slug)}/etapas/${etapa}/insumos/${insumoId}`, comJson("POST", { url })),
  enviarAnexo: (slug: string, etapa: EtapaId, arquivo: File) =>
    chamar<{ caminho: string }>(`${base(slug)}/etapas/${etapa}/anexos`, multipart(arquivo)),
}

export function urlArquivo(slug: string, caminho: string, download = false): string {
  return `${base(slug)}/arquivo?caminho=${encodeURIComponent(caminho)}${download ? "&download=1" : ""}`
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado."
}
```

`src/apps/web/components/markdown.tsx`:

```tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@workspace/ui/lib/utils"

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:font-mono [&_code]:text-xs [&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_a]:underline",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 3: Layout e verificação do sistema**

`src/apps/web/app/layout.tsx` (troca `lang`, título, e acrescenta `Toaster` e `VerificacaoSistema`):

```tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import { VerificacaoSistema } from "@/components/sistema/verificacao-sistema"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = { title: "Planejamento Estratégico · Boomer" }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}>
      <body>
        <ThemeProvider>
          {children}
          <VerificacaoSistema />
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

`src/apps/web/components/sistema/verificacao-sistema.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

interface Sistema {
  claude: { instalado: boolean; versao: string | null; logado: boolean; metodo: string | null; plano: string | null }
  python: { ok: boolean; detalhe: string | null }
}

export function VerificacaoSistema() {
  const [sistema, setSistema] = useState<Sistema | null>(null)
  const [verificando, setVerificando] = useState(false)

  const verificar = useCallback(async () => {
    setVerificando(true)
    try {
      setSistema((await (await fetch("/api/sistema", { cache: "no-store" })).json()) as Sistema)
    } finally {
      setVerificando(false)
    }
  }, [])

  useEffect(() => {
    void verificar()
  }, [verificar])

  if (!sistema) return null
  const bloqueado = !sistema.claude.instalado || !sistema.claude.logado || !sistema.python.ok
  const cobrado = sistema.claude.logado && sistema.claude.metodo !== "claude.ai"

  return (
    <>
      <Dialog open={bloqueado}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Falta configurar esta máquina</DialogTitle>
            <DialogDescription>O agente roda pelo Claude Code instalado aqui. Resolva os itens abaixo e verifique de novo.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {!sistema.claude.instalado && (
              <li>
                Instale o Claude Code (<a className="underline" href="https://docs.claude.com/en/docs/claude-code/setup" target="_blank" rel="noreferrer">guia de instalação</a>).
              </li>
            )}
            {sistema.claude.instalado && !sistema.claude.logado && (
              <li>
                No terminal, rode <code className="font-mono">claude auth login</code> e entre com a conta da Boomer.
              </li>
            )}
            {!sistema.python.ok && (
              <li>
                Instale o Python 3 e rode <code className="font-mono">pip3 install openpyxl pandas matplotlib</code>.
              </li>
            )}
          </ol>
          <DialogFooter>
            <Button onClick={verificar} disabled={verificando}>
              Verificar de novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {cobrado && (
        <div className="fixed right-4 bottom-4 z-50 max-w-sm">
          <Alert>
            <AlertDescription>
              O Claude Code desta máquina está autenticado por chave de API ({sistema.claude.metodo}), não pela assinatura. O uso vai ser cobrado na API.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Home**

`src/apps/web/app/page.tsx`:

```tsx
import { GradeProspects } from "@/components/home/grade-prospects"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

export default async function Pagina() {
  const prospects = await servidor().servico.listarProspects()
  return <GradeProspects prospects={prospects} />
}
```

`src/apps/web/components/home/grade-prospects.tsx`:

```tsx
"use client"

import { FolderOpenIcon } from "lucide-react"
import { useState } from "react"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { CardProspect } from "./card-prospect"
import { DialogoNovoProspect } from "./dialogo-novo-prospect"

export function GradeProspects({ prospects }: { prospects: ResumoProspect[] }) {
  const [busca, setBusca] = useState("")
  const filtrados = prospects.filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Planejamentos estratégicos</h1>
        <div className="ml-auto flex items-center gap-2">
          <Input className="w-64" placeholder="Buscar prospect…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <DialogoNovoProspect />
        </div>
      </header>
      {prospects.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum planejamento ainda</EmptyTitle>
            <EmptyDescription>Crie o primeiro prospect para começar pela Etapa 01.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <DialogoNovoProspect />
          </EmptyContent>
        </Empty>
      ) : filtrados.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum prospect com “{busca}”.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) => (
            <CardProspect key={p.slug} prospect={p} />
          ))}
        </div>
      )}
    </div>
  )
}
```

`src/apps/web/components/home/card-prospect.tsx`:

```tsx
"use client"

import { EllipsisIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Progress } from "@workspace/ui/components/progress"
import { api, mensagemDeErro } from "@/lib/api"
import { DialogoExcluirProspect } from "./dialogo-excluir-prospect"

function quando(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function CardProspect({ prospect: p }: { prospect: ResumoProspect }) {
  const router = useRouter()
  const [excluindo, setExcluindo] = useState(false)
  const concluido = p.etapaAtual === null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href={`/prospects/${p.slug}`} className="hover:underline">
            {p.nome}
          </Link>
        </CardTitle>
        <CardDescription>{p.rotuloEtapaAtual}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${p.nome}`} />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/prospects/${p.slug}`)}>Abrir</DropdownMenuItem>
              <DropdownMenuItem onClick={() => api.abrirPasta(p.slug).catch((e) => toast.error(mensagemDeErro(e)))}>
                Abrir pasta no Finder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
                Excluir…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={(p.concluidas / p.totalEtapas) * 100} aria-label={`${p.concluidas} de ${p.totalEtapas} etapas`} />
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={concluido ? "default" : "secondary"}>
            {p.concluidas} de {p.totalEtapas}
          </Badge>
          {p.pendencias > 0 && (
            <Badge variant="outline">
              {p.pendencias} aprovaç{p.pendencias === 1 ? "ão pendente" : "ões pendentes"}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-xs">Atualizado em {quando(p.atualizadoEm)}</CardFooter>
      <DialogoExcluirProspect prospect={p} aberto={excluindo} aoMudar={setExcluindo} />
    </Card>
  )
}
```

`src/apps/web/components/home/dialogo-novo-prospect.tsx`:

```tsx
"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { normalizarSlug } from "@workspace/core/slug"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { api, ErroApi, mensagemDeErro } from "@/lib/api"

export function DialogoNovoProspect() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState("")
  const [site, setSite] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [existente, setExistente] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const slug = normalizarSlug(nome)

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setExistente(null)
    setEnviando(true)
    try {
      const { slug: criado } = await api.criarProspect(nome, site)
      router.push(`/prospects/${criado}`)
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "prospect_existente") setExistente(String(e.dados.slug))
      else setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> Novo prospect
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={criar} className="contents">
          <DialogHeader>
            <DialogTitle>Novo prospect</DialogTitle>
            <DialogDescription>Cria a pasta do prospect a partir do modelo e libera a Etapa 01.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome-prospect">Nome do prospect</FieldLabel>
              <Input id="nome-prospect" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Iszi Cosméticos" />
              <FieldDescription>
                {slug ? (
                  <>
                    Pasta: <code className="font-mono">clientes/{slug}/</code>
                  </>
                ) : (
                  "Use pelo menos uma letra ou número."
                )}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="site-prospect">Site / e-commerce</FieldLabel>
              <Input id="site-prospect" type="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
              <FieldDescription>Opcional agora; a Etapa 01 pede se faltar.</FieldDescription>
            </Field>
            {erro && <FieldError>{erro}</FieldError>}
            {existente && (
              <FieldError>
                Já existe um prospect <code className="font-mono">{existente}</code>.{" "}
                <button type="button" className="underline" onClick={() => router.push(`/prospects/${existente}`)}>
                  Abrir o existente
                </button>{" "}
                ou escolha outro nome.
              </FieldError>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!slug || enviando}>
              {enviando && <Spinner />} Criar e abrir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`src/apps/web/components/home/dialogo-excluir-prospect.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ResumoProspect } from "@workspace/core/tipos"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { api, mensagemDeErro } from "@/lib/api"

export function DialogoExcluirProspect({
  prospect,
  aberto,
  aoMudar,
}: {
  prospect: ResumoProspect
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}) {
  const router = useRouter()
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    try {
      await api.excluirProspect(prospect.slug, confirmacao)
      toast.success(`${prospect.nome} foi para a Lixeira.`)
      aoMudar(false)
      router.refresh()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudar(v)
        if (!v) {
          setConfirmacao("")
          setErro(null)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{prospect.nome}”?</AlertDialogTitle>
          <AlertDialogDescription>
            A pasta do prospect, com insumos, conversas e entregáveis aprovados, vai para a Lixeira do macOS. Dá para recuperar por lá.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`confirmar-${prospect.slug}`}>
            Digite <code className="font-mono">{prospect.slug}</code> para confirmar
          </FieldLabel>
          <Input id={`confirmar-${prospect.slug}`} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={confirmacao.trim() !== prospect.slug || excluindo} onClick={excluir}>
            Excluir prospect
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 5: Verificar no navegador**

Run: `cd src/apps/web && npm run dev` e abra http://127.0.0.1:3000.
Expected:
- A home lista Adda, Sottile Jalecos e Sottile Teste com a etapa atual, a barra de progresso e o selo "N de 8".
- "+ Novo prospect" mostra a pasta ao vivo (`Iszi Cosméticos` → `clientes/iszi-cosmeticos/`). "Criar e abrir" leva para `/prospects/iszi-cosmeticos` (a página vem na Task 17; até lá dá 404, e isso é esperado).
- Criar o mesmo nome de novo mostra "Já existe… Abrir o existente".
- ⋯ → Excluir… só libera o botão depois de digitar o slug exato, e o prospect some da lista e aparece na Lixeira.
- Com `claude auth logout` num terminal e a página recarregada, aparece o diálogo "Falta configurar esta máquina". Faça login de novo e clique em "Verificar de novo".

Run: `cd src/apps/web && npm run typecheck && npm run lint` → sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web src/packages/ui src/package-lock.json
git commit -m "feat(web): home de prospects com criar/excluir e verificação do sistema

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: UI — área de trabalho (trilha de etapas, painel, etapa liberada)

**Files:**
- Create: `src/apps/web/app/prospects/[slug]/page.tsx`
- Create: `src/apps/web/hooks/use-area-de-trabalho.ts`
- Create: `src/apps/web/components/trabalho/area-de-trabalho.tsx`, `trilha-etapas.tsx`, `painel-etapa.tsx`, `etapa-liberada.tsx`, `icone-status.tsx`
- Create (provisório, substituído na Task 18): `src/apps/web/components/chat/chat-etapa.tsx`
- Create (provisório, substituído na Task 19): `src/apps/web/components/cards/card-insumo.tsx`

**Interfaces:**
- Consumes: `api`, `urlArquivo` (Task 16); rotas da Task 15.
- Produces:
  - `useAreaDeTrabalho(slug)` → `{ dados: RespostaEstado | null; erro: string | null; conversas: Partial<Record<EtapaId, EventoConversa[]>>; deltas: Partial<Record<EtapaId, string>>; recarregar(); carregarConversa(etapa) }`
  - `<ChatEtapa slug etapa dados eventos delta />` (contrato que a Task 18 implementa de verdade)
  - `<CardInsumo slug etapa insumo obrigatorio estadoInsumo temModelo />` (contrato que a Task 19 implementa de verdade)
  - `IconeStatus`, `ROTULO_STATUS: Record<StatusEtapa, string>`

- [ ] **Step 1: Hook de dados em tempo real**

`src/apps/web/hooks/use-area-de-trabalho.ts`:

```ts
"use client"

import { useCallback, useEffect, useState } from "react"
import type { EtapaId, EventoConversa, EventoTempoReal, RespostaEstado } from "@workspace/core/tipos"

export function useAreaDeTrabalho(slug: string) {
  const [dados, setDados] = useState<RespostaEstado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [conversas, setConversas] = useState<Partial<Record<EtapaId, EventoConversa[]>>>({})
  const [deltas, setDeltas] = useState<Partial<Record<EtapaId, string>>>({})

  const recarregar = useCallback(async () => {
    const r = await fetch(`/api/prospects/${encodeURIComponent(slug)}/estado`, { cache: "no-store" })
    if (!r.ok) {
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string }
      setErro(corpo.erro ?? `Erro ${r.status}`)
      return
    }
    setErro(null)
    setDados((await r.json()) as RespostaEstado)
  }, [slug])

  const carregarConversa = useCallback(
    async (etapa: EtapaId) => {
      const r = await fetch(`/api/prospects/${encodeURIComponent(slug)}/etapas/${etapa}/conversa`, { cache: "no-store" })
      if (!r.ok) return
      const { eventos } = (await r.json()) as { eventos: EventoConversa[] }
      setConversas((c) => ({ ...c, [etapa]: eventos }))
    },
    [slug],
  )

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const fonte = new EventSource(`/api/prospects/${encodeURIComponent(slug)}/eventos`)
    fonte.onmessage = (m) => {
      const ev = JSON.parse(m.data) as EventoTempoReal
      if (ev.tipo === "estado") {
        void recarregar()
      } else if (ev.tipo === "turno") {
        void recarregar()
        if (!ev.ativo) {
          setDeltas((d) => ({ ...d, [ev.etapa]: "" }))
          void carregarConversa(ev.etapa)
        }
      } else if (ev.tipo === "delta") {
        setDeltas((d) => ({ ...d, [ev.etapa]: (d[ev.etapa] ?? "") + ev.texto }))
      } else if (ev.tipo === "conversa") {
        setConversas((c) => {
          const atual = c[ev.etapa]
          return atual ? { ...c, [ev.etapa]: [...atual, ev.evento] } : c
        })
        if (ev.evento.tipo === "texto_agente") setDeltas((d) => ({ ...d, [ev.etapa]: "" }))
      }
    }
    // o EventSource reconecta sozinho; ao voltar, o estado é recarregado pelo próximo evento
    return () => fonte.close()
  }, [slug, recarregar, carregarConversa])

  return { dados, erro, conversas, deltas, recarregar, carregarConversa }
}
```

- [ ] **Step 2: Ícone de status e trilha**

`src/apps/web/components/trabalho/icone-status.tsx`:

```tsx
import { CircleCheckIcon, CircleDotIcon, CircleIcon, LockIcon, TriangleAlertIcon } from "lucide-react"
import type { StatusEtapa } from "@workspace/core/tipos"
import { cn } from "@workspace/ui/lib/utils"

export const ROTULO_STATUS: Record<StatusEtapa, string> = {
  bloqueada: "Bloqueada",
  liberada: "Liberada",
  em_andamento: "Em andamento",
  pronta: "Pronta para concluir",
  concluida: "Concluída",
  desatualizada: "Desatualizada",
}

export function IconeStatus({ status, className }: { status: StatusEtapa; className?: string }) {
  const classe = cn("size-4 shrink-0", className)
  switch (status) {
    case "concluida":
      return <CircleCheckIcon className={cn(classe, "text-primary")} aria-label={ROTULO_STATUS[status]} />
    case "desatualizada":
      return <TriangleAlertIcon className={cn(classe, "text-amber-500")} aria-label={ROTULO_STATUS[status]} />
    case "em_andamento":
    case "pronta":
      return <CircleDotIcon className={cn(classe, "text-primary")} aria-label={ROTULO_STATUS[status]} />
    case "liberada":
      return <CircleIcon className={cn(classe, "text-muted-foreground")} aria-label={ROTULO_STATUS[status]} />
    case "bloqueada":
      return <LockIcon className={cn(classe, "text-muted-foreground/60")} aria-label={ROTULO_STATUS[status]} />
  }
}
```

`src/apps/web/components/trabalho/trilha-etapas.tsx`:

```tsx
"use client"

import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import type { Catalogo, EtapaId, Estado } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { IconeStatus, ROTULO_STATUS } from "./icone-status"

export function TrilhaEtapas({
  catalogo,
  estado,
  selecionada,
  aoSelecionar,
}: {
  catalogo: Catalogo
  estado: Estado
  selecionada: EtapaId
  aoSelecionar: (etapa: EtapaId) => void
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-1 overflow-y-auto p-3">
      <Button variant="ghost" size="sm" className="justify-start" render={<Link href="/" />} nativeButton={false}>
        <ArrowLeftIcon /> Prospects
      </Button>
      <h2 className="px-2 pt-2 pb-3 font-semibold">{estado.prospect.nome}</h2>
      <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">Etapas</p>
      <nav aria-label="Etapas do planejamento" className="flex flex-col gap-0.5">
        {catalogo.etapas.map((e) => {
          const status = estado.etapas[e.id].status
          return (
            <Button
              key={e.id}
              variant="ghost"
              className={cn("h-auto justify-start gap-2 px-2 py-1.5 font-normal", selecionada === e.id && "bg-muted font-medium")}
              disabled={status === "bloqueada"}
              aria-current={selecionada === e.id ? "step" : undefined}
              title={ROTULO_STATUS[status]}
              onClick={() => aoSelecionar(e.id)}
            >
              <IconeStatus status={status} />
              <span className="truncate">
                {e.numero ? `${e.numero} · ` : ""}
                {e.titulo}
              </span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Painel da etapa**

`src/apps/web/components/trabalho/painel-etapa.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaEstado, StatusEntregavel } from "@workspace/core/tipos"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { CardInsumo } from "@/components/cards/card-insumo"
import { api, mensagemDeErro, type AcaoEtapa } from "@/lib/api"

const COR: Record<StatusEntregavel, string> = { pendente: "bg-amber-500", aprovado: "bg-primary", substituido: "bg-muted-foreground/40" }

export function PainelEtapa({ slug, etapa, dados }: { slug: string; etapa: EtapaId; dados: RespostaEstado }) {
  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!
  const estadoEtapa = dados.estado.etapas[etapa]
  const entregaveis = dados.estado.entregaveis.filter((e) => e.etapa === etapa && e.status !== "substituido")
  const condicoes = dados.condicoes[etapa]
  const [ocupado, setOcupado] = useState<AcaoEtapa | null>(null)

  async function executar(acao: AcaoEtapa, sucesso: string) {
    setOcupado(acao)
    try {
      await api.acaoEtapa(slug, etapa, acao)
      toast.success(sucesso)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(null)
    }
  }

  const posterioresConcluidas = dados.catalogo.etapas
    .slice(dados.catalogo.etapas.findIndex((e) => e.id === etapa) + 1)
    .filter((e) => dados.estado.etapas[e.id].status === "concluida")

  return (
    <aside className="flex min-h-0 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Entregáveis da etapa</h3>
          {entregaveis.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nada proposto ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {entregaveis.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", COR[e.status])} aria-hidden />
                  <span className="truncate">{e.titulo}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{e.status === "pendente" ? "aguardando" : "aprovado"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Insumos</h3>
          {etapaCat.insumos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Esta etapa não pede arquivos.</p>
          ) : (
            <div className="space-y-3">
              {etapaCat.insumos.map((ref) => (
                <CardInsumo
                  key={ref.id}
                  slug={slug}
                  etapa={etapa}
                  insumo={dados.catalogo.insumos.find((i) => i.id === ref.id)!}
                  obrigatorio={ref.obrigatorio}
                  estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === ref.id) ?? null}
                  temModelo={dados.modelosDisponiveis.includes(ref.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-2 border-t p-4">
        {(estadoEtapa.status === "em_andamento" || estadoEtapa.status === "pronta") && (
          <>
            <Button
              className="w-full"
              disabled={condicoes.length > 0 || dados.turnoAtivo === etapa || ocupado !== null}
              onClick={() => executar("concluir", "Etapa concluída. A próxima foi liberada.")}
            >
              {ocupado === "concluir" && <Spinner />}
              {condicoes.length > 0 ? `Concluir etapa (falta ${condicoes.length})` : "Concluir etapa"}
            </Button>
            {condicoes.length > 0 && (
              <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs" aria-label="O que falta para concluir">
                {condicoes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {estadoEtapa.status === "concluida" && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" className="w-full" />}>Reabrir etapa</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reabrir {etapaCat.rotuloStatus}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O chat desta etapa volta a aceitar mensagens.
                  {posterioresConcluidas.length > 0 &&
                    ` As etapas ${posterioresConcluidas.map((e) => e.numero || e.titulo).join(", ")} ficam desatualizadas até você revisar ou confirmar cada uma.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => executar("reabrir", "Etapa reaberta.")}>Reabrir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {estadoEtapa.status === "desatualizada" && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Uma etapa anterior foi reaberta. Revise esta ou confirme que continua valendo.</p>
            <Button className="w-full" variant="outline" disabled={ocupado !== null} onClick={() => executar("revisar", "Etapa reaberta para revisão.")}>
              Revisar
            </Button>
            <Button className="w-full" disabled={ocupado !== null} onClick={() => executar("confirmar", "Etapa confirmada.")}>
              Confirmar que continua válida
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
```

(A lista do que falta aparece logo abaixo do botão, sempre visível — cobre o "passar o mouse mostra o que falta" do spec e funciona no teclado.)

- [ ] **Step 4: Etapa liberada e placeholders**

`src/apps/web/components/trabalho/etapa-liberada.tsx`:

```tsx
"use client"

import { LockIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { CardInsumo } from "@/components/cards/card-insumo"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro } from "@/lib/api"

export function EtapaLiberada({
  slug,
  etapa,
  dados,
  handoffAnterior,
}: {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  handoffAnterior: string | null
}) {
  const [iniciando, setIniciando] = useState(false)
  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!

  if (dados.estado.etapas[etapa].status === "bloqueada") {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>Etapa bloqueada</EmptyTitle>
          <EmptyDescription>Conclua a etapa anterior para liberar esta.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  async function iniciar() {
    setIniciando(true)
    try {
      await api.acaoEtapa(slug, etapa, "iniciar")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setIniciando(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div>
          <p className="text-muted-foreground text-sm">{etapaCat.numero ? `Etapa ${etapaCat.numero}` : "Etapa final"}</p>
          <h2 className="text-2xl font-semibold">{etapaCat.titulo}</h2>
          <p className="text-muted-foreground mt-2">{etapaCat.descricao}</p>
        </div>
        {handoffAnterior && (
          <Card>
            <CardHeader>
              <CardTitle>O que preparar</CardTitle>
              <CardDescription>Pedido deixado pela etapa anterior</CardDescription>
            </CardHeader>
            <CardContent>
              <Markdown>{handoffAnterior}</Markdown>
            </CardContent>
          </Card>
        )}
        {etapaCat.insumos.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Arquivos desta etapa</h3>
            <p className="text-muted-foreground text-sm">Pode enviar agora ou quando o agente pedir.</p>
            {etapaCat.insumos.map((ref) => (
              <CardInsumo
                key={ref.id}
                slug={slug}
                etapa={etapa}
                insumo={dados.catalogo.insumos.find((i) => i.id === ref.id)!}
                obrigatorio={ref.obrigatorio}
                estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === ref.id) ?? null}
                temModelo={dados.modelosDisponiveis.includes(ref.id)}
              />
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-sm">O agente começa já com o dossiê das etapas anteriores (decisões e entregáveis aprovados).</p>
        <div className="flex items-center gap-3">
          <Button size="lg" onClick={iniciar} disabled={iniciando || dados.turnoAtivo !== null}>
            {iniciando && <Spinner />} Iniciar etapa
          </Button>
          {dados.turnoAtivo !== null && <span className="text-muted-foreground text-sm">O agente está respondendo em outra etapa…</span>}
        </div>
      </div>
    </div>
  )
}
```

Placeholder `src/apps/web/components/cards/card-insumo.tsx` (a Task 19 substitui o arquivo inteiro, mantendo as props):

```tsx
"use client"

import type { EstadoInsumo, EtapaId, InsumoCatalogo } from "@workspace/core/tipos"

export interface PropsCardInsumo {
  slug: string
  etapa: EtapaId
  insumo: InsumoCatalogo
  obrigatorio: boolean
  estadoInsumo: EstadoInsumo | null
  temModelo: boolean
}

export function CardInsumo({ insumo, estadoInsumo }: PropsCardInsumo) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      {insumo.nome} — {estadoInsumo?.status ?? "pendente"}
    </div>
  )
}
```

Placeholder `src/apps/web/components/chat/chat-etapa.tsx` (a Task 18 substitui, mantendo as props):

```tsx
"use client"

import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

export function ChatEtapa({ eventos, delta }: PropsChatEtapa) {
  return (
    <pre className="min-h-0 flex-1 overflow-auto p-4 text-xs">
      {JSON.stringify(eventos, null, 2)}
      {delta}
    </pre>
  )
}
```

- [ ] **Step 5: Área de trabalho e página**

`src/apps/web/components/trabalho/area-de-trabalho.tsx`:

```tsx
"use client"

import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ORDEM_ETAPAS, type EtapaId, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { ChatEtapa } from "@/components/chat/chat-etapa"
import { useAreaDeTrabalho } from "@/hooks/use-area-de-trabalho"
import { EtapaLiberada } from "./etapa-liberada"
import { ROTULO_STATUS } from "./icone-status"
import { PainelEtapa } from "./painel-etapa"
import { TrilhaEtapas } from "./trilha-etapas"

export function escolherEtapaInicial(estado: Estado): EtapaId {
  const prioridades: StatusEtapa[][] = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
  for (const grupo of prioridades) {
    const id = ORDEM_ETAPAS.find((i) => grupo.includes(estado.etapas[i].status))
    if (id) return id
  }
  return "final"
}

export function AreaDeTrabalho({ slug }: { slug: string }) {
  const { dados, erro, conversas, deltas, carregarConversa } = useAreaDeTrabalho(slug)
  const [selecionada, setSelecionada] = useState<EtapaId | null>(null)
  const [painelAberto, setPainelAberto] = useState(true)
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)

  useEffect(() => {
    if (etapa && dados && conversas[etapa] === undefined) void carregarConversa(etapa)
  }, [etapa, dados, conversas, carregarConversa])

  if (erro) {
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyTitle>Não consegui abrir este prospect</EmptyTitle>
          <EmptyDescription>{erro}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/" />} nativeButton={false}>
            Voltar para os prospects
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (!dados || !etapa) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!
  const estadoEtapa = dados.estado.etapas[etapa]
  const indice = ORDEM_ETAPAS.indexOf(etapa)
  const anterior = indice > 0 ? ORDEM_ETAPAS[indice - 1]! : null
  const mostrarChat = estadoEtapa.status !== "liberada" && estadoEtapa.status !== "bloqueada"

  return (
    <div className={cn("grid h-svh", painelAberto ? "grid-cols-[240px_minmax(0,1fr)_320px]" : "grid-cols-[240px_minmax(0,1fr)]")}>
      <TrilhaEtapas catalogo={dados.catalogo} estado={dados.estado} selecionada={etapa} aoSelecionar={setSelecionada} />
      <main className="flex min-h-0 flex-col border-x">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <h1 className="font-semibold">{etapaCat.rotuloStatus}</h1>
          <Badge variant="secondary">{ROTULO_STATUS[estadoEtapa.status]}</Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={painelAberto ? "Recolher painel" : "Mostrar painel"}
            onClick={() => setPainelAberto((v) => !v)}
          >
            {painelAberto ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
          </Button>
        </header>
        {mostrarChat ? (
          <ChatEtapa slug={slug} etapa={etapa} dados={dados} eventos={conversas[etapa] ?? []} delta={deltas[etapa] ?? ""} />
        ) : (
          <EtapaLiberada slug={slug} etapa={etapa} dados={dados} handoffAnterior={anterior ? dados.estado.etapas[anterior].handoff : null} />
        )}
      </main>
      {painelAberto && <PainelEtapa slug={slug} etapa={etapa} dados={dados} />}
    </div>
  )
}
```

`src/apps/web/app/prospects/[slug]/page.tsx`:

```tsx
import { AreaDeTrabalho } from "@/components/trabalho/area-de-trabalho"

export const dynamic = "force-dynamic"

export default async function Pagina(props: PageProps<"/prospects/[slug]">) {
  const { slug } = await props.params
  return <AreaDeTrabalho slug={slug} />
}
```

- [ ] **Step 6: Verificar no navegador (executor de demonstração)**

Run: `cd src/apps/web && PLANEJAMENTO_EXECUTOR=demo npm run dev` e crie um prospect "Demo" na home.
Expected:
- Três colunas: a trilha com 01 liberada e o resto com cadeado; o centro mostra a tela "Etapa 01 · Preparação de contexto" com a descrição, os insumos (placeholder) e "Iniciar etapa"; o painel mostra "Nada proposto ainda" e os insumos.
- "Iniciar etapa" troca o centro pelo chat (placeholder em JSON) com `aviso`, `turno_inicio`, `texto_agente`, `turno_fim`; o badge vira "Em andamento"; o painel mostra "Concluir etapa (falta 2)" e a lista (transcrição + sinal do agente).
- Abrir `/prospects/adda`: as etapas concluídas mostram ✓, e a 01 aberta mostra o botão "Reabrir etapa" com o diálogo avisando quais etapas ficam desatualizadas.
- `/prospects/nao-existe` mostra "Não consegui abrir este prospect".
- O botão de recolher painel alterna entre três e duas colunas.

Run: `cd src/apps/web && npm run typecheck && npm run lint` → sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): área de trabalho com trilha de etapas, painel e etapa liberada

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: UI — chat da etapa com streaming, compositor e anexos

**Files:**
- Modify (substituir inteiro): `src/apps/web/components/chat/chat-etapa.tsx`
- Create: `src/apps/web/components/chat/item-conversa.tsx`, `src/apps/web/components/chat/compositor.tsx`
- Create (provisório, substituído na Task 19): `src/apps/web/components/cards/card-entregavel.tsx`

**Interfaces:**
- Consumes: `PropsChatEtapa` (Task 17), `api` (Task 16), `CardInsumo` (Task 17/19), `MessageScroller*`, `Message*`, `Bubble*`, `Marker*`, `Alert*` do shadcn.
- Produces: `<ItemConversa evento slug etapa dados aoTentarDeNovo />`, `<Compositor slug etapa desabilitado motivo ativoAqui />`, contrato `<CardEntregavel slug entregavel />`.

- [ ] **Step 1: Placeholder do card de entregável**

`src/apps/web/components/cards/card-entregavel.tsx` (a Task 19 substitui):

```tsx
"use client"

import type { Entregavel } from "@workspace/core/tipos"

export function CardEntregavel({ entregavel }: { slug: string; entregavel: Entregavel }) {
  return <div className="rounded-lg border p-3 text-sm">{entregavel.titulo} — {entregavel.status}</div>
}
```

- [ ] **Step 2: Item de conversa**

`src/apps/web/components/chat/item-conversa.tsx`:

```tsx
"use client"

import { InfoIcon, WrenchIcon } from "lucide-react"
import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import { CardEntregavel } from "@/components/cards/card-entregavel"
import { CardInsumo } from "@/components/cards/card-insumo"
import { Markdown } from "@/components/markdown"

function resumoAutomatico(texto: string): string {
  const primeira = texto.split("\n")[0] ?? ""
  return primeira.length > 140 ? `${primeira.slice(0, 140)}…` : primeira
}

export function ItemConversa({
  evento,
  slug,
  etapa,
  dados,
  aoTentarDeNovo,
}: {
  evento: EventoConversa
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  aoTentarDeNovo: () => void
}) {
  switch (evento.tipo) {
    case "turno_inicio":
      return null
    case "mensagem_analista":
      return evento.automatica ? (
        <Marker variant="separator">
          <MarkerContent>{resumoAutomatico(evento.texto)}</MarkerContent>
        </Marker>
      ) : (
        <Message align="end">
          <MessageContent>
            <Bubble variant="default" align="end">
              <BubbleContent className="whitespace-pre-wrap">{evento.texto}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case "texto_agente":
      return (
        <Message align="start">
          <MessageContent>
            <Bubble variant="muted">
              <BubbleContent>
                <Markdown>{evento.texto}</Markdown>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case "atividade":
      return (
        <Marker>
          <MarkerIcon>
            <WrenchIcon />
          </MarkerIcon>
          <MarkerContent className="text-muted-foreground text-xs">{evento.detalhe}</MarkerContent>
        </Marker>
      )
    case "card_entregavel": {
      const entregavel = dados.estado.entregaveis.find((e) => e.id === evento.entregavelId)
      return entregavel ? <CardEntregavel slug={slug} entregavel={entregavel} /> : null
    }
    case "card_insumo": {
      const insumo = dados.catalogo.insumos.find((i) => i.id === evento.insumoId)
      const ref = dados.catalogo.etapas.find((e) => e.id === etapa)?.insumos.find((r) => r.id === evento.insumoId)
      if (!insumo || !ref) return null
      return (
        <div className="max-w-xl">
          <CardInsumo
            slug={slug}
            etapa={etapa}
            insumo={insumo}
            obrigatorio={ref.obrigatorio}
            estadoInsumo={dados.estado.insumos.find((i) => i.etapa === etapa && i.insumoId === insumo.id) ?? null}
            temModelo={dados.modelosDisponiveis.includes(insumo.id)}
          />
        </div>
      )
    }
    case "aviso":
      return (
        <Alert variant={evento.nivel === "erro" ? "destructive" : "default"}>
          <InfoIcon />
          <AlertDescription>{evento.texto}</AlertDescription>
        </Alert>
      )
    case "turno_fim":
      if (evento.status === "ok") return null
      return (
        <Alert variant="destructive">
          <AlertTitle>{evento.status === "interrompido" ? "Resposta interrompida" : "O agente encontrou um erro"}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {evento.detalhe && <span>{evento.detalhe}</span>}
            <Button size="sm" variant="outline" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )
  }
}
```

- [ ] **Step 3: Compositor**

`src/apps/web/components/chat/compositor.tsx`:

```tsx
"use client"

import { PaperclipIcon, SendIcon, SquareIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { EtapaId } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { api, mensagemDeErro } from "@/lib/api"

export function Compositor({
  slug,
  etapa,
  desabilitado,
  motivo,
  ativoAqui,
}: {
  slug: string
  etapa: EtapaId
  desabilitado: boolean
  motivo: string | null
  ativoAqui: boolean
}) {
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [anexando, setAnexando] = useState(false)
  const entradaArquivo = useRef<HTMLInputElement>(null)

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo) return
    setEnviando(true)
    try {
      await api.enviarMensagem(slug, etapa, limpo)
      setTexto("")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setAnexando(true)
    try {
      for (const arquivo of Array.from(arquivos)) {
        const { caminho } = await api.enviarAnexo(slug, etapa, arquivo)
        setTexto((t) => `${t}${t ? "\n" : ""}[Anexo: ${caminho}]`)
      }
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setAnexando(false)
      if (entradaArquivo.current) entradaArquivo.current.value = ""
    }
  }

  return (
    <div className="border-t p-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {motivo && <p className="text-muted-foreground text-xs">{motivo}</p>}
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (!desabilitado && !enviando) void enviar()
            }
          }}
          placeholder="Escreva para o agente… (Enter envia, Shift+Enter quebra linha)"
          disabled={desabilitado}
          rows={3}
          aria-label="Mensagem para o agente"
        />
        <div className="flex items-center gap-2">
          <input ref={entradaArquivo} type="file" multiple hidden onChange={(e) => void anexar(e.target.files)} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Anexar arquivo"
            disabled={desabilitado || anexando}
            onClick={() => entradaArquivo.current?.click()}
          >
            {anexando ? <Spinner /> : <PaperclipIcon />}
          </Button>
          {ativoAqui ? (
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => api.acaoEtapa(slug, etapa, "parar").catch((e) => toast.error(mensagemDeErro(e)))}
            >
              <SquareIcon /> Parar
            </Button>
          ) : (
            <Button className="ml-auto" onClick={() => void enviar()} disabled={desabilitado || enviando || !texto.trim()}>
              {enviando ? <Spinner /> : <SendIcon />} Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chat da etapa**

`src/apps/web/components/chat/chat-etapa.tsx` (substitui o placeholder):

```tsx
"use client"

import { toast } from "sonner"
import type { EtapaId, EventoConversa, RespostaEstado } from "@workspace/core/tipos"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Marker, MarkerContent } from "@workspace/ui/components/marker"
import { Message, MessageContent } from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro } from "@/lib/api"
import { Compositor } from "./compositor"
import { ItemConversa } from "./item-conversa"

export interface PropsChatEtapa {
  slug: string
  etapa: EtapaId
  dados: RespostaEstado
  eventos: EventoConversa[]
  delta: string
}

export function ChatEtapa({ slug, etapa, dados, eventos, delta }: PropsChatEtapa) {
  const estadoEtapa = dados.estado.etapas[etapa]
  const ativoAqui = dados.turnoAtivo === etapa
  const ativoOutra = dados.turnoAtivo !== null && !ativoAqui
  const somenteLeitura = estadoEtapa.status === "concluida" || estadoEtapa.status === "desatualizada"
  const motivo = somenteLeitura
    ? estadoEtapa.status === "concluida"
      ? "Etapa concluída. Para mudar algo, use Reabrir etapa no painel."
      : "Etapa desatualizada. Use Revisar no painel para voltar a conversar."
    : ativoOutra
      ? "O agente está respondendo em outra etapa deste prospect."
      : null

  const tentarDeNovo = () =>
    api.enviarMensagem(slug, etapa, "Continue de onde parou.").catch((e) => toast.error(mensagemDeErro(e)))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
              {estadoEtapa.origem === "terminal" && eventos.length === 0 && (
                <MessageScrollerItem messageId="terminal">
                  <Marker variant="separator">
                    <MarkerContent>Conversa feita no terminal. Os entregáveis aprovados estão no painel ao lado.</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}
              {eventos.map((evento, i) => (
                <MessageScrollerItem
                  key={`${evento.em}-${i}`}
                  messageId={`evento-${i}`}
                  scrollAnchor={evento.tipo === "mensagem_analista" && !evento.automatica}
                >
                  <ItemConversa evento={evento} slug={slug} etapa={etapa} dados={dados} aoTentarDeNovo={tentarDeNovo} />
                </MessageScrollerItem>
              ))}
              {ativoAqui && (
                <MessageScrollerItem messageId="ao-vivo">
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent>{delta ? <Markdown>{delta}</Markdown> : <span className="shimmer">Pensando…</span>}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <Compositor slug={slug} etapa={etapa} desabilitado={somenteLeitura || ativoOutra || ativoAqui} motivo={motivo} ativoAqui={ativoAqui} />
    </div>
  )
}
```

(Se a classe `shimmer` não existir na versão instalada, veja `.agents/skills/shadcn/rules/styling.md`.)

- [ ] **Step 5: Verificar no navegador (executor de demonstração)**

Run: `cd src/apps/web && PLANEJAMENTO_EXECUTOR=demo npm run dev`, abra o prospect "Demo" e a Etapa 01.
Expected:
- Mensagens do analista à direita, do agente à esquerda em markdown, "Etapa iniciada…" como aviso.
- Enviar uma mensagem com Enter: aparece a bolha, "Pensando…" com shimmer, depois a resposta de demonstração; o campo fica bloqueado enquanto o turno roda e o botão vira "Parar".
- O clipe anexa um arquivo e insere `[Anexo: clientes/demo/.app/anexos/…]` no campo.
- Rolar para cima durante a resposta mostra o botão de voltar ao fim.
- Mate o servidor no meio de um turno (Ctrl+C), suba de novo e abra a etapa: aparece "Resposta interrompida" com "Tentar de novo".

Run: `cd src/apps/web && npm run typecheck && npm run lint` → sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): chat da etapa com streaming, anexos e retomada após interrupção

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: UI — cards de entregável e de insumo

**Files:**
- Modify (substituir inteiro): `src/apps/web/components/cards/card-entregavel.tsx`, `src/apps/web/components/cards/card-insumo.tsx`
- Create: `src/apps/web/components/cards/previa-arquivo.tsx`

**Interfaces:**
- Consumes: `api`, `urlArquivo` (Task 16); `destinoAprovado` de `@workspace/core/entregaveis`; `PropsCardInsumo` (Task 17).
- Produces: `<CardEntregavel slug entregavel />`, `<CardInsumo {...PropsCardInsumo} />`, `<PreviaArquivo slug tipo caminho titulo />`.

- [ ] **Step 1: Prévia de arquivo**

`src/apps/web/components/cards/previa-arquivo.tsx`:

```tsx
"use client"

import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon, Maximize2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import type { TipoEntregavel } from "@workspace/core/tipos"
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@workspace/ui/components/attachment"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Markdown } from "@/components/markdown"
import { urlArquivo } from "@/lib/api"

export function PreviaArquivo({ slug, tipo, caminho, titulo }: { slug: string; tipo: TipoEntregavel; caminho: string; titulo: string }) {
  const url = urlArquivo(slug, caminho)
  const [texto, setTexto] = useState<string | null>(null)

  useEffect(() => {
    if (tipo !== "secao") return
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => r.text())
      .then((t) => ativo && setTexto(t))
    return () => {
      ativo = false
    }
  }, [tipo, url])

  if (tipo === "grafico" || tipo === "tabela") {
    return (
      <Dialog>
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={url} alt={titulo} className="w-full rounded-md border bg-white" />
          <DialogTrigger render={<Button size="sm" variant="secondary" className="absolute top-2 right-2" />}>
            <Maximize2Icon /> Ampliar
          </DialogTrigger>
        </div>
        <DialogContent className="max-w-[92vw] sm:max-w-[92vw]">
          <DialogTitle>{titulo}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
          <img src={url} alt={titulo} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    )
  }
  if (tipo === "secao") {
    return texto === null ? (
      <Skeleton className="h-24 w-full" />
    ) : (
      <div className="max-h-96 overflow-y-auto rounded-md border p-3">
        <Markdown>{texto}</Markdown>
      </div>
    )
  }
  if (tipo === "html") {
    return <iframe src={url} title={titulo} sandbox="allow-scripts" className="h-96 w-full rounded-md border bg-white" />
  }
  return (
    <Attachment state="done">
      <AttachmentMedia variant="icon">{tipo === "planilha" ? <FileSpreadsheetIcon /> : <FileTextIcon />}</AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{titulo}</AttachmentTitle>
        <AttachmentDescription>{tipo === "planilha" ? "Planilha Excel" : "Documento Word"} · abra para conferir</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction render={<a href={urlArquivo(slug, caminho, true)} download aria-label="Baixar" />}>
          <DownloadIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}
```

(Se `AttachmentAction` não aceitar `render` na versão instalada, troque por `<AttachmentAction onClick={() => window.open(urlArquivo(slug, caminho, true))}>` — confira o arquivo gerado em `src/packages/ui/src/components/attachment.tsx`.)

- [ ] **Step 2: Card de entregável**

`src/apps/web/components/cards/card-entregavel.tsx`:

```tsx
"use client"

import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { destinoAprovado } from "@workspace/core/entregaveis"
import type { Entregavel, StatusEntregavel, TipoEntregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"
import { PreviaArquivo } from "./previa-arquivo"

const ROTULO_TIPO: Record<TipoEntregavel, string> = {
  grafico: "Gráfico",
  tabela: "Tabela",
  secao: "Seção de texto",
  planilha: "Planilha",
  documento: "Documento",
  html: "Relatório HTML",
}
const ROTULO_STATUS: Record<StatusEntregavel, string> = { pendente: "Aguardando aprovação", aprovado: "Aprovado", substituido: "Substituído" }

export function CardEntregavel({ slug, entregavel: e }: { slug: string; entregavel: Entregavel }) {
  const [ajusteAberto, setAjusteAberto] = useState(false)
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const nomeNaApresentacao = destinoAprovado(e).split("/").pop()

  async function aprovar() {
    setOcupado(true)
    try {
      await api.aprovar(slug, e.id)
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  async function enviarAjuste() {
    setOcupado(true)
    try {
      await api.pedirAjuste(slug, e.id, texto)
      setAjusteAberto(false)
      setTexto("")
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card className={cn("max-w-2xl", e.status === "substituido" && "opacity-60")}>
      <CardHeader>
        <CardTitle>{e.titulo}</CardTitle>
        <CardDescription>
          {ROTULO_TIPO[e.tipo]} · vai para a apresentação como <code className="font-mono">{nomeNaApresentacao}</code>
        </CardDescription>
        <CardAction>
          <Badge variant={e.status === "aprovado" ? "default" : e.status === "pendente" ? "outline" : "secondary"}>
            {ROTULO_STATUS[e.status]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <PreviaArquivo slug={slug} tipo={e.tipo} caminho={e.arquivoRascunho} titulo={e.titulo} />
        {(e.tipo === "grafico" || e.tipo === "tabela") && e.status === "pendente" && (
          <p className="text-sm">Confirme se os valores representados no gráfico correspondem exatamente aos dados enviados.</p>
        )}
        {e.ajustePedido && e.status === "pendente" && (
          <p className="text-muted-foreground text-sm">Ajuste pedido: “{e.ajustePedido}”. Aguardando a nova versão do agente.</p>
        )}
        {ajusteAberto && (
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Ex.: trocar para barras, incluir a linha de média"
              aria-label="Descreva o ajuste"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={enviarAjuste} disabled={!texto.trim() || ocupado}>
                {ocupado && <Spinner />} Enviar ajuste
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAjusteAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      {e.status === "pendente" && !ajusteAberto && (
        <CardFooter className="gap-2">
          <Button onClick={aprovar} disabled={ocupado}>
            {ocupado ? <Spinner /> : <CheckIcon />} Aprovar
          </Button>
          <Button variant="outline" onClick={() => setAjusteAberto(true)} disabled={ocupado}>
            Pedir ajuste…
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Card de insumo**

`src/apps/web/components/cards/card-insumo.tsx` (substitui o placeholder, mesmas props):

```tsx
"use client"

import { CircleCheckIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon, LinkIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { EstadoInsumo, EtapaId, InsumoCatalogo } from "@workspace/core/tipos"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"

export interface PropsCardInsumo {
  slug: string
  etapa: EtapaId
  insumo: InsumoCatalogo
  obrigatorio: boolean
  estadoInsumo: EstadoInsumo | null
  temModelo: boolean
}

export function CardInsumo({ slug, etapa, insumo, obrigatorio, estadoInsumo, temModelo }: PropsCardInsumo) {
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [url, setUrl] = useState(estadoInsumo?.resumo ?? "")
  const entrada = useRef<HTMLInputElement>(null)
  const status = estadoInsumo?.status ?? "pendente"
  const Icone = insumo.tipo === "link" ? LinkIcon : insumo.formatos.includes(".xlsx") ? FileSpreadsheetIcon : FileTextIcon

  async function enviarArquivos(arquivos: FileList | File[] | null) {
    if (!arquivos || arquivos.length === 0) return
    setEnviando(true)
    try {
      for (const arquivo of Array.from(arquivos)) {
        const r = await api.enviarInsumo(slug, etapa, insumo.id, arquivo)
        if (r.ok) toast.success(`${insumo.nome}: recebido`)
        else toast.error(`${insumo.nome}: ${r.problemas.length} problema(s) — veja no card`)
      }
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  async function salvarLink() {
    setEnviando(true)
    try {
      await api.enviarLink(slug, etapa, insumo.id, url)
      toast.success(`${insumo.nome}: salvo`)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="size-4" /> {insumo.nome}
        </CardTitle>
        <CardDescription>
          {insumo.tipo === "link" ? "Link" : insumo.formatos.join(", ")}
        </CardDescription>
        <CardAction>
          <Badge variant={status === "valido" ? "default" : status === "invalido" ? "destructive" : "outline"}>
            {status === "valido" ? "Recebido" : status === "invalido" ? "Com problemas" : obrigatorio ? "Obrigatório" : "Opcional"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{insumo.descricao}</p>
        <p className="text-muted-foreground">{insumo.instrucao}</p>

        {status === "valido" && (
          <Alert>
            <CircleCheckIcon />
            <AlertTitle>{estadoInsumo?.resumo ?? "Arquivo recebido"}</AlertTitle>
            {estadoInsumo && estadoInsumo.avisos.length > 0 && (
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {estadoInsumo.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}
        {status === "invalido" && estadoInsumo && (
          <Alert variant="destructive">
            <AlertTitle>
              {estadoInsumo.problemas.length} problema{estadoInsumo.problemas.length === 1 ? "" : "s"} na planilha
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {estadoInsumo.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {insumo.tipo === "link" ? (
          <div className="flex gap-2">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label={insumo.nome} />
            <Button onClick={salvarLink} disabled={!url.trim() || enviando}>
              {enviando && <Spinner />} Salvar
            </Button>
          </div>
        ) : (
          <>
            <input
              ref={entrada}
              type="file"
              hidden
              multiple={insumo.destino.endsWith("/")}
              accept={insumo.formatos.join(",")}
              onChange={(e) => void enviarArquivos(e.target.files)}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label={`Enviar ${insumo.nome}`}
              onClick={() => entrada.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  entrada.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastando(false)
                void enviarArquivos(e.dataTransfer.files)
              }}
              className={cn(
                "text-muted-foreground flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors",
                arrastando && "border-primary bg-muted",
              )}
            >
              {enviando ? (
                <>
                  <Spinner /> Validando…
                </>
              ) : status === "valido" ? (
                "Enviar outra versão"
              ) : (
                "Arraste o arquivo aqui ou clique para escolher"
              )}
            </div>
          </>
        )}
      </CardContent>
      {temModelo && (
        <CardFooter>
          <Button variant="outline" size="sm" render={<a href={`/api/modelos/${insumo.id}`} download />} nativeButton={false}>
            <DownloadIcon /> Baixar modelo
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
```

(Se o `Card` instalado não tiver a prop `size`, remova `size="sm"`.)

- [ ] **Step 4: Verificar no navegador**

Para ver os cards sem gastar a assinatura, use o executor de demonstração (Task 8), que entende `demo:propor`. Com `PLANEJAMENTO_EXECUTOR=demo npm run dev` rodando e o prospect "Demo" com a Etapa 01 em andamento, copie dois rascunhos reais (na raiz do projeto):

```bash
mkdir -p clientes/demo/.app/rascunhos
cp clientes/sottile-jalecos/entrega/ativos-aprovados/graficos/taxa-conversao-global.png clientes/demo/.app/rascunhos/g.png
cp clientes/sottile-jalecos/entrega/ativos-aprovados/secoes/03-macro-financeiro.md clientes/demo/.app/rascunhos/s.md
```

e mande no chat da Etapa 01, uma de cada vez: `demo:propor grafico clientes/demo/.app/rascunhos/g.png` e `demo:propor secao clientes/demo/.app/rascunhos/s.md`.

Confira os cards de entregável:
- O gráfico aparece com a imagem real, "vai para a apresentação como `demonstracao-grafico.png`", a pergunta de validação e os botões; "Ampliar" abre em tela cheia.
- "Pedir ajuste…" abre o campo; enviar marca "Ajuste pedido: …" e dispara um turno automático (aparece como marcador no chat).
- "Aprovar" muda o badge para "Aprovado", o painel lista o item como aprovado e o arquivo aparece em `clientes/demo/entrega/ativos-aprovados/graficos/demonstracao-grafico.png`.
- Propor o mesmo gráfico de novo marca o card anterior como "Substituído" quando o novo é aprovado.
- A seção mostra o markdown renderizado e aprova para `secoes/01-demonstracao-secao.md`.

Confira também os cards de insumo:
- No painel e na tela "Etapa liberada" da 03 de um prospect novo: o card do "Histórico mensal" mostra descrição, instrução e "Baixar modelo" só quando `.claude/skills/_shared/modelos-insumo/historico-mensal.xlsx` existe (copie temporariamente `clientes/sottile-jalecos/dados/historico-mensal.xlsx` para lá e recarregue; apague depois se não for o modelo oficial).
- Arrastar um `.csv` mostra "Formato não aceito…"; arrastar a planilha da Sottile mostra "Recebido" com o resumo de meses (ou os problemas, se o layout não bater com o modelo).
- O card de link da Etapa 01 salva o site e passa para "Recebido".

Run: `cd src/apps/web && npm run typecheck && npm run lint` → sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): cards de entregável (prévia, aprovar, ajuste) e de insumo (modelo, envio, validação)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Ajustes nas skills, template e documentação

**Files:**
- Modify: `.claude/skills/_shared/regras-de-validacao.md` (Regra 6 estendida + Regra 7)
- Modify: `.claude/skills/06-briefing-e-benchmark/SKILL.md:28`, `.claude/skills/08-plano-de-acao/SKILL.md:31`
- Create: `clientes/_template/contexto/decisoes/README.md`
- Modify: `README.md`, `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-28-interface-planejamento-design.md` (Node ≥ 22.18, `.app/propostas/`, lista do que falta visível)

**Interfaces:**
- Consumes: nomes das ferramentas (`propor_entregavel`, `solicitar_insumo`, `sinalizar_etapa_pronta`) e caminhos (`.app/rascunhos/`, `contexto/decisoes/<skill>.md`) das Tasks 11–13.
- Produces: regras que o agente segue nos dois modos.

- [ ] **Step 1: Regra 6 estendida e Regra 7**

Em `.claude/skills/_shared/regras-de-validacao.md`, no fim da seção "## 6. Handoff estruturado ao final de cada etapa", acrescentar:

```markdown
Além disso, toda etapa numerada registra um resumo das decisões tomadas em
`contexto/decisoes/<nome-da-skill>.md` (ex.: `contexto/decisoes/03-diagnostico-performance.md`):
números aprovados, escolhas do analista e ressalvas — o que uma etapa
posterior precisa saber sem reler a conversa. No terminal, a própria skill
grava esse arquivo; no modo interface (Regra 7), quem grava é o app, com o
`resumo_decisoes` enviado em `sinalizar_etapa_pronta`.
```

E acrescentar no fim do arquivo:

```markdown
## 7. Modo interface

Quando as ferramentas do MCP `planejamento` estiverem disponíveis
(`propor_entregavel`, `solicitar_insumo`, `sinalizar_etapa_pronta`), a skill
está rodando dentro da interface web, e estas regras substituem o jeito
"terminal" de fazer as Regras 1, 2 e 6:

- **Checkpoint (Regras 1 e 2):** salve o gráfico, a tabela ou o texto em
  `clientes/<slug>/.app/rascunhos/` e chame `propor_entregavel` com um
  `nome_final` estável. Não peça "ok" no chat e não grave em
  `entrega/ativos-aprovados/` — o app copia para lá quando o analista clica em
  Aprovar. Depois de propor, encerre a resposta; a decisão chega como nova
  mensagem ("APROVOU" ou "AJUSTE").
- **Insumos:** peça arquivos com `solicitar_insumo` (ids em
  `.claude/skills/_shared/etapas.json`), não descrevendo caminhos de pasta.
- **Encerramento (Regra 6):** não edite `contexto/status-planejamento.md`.
  Chame `sinalizar_etapa_pronta` com o resumo de decisões (markdown) e o
  mesmo texto de handoff do "Encerramento e handoff" da skill.
- A pasta `.app/` pertence ao app: fora de `.app/rascunhos/`, não escreva nela.
- Scripts que geram arquivo (ex.: `preencher_projecao_xlsx.py`,
  `preencher_plano_acao_docx.py`) recebem `--output` apontando para
  `.app/rascunhos/`, e o resultado é proposto com `propor_entregavel`
  (tipo `planilha` ou `documento`).
```

- [ ] **Step 2: Skills 06 e 08**

Em `.claude/skills/06-briefing-e-benchmark/SKILL.md`, trocar a linha

```
1. Ler todo o histórico da conversa desde a Skill 01.
```

por

```
1. Ler os resumos de decisão das etapas anteriores em `contexto/decisoes/`
   e o histórico desta conversa (no modo interface, cada etapa tem sua
   própria conversa — o que foi decidido antes está nos resumos e no dossiê).
```

Em `.claude/skills/08-plano-de-acao/SKILL.md`, trocar

```
Tudo que já foi decidido nesta conversa: problemas e oportunidades do
```

por

```
Tudo que já foi decidido nas etapas anteriores (`contexto/decisoes/`) e nesta
conversa: problemas e oportunidades do
```

- [ ] **Step 3: Template e documentação**

`clientes/_template/contexto/decisoes/README.md`:

```markdown
Resumo das decisões de cada etapa concluída, um arquivo por skill
(`01-preparacao-de-contexto.md`, `02-contextualizacao-estrategica.md`, …).
Ver Regra 6 em `.claude/skills/_shared/regras-de-validacao.md`.

É o que as etapas seguintes leem para não depender do histórico da conversa.
Não edite à mão: uma etapa reaberta e concluída de novo sobrescreve o arquivo.
```

Em `README.md`, acrescentar antes de "## Pré-requisitos de configuração":

```markdown
## Interface web (protótipo)

Em vez de chamar as skills no terminal, dá para conduzir o planejamento pela
interface local, que cria o prospect, mostra o chat por etapa, os cards de
aprovação e de envio de planilha, e libera a próxima etapa quando você
conclui a atual.

    cd src
    npm install
    npm run dev          # http://127.0.0.1:3000

Requisitos: Node ≥ 22.18, Python 3 com openpyxl/pandas/matplotlib e o Claude
Code instalado e logado (`claude auth login`). O protótipo usa a sua
assinatura do Claude, não uma chave de API. Para mexer na tela sem gastar
uso: `PLANEJAMENTO_EXECUTOR=demo npm run dev`.

Os modelos de planilha que o analista baixa ficam em
`.claude/skills/_shared/modelos-insumo/` (ver o README de lá). Design:
`docs/superpowers/specs/2026-09-28-interface-planejamento-design.md`.
```

Em `CLAUDE.md`, acrescentar ao fim da seção "### Arquivos de regra compartilhada":

```markdown
Quando a skill roda dentro da interface web (ferramentas do MCP
`planejamento` disponíveis), vale também a Regra 7 de
`regras-de-validacao.md`: checkpoints por `propor_entregavel`, pedidos de
arquivo por `solicitar_insumo` e encerramento por `sinalizar_etapa_pronta`.
Nesse modo cada etapa tem a própria conversa, e o contexto das anteriores
chega pelo dossiê e por `contexto/decisoes/`.
```

- [ ] **Step 4: Atualizar o spec com o que o plano fixou**

Em `docs/superpowers/specs/2026-09-28-interface-planejamento-design.md`:
- Seção 10: trocar "Node ≥ 20" por "Node ≥ 22.18 (o servidor MCP e o hook rodam como `.ts` direto)".
- Seção 6.1: acrescentar a linha `.app/propostas/<id><ext>   NOVO — cópia congelada de cada proposta (o card sempre mostra a versão proposta)`.
- Seção 4: depois de "O botão bloqueado mostra a lista do que falta.", acrescentar "(sempre visível logo abaixo do botão)".
- Seção 3.1, Catálogo de etapas: remover `tipos_de_entregavel` da lista de campos (o tipo vem em cada `propor_entregavel`).
- Seção 11: acrescentar "Servidor de desenvolvimento escuta só em 127.0.0.1; a versão hospedada (Fase 3) precisa de autenticação antes de abrir para a rede."

- [ ] **Step 5: Conferir e commitar**

Run: `git diff --stat` → só os arquivos desta tarefa.

```bash
git add .claude/skills clientes/_template README.md CLAUDE.md docs/superpowers/specs
git commit -m "docs: regra do modo interface, resumos de decisão e instruções da interface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Validação ponta a ponta com o Claude de verdade

**Files:**
- Create: `docs/superpowers/validacoes/2026-09-28-e2e-interface.md` (registro da validação)
- Possivelmente modificar: qualquer arquivo em que um defeito for encontrado (cada correção com teste que reproduz o defeito, na tarefa/arquivo correspondente)

**Interfaces:**
- Consumes: o app completo (Tasks 1–20).
- Produces: registro do critério de sucesso do spec (seção 1).

- [ ] **Step 1: Suíte completa**

```bash
cd src && npm test && npm run typecheck && npm run lint
cd .. && python3 -m pytest scripts/tests -q
```

Expected: tudo verde.

- [ ] **Step 2: Conduzir um prospect de teste pela interface (etapas 01 a 03)**

Run: `cd src/apps/web && npm run dev` (sem `PLANEJAMENTO_EXECUTOR`, usa a assinatura).

Na interface, com os arquivos de `clientes/sottile-teste/` como insumo:
1. Criar o prospect "Teste Interface" com o site da Sottile.
2. Etapa 01: enviar `contexto/brutos/kickoff-transcricao-bruta.docx` pelo card, iniciar, aprovar a transcrição limpa proposta, esperar o sinal e concluir. Conferir `clientes/teste-interface/contexto/decisoes/01-preparacao-de-contexto.md`.
3. Etapa 02: a tela "Etapa liberada" mostra o handoff da 01. Iniciar, responder às perguntas estratégicas no chat e concluir.
4. Etapa 03: enviar `dados/historico-mensal.xlsx` e `dados/produtos-curva-abc.xlsx` pelos cards. Aprovar pelo menos 2 gráficos, pedir ajuste em 1 (ex.: "incluir a linha de média") e aprovar a nova versão. Conferir que `entrega/ativos-aprovados/graficos/` só tem os nomes estáveis (sem `-v2`) e que o card antigo ficou "Substituído".
5. Reabrir a 02: a 03 fica ⚠️ Desatualizada; clicar em "Confirmar que continua válida".
6. Durante um turno longo, clicar em Parar e depois em "Tentar de novo".
7. Excluir "Teste Interface" pela home e confirmar que foi para a Lixeira.

Em cada passo, confira:
- Nada foi gravado fora de `clientes/teste-interface/` (`git status` na raiz mostra só o que já estava modificado; os prospects estão no `.gitignore`).
- Os PNGs aprovados têm o mesmo padrão visual dos de `clientes/sottile-jalecos/entrega/ativos-aprovados/graficos/`.
- O agente não pediu "ok" em texto para gráficos (se pedir, a Regra 7 ou o system prompt precisa de ajuste — registre).

- [ ] **Step 3: Registrar a validação**

`docs/superpowers/validacoes/2026-09-28-e2e-interface.md`: data, versão do Claude Code (`claude --version`), resultado de cada passo acima (ok / problema), defeitos encontrados e o commit que corrigiu cada um, e o uso da assinatura no fim (`rate_limit_event` nos logs do servidor, se aparecer).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/validacoes
git commit -m "docs: registro da validação ponta a ponta da interface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Plano futuro (fora deste plano)

- **Fase 2 — depois de validar o protótipo:** trocar o executor por Claude Agent SDK com chave de API da organização. Muda só `src/packages/core/src/executor/` (novo `agent-sdk.ts` implementando `Executor`) e a escolha em `lib/servidor.ts`; as três ferramentas do MCP "planejamento" viram ferramentas em processo do SDK (`createSdkMcpServer`), com o mesmo contrato de `ServicoPlanejamento.ferramenta`.
- **Fase 3:** versão hospedada multiusuário com login; armazenamento no Google Drive como nova implementação da interface de `FsArmazenamento`.
