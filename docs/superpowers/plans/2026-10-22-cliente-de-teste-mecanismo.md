# Cliente de teste: mecanismo (subprojeto A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cliente marcado como teste pode ser reposicionado no início de qualquer etapa (01 a final), recebendo o estado, os arquivos das etapas anteriores e um kit do analista a partir de um fixture em `clientes/_fixtures/<id>/`.

**Architecture:** `packages/core` ganha `fixture.ts` (carrega e valida manifesto e estado completo) e `servico-teste.ts` (reposiciona a pasta do cliente e lê o kit); `ServicoPlanejamento` expõe `criarClienteTeste`, `reposicionarTeste` e `kitDaEtapa` dentro do mesmo `exclusivo`/`salvar` que protege o `estado.json`. Duas rotas e três componentes novos no app web; um script `tsx` cria o cliente.

**Tech Stack:** TypeScript (Vitest em `packages/core`), Next.js 16 + shadcn (`packages/ui`), Node 26.

**Spec:** `docs/superpowers/specs/2026-10-22-cliente-de-teste-design.md`. O conteúdo da Verdeluz é o subprojeto B (`docs/superpowers/plans/2026-10-22-cliente-de-teste-conteudo.md`); este plano usa um fixture mínimo gerado em código.

## Global Constraints

- Rodar tudo em um worktree: o repositório tem alterações não commitadas de outra frente em `servico-planejamento.ts`, `tipos.ts`, `area-de-trabalho.tsx`, `lib/api.ts` e outros. Editar esses arquivos só com mudanças pequenas e aditivas.
- Nenhum texto do app (`src/packages/core/src`, `src/apps/web/app`, `components`, `lib`, `hooks`) usa travessão (`—`) fora de intervalo numérico; `test/sem-travessao.test.ts` vigia isso.
- Em `packages/core`, imports relativos sem extensão (`"./catalogo"`); no app web, `@workspace/core/<arquivo>` e `@/...`.
- `Estado.versao` continua `1`. Erros de domínio estendem `ErroDominio` (`src/erros.ts`) e a rota responde com `respostaDeErro`.
- Pasta do fixture: `clientes/_fixtures/<id>/` com `manifesto.json`, `estado-completo.json`, `base/` e `roteiros/NN.md`. No disco de `base/`, o prefixo `.app/` do caminho do cliente vira `app/`.
- Etapa `"00"` no manifesto = existe desde o início. Kit no cliente: `kit-de-teste/<NN>/<arquivo>` e `kit-de-teste/<NN>/roteiro.md`.
- Testes de `packages/core`: `cd src/packages/core && npx vitest run <arquivo>`. Verificação geral: `cd src && npm run typecheck && npm test`.

## Review Focus

- Reposicionar com o agente rodando um turno: recusa e não apaga nada (Task 3).
- Reposicionar um prospect real (sem `teste` no estado): recusa e não apaga nada (Task 3).
- Manifesto com caminho que escapa da pasta (`../x`, caminho absoluto): rejeitado ao carregar (Task 1).
- Escolher a etapa 03 e depois a 01: nada da 03 sobra (arquivo, entregável, insumo, conversa) (Task 2).
- Dois kits com arquivos de mesmo nome em etapas diferentes, ou nome com espaço e acento: cada um vai para a pasta da sua etapa (Task 2).

---

### Task 1: Tipos, erros e carregamento do fixture

**Files:**
- Modify: `src/packages/core/src/tipos.ts` (`Estado`, `ResumoProspect`, novo `RespostaTeste`)
- Modify: `src/packages/core/src/erros.ts`
- Create: `src/packages/core/src/fixture.ts`
- Create: `src/packages/core/test/fixture-minimo.ts` (helper de teste)
- Test: `src/packages/core/test/fixture.test.ts`

**Interfaces:**
- Produces (tipos, em `tipos.ts`):
  - `Estado.teste?: { fixture: string; etapaInicial: EtapaId }`
  - `ResumoProspect.teste: boolean`
  - `export type RespostaTeste = { teste: false } | { teste: true; fixture: string; etapaInicial: EtapaId; etapa: EtapaId; arquivos: string[]; roteiro: string | null }` (`arquivos` são caminhos relativos à pasta do cliente, em `kit-de-teste/<NN>/`)
