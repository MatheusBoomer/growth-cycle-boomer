# Aba Modelos em cartões — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a tabela da aba Modelos por cartões por etapa, com selos de modelo e versão, barra de esforço, resumo de uso e edição num painel lateral.

**Architecture:** Funções puras de rótulo (`rotuloDoModelo`) e o modelo padrão entram no `core`, em `modelos.ts`, que não pode importar `node:`. O serviço ganha `resumoDeUsoPorEtapa()`, e a rota `GET /api/admin/modelos` passa a devolver `uso` e `padrao`. A tela é refeita com `Card` e um `Sheet` lateral.

**Tech Stack:** TypeScript, Next.js 16, Vitest, `@workspace/ui` (shadcn sobre base-ui).

**Spec:** `docs/superpowers/specs/2026-11-08-modelos-visual-design.md`

## Global Constraints

- `src/packages/core/src/modelos.ts` continua **sem** import `node:`. O teste de guarda já existe e não pode ser afrouxado.
- Nada muda na gravação, nas validações, nas sugestões nem nos turnos. Não há migração.
- Textos fixos do spec, verbatim:
  - selo: `mais recente`, `· fixo`, `Padrão (…)`, `Padrão`;
  - níveis de esforço: `Baixo`, `Médio`, `Alto`, `Muito alto`, `Máximo` e `padrão`;
  - as seis frases de esforço da tabela do spec;
  - agentes: `Agente principal`, `Analista de dados · gráficos e projeções`, `Pesquisador · benchmark e sites`;
  - rodapé: `média US$ <x> por etapa · <n> projetos`, `últimos turnos: <modelo>`, `sem uso ainda`;
  - sugestão: `Sugestão: <modelo> · <motivo>`.
- Segmentos acesos: `low` 1, `medium` 2, `high` 3, `xhigh` 4, `max` 5; padrão 0.
- Cores: Haiku verde, Sonnet azul, Opus roxo, família desconhecida neutra, Padrão cinza tracejado. Usar tokens do tema existentes ou classes Tailwind com variante `dark:`.
- Antes do PR: `next build` numa worktree isolada sem o `.env` da raiz.
- Nunca ler `.env` nem `.env.example`. Textos sem travessão (—).

## Review Focus

1. **Etapa sem nenhum dado de uso.** O rodapé mostra `sem uso ainda`, sem `NaN` nem `US$ 0,00` enganoso. Teste na Task 2.
2. **Turnos antigos sem `modelos`.** `modeloRecente` fica `null` e o rodapé omite `últimos turnos`. Teste na Task 2.
3. **Apelido sem `resolvedModel` na lista** (SDK fora do ar). O selo mostra `Sonnet · mais recente`, sem versão, e não quebra. Teste na Task 1.
4. **Modelo salvo fora da lista.** O selo mostra o nome a partir do id, e o painel mantém o aviso `modelo não está mais na lista`. Teste na Task 1.
5. **Sugestão igual ao salvo.** A faixa de sugestão não aparece. Teste na Task 3.

---

### Task 1: Rótulos de modelo e modelo padrão (core, puro)

**Files:**
- Modify: `src/packages/core/src/modelos.ts`
- Test: `src/packages/core/test/modelos.test.ts`

**Interfaces:**
- Produces:

```ts
export interface RotuloModelo { familia: string | null; texto: string }
export function rotuloDoModelo(id: string, nomeSdk?: string): RotuloModelo
export interface SeloModelo { familia: string | null; texto: string; apelido: boolean; fixo: boolean; padrao: boolean }
export function seloDoModelo(modelo: string | null, lista: ListaDeModelos): SeloModelo
// ListaDeModelos ganha: padrao: string | null   (resolvedModel ou displayName da entrada `default` do SDK; senão null)
export const ROTULOS_ESFORCO: Record<NivelEsforco, string>          // Baixo, Médio, Alto, Muito alto, Máximo
export const FRASES_ESFORCO: Record<NivelEsforco | "padrao", string> // as seis frases do spec
export function segmentosDoEsforco(e: NivelEsforco | null): number  // 0..5
```

Regras:
- `rotuloDoModelo`: o padrão `^claude-([a-z]+)-(\d+)-(\d+)` dá `{ familia, texto: "<Familia capitalizada> <maior>.<menor>" }`. Fora dele, vale `{ familia: null, texto: nomeSdk ?? id }`.
- `seloDoModelo`:
  - `null`: `padrao: true`, e o texto é `Padrão (<rotulo do padrão>)` ou `Padrão`.
  - Apelido: a família é o próprio apelido. O texto é o rótulo do `resolvedModel` da entrada do apelido, quando conhecido, ou a família capitalizada sem versão. `apelido: true`.
  - Id fixo: rótulo do id, com `fixo: true`.
  - Os sufixos (`mais recente`, `· fixo`) ficam a cargo da tela, a partir das flags.
