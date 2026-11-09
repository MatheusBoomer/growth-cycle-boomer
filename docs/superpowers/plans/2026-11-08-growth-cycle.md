# Growth Cycle: novo nome, etapa 07 oculta e renumeração: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renomear o produto para Growth Cycle, ocultar a etapa 07 (briefing e benchmark), renumerar as etapas seguintes (08→07, 09→08, apresentação→09) e tirar "Benchmarking" do deck, migrando prospects existentes (disco e Supabase).

**Architecture:** A renumeração é feita por um módulo puro de migração em `packages/core` (`migracao-etapas.ts`), usado por um script de disco e espelhado numa migration SQL do Supabase. Um marcador `versaoEtapas: 2` no `Estado` distingue estados já migrados e estados da numeração legada de 8 etapas, que a migração nunca converte. O resto é renomear pastas e textos de skills, ajustar o catálogo (`etapas.json`, `ORDEM_ETAPAS`) e editar o molde do deck.

**Tech Stack:** TypeScript (vitest, npm workspaces em `src/`), Python 3 (`scripts/`, pytest), Supabase Postgres, Next.js (app web), Mermaid, pptx (XML).

**Spec:** `docs/superpowers/specs/2026-11-08-growth-cycle-design.md`

## Global Constraints

- Mapa de ids: `07` (briefing e benchmark) sai; `08`→`07` (Mídia paga); `09`→`08` (Plano de ação); a apresentação passa a skill `09-apresentacao-final`, e o id do app continua `final`.
- Pastas novas: `.claude/skills/07-midia-paga`, `08-plano-de-acao`, `09-apresentacao-final`; comandos `.claude/commands/07-midia-paga.md` e `08-plano-de-acao.md`; `apresentacao-final.md` não muda.
- A etapa 07 antiga vai para `.claude/skills/_desativadas/briefing-e-benchmark/` (skill, `fluxo.mmd`, comando e um `README.md` de reativação). Id legado em dados: `briefing-benchmark`.
- Nome: "Planejamento Estratégico" vira "Growth Cycle" em tudo que é nome; "planejamento" solto em frases comuns não muda. Home: "Growth Cycles" e "Nenhum Growth Cycle ainda". Download: `Growth Cycle - <prospect>.pptx`.
- Não mudam: pasta do repositório, schema `planejamento` do banco, nome do MCP `planejamento`, migrations já aplicadas, specs e planos antigos em `docs/`, `.claude/worktrees/`, conteúdo de `clientes/` (exceto pela migração).
- Deck: 5 seções (01 Cenário atual, 02 Desafios, 03 Metas, 04 Cenários e impactos, 05 Plano de ação). O tipo de slide `benchmark` fica no `ESQUEMA` de `scripts/gerar_apresentacao.py`, sem uso.
- Regra do `CLAUDE.md`: skill e `fluxo.mmd` mudam juntos, no mesmo commit; ao fim rodar `npm test` em `src/apps/web` e `src/packages/core`. `fluxos.test.ts` passa de 13 para 12 fluxos.
- Nenhum travessão (—) em arquivos `.mmd` (o teste de fluxos rejeita). Todo rótulo Mermaid entre aspas.
- Aplicar migração na nuvem e fazer deploy na VPS só com confirmação explícita do usuário. Nunca imprimir tokens ou chaves.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Trabalhar na branch `feat/growth-cycle`. Não commitar `.env.example` (já modificado antes deste trabalho).

## Review Focus

1. **Prospect na numeração legada de 8 etapas** (`adda`, `adda-demo`, `sottile-teste`: sem a chave `09`, 05 = Metas): a migração pula e relata, nunca remapeia. Teste em Task 1 e dry-run em Task 2.
2. **Rodar a migração duas vezes:** a segunda não muda nada (marcador `versaoEtapas: 2` no disco; tabela `migracoes` no banco). Testes em Task 1 e Task 3.
3. **Prospect parado na etapa 07 antiga** (`em_andamento`, `pronta` ou `liberada`) ou com a 08 antiga em andamento: a nova 07 fica `liberada` e nenhuma etapa fica duplicada ou perdida. Teste em Task 1.
4. **Colisão de nomes ao mover arquivos:** `secoes/07-briefing.md` e `07-benchmark.md` (antigos) não podem ficar ao lado de `07-midia-paga.md` nem ser lidos como etapa 07 pela Biblioteca. Vão para `entrega/arquivo-etapa-07/` antes das renomeações. Teste em Task 1.
5. **Chave primária `(etapa, alvo)` de `config_modelos` e ids de conversa:** a 07 antiga é arquivada antes de 08→07, tudo numa transação. Teste em Task 3.

