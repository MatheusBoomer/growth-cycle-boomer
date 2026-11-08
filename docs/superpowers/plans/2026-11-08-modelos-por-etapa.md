# Modelo e esforço por etapa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o admin escolher, na aba "Modelos", o modelo e o esforço do agente principal e de cada subagente por etapa, aplicados a cada turno sem deploy.

**Architecture:**
- A configuração fica em `planejamento.config_modelos`, lida pelo `ServicoTurnos` no começo de cada turno.
- O `PedidoTurno` ganha `modelo`, `esforco` e `agentes`. O executor do SDK os repassa nas `Options`, e o do CLI, em `--model`, `--effort` e `--agents`.
- A lista de modelos vem do `supportedModels()` do SDK (com cache de 1 h), e as sugestões, de um arquivo versionado.

**Tech Stack:** TypeScript, Next.js (App Router), Vitest, `@anthropic-ai/claude-agent-sdk` 0.3.x, Supabase/Postgres (schema `planejamento`).

**Spec:** `docs/superpowers/specs/2026-11-08-modelos-por-etapa-design.md`

Caminhos relativos à raiz do repositório. Os comandos `npm` rodam no pacote indicado.

## Global Constraints

- Nada fora do schema `planejamento` no Supabase. A migração só é aplicada pelo MCP, com o OK do analista e **antes** do deploy.
- Níveis de esforço válidos: exatamente `low`, `medium`, `high`, `xhigh` e `max`.
- Alvos válidos: `principal`, `analista-dados` e `pesquisador-benchmark`. Um subagente só é alvo válido numa etapa que o lista em `subagentes`.
- Apelidos: `haiku`, `sonnet` e `opus`, mostrados como `Haiku (mais recente)`, `Sonnet (mais recente)` e `Opus (mais recente)`. Quando o SDK não informa o esforço do apelido, valem `low`, `medium` e `high`.
- Sem configuração, as opções do SDK e os argumentos do CLI ficam **idênticos** aos de hoje.
- Cache da lista de modelos: 1 h (`3_600_000` ms).
- Textos fixos:
  - `Padrão`;
  - `não usa`;
  - `Aplicar`;
  - `Voltar ao padrão`;
  - `modelo não está mais na lista`;
  - `lista completa indisponível agora`;
  - `Ver o custo por modelo em Projetos`;
  - `Alterado por <nome> em <dd/mm>`;
  - `O modelo <modelo> foi recusado. Ajuste em Administração → Modelos.`;
  - `A administração de pessoas só existe com os dados na nuvem.` (modo fs).
- Uma falha ao ler a configuração ou o `.md` de um subagente nunca derruba o turno: o turno segue no padrão e o erro vai para o log.
- Nunca ler `.env` nem `.env.example`. Não rodar o app local com o `.env` de produção. Textos sem travessão (—).

## Review Focus

1. **Modelo e esforço vindos do banco com valor inesperado** (linha editada à mão). O turno ignora um esforço fora da lista de níveis e não quebra. Teste na Task 5.
2. **Subagente configurado numa etapa que não o usa mais** (o `etapas.json` mudou). A configuração é ignorada no turno e a aba não mostra a célula. Teste na Task 5.
3. **Escolher um modelo novo cujo esforço salvo não é aceito** (ex.: trocar para um modelo sem esforço e manter `high`). O PUT recusa com 400 e a interface limpa o esforço ao trocar o modelo. Teste nas Tasks 3 e 7.
4. **A consulta de modelos travando** (rede ou SDK sem resposta). Ela tem um tempo limite de 20 s e cai na lista só com os apelidos. Teste na Task 3.
5. **`.md` de subagente com `tools` vazio ou sem cabeçalho.** A leitura falha de forma clara, e o turno segue no padrão para esse subagente. Teste na Task 3.

---

### Task 1: Migração e backup

**Files:**
- Create: `supabase/migrations/20261109120000_config_modelos.sql` e `supabase/testes/testar-config-modelos.sh` (no padrão de `testar-custos-e-tempo.sh`)
- Modify: `scripts/backup/comum.mjs`

**Interfaces:**
- Produces:
  - a tabela `planejamento.config_modelos` com as colunas e o `check` do spec, a chave primária `(etapa, alvo)`, RLS ligado e permissões só para `service_role`;
  - em `TABELAS`, a entrada `{ nome: "config_modelos", chave: ["etapa", "alvo"], global: true }`, depois de `usuarios`.