- Produces (erros, em `erros.ts`): `ErroFixture` (código `fixture_invalido`, status 409) e `ErroNaoEhTeste` (código `nao_eh_teste`, status 409, mensagem "Este prospect não é um cliente de teste.").
- Produces (`fixture.ts`):
  - `export type EtapaManifesto = "00" | EtapaId`
  - `export interface Manifesto { fixture: string; prospect: { nome: string; site: string | null }; overrides: string | null; arquivos: { caminho: string; etapa: EtapaManifesto }[]; kit: Partial<Record<EtapaId, string[]>> }`
  - `export interface Fixture { id: string; pasta: string; manifesto: Manifesto; estadoCompleto: Estado }`
  - `export function pastaDoFixture(raiz: string, id: string): string` (`<raiz>/clientes/_fixtures/<id>`)
  - `export function caminhoNaBase(fixture: Fixture, caminho: string): string` (absoluto; `.app/x` vira `base/app/x`)
  - `export function etapaDoArquivo(fixture: Fixture, caminho: string): EtapaManifesto | null`
  - `export function antesDe(etapa: EtapaManifesto, limite: EtapaId): boolean` (`"00"` é anterior a qualquer etapa; senão compara por `ORDEM_ETAPAS`)
  - `export async function carregarFixture(raiz: string, id: string): Promise<Fixture>`
- Produces (`test/fixture-minimo.ts`): `export async function criarFixtureMinimo(pasta: string): Promise<void>`, que grava um fixture completo e pequeno em `pasta`:
  - manifesto com `prospect: { nome: "Cliente Teste", site: "https://teste.example" }` e `overrides: "O site é simulado."`;
  - arquivos: `contexto/site-referencia.md` (00); `contexto/brutos/kickoff-transcricao-bruta.md` (01); `contexto/kickoff-transcricao.md` (01); `contexto/decisoes/01-preparacao-de-contexto.md` (01); `entrega/ativos-aprovados/secoes/01-kickoff-transcricao.md` (01); `.app/propostas/p1.md` (01); `contexto/contextualizacao-estrategica.md` (02); `dados/historico-mensal.xlsx` (03), um arquivo de texto qualquer com essa extensão;
  - `kit`: `"01": ["contexto/brutos/kickoff-transcricao-bruta.md"]`, `"03": ["dados/historico-mensal.xlsx"]`;
  - `roteiros/01.md`, `02.md`, `03.md` com a etapa no texto;
  - `estado-completo.json`: as 10 etapas `concluida` (resumo e handoff preenchidos), 2 entregáveis aprovados (`e1` da etapa 01 apontando para `.app/propostas/p1.md`, `e2` da etapa 02) e 3 insumos válidos (`site` da 01 com arquivo `contexto/site-referencia.md`, `kickoff-transcricao` da 01, `historico-mensal` da 03).

- [ ] **Step 1: Write the failing tests** em `test/fixture.test.ts`

```ts
it("carrega o fixture mínimo", async () => {
  const f = await carregarFixture(raiz, "mini")
  expect(f.manifesto.arquivos).toHaveLength(8)
  expect(f.estadoCompleto.etapas["final"].status).toBe("concluida")
})
it("antesDe: 00 vem antes de tudo; compara pela ordem das etapas", () => {
  expect(antesDe("00", "01")).toBe(true)
  expect(antesDe("02", "03")).toBe(true)
  expect(antesDe("03", "03")).toBe(false)
  expect(antesDe("final", "09")).toBe(false)
})
it("caminhoNaBase troca .app/ por app/", () => {
  expect(caminhoNaBase(f, ".app/propostas/p1.md")).toBe(path.join(pasta, "base/app/propostas/p1.md"))
})
it("rejeita caminho que escapa da pasta", async () => { /* manifesto com "../fora.md" → ErroFixture */ })
it("rejeita arquivo do manifesto que não existe em base/", async () => { /* ErroFixture */ })
it("rejeita arquivo de base/ fora do manifesto", async () => { /* ErroFixture */ })
it("rejeita kit que cita arquivo fora do manifesto", async () => { /* ErroFixture */ })
it("fixture inexistente vira ErroFixture", async () => { /* carregarFixture(raiz, "nao-existe") */ })
```

`raiz` é `raizTemporaria()`; o fixture mini é criado com `criarFixtureMinimo(pastaDoFixture(raiz, "mini"))`. Cada teste de rejeição altera o manifesto gravado antes de carregar.