---

### Task 1: Módulo puro de migração de etapas

**Files:**
- Create: `src/packages/core/src/migracao-etapas.ts`
- Create: `src/packages/core/test/migracao-etapas.test.ts`
- Modify: `src/packages/core/src/tipos.ts` (campo opcional `versaoEtapas?: 2` em `Estado`, ~linha 140)
- Modify: `src/packages/core/src/maquina-estados.ts` (`estadoInicial` grava `versaoEtapas: 2`, ~linha 20)

**Interfaces:**
- Consumes: `Estado`, `EtapaId`, `Entregavel`, `EstadoInsumo` de `./tipos`; `estadoInicial`, `recalcularLiberacoes`, `etapaVazia` de `./maquina-estados`. Estes testes usam estados montados à mão com chaves string (`"07"`, `"09"`), então não dependem de `ORDEM_ETAPAS` já ter mudado.
- Produces (usados por Task 2 e Task 3):
  - `export const ID_ETAPA_ARQUIVADA = "briefing-benchmark"`
  - `export const MAPA_ETAPAS: Readonly<Record<string, string>>` = `{ "07": "briefing-benchmark", "08": "07", "09": "08" }`
  - `export function novoIdEtapa(id: string): string` (devolve o próprio id fora do mapa; `final` e `01`–`06` passam direto)
  - `export type ClasseNumeracao = "atual" | "legada" | "migrada"`
  - `export function classificarNumeracao(estado: { versaoEtapas?: number; etapas: Record<string, unknown> }): ClasseNumeracao`: `migrada` se `versaoEtapas === 2`; `atual` se tem a chave `"09"`; senão `legada`.
  - `export function migrarEstado(estado: Estado): Estado`: puro; lança `Error` se a classe não for `atual`.
  - `export interface MovimentoArquivo { de: string; para: string }`
  - `export function planoDeArquivos(caminhos: string[]): MovimentoArquivo[]`: caminhos relativos à pasta do prospect; devolve só os que mudam, ordenados: primeiro os arquivamentos (07 antiga), depois 08→07, 09→08, 10→09.
  - `export function migrarManifesto(m: Manifesto): Manifesto`: mapeia `arquivos[].etapa` e as chaves de `kit`; descarta arquivos e kit da 07 antiga.

- [ ] **Step 1: Escrever os testes que falham**

Em `migracao-etapas.test.ts`, com um helper `estadoDe(statusPorId: Record<string, StatusEtapa>)` que monta `Estado` com `etapas` das chaves dadas:

```ts
it("classifica: migrada, atual e legada", () => {
  expect(classificarNumeracao({ versaoEtapas: 2, etapas: {} })).toBe("migrada")
  expect(classificarNumeracao({ etapas: { "08": {}, "09": {} } })).toBe("atual")
  expect(classificarNumeracao({ etapas: { "08": {}, final: {} } })).toBe("legada")
})
it("migrarEstado recusa estado legado e estado já migrado", () => { /* expect(() => ...).toThrow(/legada|migrada/) */ })
it("remapeia etapas: 08→07, 09→08, descarta a 07 antiga, mantém final", () => {
  // concluida até 06, 07 antiga concluida, 08 em_andamento, 09 bloqueada
  // esperado: chaves 01..08 e final; novo 07 = em_andamento, novo 08 = bloqueada; versaoEtapas === 2
})
it("quem estava na 07 antiga fica com a nova 07 liberada", () => {
  // 06 concluida, 07 antiga em_andamento, 08 e 09 bloqueadas -> novo 07 === "liberada"
})
it("remapeia entregáveis, insumos, fila e teste.etapaInicial; descarta os da 07 antiga", () => {
  // entregável etapa "07" some; "08" -> "07"; "09" -> "08"; teste.etapaInicial "08" -> "07"
})
it("é idempotente pelo marcador: migrarEstado(migrarEstado(x)) lança, classificarNumeracao diz migrada", () => {})
it("planoDeArquivos arquiva a 07 antiga antes das renomeações", () => {
  const p = planoDeArquivos([
    ".app/conversas/07.jsonl", ".app/conversas/08.jsonl", ".app/conversas/09.jsonl", ".app/conversas/final.jsonl",
    "contexto/decisoes/07-briefing-e-benchmark.md", "contexto/decisoes/08-midia-paga.md",
    "contexto/decisoes/09-plano-de-acao.md", "contexto/decisoes/10-apresentacao-final.md",
    "entrega/ativos-aprovados/secoes/07-briefing.md", "entrega/ativos-aprovados/secoes/07-benchmark.md",
    "entrega/ativos-aprovados/secoes/08-midia-paga.md", "entrega/ativos-aprovados/benchmark/benchmark.html",
    "entrega/ativos-aprovados/graficos/roas-global.png",
  ])
  // pares esperados (de -> para):
  // .app/conversas/07.jsonl -> entrega/arquivo-etapa-07/conversas/07.jsonl
  // .app/conversas/08.jsonl -> .app/conversas/07.jsonl ; 09.jsonl -> 08.jsonl ; final.jsonl não aparece
  // contexto/decisoes/07-briefing-e-benchmark.md -> entrega/arquivo-etapa-07/decisoes/07-briefing-e-benchmark.md
  // 08-midia-paga.md -> 07-midia-paga.md ; 09-plano-de-acao.md -> 08-plano-de-acao.md ; 10-apresentacao-final.md -> 09-apresentacao-final.md
  // secoes/07-briefing.md e 07-benchmark.md -> entrega/arquivo-etapa-07/secoes/<nome>
  // secoes/08-midia-paga.md -> secoes/07-midia-paga.md
  // ativos-aprovados/benchmark/benchmark.html -> entrega/arquivo-etapa-07/benchmark/benchmark.html
  // roas-global.png não aparece
  // índice de qualquer arquivamento < índice de qualquer renomeação; nenhum `para` repete outro `para` nem existe como `de` ainda não movido antes dele
})
it("planoDeArquivos trata kit-de-teste/NN/ e conversas de cliente de teste", () => {})
it("migrarManifesto mapeia etapas e kit e descarta a 07 antiga", () => {})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `src/packages/core`): `npx vitest run test/migracao-etapas.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `migracao-etapas.ts` e o campo `versaoEtapas`**