- [ ] **Step 1:** Escrever a migração, idempotente e sem `drop`.
- [ ] **Step 2:** O script aplica `20261027120000_planejamento.sql` e depois a migração nova duas vezes, confere com `\d planejamento.config_modelos` e confere que um `insert` com `esforco = 'turbo'` falha.

Run: `bash supabase/testes/testar-config-modelos.sh`
Expected: `config-modelos: migração aplicada duas vezes sem erro`

- [ ] **Step 3:** Rodar `node --check scripts/backup/*.mjs` e commitar.

```bash
git commit -m "feat(banco): tabela de modelo e esforço por etapa"
```

---

### Task 2: Catálogo com subagentes e arquivo de sugestões

**Files:**
- Modify:
  - `.claude/skills/_shared/etapas.json`, com o campo `subagentes` em **todas** as etapas, usando os valores da tabela do spec;
  - `src/packages/core/src/tipos.ts` (`EtapaCatalogo.subagentes: string[]`);
  - `src/packages/core/src/catalogo.ts`.
- Create:
  - `.claude/skills/_shared/sugestoes-modelos.json`, com as linhas da tabela "Sugestões" do spec;
  - `src/packages/core/src/modelos.ts`.
- Test: `src/packages/core/test/catalogo.test.ts` e `src/packages/core/test/modelos.test.ts`

**Interfaces:**
- Produces, em `modelos.ts`:

```ts
export const NIVEIS_ESFORCO = ["low", "medium", "high", "xhigh", "max"] as const
export type NivelEsforco = (typeof NIVEIS_ESFORCO)[number]
export const ALVO_PRINCIPAL = "principal"
export const SUBAGENTES_CONFIGURAVEIS = ["analista-dados", "pesquisador-benchmark"] as const
export interface EscolhaModelo { modelo: string | null; esforco: NivelEsforco | null }
export interface Sugestao { etapa: EtapaId; alvo: string; modelo: string; esforco: NivelEsforco | null; motivo: string }
export const CAMINHO_SUGESTOES = ".claude/skills/_shared/sugestoes-modelos.json"
export function carregarSugestoes(raiz: string, catalogo: Catalogo): Sugestao[]
export function alvosDaEtapa(catalogo: Catalogo, etapa: EtapaId): string[]  // ["principal", ...subagentes]
```

- `carregarCatalogo` lança erro quando `subagentes` está ausente, não é lista ou traz um nome fora de `SUBAGENTES_CONFIGURAVEIS`.
- `carregarSugestoes` lança erro quando há uma etapa inexistente, um alvo fora de `alvosDaEtapa`, um esforço fora de `NIVEIS_ESFORCO` ou um `motivo` vazio.

- [ ] **Step 1: Escrever os testes que falham**
  - o catálogo real carrega e traz a etapa 05 com `["analista-dados", "pesquisador-benchmark"]` e a 01 com `[]`;
  - um `subagentes` com `"designer"` lança;
  - as sugestões reais carregam, e a sugestão da etapa 06 para `analista-dados` é `sonnet`;
  - uma sugestão de `analista-dados` na etapa 01 lança;
  - `alvosDaEtapa(cat, "08")` dá `["principal", "analista-dados", "pesquisador-benchmark"]`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/catalogo.test.ts test/modelos.test.ts` (core). Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck` (core). Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(core): subagentes por etapa no catálogo e sugestões de modelo"
```

---

### Task 3: Executor aplica modelo, esforço e subagentes; lista e validação de modelos

**Files:**
- Modify:
  - `src/packages/core/src/executor/tipos.ts` (`PedidoTurno`);
  - `src/packages/core/src/executor/agent-sdk.ts` (`montarOpcoesSdk`);
  - `src/packages/core/src/executor/claude-cli.ts` (montagem dos `args`).
- Create:
  - `src/packages/core/src/executor/subagentes.ts`;
  - `src/packages/core/src/executor/modelos-sdk.ts`.
- Modify: `src/packages/core/src/modelos.ts`, para a lista e a validação.
- Test:
  - `src/packages/core/test/agent-sdk.test.ts`;
  - `src/packages/core/test/claude-cli.test.ts`;
  - `src/packages/core/test/subagentes.test.ts`;
  - `src/packages/core/test/modelos.test.ts`.

**Interfaces:**
- Consumes (Task 2): `NivelEsforco`, `NIVEIS_ESFORCO`.
- Produces:

```ts
// executor/tipos.ts
export interface DefinicaoAgente { description: string; prompt: string; tools: string[]; model?: string; effort?: NivelEsforco }
// PedidoTurno ganha: modelo?: string; esforco?: NivelEsforco; agentes?: Record<string, DefinicaoAgente>