- `montarListaDeModelos` passa a preencher `padrao` a partir da entrada cujo `value` é `default` e passa a guardar o `resolvedModel` dos apelidos (um campo opcional `resolvido?: string` em `ModeloDisponivel`). A entrada `default` **não** entra em `modelos`.

- [ ] **Step 1: Escrever os testes que falham**
  - `rotuloDoModelo("claude-sonnet-5-5")` dá `{familia:"sonnet", texto:"Sonnet 5.5"}`;
  - `rotuloDoModelo("claude-fable-5-1")` dá `{familia:"fable", texto:"Fable 5.1"}`;
  - `rotuloDoModelo("gpt-x", "Algo")` dá `{familia:null, texto:"Algo"}`;
  - `seloDoModelo("sonnet", lista com sonnet→claude-sonnet-5-5)` dá texto `Sonnet 5.5`, `apelido: true`;
  - `seloDoModelo("sonnet", montarListaDeModelos(null))` dá texto `Sonnet`, `apelido: true` (Review Focus 3);
  - `seloDoModelo("claude-opus-5-5", lista)` dá `fixo: true` e texto `Opus 5.5`;
  - `seloDoModelo("claude-velho-4-0", lista)` dá texto `Velho 4.0` (Review Focus 4);
  - `seloDoModelo(null, lista com default→claude-opus-5-5)` dá texto `Padrão (Opus 5.5)`; sem `default`, dá `Padrão`;
  - `segmentosDoEsforco`: `null` dá 0, `"medium"` dá 2, `"max"` dá 5;
  - `montarListaDeModelos([{value:"default", resolvedModel:"claude-opus-5-5", …}, …])` dá `padrao: "claude-opus-5-5"`, e a entrada `default` fica fora de `modelos`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/modelos.test.ts` (core). Expected: FAIL.
- [ ] **Step 3: Implementar** em `modelos.ts`, sem imports `node:`.
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck` (core). Expected: PASS, com o teste de guarda verde.
- [ ] **Step 5: Commit** `feat(core): rótulo de modelo com família e versão, modelo padrão e níveis de esforço`

---

### Task 2: Resumo de uso por etapa e rota

**Files:**
- Modify:
  - `src/packages/core/src/servico-planejamento.ts`;
  - `src/apps/web/app/api/admin/modelos/route.ts`;
  - `src/apps/web/lib/api.ts` (tipo `ConfigModelos`).
- Test:
  - `src/packages/core/test/servico-planejamento.test.ts`;
  - `src/apps/web/app/api/admin/modelos.test.ts`.

**Interfaces:**
- Consumes (Task 1): `ListaDeModelos.padrao`.
- Produces:

```ts
export interface UsoDaEtapa { mediaUsd: number | null; projetos: number; modeloRecente: string | null }
resumoDeUsoPorEtapa(): Promise<Partial<Record<EtapaId, UsoDaEtapa>>>   // em ServicoPlanejamento
// GET /api/admin/modelos acrescenta: uso: Partial<Record<EtapaId, UsoDaEtapa>>, padrao: string | null (= lista.padrao)
```

Regras (do spec, seção 2):
- Lê `listarSlugs()` uma vez, `listarUsos(ativos)` uma vez e `estado(slug)` de cada prospect. **Nunca** lê presença.
- `mediaUsd`:
  - é a média de `custoPorEtapa(usosDoSlug).get(etapa).usd`, só para etapas `concluida`, sem cliente de teste e com `usd > 0`;
  - `projetos` é quantos entraram;
  - fica `null` quando nenhum entrou.
- `modeloRecente`: entre os 5 usos mais recentes por `fim` da etapa, em qualquer prospect ativo (inclusive teste), é a chave de maior soma em `modelos`, ou `null`.
- A etapa sem média e sem modelo recente fica fora do objeto.
- Um prospect com estado ilegível é ignorado, com log, no padrão de `metricasGerais`.

- [ ] **Step 1: Escrever os testes que falham**
  - Serviço:
    - dois prospects com a etapa 03 concluída, de US$ 1 e US$ 3, mais um prospect teste com US$ 50, dão `mediaUsd: 2, projetos: 2`;
    - os últimos turnos da 03 com `{sonnet: 0.4}` e `{haiku: 0.01}` dão `modeloRecente: "sonnet"`;
    - turnos antigos sem `modelos` dão `modeloRecente: null` (Review Focus 2);
    - uma etapa sem nada fica ausente (Review Focus 1);
    - um espião confirma que `listarPresencas` não é chamado.
  - Rota:
    - o GET devolve `uso` e `padrao`;
    - usuário comum recebe 403.