`migrarEstado` monta o mapa de `etapas` remapeado, depois chama `recalcularLiberacoes` para que a nova 07 (vinda da 08 antiga, geralmente `bloqueada`) vire `liberada` quando a 06 está concluída. `planoDeArquivos`: regex por padrão de caminho (conversas `\.app/conversas/(\d\d)\.jsonl`, decisões `contexto/decisoes/(\d\d)-`, seções `secoes/(\d\d)-`, `ativos-aprovados/benchmark/`, `kit-de-teste/(\d\d)/`); a 07 antiga vai para `entrega/arquivo-etapa-07/<tipo>/…`. `estadoInicial` passa a incluir `versaoEtapas: 2`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/migracao-etapas.test.ts test/maquina-estados.test.ts`
Expected: PASS (se `maquina-estados.test.ts` comparar o estado inicial inteiro, acrescentar `versaoEtapas: 2` nas expectativas).

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/migracao-etapas.ts src/packages/core/test/migracao-etapas.test.ts src/packages/core/src/tipos.ts src/packages/core/src/maquina-estados.ts src/packages/core/test/maquina-estados.test.ts
git commit -m "feat(core): módulo puro de migração de etapas (08→07, 09→08) com marcador versaoEtapas"
```

---

### Task 2: Catálogo e código do app com a nova numeração