// executor/subagentes.ts
export function lerDefinicaoSubagente(raiz: string, nome: string): DefinicaoAgente  // lê .claude/agents/<nome>.md; lança Error com o nome do arquivo se faltar cabeçalho, description ou tools

// executor/modelos-sdk.ts
export interface InfoModeloSdk { value: string; resolvedModel?: string; displayName: string; description: string; supportsEffort?: boolean; supportedEffortLevels?: NivelEsforco[] }
export function consultarModelosSdk(env: Record<string, string | undefined>, consulta?: ConsultaSdk, limiteMs?: number): Promise<InfoModeloSdk[]>  // limiteMs padrão 20000; rejeita no tempo limite

// modelos.ts
export interface ModeloDisponivel { value: string; nome: string; descricao: string; esforcos: NivelEsforco[]; apelido: boolean }
export interface ListaDeModelos { modelos: ModeloDisponivel[]; completa: boolean }
export function montarListaDeModelos(info: InfoModeloSdk[] | null): ListaDeModelos
export function validarEscolha(e: EscolhaModelo, lista: ListaDeModelos): void  // ErroEntrada com mensagem listando o que vale
export function criarCacheDeModelos(buscar: () => Promise<InfoModeloSdk[]>, agora?: () => number, ttlMs?: number): () => Promise<ListaDeModelos>
```

Regras:
- `montarOpcoesSdk` acrescenta `model`, `effort` e `agents` **só** quando estão definidos no pedido.
- O CLI acrescenta `--model <m>`, `--effort <e>` e `--agents <json>` pelo mesmo critério. O JSON tem o formato de `agents` (nome → `{ description, prompt, tools, model?, effort? }`).
- `lerDefinicaoSubagente` lê o cabeçalho YAML entre `---` (só as chaves de uma linha `description:` e `tools:`). `tools` é separado por vírgula, com os espaços aparados. O corpo sem o cabeçalho, aparado, é o `prompt`.
- `consultarModelosSdk` chama `query` com um `prompt` que é um gerador assíncrono que nunca produz nada, aguarda `supportedModels()` e encerra a consulta (`abortController.abort()`) em qualquer caso.
- `montarListaDeModelos`:
  - os três apelidos vêm no topo, com `apelido: true`. Os esforços de cada apelido vêm da linha cujo `value` é o apelido; senão, da linha cujo `value` é o `resolvedModel` dessa linha; senão, são `low`, `medium` e `high`.
  - depois vêm os demais modelos do SDK, sem repetir um `value`. Os esforços são `supportedEffortLevels` filtrados por `NIVEIS_ESFORCO`, ou `[]` quando `supportsEffort` é falso.
  - com `info === null`, a lista traz só os apelidos e `completa: false`.
- `criarCacheDeModelos` reaproveita o resultado por `ttlMs` (padrão `3_600_000`). Uma falha da busca devolve `montarListaDeModelos(null)` e **não** fica em cache.

- [ ] **Step 1: Escrever os testes que falham**
  - SDK: um pedido sem extras dá `Options` com as **mesmas chaves de hoje**. Com `modelo: "haiku"` e `esforco: "low"`, aparecem `model` e `effort`. Com `agentes`, aparece `agents` igual ao objeto.
  - CLI: sem extras, os `args` são idênticos aos de hoje. Com extras, aparecem `--model haiku --effort low --agents {...}`.
  - `lerDefinicaoSubagente`:
    - lê o `.claude/agents/analista-dados.md` real, com `tools = ["Read", "Bash", "Glob"]`, `description` não vazia e `prompt` começando por "Você é o analista de dados";
    - um arquivo sem cabeçalho lança;
    - um `tools:` vazio lança (Review Focus 5).
  - `montarListaDeModelos`:
    - com `[{value:"sonnet", resolvedModel:"claude-sonnet-5-5", …, supportedEffortLevels:["low","high"]}, {value:"claude-haiku-5-5", supportsEffort:false, …}]`, os 3 apelidos vêm primeiro, o `sonnet` tem esforços `["low","high"]` e o `claude-haiku-5-5` tem `[]`;
    - com `null`, vêm só os apelidos e `completa: false`.
  - `validarEscolha`:
    - `{modelo:"opus", esforco:"high"}` passa;
    - `{modelo:"claude-x", esforco:null}` lança 400;
    - `{modelo:"claude-haiku-5-5", esforco:"high"}` lança 400 (Review Focus 3);
    - `{modelo:null, esforco:"max"}` passa.
  - `consultarModelosSdk`: uma consulta falsa que nunca resolve rejeita depois de `limiteMs: 50` (Review Focus 4), e a consulta é abortada.
  - `criarCacheDeModelos`:
    - duas chamadas dentro do TTL buscam uma vez;
    - depois do TTL, buscam de novo;
    - uma falha devolve só os apelidos e a próxima chamada tenta de novo.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/agent-sdk.test.ts test/claude-cli.test.ts test/subagentes.test.ts test/modelos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck` (core). Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(core): executor aplica modelo, esforço e subagentes; lista e validação de modelos"