- [ ] **Step 2: Run to verify failure**

Run: `cd src/packages/core && npx vitest run test/fixture.test.ts`
Expected: FAIL (módulo `../src/fixture` não existe).

- [ ] **Step 3: Implement** os tipos em `tipos.ts`, as duas classes em `erros.ts` e `fixture.ts` com as assinaturas acima. `carregarFixture` valida: `id` sem separador de caminho; `manifesto.json` e `estado-completo.json` legíveis; cada `caminho` relativo, sem `..`; cada arquivo existe em `base/`; todo arquivo de `base/` (varredura recursiva, ignorando `.DS_Store`) está no manifesto; todo item de `kit` está em `arquivos`; `roteiros/` não entra na varredura de `base/`. Qualquer falha lança `ErroFixture` com a mensagem dizendo qual caminho.

- [ ] **Step 4: Run to verify pass**

Run: `cd src/packages/core && npx vitest run test/fixture.test.ts && npx tsc --noEmit`
Expected: PASS e sem erro de tipo. Se `tsc` acusar `ResumoProspect.teste` faltando em `servico-planejamento.ts`, anote para a Task 3 e use `teste: false` provisório em `resumir`.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/tipos.ts src/packages/core/src/erros.ts src/packages/core/src/fixture.ts src/packages/core/test/fixture.test.ts src/packages/core/test/fixture-minimo.ts
git commit -m "feat(core): carregamento e validação do fixture do cliente de teste"
```

---

### Task 2: Reposicionar a pasta do cliente e ler o kit

**Files:**
- Create: `src/packages/core/src/servico-teste.ts`
- Test: `src/packages/core/test/servico-teste.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `caminhoNaBase`, `antesDe` (Task 1); `FsArmazenamento` (`pastaProspect`, `caminhoAbsoluto`, `lerTexto`, `listarArquivos`); `estadoInicial`, `etapaVazia`, `recalcularLiberacoes` (`maquina-estados.ts`); `ORDEM_ETAPAS`.
- Produces:
  - `export async function reposicionarNoFixture(arm: FsArmazenamento, fixture: Fixture, atual: Estado, etapa: EtapaId, agora: string): Promise<Estado>`: apaga e recompõe a pasta do cliente (itens 2 a 5 da seção 6 do spec) e devolve o novo `Estado`; **não** grava `estado.json` nem `status-planejamento.md` (quem chama grava).
  - `export function aplicarOverrides(claudeMd: string, texto: string | null): string`: substitui o corpo da seção `## Overrides específicos deste prospect` por `texto`; com `texto` nulo devolve o `claudeMd` inalterado.
  - `export async function lerKit(arm: FsArmazenamento, slug: string, etapa: EtapaId): Promise<{ arquivos: string[]; roteiro: string | null }>`: lista `kit-de-teste/<etapa>/` (sem `roteiro.md`, como caminhos relativos ao cliente) e lê `roteiro.md`.

- [ ] **Step 1: Write the failing tests**