- [ ] **Step 2: Rodar e ver falhar.** Run: core `npx vitest run test/servico-planejamento.test.ts` e web `npx vitest run app/api/admin/modelos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar as suítes e conferir os tipos.** Run: core e web `npm test` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: resumo de uso por etapa e modelo padrão na rota da aba Modelos`

---

### Task 3: Tela em cartões com painel lateral

**Files:**
- Create:
  - `src/packages/ui/src/components/sheet.tsx` (pelo shadcn, `npx shadcn add sheet` em `src/packages/ui`, no padrão dos outros componentes);
  - `src/apps/web/components/admin/selo-modelo.tsx`;
  - `src/apps/web/components/admin/barra-esforco.tsx`;
  - `src/apps/web/components/admin/cartao-etapa-modelos.tsx`;
  - `src/apps/web/components/admin/painel-etapa-modelos.tsx`.
- Modify:
  - `src/apps/web/components/admin/tabela-modelos.tsx`, que vira a grade de cartões e mantém o carregamento, o salvamento, os toasts e os avisos de hoje;
  - `src/apps/web/lib/celula-modelo.ts`.
- Test: `src/apps/web/lib/celula-modelo.test.ts`

**Interfaces:**
- Consumes:
  - Task 1: `seloDoModelo`, `ROTULOS_ESFORCO`, `FRASES_ESFORCO`, `segmentosDoEsforco`;
  - Task 2: `ConfigModelos.uso` e `.padrao`.
  - Já existentes: `esforcosDoModelo`, `escolhaAoTrocarModelo`, `foraDaLista`, `textoAlteracao`.
- Produces, em `celula-modelo.ts`:
  - `ROTULOS_ALVO: Record<string, string>`, com os três rótulos de agente do spec;
  - `sugestaoVisivel(sugestao: Sugestao | undefined, salvo: EscolhaModelo): boolean`, que só é `true` quando a sugestão difere do valor salvo (Review Focus 5);
  - `textoRodape(uso: UsoDaEtapa | undefined, lista: ListaDeModelos): string[]`, que devolve as linhas do rodapé (`média US$ 7,59 por etapa · 2 projetos`, `últimos turnos: Sonnet 5.5`) ou `["sem uso ainda"]`. Usa `formatarUsd` de `@workspace/core/metricas/formato` e `seloDoModelo` para o nome.

Tela (o spec, seção 1, define o conteúdo):
- Grade `grid-cols-1 md:grid-cols-2`.
- O cartão é clicável (botão acessível) e abre o `Sheet` com a etapa.
- No painel, cada agente tem dois `Select`: modelo, com itens `SeloModelo` e descrição, e esforço, com a frase do nível. Também mostra a sugestão com `Aplicar`, `Voltar ao padrão`, a alteração e o aviso de fora da lista.
- Cores do selo: `haiku` verde, `sonnet` azul, `opus` roxo, outra família neutra e padrão cinza tracejado, com variantes `dark:`.

- [ ] **Step 1: Escrever os testes que falham**
  - `sugestaoVisivel({modelo:"haiku",esforco:null}, {modelo:"haiku",esforco:null})` dá `false`;
  - com o salvo diferente, dá `true`;
  - com `undefined`, dá `false`;
  - `textoRodape(undefined, lista)` dá `["sem uso ainda"]`;
  - `textoRodape({mediaUsd:7.59, projetos:2, modeloRecente:"claude-opus-5-5"}, lista)` dá `["média US$ 7,59 por etapa · 2 projetos", "últimos turnos: Opus 5.5"]`;
  - com `mediaUsd: null`, só a linha de últimos turnos aparece.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run lib/celula-modelo.test.ts` (web). Expected: FAIL.
- [ ] **Step 3: Implementar** os componentes e a grade.
- [ ] **Step 4: Rodar a suíte do web e conferir os tipos.** Run: `npm test` e `npm run typecheck` (web). Expected: PASS.
- [ ] **Step 5: Conferir a compilação de produção.**
  1. `git worktree add <scratchpad>/wt-build HEAD`;
  2. `npm ci` em `<wt>/src`;
  3. `env -i PATH="$PATH" HOME="$HOME" npx next build` em `<wt>/src/apps/web`. Expected: `Compiled successfully`, com `/admin/modelos` na tabela de rotas.
  4. Remover a worktree.
- [ ] **Step 6: Commit** `feat(web): aba Modelos em cartões com selos de modelo, barra de esforço e painel lateral`