```

---

### Task 4: Configuração no repositório e no serviço

**Files:**
- Modify:
  - `src/packages/core/src/nuvem/tipos.ts`;
  - `src/packages/core/src/nuvem/memoria.ts`;
  - `src/packages/core/src/nuvem/supabase.ts`;
  - `src/packages/core/src/armazenamento.ts`;
  - `src/packages/core/src/nuvem/armazenamento-nuvem.ts`;
  - `src/packages/core/src/servico-planejamento.ts`.
- Test:
  - `src/packages/core/test/nuvem/contrato-repositorio.ts`;
  - `src/packages/core/test/nuvem/supabase-fake.test.ts`;
  - `src/packages/core/test/servico-planejamento.test.ts`.

**Interfaces:**
- Consumes: `EscolhaModelo`, `NivelEsforco`, `alvosDaEtapa`, `validarEscolha`, `ListaDeModelos` (Tasks 2 e 3).
- Produces:

```ts
// nuvem/tipos.ts
export interface LinhaConfigModelo { etapa: EtapaId; alvo: string; modelo: string | null; esforco: string | null; alteradoPor: string | null; alteradoEm: string | null }
// Repositorio:
lerConfigModelos(): Promise<LinhaConfigModelo[]>
gravarConfigModelo(l: { etapa: EtapaId; alvo: string; modelo: string | null; esforco: NivelEsforco | null; alteradoPor: string }): Promise<void>  // os dois nulos → apaga a linha; senão, upsert com alterado_em = agora

// ServicoPlanejamento
configModelos(): Promise<LinhaConfigModelo[]>                      // modo fs: []
configDaEtapa(etapa: EtapaId): Promise<{ principal: EscolhaModelo; subagentes: Record<string, EscolhaModelo> }>
salvarConfigModelo(etapa: EtapaId, alvo: string, escolha: EscolhaModelo, autor: string, lista: ListaDeModelos): Promise<void>
```

- `FsArmazenamento`: `lerConfigModelos` devolve `[]`; `gravarConfigModelo` lança `ErroEntrada("A administração de pessoas só existe com os dados na nuvem.")`.
- `configDaEtapa`:
  - considera só os alvos de `alvosDaEtapa` (Review Focus 2);
  - ignora um `esforco` fora de `NIVEIS_ESFORCO` (Review Focus 1);
  - trata uma linha ausente como `{ modelo: null, esforco: null }`;
  - **nunca lança**: com erro de leitura, registra no log e devolve tudo padrão.
- `salvarConfigModelo`:
  - lança `ErroNaoEncontrado("Etapa ou alvo inexistente.")` quando o alvo não está em `alvosDaEtapa`;
  - depois chama `validarEscolha` e grava.

- [ ] **Step 1: Escrever os testes que falham**
  - Contrato:
    - gravar, ler, regravar e ler mostra o novo valor e `alteradoPor`;
    - gravar os dois `null` apaga a linha.
  - Serviço:
    - `configDaEtapa("01")` ignora uma linha de `analista-dados` na 01;
    - um esforço `"turbo"` lido do banco vira `null`;
    - um repositório que lança devolve tudo padrão;
    - salvar `analista-dados` na etapa 01 dá 404;
    - salvar um modelo fora da lista dá 400.
  - Fake do Supabase: o `upsert` usa `onConflict: "etapa,alvo"`, e o par de `null` faz um `delete`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/servico-planejamento.test.ts test/nuvem`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Não rodar `test:supabase`: a tabela só existe depois da Task 8.
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(core): configuração de modelo por etapa no repositório e no serviço"
```

---

### Task 5: Turno usa a configuração da etapa

**Files:**
- Modify: `src/packages/core/src/servico-turnos.ts` (montagem do `PedidoTurno` em torno da linha 435 e o registro do uso)
- Test: `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Consumes:
  - Task 4: `servico.configDaEtapa(etapa)`;
  - Task 3: `lerDefinicaoSubagente(raiz, nome)` e `DefinicaoAgente`.