```ts
// cada teste: raiz temporária, fixture mini, FsArmazenamento(raiz, async () => {}), cliente criado com
// arm.criarPasta("cliente-teste") e atual = { ...estadoInicial(...), teste: { fixture: "mini", etapaInicial: "01" } }
it("etapa 03: copia só 00, 01 e 02; kit 03 vai para kit-de-teste/03", async () => {
  const novo = await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
  expect(existe("contexto/kickoff-transcricao.md")).toBe(true)
  expect(existe("contexto/contextualizacao-estrategica.md")).toBe(true)
  expect(existe("dados/historico-mensal.xlsx")).toBe(false)
  expect(existe("kit-de-teste/03/historico-mensal.xlsx")).toBe(true)
  expect(existe("kit-de-teste/03/roteiro.md")).toBe(true)
  expect(existe("kit-de-teste/01/roteiro.md")).toBe(false)
  expect(novo.etapas["02"].status).toBe("concluida")
  expect(novo.etapas["03"].status).toBe("liberada")
  expect(novo.etapas["04"].status).toBe("bloqueada")
  expect(novo.entregaveis.map((e) => e.id)).toEqual(["e1", "e2"])
  expect(novo.insumos.map((i) => i.insumoId).sort()).toEqual(["kickoff-transcricao", "site"])
  expect(novo.teste).toEqual({ fixture: "mini", etapaInicial: "03" })
  expect(novo.etapas["01"].sessionId).toBeNull()
})
it("etapa 01: só o 00 e o kit 01; nenhuma etapa concluída, entregável ou insumo da 01", async () => { /* site-referencia presente, insumo site mantido, insumo kickoff fora, kit-de-teste/01 e /02 e /03 */ })
it("etapa final: todas as anteriores concluídas, final liberada, kits só da final (sem arquivos)", async () => {})
it("escolher 03 e depois 01 não deixa nada da 03", async () => {
  // reposiciona 03, grava um .app/conversas/03.jsonl e um arquivo solto em dados/, reposiciona 01
  // espera: sem contexto/kickoff-transcricao.md, sem .app/conversas/03.jsonl, sem dados/solto.xlsx
})
it("repetir a mesma etapa devolve o mesmo estado (ignorando atualizadoEm) e a mesma lista de arquivos", async () => {})
it("mantém o CLAUDE.md do cliente", async () => {})
it("restaura os README do modelo em contexto/, dados/ e entrega/", async () => {})
it("kits com arquivo de mesmo nome em etapas diferentes e nome com espaço e acento ficam cada um na pasta da sua etapa", async () => {
  // fixture com kit 01 ["contexto/brutos/relatório de vendas.md"] e kit 02 ["contexto/brutos/outro/relatório de vendas.md"]
})
it("aplicarOverrides troca o corpo da seção; sem texto não muda nada; sem a seção devolve inalterado", () => {
  const claude = "# X\n\n## Overrides específicos deste prospect\n\nEsta seção normalmente fica vazia.\n"
  expect(aplicarOverrides(claude, "O site é simulado.")).toBe("# X\n\n## Overrides específicos deste prospect\n\nO site é simulado.\n")
})
it("lerKit devolve os arquivos do kit (sem o roteiro) e o roteiro; etapa sem kit devolve vazio e roteiro nulo", async () => {})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src/packages/core && npx vitest run test/servico-teste.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement** em `servico-teste.ts`. Ordem dentro de `reposicionarNoFixture`: `rm` recursivo e forçado de `contexto`, `dados`, `entrega`, `.app` e `kit-de-teste`; `cp` recursivo desses três diretórios de `<raiz>/clientes/_template/` (ignorando `.DS_Store`); cópia dos arquivos do manifesto com `etapa` `"00"` ou `antesDe(etapa, N)`, criando as pastas; kits e roteiros das etapas de N em diante; montagem do estado conforme o spec (etapas por posição, `estadoInicial` como base para campos de topo, `prospect` e `criadoEm` mantidos de `atual`, `teste` novo). Use `copyFile` e `mkdir`, não `cp` em árvore, para não depender de ordem. Rejeite (`ErroFixture`) se `etapa` não estiver em `ORDEM_ETAPAS`.

- [ ] **Step 4: Run to verify pass**

Run: `cd src/packages/core && npx vitest run test/servico-teste.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/servico-teste.ts src/packages/core/test/servico-teste.test.ts
git commit -m "feat(core): reposiciona o cliente de teste em qualquer etapa e lê o kit"
```

---

### Task 3: Operações no ServicoPlanejamento

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts` (novos métodos; `resumir` preenche `teste`)
- Test: `src/packages/core/test/servico-cliente-teste.test.ts`

**Interfaces:**
- Consumes: `carregarFixture`, `pastaDoFixture` (Task 1); `reposicionarNoFixture`, `aplicarOverrides`, `lerKit` (Task 2); `this.exclusivo`, `this.salvar`, `this.carregar`, `this.turnos.estaOcupado`, `criarProspect`; `ErroTurnoAtivo`, `ErroNaoEhTeste`.
- Produces (métodos públicos de `ServicoPlanejamento`):
  - `criarClienteTeste(fixtureId: string, etapaInicial: EtapaId = "01"): Promise<string>`: cria o prospect com `manifesto.prospect` via `criarProspect`, grava os overrides no `CLAUDE.md` (`aplicarOverrides`), marca `estado.teste` e reposiciona; devolve o slug. Se o slug já existe, o `ErroProspectExistente` de `criarProspect` sobe sem alteração.
  - `reposicionarTeste(slug: string, etapa: EtapaId): Promise<void>`: recusa com `ErroTurnoAtivo` se `turnos.estaOcupado(slug)`; recusa com `ErroNaoEhTeste` se o estado não tem `teste`; senão, dentro de `exclusivo`, carrega o fixture de `estado.teste.fixture`, reposiciona e `salvar`.
  - `kitDaEtapa(slug: string, etapa?: EtapaId): Promise<RespostaTeste>`: `{ teste: false }` para prospect comum; senão a etapa pedida (padrão: `etapaInicial`) com `lerKit`.