**Files:**
- Modify: `src/packages/core/src/tipos.ts:1` (`ORDEM_ETAPAS`)
- Modify: `.claude/skills/_shared/etapas.json` (remover a etapa `07`; `08`→`07` com `skill: "07-midia-paga"`, `numero`/`rotuloStatus` "07 · Mídia paga"; `09`→`08` com `skill: "08-plano-de-acao"`; `final` com `skill: "09-apresentacao-final"`)
- Modify: `.claude/skills/_shared/sugestoes-modelos.json` (linhas `"etapa": "08"` viram `"07"`)
- Modify: `src/packages/core/src/catalogo-skills.ts` (`RESUMO_VISAO_GERAL`: "10 etapas" vira "9 etapas"), `src/packages/core/src/catalogo-skills-tipos.ts` se citar ids
- Modify: `src/packages/core/src/biblioteca.ts:~118-145` (remover o bloco dos anúncios de benchmark; o benchmark deixa de aparecer na Biblioteca) e `src/apps/web/components/biblioteca/biblioteca.tsx`, `src/apps/web/lib/biblioteca.ts` se referenciarem `origem: "benchmark"`
- Modify: `src/apps/web/components/sistema/verificacao-sistema.tsx` (e `.test.ts`): remover as checagens `ffmpeg` e `apify`
- Modify: `src/packages/core/scripts/montar-fixture.ts` (`GRAFICOS`, `INSUMOS`, kit e o mapa de arquivos: "08"→"07", "09"→"08"; arquivos de benchmark deixam de ser colhidos)
- Modify: testes que citam ids: `core/test/{entregaveis,catalogo,biblioteca,armazenamento,fixture,fixture-verdeluz,servico-teste,sugestoes-modelos,modelos,maquina-estados,status-md}.test.ts`, `core/test/nuvem/armazenamento-nuvem.test.ts`, `web/lib/{biblioteca,fluxos}.test.ts`, `web/app/api/admin/modelos.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `ORDEM_ETAPAS = ["01","02","03","04","05","06","07","08","final"] as const`. Daí em diante `EtapaId` não inclui `"09"`; `etapaAnterior("final")` é `"08"`.

- [ ] **Step 1: Atualizar os testes primeiro** nos arquivos acima (ids 08→07, 09→08, 9 etapas, sem `ffmpeg`/`apify`, biblioteca sem `origem: "benchmark"`). Conferir com `grep -n '"0[789]"' <arquivo>` em cada um.
- [ ] **Step 2: Rodar `npm test` em `src/packages/core` e em `src/apps/web`; Expected: FAIL** nos testes alterados.
- [ ] **Step 3: Aplicar as mudanças de código e JSON** listadas em Files.
- [ ] **Step 4: Rodar `npm test` nos dois workspaces e `npx tsc --noEmit` em cada um** (via `npm run typecheck` em `src/`). Expected: PASS, sem erro de tipo (o tipo `EtapaId` perdeu `"09"`).
- [ ] **Step 5: Commit**

```bash
git add -A src .claude/skills/_shared/etapas.json .claude/skills/_shared/sugestoes-modelos.json
git commit -m "feat: catálogo com 9 etapas (07 oculta; mídia paga 07, plano de ação 08) e app sem checagem de Apify/ffmpeg"
```

---

### Task 3: Script de migração de disco

**Files:**
- Create: `src/packages/core/scripts/migrar-etapas.ts`
- Create: `src/packages/core/test/migrar-etapas-disco.test.ts` (usa pasta temporária)
- Modify: `src/package.json` (script `"migrar-etapas": "tsx packages/core/scripts/migrar-etapas.ts"`)

**Interfaces:**
- Consumes de Task 1: `classificarNumeracao`, `migrarEstado`, `planoDeArquivos`, `migrarManifesto`. Consome de `./src/status-md`: `renderStatusMd(estado, catalogo)`; de `./src/catalogo`: `carregarCatalogo(raiz)`.
- Produces: `export async function migrarProspect(pasta: string, catalogo: Catalogo, opcoes: { aplicar: boolean; pastaBackup: string | null }): Promise<{ slug: string; resultado: "migrado" | "pulado-legado" | "pulado-ja-migrado" | "pulado-sem-estado"; movimentos: MovimentoArquivo[] }>` (exportada para teste). CLI: `npm run migrar-etapas -- [--clientes ../clientes] [--aplicar] [--sem-backup]`; sem `--aplicar` é dry-run e só imprime o relatório.

- [ ] **Step 1: Escrever o teste** com um prospect temporário (estado atual de 9 etapas, `.app/conversas/07..09.jsonl`, `contexto/decisoes/*`, `secoes/*`): em dry-run nada muda e o relatório lista os movimentos; com `aplicar: true` os arquivos vão para os destinos do plano, `estado.json` fica com `versaoEtapas: 2` e `status-planejamento.md` é regenerado; rodar de novo devolve `"pulado-ja-migrado"` sem tocar em nada; um prospect sem chave `"09"` devolve `"pulado-legado"` e fica intacto; um prospect sem `.app/estado.json` devolve `"pulado-sem-estado"`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run test/migrar-etapas-disco.test.ts`.
- [ ] **Step 3: Implementar `migrarProspect` e a CLI.** Com `pastaBackup`, copia a pasta inteira do prospect antes de mexer. Movimentos aplicados na ordem do plano, criando pastas de destino e recusando sobrescrever arquivo existente (aborta o prospect com erro, sem migração parcial: validar todos os destinos antes de mover). Tratar também `clientes/_fixtures/verdeluz`: `estado-completo.json` (via `migrarEstado`), `manifesto.json` (via `migrarManifesto`), `roteiros/NN.md` (mesma regra de numeração; `07.md` antigo é removido do fixture) e `base/` (mesmas regras de `planoDeArquivos`, lembrando que `.app/` vira `app/` ali).
- [ ] **Step 4: Rodar o teste: PASS.** Depois, dry-run real: `cd src && npm run migrar-etapas` e conferir o relatório contra o levantamento atual: `sottile-novo-modelo`, `sottile-jalecos`, `verdeluz-teste-off` migram; `adda`, `adda-demo`, `sottile-teste` pulam como legados; `sottile-teste-2`, `teste-login`, `verdeluz-nuvem` pulam por não terem estado em disco.
- [ ] **Step 5: Aplicar sobre uma cópia** de `clientes/` feita na pasta de scratchpad da sessão, com `--clientes <cópia> --aplicar`; conferir `estado.json`, `status-planejamento.md` e a árvore de arquivos de `sottile-novo-modelo` antes e depois; rodar de novo e ver só "pulado-ja-migrado".
- [ ] **Step 6: Commit**

```bash
git add src/packages/core/scripts/migrar-etapas.ts src/packages/core/test/migrar-etapas-disco.test.ts src/package.json
git commit -m "feat(core): script de migração de etapas em disco (dry-run por padrão, backup, idempotente)"
```

---

### Task 4: Migration SQL do Supabase

**Files:**
- Create: `supabase/migrations/20261111120000_renumera_etapas.sql`
- Create: `scripts/tests/test_migration_renumera_etapas.md` (roteiro de verificação manual em SQL, ver Step 3; o projeto não tem harness de SQL)

**Interfaces:**
- Consumes: tabelas do schema `planejamento` com coluna de etapa: `prospects` (`etapa_atual`, `estado` jsonb), `eventos_conversa.etapa`, `uso_turnos.etapa`, `presenca.etapa`, `config_modelos.etapa` (chave `(etapa, alvo)`), `arquivos.caminho`.
- Produces: tabela `planejamento.migracoes(nome text primary key, aplicada_em timestamptz default now())` e a linha `'renumera-etapas-growth-cycle'` ao final.

- [ ] **Step 1: Escrever a migration** dentro de um `do $$ … $$` guardado por `if not exists (select 1 from planejamento.migracoes where nome = 'renumera-etapas-growth-cycle')`, numa única transação:
  1. `create table if not exists planejamento.migracoes (...)`.
  2. **Escopo por prospect:** só prospects cujo `estado->'etapas'` tem a chave `'09'` e cujo `estado` não tem `versaoEtapas` (mesma regra de `classificarNumeracao`).
  3. Para esses slugs, em `eventos_conversa`, `uso_turnos` e `presenca`: `etapa` `'07'`→`'briefing-benchmark'`, depois `'08'`→`'07'`, depois `'09'`→`'08'` (nesta ordem, três `update`s).
  4. `prospects.etapa_atual` com o mesmo mapa; `estado` jsonb reconstruído: `etapas` sem a chave `'07'` antiga e com `08`→`07`, `09`→`08`; `entregaveis`, `insumos`, `filaAutomatica`, `perguntas` com `etapa` remapeada e os da 07 antiga removidos; `teste.etapaInicial` remapeada; `versaoEtapas = 2`. Se a etapa atual era a 07 antiga, `etapa_atual` vira `'07'`.
  5. `config_modelos` (global): `'07'`→`'briefing-benchmark'`, `'08'`→`'07'`, `'09'`→`'08'` (nesta ordem, por causa da chave primária).
  5b. `notas_skills.item` (global, hoje vazia): `'etapa:07'`→`'etapa:briefing-benchmark'`, `'etapa:08'`→`'etapa:07'`, `'etapa:09'`→`'etapa:08'`, nesta ordem.
  6. `arquivos.caminho` dos mesmos slugs: o equivalente SQL das regras de `planoDeArquivos` (conversas não ficam em `arquivos` na nuvem; cobrir `contexto/decisoes/`, `entrega/ativos-aprovados/secoes/`, `…/benchmark/`, `kit-de-teste/NN/`).
  7. Inserir a marca em `migracoes`.
- [ ] **Step 2: Rodar em branch do Supabase, não em produção.** Criar branch com `mcp__supabase__create_branch`, aplicar com `mcp__supabase__apply_migration` e conferir.
- [ ] **Step 3: Verificar** (roteiro em `scripts/tests/test_migration_renumera_etapas.md`): antes e depois, `select etapa, count(*)` por tabela; `config_modelos` sem a chave `'09'` e com `'briefing-benchmark'`; nenhum `estado` migrado com chave `'09'`; `verdeluz-teste` (a única conta com arquivos `0[789]/`) com `kit-de-teste/NN/` renumerado; executar o bloco `do $$ … $$` uma segunda vez na branch (por `execute_sql`) e ver que nenhuma linha muda, porque a marca em `migracoes` já existe.
- [ ] **Step 4: Commit** (sem aplicar em produção)

```bash
git add supabase/migrations/20261111120000_renumera_etapas.sql scripts/tests/test_migration_renumera_etapas.md
git commit -m "feat(supabase): migration idempotente de renumeração de etapas"
```

---

### Task 5: Skills, comandos e fluxogramas

**Files:**
- Move: `.claude/skills/07-briefing-e-benchmark/` e `.claude/commands/07-briefing-e-benchmark.md` → `.claude/skills/_desativadas/briefing-e-benchmark/` (`SKILL.md`, `fluxo.mmd`, `comando.md`); Create: `.claude/skills/_desativadas/briefing-e-benchmark/README.md` (por que está desativada, o que a reativação exige: voltar a pasta para `.claude/skills/07-…`, recolocar a etapa em `etapas.json`/`ORDEM_ETAPAS`/catálogo/fluxo geral, `APIFY_TOKEN` e `ffmpeg`)
- Rename (`git mv`): `.claude/skills/08-midia-paga`→`07-midia-paga`; `09-plano-de-acao`→`08-plano-de-acao`; `10-apresentacao-final`→`09-apresentacao-final`; `.claude/commands/08-midia-paga.md`→`07-midia-paga.md`; `09-plano-de-acao.md`→`08-plano-de-acao.md`
- Modify: o texto de cada `SKILL.md` e comando renomeado e das skills 04, 05, 06 (handoff da 06 aponta para `/07-midia-paga`), `_shared/regras-de-validacao.md` (Regra 5, "Skill 07"), `_shared/fluxo-geral.mmd`, `fluxo.mmd` das skills renomeadas e da 06 (se citar o handoff), `CLAUDE.md` raiz (ordem de execução, remoção de "Pré-requisitos da Skill 07", lista de subagentes), `README.md` (ordem, árvore, remoção da seção "Token da Apify"), `.env.example` (comentário do `APIFY_TOKEN` marcado como opcional/desativado; não commitar junto do que já estava modificado: usar `git add -p`), `.claude/agents/*.md` e `*.fluxo.mmd` que citem "Skill 07/08/09/10"
- Modify: `src/packages/core/src/prompts.ts` e `src/packages/core/src/servico-planejamento.ts` se citarem nomes de skill ou ids antigos; `src/apps/web/lib/fluxos.test.ts` (lista de 12 fluxos, comentário "12 fluxogramas")

**Interfaces:**
- Consumes de Task 2: ids e `skill` novos em `etapas.json`.
- Produces: nenhum caminho antigo (`08-midia-paga`, `09-plano-de-acao`, `10-apresentacao-final`, `07-briefing-e-benchmark`) fora de `_desativadas/`, de `docs/` e de `.claude/worktrees/`.

- [ ] **Step 1: Atualizar `fluxos.test.ts`** para a lista nova (12 caminhos, sem 07, com os renomeados). Rodar `npx vitest run lib/fluxos.test.ts` em `src/apps/web`. Expected: FAIL (caminhos não existem ainda).
- [ ] **Step 2: Mover e renomear com `git mv`**, criar o README de `_desativadas`.
- [ ] **Step 3: Editar o texto** de cada arquivo listado. Regra de reescrita, arquivo a arquivo, sem `sed` cego: "Skill 08"→"Skill 07", "Skill 09"→"Skill 08", "Skill 10"→"Skill 09"; "Skills 01 a 07 concluídas" na Mídia paga vira "Skills 01 a 06"; `description` da Mídia paga deixa de dizer "Use após briefing-e-benchmark" e passa a "Use após metas-e-cenarios"; `secoes/08-midia-paga.md`→`secoes/07-midia-paga.md`. Conferir com `grep -rnE "0[789]-[a-z]|Skills? (0[789]|10)|10-apresentacao|briefing" .claude/skills .claude/commands .claude/agents CLAUDE.md README.md` e tratar cada ocorrência restante.
- [ ] **Step 4: Atualizar os fluxos** no mesmo passo: `fluxo-geral.mmd` (remove o nó `E07`, renomeia `E08`→`E07`, `E09`→`E08`, `E10`→`E09`, rótulos "07 · Mídia paga", "08 · Plano de ação", "09 · Apresentação final"; a seta `E06 -->|"meta e 3 cenários"| E07` passa direto para a Mídia paga; subagentes ligam aos nós novos), e o `fluxo.mmd` de cada skill renomeada. Seguir as convenções do `CLAUDE.md` (flowchart TD, rótulos entre aspas, `"Analista aprova?"` com classe `checkpoint`, três `classDef`).
- [ ] **Step 5: Rodar `npx vitest run lib/fluxos.test.ts` (em `src/apps/web`) e `npx vitest run test/catalogo-skills.test.ts` (em `src/packages/core`).** Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add -A .claude CLAUDE.md README.md src/apps/web/lib/fluxos.test.ts src/packages/core
git add -p .env.example
git commit -m "feat(skills): etapa 07 oculta em _desativadas e skills renumeradas (07 mídia paga, 08 plano de ação, 09 apresentação)"
```

---

### Task 6: Deck de 5 seções

**Files:**
- Modify: `.claude/skills/09-apresentacao-final/SKILL.md` e `fluxo.mmd`
- Modify: `.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx` (slide 2, "Jornada")
- Modify: `scripts/gerar_apresentacao.py` (comentários e textos que citem 6 seções; manter `"benchmark"` no `ESQUEMA`), `scripts/preparar_molde_apresentacao.py`, `scripts/tests/test_molde_apresentacao.py`, `scripts/tests/test_gerar_apresentacao.py`
- Modify: `scripts/fixture_verdeluz/roteiro_10.py` (renomear para `roteiro_09.py`; sem slides de benchmark; divisórias 01 a 05), `scripts/fixture_verdeluz/producao.md` (comandos `/07-midia-paga`, `/08-plano-de-acao`, remover o handoff da 07), `scripts/fixture_verdeluz/benchmark_07.py` (mover para `.claude/skills/_desativadas/briefing-e-benchmark/` ou remover se só alimentava o fixture), `graficos.py`, `analise_diagnostico.py`, `overrides.md` se citarem etapas
- Modify: `src/apps/web/lib/roteiro.ts` e `roteiro.test.ts` (não precisam mudar o suporte ao tipo `benchmark`; ajustar só se os testes usarem a seção 03)

**Interfaces:**
- Consumes de Task 5: skill renomeada `09-apresentacao-final`.
- Produces: roteiro de referência com divisórias `01.` Cenário atual, `02.` Desafios, `03.` Metas, `04.` Cenários e impactos, `05.` Plano de ação, na ordem capa → jornada (5 seções) → seções → obrigado. Slide 2 do molde com os itens: Cenário atual, Desafios, Metas, Cenários e Impactos Esperados, Plano de ação, mais o título "JORNADA".

- [ ] **Step 1: Atualizar os testes Python** (`test_gerar_apresentacao.py`, `test_molde_apresentacao.py`) para o roteiro de 5 seções e para a jornada sem "Benchmarking"; acrescentar uma asserção que lê `ppt/slides/slide2.xml` do molde e confere que `"Benchmarking"` não aparece e que os 5 nomes aparecem. Rodar `python3 -m pytest scripts/tests -q`. Expected: FAIL.
- [ ] **Step 2: Editar o molde.** No XML do slide 2 (zip do `.pptx`): remover o item "Benchmarking" e redistribuir os 5 itens restantes na mesma altura útil (recalcular `a:off`/`a:ext` dos blocos de texto). Inspecionar `ppt/media/image1.png` do slide: se tiver numeração 1 a 6 embutida ou o fundo depender de 6 posições, **parar e avisar o usuário** em vez de improvisar.
- [ ] **Step 3: Renderizar para conferir:** gerar um deck de amostra com `python3 scripts/gerar_apresentacao.py --roteiro <roteiro_de_amostra.json> --prospect clientes/_fixtures/verdeluz/base --output <scratchpad>/amostra.pptx` e converter o slide Jornada em imagem (LibreOffice ou `scripts/previa_apresentacao.py`); abrir a imagem e verificar alinhamento e texto.
- [ ] **Step 4: Atualizar a skill 09:** remover a linha "03. Benchmarking" das duas tabelas, renumerar (04→03, 05→04, 06→05), "jornada (6 seções)"→"jornada (5 seções)", lista de divisórias sem "ANÁLISE DE BENCHMARKING", remover o parágrafo "Benchmark: um slide `benchmark` por concorrente…", trocar o exemplo de ajuste ("Benchmarking · Baunni") por outro slide, "Skill 09 (plano-de-acao)"→"Skill 08", e ajustar `fluxo.mmd` junto.
- [ ] **Step 5: Rodar `python3 -m pytest scripts/tests -q` e `npx vitest run lib/fluxos.test.ts lib/roteiro.test.ts` (em `src/apps/web`).** Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add -A .claude/skills scripts src/apps/web/lib
git commit -m "feat(deck): apresentação de 5 seções sem Benchmarking e molde da jornada ajustado"
```

---

### Task 7: Nome Growth Cycle

**Files:**
- Modify: `src/apps/web/app/layout.tsx:18` (título `"Growth Cycle · Boomer"`), `components/home/grade-prospects.tsx` (barra "Growth Cycle", `h1` "Growth Cycles", `EmptyTitle` "Nenhum Growth Cycle ainda"), `components/trabalho/area-de-trabalho.tsx:266`, `components/trabalho/painel-etapa.tsx:72` (nome do download), `components/login/cartao-login.tsx:14`, `components/marca/menu-conta.test.ts`, `lib/nome-download.test.ts`
- Modify: `src/packages/core/src/prompts.ts:8` ("Modo interface do Growth Cycle")
- Modify: `Dockerfile`, `README.md`, `CLAUDE.md`, `.claude/agents/{analista-dados,designer-apresentacao,pesquisador-benchmark}.md`, `.claude/commands/*.md`, `.claude/skills/{01,02,criar-prospect,dev-comentarios,07-midia-paga}/SKILL.md`, `scripts/projecao.py`, `scripts/fixture_verdeluz/textos.py`, `clientes/_template/` (textos que o prospect novo herda)
- Do not modify: `supabase/migrations/*` já aplicadas, `docs/superpowers/*` antigos, `.claude/worktrees/`, `clientes/<prospect>/`.

**Interfaces:**
- Consumes: nada. Produces: nenhuma ocorrência de "Planejamento Estratégico" (qualquer caixa) nos arquivos acima.

- [ ] **Step 1: Atualizar os testes** (`menu-conta.test.ts`, `nome-download.test.ts`: `nomeDeDownload("Growth Cycle - ADDA", "/x/entrega/apresentacao-final.pptx")` → `"Growth Cycle - ADDA.pptx"`; testes da home, se houver, com os novos textos). Rodar `npx vitest run` em `src/apps/web`. Expected: FAIL.
- [ ] **Step 2: Trocar o nome**, arquivo a arquivo, lendo a frase: onde "planejamento estratégico" é o nome do produto ou do documento, vira "Growth Cycle"; onde é adjetivação comum ("planejamento estratégico de mídia paga" na descrição da skill de mídia), trocar para "plano estratégico de mídia paga" para não ficar "Growth Cycle de mídia paga". Lista de apoio: `grep -rniE "planejamento estrat" src scripts Dockerfile .claude/skills .claude/agents .claude/commands CLAUDE.md README.md clientes/_template --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=worktrees`.
- [ ] **Step 3: Rodar `npm test` em `src/apps/web` e `src/packages/core`.** Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add -A src scripts Dockerfile README.md CLAUDE.md .claude clientes/_template
git commit -m "feat: produto passa a se chamar Growth Cycle"
```

---

### Task 8: Verificação final e entrega

**Files:** nenhum novo; só verificação.

- [ ] **Step 1: Suítes completas.** `cd src && npm test && npm run typecheck && npm run lint`; `python3 -m pytest scripts/tests -q`; `node --test scripts/backup/linhas.test.mjs`. Expected: tudo verde (se `lint` já falhava antes, comparar com `git stash` e relatar só o que for novo).
- [ ] **Step 2: Buscas finais.**
  - `grep -rniE "planejamento estrat" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=worktrees --exclude-dir=clientes --exclude-dir=docs` deve vir vazio (exceto migrations já aplicadas).
  - `grep -rnE "07-briefing|08-midia-paga|09-plano-de-acao|10-apresentacao" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=worktrees --exclude-dir=docs` deve aparecer só dentro de `_desativadas/`, na migração (mapa de nomes) e nos testes da migração.
- [ ] **Step 3: Rodar o app** com a skill `run` (dev server), abrir a home e um prospect e conferir: título da aba "Growth Cycle · Boomer", trilha de etapas 01 a 09 sem benchmark, catálogo em Administração → Skills sem a 07 e com 12 fluxos, favicon novo.
- [ ] **Step 4: Dry-run final** `npm run migrar-etapas` contra os prospects reais e colar o relatório na conversa.
- [ ] **Step 5: PARAR E PEDIR CONFIRMAÇÃO** antes de qualquer coisa irreversível: (a) `npm run migrar-etapas -- --aplicar` nos prospects locais; (b) `apply_migration` da migration SQL na produção do Supabase (precedida do backup em `scripts/backup/backup.mjs`); (c) deploy na VPS, nesta ordem: parar o app, backup, migrar dados, subir o código novo. Mostrar ao usuário o que cada passo muda e só executar o que ele autorizar.
- [ ] **Step 6: Abrir o PR** (`gh pr create`) com resumo das 8 tarefas e a lista de verificação; corpo termina com a linha de atribuição do Claude Code.