- Produces:
  - O `PedidoTurno` leva `modelo` e `esforco` do principal, quando não nulos.
  - `agentes` traz cada subagente da etapa com modelo ou esforço configurado: a definição lida do `.md`, mais `model` e/ou `effort`. Uma falha ao ler um `.md` deixa esse subagente de fora, com log.
  - O uso do turno grava `esforco: pedido.esforco ?? null`.
  - Num `fim` com `ok: false` e `pedido.modelo` definido, quando o texto do erro casa com `/model/i`, o evento de fim registrado na conversa leva a mensagem `O modelo <modelo> foi recusado. Ajuste em Administração → Modelos.` antes do erro original.

- [ ] **Step 1: Escrever os testes que falham**, com o executor falso capturando o pedido:
  - sem configuração, o pedido não tem `modelo`, `esforco` nem `agentes`;
  - com `principal: {haiku, low}`, o pedido leva os dois, e o uso grava `esforco: "low"`;
  - com `analista-dados: {haiku, null}` na etapa 03, `agentes["analista-dados"]` tem `model: "haiku"`, as `tools` do `.md` e nenhum `effort`;
  - com o `.md` ilegível (raiz falsa), o turno roda sem `agentes` e termina `ok`;
  - com o executor falso devolvendo `fim` com o erro `"model not found: claude-x"` e o modelo `claude-x`, a mensagem do turno contém `O modelo claude-x foi recusado`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/servico-turnos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(core): turno usa modelo, esforço e subagentes configurados para a etapa"
```

---

### Task 6: Rotas de admin

**Files:**
- Create:
  - `src/apps/web/app/api/admin/modelos/route.ts` (`GET`);
  - `src/apps/web/app/api/admin/modelos/[etapa]/[alvo]/route.ts` (`PUT`).
- Modify:
  - `src/apps/web/lib/servidor.ts` (`Servidor.modelosDisponiveis: () => Promise<ListaDeModelos>`, que usa `criarCacheDeModelos(() => consultarModelosSdk(<mesmo env do executor do agente>))`, criado uma vez por processo);
  - `src/apps/web/lib/api.ts`.
- Test: `src/apps/web/app/api/admin/modelos.test.ts`

**Interfaces:**
- Consumes (Tasks 2 a 4): `carregarSugestoes`, `alvosDaEtapa`, `servico.configModelos`, `servico.salvarConfigModelo`, `ListaDeModelos`.
- Produces:
  - `GET /api/admin/modelos` → `{ etapas: Array<{ id: EtapaId; rotulo: string; alvos: string[] }>, config: LinhaConfigModelo[], sugestoes: Sugestao[], lista: ListaDeModelos }`;
  - `PUT /api/admin/modelos/[etapa]/[alvo]` com `{ modelo: string | null, esforco: NivelEsforco | null }` → `{ ok: true }`;
  - os dois chamam `exigirAdmin()` como primeira instrução e `usuariosDaNuvem()` para o 400 do modo fs;
  - a etapa é validada com `validarEtapa` (404); um corpo malformado dá 400;
  - em `lib/api.ts`: `api.configModelos()` e `api.salvarModelo(etapa, alvo, escolha)`, com os tipos exportados.

- [ ] **Step 1: Escrever os testes que falham**, no padrão de `app/api/admin/admin.test.ts`, com `modelosDisponiveis` falso:
  - usuário comum → 403 nas duas rotas;
  - o GET traz as 10 etapas, as sugestões e a lista;
  - PUT de `analista-dados` na 01 → 404;
  - PUT de `claude-x` → 400;
  - PUT válido grava `alteradoPor` = e-mail do admin;
  - PUT com os dois `null` apaga;
  - modo fs → 400.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run app/api/admin` (web). Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do web e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS, com a varredura de rotas classificando as novas como admin.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(web): rotas de admin para modelo e esforço por etapa"