- [ ] **Step 1: Write the failing tests** (mesmo harness de `servico-planejamento.test.ts`: `raizTemporaria`, `FsArmazenamento(raiz, async () => {})`, `validar` falso, `conectarTurnos` com `ocupado` controlável; fixture mini criado em `pastaDoFixture(raiz, "mini")`)

```ts
it("criarClienteTeste cria o prospect na etapa pedida, com overrides e estado.teste", async () => {
  const slug = await servico.criarClienteTeste("mini", "03")
  expect(slug).toBe("cliente-teste")
  const estado = await servico.estado(slug)
  expect(estado.etapas["03"].status).toBe("liberada")
  expect(estado.teste).toEqual({ fixture: "mini", etapaInicial: "03" })
  expect(await arm.lerTexto(slug, "CLAUDE.md")).toContain("O site é simulado.")
  expect(await servico.dossie(slug, "03")).toContain("O site é simulado.")
})
it("criarClienteTeste duas vezes lança ErroProspectExistente", async () => {})
it("reposicionarTeste move para a etapa escolhida e publica evento de estado", async () => {})
it("reposicionarTeste com o agente rodando lança ErroTurnoAtivo e não apaga nada", async () => {
  // ocupado = true; antes grava um arquivo em dados/marca.txt; depois da recusa o arquivo continua lá
})
it("reposicionarTeste em prospect comum lança ErroNaoEhTeste e não apaga nada", async () => {
  // criarProspect("Prospect Real", null); grava contexto/x.md; reposicionarTeste lança; x.md continua
})
it("reposicionarTeste com fixture que sumiu lança ErroFixture e mantém a pasta", async () => {})
it("kitDaEtapa: teste:false para prospect comum; kit da etapa de partida por padrão; kit de outra etapa quando pedida", async () => {})
it("listarProspects marca teste:true só no cliente de teste", async () => {})
it("status-planejamento.md é regerado: etapas anteriores com ✅ e a de partida com ⬜", async () => {})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src/packages/core && npx vitest run test/servico-cliente-teste.test.ts`
Expected: FAIL (métodos não existem).

- [ ] **Step 3: Implement** os três métodos e o campo `teste` em `resumir`. A checagem de `ErroNaoEhTeste` e de turno ocupado acontece **antes** de qualquer escrita. `criarClienteTeste` reutiliza `criarProspect(manifesto.prospect.nome, manifesto.prospect.site)`.

- [ ] **Step 4: Run to verify pass**

Run: `cd src/packages/core && npx vitest run && npx tsc --noEmit`
Expected: toda a suíte do core passa (incluindo `sem-travessao.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/servico-planejamento.ts src/packages/core/test/servico-cliente-teste.test.ts
git commit -m "feat(core): criar, reposicionar e ler o kit do cliente de teste no serviço de planejamento"
```

---

### Task 4: Rotas da API e cliente de API

**Files:**
- Create: `src/apps/web/app/api/prospects/[slug]/teste/route.ts`
- Create: `src/apps/web/app/api/prospects/[slug]/teste/reposicionar/route.ts`
- Modify: `src/apps/web/lib/api.ts` (dois métodos em `api`)

**Interfaces:**
- Consumes: `servidor().servico.kitDaEtapa`, `.reposicionarTeste`; `json`, `respostaDeErro`, `lerJson`, `validarEtapa` (`lib/http.ts`).
- Produces:
  - `GET /api/prospects/[slug]/teste?etapa=NN` → `RespostaTeste` (`export const dynamic = "force-dynamic"`).
  - `POST /api/prospects/[slug]/teste/reposicionar` com `{ etapa }` → `{ ok: true }`.
  - `api.kitTeste(slug: string, etapa?: EtapaId): Promise<RespostaTeste>` e `api.reposicionarTeste(slug: string, etapa: EtapaId): Promise<{ ok: true }>`.

- [ ] **Step 1: Implement** as duas rotas no formato de `estado/route.ts` e `abrir-pasta/route.ts` (try/catch com `respostaDeErro`; `etapa` vem de `validarEtapa`; corpo inválido ou sem `etapa` vira `ErroEntrada` via `lerJson`/`validarEtapa`).

- [ ] **Step 2: Implement** os dois métodos em `lib/api.ts`, ao lado de `mostrarNoFinder`, usando `chamar` e `comJson`.

- [ ] **Step 3: Verify**

Run: `cd src && npm run typecheck`
Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add "src/apps/web/app/api/prospects/[slug]/teste" src/apps/web/lib/api.ts
git commit -m "feat(web): rotas e cliente de API do cliente de teste"
```

---

### Task 5: Tela: faixa, diálogo de reposicionar e painel do kit

**Files:**
- Create: `src/apps/web/components/teste/painel-kit.tsx`
- Create: `src/apps/web/components/teste/dialogo-reposicionar.tsx`
- Create: `src/apps/web/components/teste/faixa-teste.tsx`
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx` (renderizar `FaixaTeste` logo abaixo de `BarraTopo`, linha ~259)
- Modify: `src/apps/web/components/trabalho/etapa-liberada.tsx` (renderizar `PainelKit` abaixo dos cards de insumo)
- Modify: `src/apps/web/components/home/card-prospect.tsx` (selo "Teste" ao lado do `Badge` de progresso quando `p.teste`)

**Interfaces:**
- Consumes: `api.kitTeste`, `api.reposicionarTeste`, `api.mostrarNoFinder`, `mensagemDeErro` (`lib/api.ts`); `Markdown` (`components/markdown.tsx`); `AlertDialog*`, `Dialog*`, `Button`, `Badge`, `Spinner` (`@workspace/ui/components/*`); `RespostaEstado` e `Catalogo` (para listar as etapas).
- Produces:
  - `PainelKit({ slug, etapa }: { slug: string; etapa: EtapaId })`: busca `api.kitTeste(slug, etapa)`; devolve `null` quando `teste` é falso, quando falha ou quando não há arquivos nem roteiro; senão mostra "Kit desta etapa", a lista de arquivos (cada um com botão "Mostrar no Finder") e o roteiro em `Markdown`.
  - `DialogoReposicionar({ slug, catalogo, etapaAtual, aberto, aoMudar })`: `AlertDialog` com as etapas do catálogo como opções (rótulo `rotuloStatus`), aviso "Isto apaga o que você fez neste cliente e volta ao início da etapa escolhida." e botão "Reposicionar"; ao concluir, `toast.success` e `window.location.reload()` (as conversas ficam em cache no hook da área de trabalho).
  - `FaixaTeste({ slug, dados }: { slug: string; dados: RespostaEstado })`: `null` se `dados.estado.teste` não existe; senão faixa fina com "Cliente de teste", botão "Kit da etapa" (abre `Dialog` com `PainelKit` da etapa aberta) e botão "Reposicionar".
- Textos da interface em português, sem travessão.

- [ ] **Step 1: Implement** os três componentes. Estado local simples (`useState`/`useEffect`), erros por `toast.error(mensagemDeErro(e))`, no estilo de `dialogo-excluir-prospect.tsx` e `etapa-liberada.tsx`.

- [ ] **Step 2: Implement** as três edições mínimas nos arquivos existentes (uma linha de import e uma de uso cada; o selo usa `<Badge variant="secondary">Teste</Badge>`).

- [ ] **Step 3: Verify**

Run: `cd src && npm run typecheck && npm run lint && npm test`
Expected: tudo passa; `sem-travessao.test.ts` continua verde.

- [ ] **Step 4: Commit**

```bash
git add src/apps/web/components/teste src/apps/web/components/trabalho/area-de-trabalho.tsx src/apps/web/components/trabalho/etapa-liberada.tsx src/apps/web/components/home/card-prospect.tsx
git commit -m "feat(web): faixa, diálogo de reposicionar e painel do kit do cliente de teste"
```

---

### Task 6: Script de criação e `.gitignore`

**Files:**
- Create: `src/packages/core/scripts/cliente-teste.ts`
- Modify: `src/package.json` (script `cliente-teste`; `tsx` em `devDependencies`)
- Modify: `.gitignore` (exceção `!clientes/_fixtures/`)

**Interfaces:**
- Consumes: `ServicoPlanejamento`, `FsArmazenamento`, `Barramento`, `carregarCatalogo`, `ErroProspectExistente`.
- Produces: `npm run cliente-teste -- [--fixture verdeluz] [--etapa 01]` (padrões: `verdeluz`, `01`). Imprime "Cliente de teste criado: clientes/<slug>/ (etapa NN)". Se o cliente já existe, imprime "O cliente de teste já existe. Abra o app e use Reposicionar." e sai com código 0. Etapa inválida: mensagem em português e código 1.

- [ ] **Step 1: Add** `tsx` como dependência de desenvolvimento.

Run: `cd src && npm install --save-dev tsx`
Expected: `package.json` e `package-lock.json` atualizados.

- [ ] **Step 2: Implement** o script (raiz do projeto por `PLANEJAMENTO_ROOT` ou `path.resolve(import.meta.dirname, "../../../..")`; `validar` falso, pois nenhum insumo é recebido) e a entrada em `scripts`: `"cliente-teste": "tsx packages/core/scripts/cliente-teste.ts"`.

- [ ] **Step 3: Edit** o `.gitignore`: depois de `!clientes/_template/`, acrescentar `!clientes/_fixtures/`. O `clientes/**/.app/` continua ignorado.

- [ ] **Step 4: Verify** com o fixture mínimo (apagado ao final)

Run:
```bash
cd src && npx tsx -e "import { criarFixtureMinimo } from './packages/core/test/fixture-minimo.ts'; await criarFixtureMinimo('../clientes/_fixtures/verdeluz')"
npm run cliente-teste -- --etapa 03
git check-ignore -v ../clientes/_fixtures/verdeluz/manifesto.json ../clientes/verdeluz-teste/CLAUDE.md
```
Expected: o script imprime a linha de criação; o primeiro caminho **não** é ignorado (saída vazia, código 1) e o segundo é ignorado por `clientes/*`. Rodar o script de novo imprime a mensagem de cliente já existente. Não commitar o conteúdo de `clientes/_fixtures/` neste plano.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/scripts/cliente-teste.ts src/package.json src/package-lock.json .gitignore
git commit -m "feat: script npm run cliente-teste e fixtures versionados"
```

---

### Task 7: Verificação no app e fechamento

**Files:** nenhum arquivo novo (só ajustes que a verificação pedir).

- [ ] **Step 1: Subir o app** com `preview_start` (configuração do `launch.json`; se não existir, `npm run dev` em `src/apps/web`) e abrir a home.
Expected: o card "Cliente Teste" aparece com o selo "Teste"; os demais prospects não mudam.

- [ ] **Step 2: Conferir a etapa 03** abrindo o cliente criado na Task 6.
Expected: faixa "Cliente de teste" no topo; etapas 01 e 02 concluídas na trilha; 03 liberada com o painel "Kit desta etapa" mostrando `historico-mensal.xlsx` e o roteiro; "Mostrar no Finder" abre `kit-de-teste/03`.

- [ ] **Step 3: Reposicionar na 01** pelo diálogo e depois na `final`.
Expected: confirmação aparece; a página recarrega; na 01 nada concluído e kit da 01 visível; na `final` as etapas 01 a 09 concluídas e a final liberada.

- [ ] **Step 4: Prospect real intocado.** Abrir um prospect que não é de teste.
Expected: sem faixa, sem painel e sem selo. Pelo console do navegador, `fetch('/api/prospects/<slug-real>/teste/reposicionar', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({etapa:'01'})})` responde 409 com `codigo: "nao_eh_teste"` e a pasta do prospect continua igual.

- [ ] **Step 5: Limpar e rodar tudo**

Run: `rm -rf ../clientes/verdeluz-teste ../clientes/_fixtures/verdeluz && cd src && npm run typecheck && npm run lint && npm test`
Expected: tudo passa. (O fixture mínimo e o cliente de teste de desenvolvimento são descartáveis; o conteúdo real vem do subprojeto B.)

- [ ] **Step 6: Commit** de qualquer ajuste pedido pela verificação.

```bash
git add -A src
git commit -m "fix(web): ajustes da verificação do cliente de teste"
```