```

---

### Task 7: Aba "Modelos"

**Files:**
- Create:
  - `src/apps/web/app/admin/modelos/page.tsx`;
  - `src/apps/web/components/admin/tabela-modelos.tsx`;
  - `src/apps/web/lib/celula-modelo.ts` (lógica pura).
- Modify: `src/apps/web/components/admin/abas-admin.tsx` (aba "Modelos", em `/admin/modelos`)
- Test: `src/apps/web/lib/celula-modelo.test.ts`

**Interfaces:**
- Consumes (Task 6): `api.configModelos`, `api.salvarModelo` e os tipos exportados.
- Produces, em `celula-modelo.ts`:
  - `esforcosDoModelo(lista: ListaDeModelos, modelo: string | null): NivelEsforco[]`: com `null` (padrão), todos os `NIVEIS_ESFORCO`;
  - `escolhaAoTrocarModelo(atual: EscolhaModelo, novoModelo: string | null, lista: ListaDeModelos): EscolhaModelo`: limpa o esforço quando o novo modelo não o aceita (Review Focus 3);
  - `foraDaLista(lista: ListaDeModelos, modelo: string | null): boolean`;
  - `textoAlteracao(linha: LinhaConfigModelo | undefined): string | null`: devolve `Alterado por <nomeCurto> em <dd/mm>`.

A tela segue o spec, seção "Aba Modelos":
- uma linha por etapa, com as colunas `Agente principal`, `analista-dados` e `pesquisador-benchmark`;
- cada célula com um seletor de modelo (primeira opção `Padrão`) e um de esforço, este desligado quando a lista de esforços vem vazia;
- `não usa` quando o alvo não é da etapa;
- a sugestão com o motivo no tooltip e o botão `Aplicar`;
- `Voltar ao padrão`;
- `modelo não está mais na lista`;
- o aviso `lista completa indisponível agora` quando `completa` é falso;
- o link `Ver o custo por modelo em Projetos` para `/admin/projetos`.

Cada mudança chama `api.salvarModelo`, mostra um toast de sucesso ou de erro e recarrega os dados. A página é server fina (sessão e redirecionamento ficam no `admin/layout.tsx`), e os dados vêm pelo cliente.

- [ ] **Step 1: Escrever os testes que falham** para as quatro funções:
  - `esforcosDoModelo(lista, null)` traz os 5 níveis;
  - trocar de `{sonnet, high}` para um modelo sem esforço dá `{modelo, esforco: null}`;
  - `foraDaLista` dá `true` para `"claude-velho"` e `false` para `"opus"`;
  - `textoAlteracao` dá `"Alterado por Ana Silva em 08/11"`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run lib/celula-modelo.test.ts` (web). Expected: FAIL.
- [ ] **Step 3: Implementar.** Usar os componentes de `@workspace/ui` que as telas de admin já usam (`table`, `select`, `tooltip`, `button`).
- [ ] **Step 4: Rodar a suíte do web e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(web): aba Modelos com modelo e esforço por etapa e sugestões"
```

---

### Task 8: Aplicação no Supabase, deploy e aceitação

Feita pelo controlador com o analista. Não é delegada.

- [ ] **Step 1:** Com o OK do analista, aplicar `20261109120000_config_modelos.sql` pelo MCP (`apply_migration`, nome `planejamento_config_modelos`) e conferir as colunas.
- [ ] **Step 2:** Rodar `npm run test:supabase` (core). Expected: PASS, sem linhas de teste sobrando em `config_modelos`.
- [ ] **Step 3:** Abrir o PR e, depois do merge, o deploy na VPS:
  `cd /opt/planejamento/app && git pull && docker build -t planejamento:vps . && cd .. && docker compose up -d app`.
- [ ] **Step 4:** Aceitação:
  1. aplicar a sugestão Haiku na etapa 01 e rodar um turno;
  2. conferir em `uso_turnos.modelos` que o turno saiu em Haiku e que o painel mostra isso;
  3. voltar ao padrão e confirmar que o turno seguinte sai no Opus;
  4. conferir que a lista completa de modelos aparece.
