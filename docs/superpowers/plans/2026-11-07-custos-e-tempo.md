# Custos e tempo por projeto e por etapa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar o custo real de cada turno (por conversa e por modelo) e a presença do analista no projeto, e mostrar ao admin o custo e o tempo de cada projeto, de cada etapa e de cada pessoa, com médias por etapa entre projetos.

**Architecture:**
- O cálculo fica em três módulos puros do `core`, em `src/packages/core/src/metricas/`: custo, tempo e resumo/médias.
- O `Repositorio` ganha leitura do uso, a gravação e leitura da presença e a busca do último turno de uma conversa. O `ServicoPlanejamento` calcula o custo do turno antes de gravar e monta as métricas para as rotas.
- No `web`:
  - um componente invisível manda o aviso de presença;
  - duas rotas de admin servem a lista e o detalhe;
  - a aba "Projetos" e um selo na barra mostram os números.

**Tech Stack:** Next.js (App Router) e TypeScript; Vitest; `@supabase/supabase-js` 2.x e Postgres (schema `planejamento`).

**Spec:** `docs/superpowers/specs/2026-11-07-custos-e-tempo-design.md`

Caminhos relativos à raiz do repositório. Os comandos `npm` rodam no pacote indicado (`src/packages/core` ou `src/apps/web`).

## Global Constraints

- Nada fora do schema `planejamento` no Supabase (projeto compartilhado com o `pit`). A migração só é aplicada pelo MCP do Supabase, com o OK do analista e **antes** do deploy da imagem.
- Só admin vê custo e tempo. A presença é medida para todos e nada aparece ao usuário comum.
- Limites: `PLANEJAMENTO_OCIOSO_MIN` (padrão `5`) e `PLANEJAMENTO_DESCARTE_MIN` (padrão `15`). Valor ausente, vazio ou inválido (não número, ≤ 0) usa o padrão.
- Os blocos de tempo são de 30 s, alinhados ao relógio: `bloco = Math.floor(epochMs / 30000)`.
- Prioridade das categorias: agente > ativo > ocioso > descartado.
- Médias: só etapas `concluida`, de prospects ativos e não teste. Com menos de 5 projetos na base, `basePequena = true`. "Dentro da média" vale para a razão entre `0.8` e `1.25`, inclusive.
- Textos fixos:
  - `Sem uso registrado ainda`;
  - `estimado`;
  - `base pequena, menos de 5 projetos`;
  - `dentro da média`;
  - `2,4× a média` (uma casa decimal, vírgula);
  - `A administração de pessoas só existe com os dados na nuvem.` (reaproveitado no modo fs).
- Formatos:
  - custo `US$ 9,80` (duas casas, vírgula);
  - tempo `3h12`, `45 min`, `< 1 min` (`3h05` com dois dígitos nos minutos; `0` segundos vira `0 min`).
- Uma falha ao registrar uso nunca derruba o turno. Uma falha do aviso de presença é ignorada em silêncio pela página.
- Nunca ler `.env` nem `.env.example`. Não rodar o app local com o `.env` de produção.
- Textos de interface sem travessão (—).

## Review Focus

1. **Aviso de presença chegando atrasado ou fora de ordem** (rede lenta). A classificação ordena por `em` antes de calcular as sequências ociosas e não depende da ordem de chegada. Teste na Task 4.
2. **Dois avisos no mesmo bloco, um ativo e outro ocioso** (duas abas). O bloco conta como ativo, e uma única vez. Teste na Task 4.
3. **Turno sem `sessao`** (executor demo ou erro antes do `init`). Ele é gravado com `custo_turno_usd = custo_usd` e não quebra o cálculo do turno seguinte. Teste na Task 3.
4. **Prospect sem uso nem presença.** Lista e detalhe mostram zeros ou `Sem uso registrado ainda`, sem `NaN` nem erro, e o projeto não entra nas médias. Teste na Task 5.
5. **Turno que atravessa a meia-noite ou dura menos de 30 s.** Pelo menos o bloco do início conta como agente, e nenhum bloco é contado duas vezes. Teste na Task 4.

---

### Task 1: Migração, backup e restauração

**Files:**
- Create: `supabase/migrations/20261108120000_custos_e_tempo.sql`
- Modify: `scripts/backup/comum.mjs` e `scripts/backup/restaurar.mjs`

**Interfaces:**
- Produces:
  - colunas `uso_turnos.sessao text`, `custo_turno_usd numeric(10,4)`, `modelos jsonb`, `modelos_acumulado jsonb` e `esforco text`, todas `add column if not exists`, aceitando nulo;
  - tabela `planejamento.presenca` com as colunas do spec, a FK `slug → prospects(slug)`, os índices `presenca_slug_em (slug, em)` e `presenca_email_em (email, em)`, RLS ligado e permissões no padrão de `20261027120000_planejamento.sql`, com `grant usage, select` na sequência da identidade para `service_role`;
  - índice `uso_turnos_slug_sessao (slug, sessao)`.
  - `TABELAS` ganha `{ nome: "presenca", chave: ["id"], identidade: "id", opcional: true }`, depois de `uso_turnos`.
  - Em `lerTabelaDoBackup`, uma tabela ausente vira `[]` quando ela é `global` **ou** `opcional`.

- [ ] **Step 1: Escrever a migração**, idempotente e sem `drop`.

- [ ] **Step 2: Validar o SQL num Postgres descartável**
  - Reusar o padrão de `supabase/testes/testar-usuarios.sh`: o contêiner, os papéis e o schema.
  - Aplicar `20261027120000_planejamento.sql`, depois a migração nova, **duas vezes** (para provar a idempotência).
  - Conferir com `\d planejamento.presenca` e `\d planejamento.uso_turnos`.
  - Pode ser um script novo, `supabase/testes/testar-custos-e-tempo.sh`.

Run: `bash supabase/testes/testar-custos-e-tempo.sh`
Expected: `custos-e-tempo: migração aplicada duas vezes sem erro`.

- [ ] **Step 3: Ajustar o backup e conferir**

Run: `node --check scripts/backup/comum.mjs scripts/backup/restaurar.mjs scripts/backup/backup.mjs`. Depois, um script descartável no scratchpad que confirma que `presenca` ausente dá `[]` e `prospects` ausente lança. Nunca rodar backup nem restauração de verdade.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261108120000_custos_e_tempo.sql supabase/testes/testar-custos-e-tempo.sh scripts/backup/comum.mjs scripts/backup/restaurar.mjs
git commit -m "feat(banco): colunas de custo por turno e tabela de presença"
```

---

### Task 2: Executor extrai o custo por modelo

**Files:**
- Modify: `src/packages/core/src/executor/tipos.ts` (`UsoDoTurno`) e `src/packages/core/src/executor/stream-json.ts` (caso `result`)
- Test: `src/packages/core/test/stream-json.test.ts`

**Interfaces:**
- Produces: `UsoDoTurno.modelos: Record<string, number> | null`, que é o `costUSD` acumulado de cada chave de `modelUsage`. Fica `null` quando `modelUsage` está ausente ou vazio. Entradas sem `costUSD` numérico são ignoradas. O modo SDK (`agent-sdk.ts`) usa o mesmo `eventosDaMensagem`, então não muda.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it("result leva o custo acumulado por modelo de modelUsage", () => {
  const [fim] = eventosDaMensagem({ type: "result", subtype: "success", session_id: "s1", total_cost_usd: 0.5,
    usage: { input_tokens: 10, output_tokens: 5 },
    modelUsage: { "claude-sonnet-5-5": { costUSD: 0.45 }, "claude-haiku-5-5": { costUSD: 0.05 }, "x": { inputTokens: 1 } } })
  expect(fim).toMatchObject({ tipo: "fim", uso: { custoUsd: 0.5, modelos: { "claude-sonnet-5-5": 0.45, "claude-haiku-5-5": 0.05 } } })
})
it("sem modelUsage, modelos é null", () => { /* mesmo result sem modelUsage → uso.modelos === null */ })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/stream-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar a suíte do core**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/executor src/packages/core/test/stream-json.test.ts
git commit -m "feat(core): resultado do turno traz o custo acumulado por modelo"
```

---

### Task 3: Custo do turno e custo por etapa (puro)

**Files:**
- Create: `src/packages/core/src/metricas/tipos.ts` e `src/packages/core/src/metricas/custo.ts`
- Test: `src/packages/core/test/metricas-custo.test.ts`

**Interfaces:**
- Produces, em `tipos.ts`:

```ts
export interface LinhaUso {
  slug: string; etapa: EtapaId; autor: string | null; sessao: string | null
  custoUsd: number | null; custoTurnoUsd: number | null; modelos: Record<string, number> | null
  inicio: string; fim: string
}
export interface CustoEtapa { usd: number; estimado: boolean; turnos: number; modelos: Record<string, number> }
export interface Acumulado { custoUsd: number | null; modelos: Record<string, number> | null }
```

- Produces, em `custo.ts`:
  - `custoDoTurno(atual: Acumulado, anterior: Acumulado | null): { custoTurnoUsd: number | null; modelos: Record<string, number> | null }`. Aplica a regra do spec ao total e a cada modelo: sem anterior, `A`; `A ≥ B`, `A − B`; `A < B`, `A`. Modelo sem valor anterior entra com o próprio valor. Arredonda para 4 casas.
  - `custoPorEtapa(usos: LinhaUso[]): Map<EtapaId, CustoEtapa>`:
    - as linhas com `sessao` somam `custoTurnoUsd` e `modelos`;
    - as linhas sem `sessao` (antigas) da etapa contribuem com `max(custoUsd)`, e marcam `estimado: true`;
    - `turnos` conta todas as linhas.
  - `custoPorPessoa(usos: LinhaUso[]): Map<string, number>`: soma `custoTurnoUsd` pelo `autor` normalizado, ignorando `autor` nulo. Linhas antigas não entram por pessoa.

- [ ] **Step 1: Escrever os testes que falham**

Casos, com os valores conferidos em `toBeCloseTo`:

`custoDoTurno`:
- primeiro turno `{0.30}` → `0.30`;
- `{0.50}` depois de `{0.30}` → `0.20`;
- acumulado que caiu: `{0.10}` depois de `{0.50}` → `0.10`;
- `{sonnet: 0.45, haiku: 0.05}` depois de `{sonnet: 0.30}` → `{sonnet: 0.15, haiku: 0.05}`;
- `custoUsd` nulo → `custoTurnoUsd` nulo.

`custoPorEtapa`:
- etapa só com linhas antigas `[0.2, 0.6, 1.1]` → `usd 1.1, estimado true, turnos 3`;
- etapa mista (antigas com max `1.0`, mais novas `0.2 + 0.3`) → `usd 1.5, estimado true`;
- turno com `sessao` e `custoTurnoUsd` nulo conta 0 (Review Focus 3).

`custoPorPessoa`:
- `"Ana@X"` e `"ana@x"` somam juntos;
- linha antiga sem `sessao` não entra.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/metricas-custo.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/metricas-custo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/metricas src/packages/core/test/metricas-custo.test.ts
git commit -m "feat(core): custo do turno a partir do acumulado e custo por etapa e pessoa"
```

---

### Task 4: Classificação do tempo (puro)

**Files:**
- Create: `src/packages/core/src/metricas/tempo.ts`
- Modify: `src/packages/core/src/metricas/tipos.ts`
- Test: `src/packages/core/test/metricas-tempo.test.ts`

**Interfaces:**
- Consumes (Task 3): `LinhaUso`.
- Produces (tipos):

```ts
export interface LinhaPresenca { slug: string; email: string; etapa: EtapaId; em: string; visivel: boolean; segundosSemInteracao: number }
export interface Limites { ociosoMin: number; descarteMin: number }
export type Categoria = "agente" | "ativo" | "ocioso" | "descartado"
export interface BlocoClassificado { slug: string; email: string; etapa: EtapaId; bloco: number; categoria: Categoria }
export interface TempoSegundos { agente: number; ativo: number; ocioso: number; descartado: number }
```

- Produces (funções):
  - `limitesDoAmbiente(env: Record<string, string | undefined>): Limites`, com os padrões `5` e `15`.
  - `classificarTempo(presencas: LinhaPresenca[], usos: LinhaUso[], limites: Limites): BlocoClassificado[]`.
  - `somarTempo(blocos: BlocoClassificado[], chave: (b: BlocoClassificado) => string): Map<string, TempoSegundos>`. Cada bloco vale 30 s.
  - `tempoUtil(t: TempoSegundos): number`, que é `agente + ativo`.

Algoritmo de `classificarTempo`. Ele não sai determinado só da assinatura, então segue aqui:
1. Os blocos de agente vêm de `usos` com `autor` não nulo: todos os blocos de `bloco(inicio)` a `bloco(fim)`, inclusive, para (slug, autor normalizado, etapa do turno). Um turno dentro de um único bloco gera um bloco.
2. Os avisos são agrupados por (slug, email normalizado, bloco). O bloco é **ativo** se algum aviso tem `visivel && segundosSemInteracao < ociosoMin*60`; senão, é **ocioso**. A etapa é a do aviso de maior `em`.
3. Para cada (slug, email), juntam-se os blocos de agente e de aviso. Na mesma chave, o de agente vence.
4. Os blocos de cada (slug, email) são percorridos em ordem crescente. Uma sequência de ociosos **consecutivos**, com números de bloco seguidos, ganha um contador, que zera em qualquer bloco ativo ou de agente e em qualquer salto de numeração (bloco sem aviso). O bloco ocioso cujo índice na sequência (a partir de 0) é `≥ descarteMin*2` vira **descartado**.

- [ ] **Step 1: Escrever os testes que falham**

Com `limites = {ociosoMin: 5, descarteMin: 15}` e helpers para montar avisos a cada 30 s:

| Caso | Esperado |
|---|---|
| aviso visível com 299 s sem interação | ativo |
| aviso visível com 300 s sem interação | ocioso |
| aviso com a aba escondida e 0 s | ocioso |
| 40 min de avisos ociosos seguidos | 30 blocos (15 min) ocioso e 50 descartados |
| 20 min ociosos, 1 ativo, 20 min ociosos | nenhum descartado nas duas sequências até o 30º bloco de cada; o resto descartado |
| duas abas no mesmo bloco, uma ativa e uma ociosa | um bloco, ativo (Review Focus 2) |
| avisos fora de ordem | o mesmo resultado que em ordem (Review Focus 1) |
| turno de 10 min sem nenhum aviso | 20 blocos de agente, na etapa do turno |
| turno de 10 s | 1 bloco de agente (Review Focus 5) |
| turno de 23:59:50 a 00:00:20 | blocos consecutivos, sem duplicar |
| bloco com turno e aviso ativo ao mesmo tempo | um bloco, agente |
| 10 min sem aviso entre dois períodos ociosos | a contagem zera |
| `limitesDoAmbiente({})` | `{5, 15}` |
| `limitesDoAmbiente({ PLANEJAMENTO_OCIOSO_MIN: "abc", PLANEJAMENTO_DESCARTE_MIN: "0" })` | `{5, 15}` |
| `limitesDoAmbiente({ PLANEJAMENTO_OCIOSO_MIN: "3", PLANEJAMENTO_DESCARTE_MIN: "10" })` | `{3, 10}` |

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/metricas-tempo.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/metricas-tempo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/metricas src/packages/core/test/metricas-tempo.test.ts
git commit -m "feat(core): classificação do tempo em agente, ativo, ocioso e descartado"
```

---

### Task 5: Resumo do projeto, médias por etapa e formatos (puro)

**Files:**
- Create: `src/packages/core/src/metricas/resumo.ts`
- Create: `src/packages/core/src/metricas/formato.ts`
- Test: `src/packages/core/test/metricas-resumo.test.ts` e `src/packages/core/test/metricas-formato.test.ts`

**Interfaces:**
- Consumes (Tasks 3 e 4): `custoPorEtapa`, `custoPorPessoa`, `classificarTempo`, `somarTempo`, `tempoUtil` e os tipos.
- Produces:

```ts
export interface MetricasEtapa { custo: CustoEtapa; tempo: TempoSegundos; temPresenca: boolean }
export interface MetricasPessoa { email: string; custoUsd: number; tempo: TempoSegundos }
export interface MetricasProjeto {
  custoUsd: number; estimado: boolean; tempo: TempoSegundos
  porEtapa: Partial<Record<EtapaId, MetricasEtapa>>; porPessoa: MetricasPessoa[]; ultimaAtividade: string | null
}
export interface Estatistica { media: number; mediana: number; min: number; max: number; n: number }
export interface MediaEtapa { custo: Estatistica | null; tempoUtil: Estatistica | null; basePequena: boolean }
export function resumirProjeto(usos: LinhaUso[], presencas: LinhaPresenca[], limites: Limites): MetricasProjeto
export function mediasPorEtapa(projetos: Array<{ metricas: MetricasProjeto; concluidas: EtapaId[]; teste: boolean }>): Partial<Record<EtapaId, MediaEtapa>>
export function compararComMedia(valor: number, media: number | null | undefined): string | null
```

Detalhes de `resumirProjeto`:
- `porPessoa` junta as pessoas com custo e as com tempo, ordenadas por `tempoUtil` decrescente.
- `ultimaAtividade` é o maior entre `fim` dos usos e `em` das presenças, ou `null`.

Detalhes de `mediasPorEtapa`:
- O custo entra quando a etapa está em `concluidas`, o projeto não é teste e a etapa tem custo.
- O tempo entra nas mesmas condições e só quando `temPresenca` é `true` (houve ao menos um aviso de presença na etapa). Assim, uma etapa anterior à medição, que só tem tempo de agente, não puxa a média para baixo.
- `basePequena` é `true` quando `n < 5` em qualquer das duas estatísticas.
- A mediana de uma quantidade par é a média dos dois valores centrais.

Detalhes de `compararComMedia`:
- Devolve `null` sem média ou com média igual a 0.
- Devolve `dentro da média` para a razão entre `0.8` e `1.25`.
- Fora disso, devolve `"<razão com 1 casa e vírgula>× a média"`.

`formato.ts`:
- `formatarUsd(v: number): string` → `US$ 9,80`.
- `formatarDuracao(segundos: number): string` → `3h12`, `3h05`, `45 min`, `< 1 min` (de 1 a 59 s) e `0 min` (0 s).

- [ ] **Step 1: Escrever os testes que falham**

`resumirProjeto`:
- sem uso nem presença → `custoUsd 0`, tempo todo 0, `porEtapa {}`, `porPessoa []` e `ultimaAtividade null` (Review Focus 4);
- com dados de duas etapas e duas pessoas, os totais batem com a soma das partes.

`mediasPorEtapa`:
- custos de 5 projetos concluídos `[1,2,3,4,10]` → `media 4`, `mediana 3`, `min 1`, `max 10`, `n 5`, `basePequena false`;
- 4 projetos com `[1,2,3,4]` → `mediana 2.5`, `basePequena true`;
- projeto teste e etapa não concluída ficam fora;
- etapa concluída só com tempo de agente (`temPresenca: false`) entra no custo e fica fora do tempo.

`compararComMedia`:
- `(7.59, 3.16)` → `"2,4× a média"`;
- `(1.0, 1.1)` → `"dentro da média"`;
- `(1, 0)` → `null`.

Formatos:
- `formatarUsd(9.8)` → `"US$ 9,80"`;
- `formatarDuracao(11520)` → `"3h12"`;
- `formatarDuracao(11100)` → `"3h05"`;
- `formatarDuracao(2700)` → `"45 min"`;
- `formatarDuracao(20)` → `"< 1 min"`;
- `formatarDuracao(0)` → `"0 min"`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/metricas-resumo.test.ts test/metricas-formato.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar a suíte do core**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/metricas src/packages/core/test/metricas-*.test.ts
git commit -m "feat(core): resumo de custo e tempo do projeto, médias por etapa e formatos"
```

---

### Task 6: Gravação e leitura no repositório e no serviço

**Files:**
- Modify:
  - `src/packages/core/src/nuvem/tipos.ts` (`RegistroUsoTurno`, `Repositorio`);
  - `src/packages/core/src/nuvem/memoria.ts`;
  - `src/packages/core/src/nuvem/supabase.ts`.
- Modify:
  - `src/packages/core/src/armazenamento.ts`;
  - `src/packages/core/src/nuvem/armazenamento-nuvem.ts`.
- Modify: `src/packages/core/src/servico-planejamento.ts` e `src/packages/core/src/servico-turnos.ts` (a chamada de `registrarUso`)
- Test:
  - `src/packages/core/test/nuvem/contrato-repositorio.ts`;
  - `src/packages/core/test/nuvem/supabase-fake.test.ts`;
  - `src/packages/core/test/servico-planejamento.test.ts`;
  - `src/packages/core/test/servico-turnos.test.ts`.

**Interfaces:**
- Consumes: `UsoDoTurno.modelos` (Task 2), `custoDoTurno` (Task 3), `LinhaUso` e `LinhaPresenca` (Tasks 3 e 4), `resumirProjeto`, `mediasPorEtapa` e `limitesDoAmbiente` (Tasks 4 e 5).
- Produces:
  - `RegistroUsoTurno` ganha `sessao: string | null`, `modelosAcumulado: Record<string, number> | null` e `esforco: string | null` (vindos do turno), além de `custoTurnoUsd` e `modelos` (calculados pelo serviço).
  - `Repositorio`:
    - `ultimoUsoDaSessao(slug: string, sessao: string): Promise<Acumulado | null>`: o turno mais recente por `fim` com essa `sessao`; `custoUsd` e `modelos` vêm de `custo_usd` e `modelos_acumulado`.
    - `listarUsos(slug?: string): Promise<LinhaUso[]>`: paginado e só de prospects ativos.
    - `registrarPresenca(p: Omit<LinhaPresenca, "em">): Promise<void>`: `em` vem do banco ou do relógio do repositório.
    - `listarPresencas(slug?: string): Promise<LinhaPresenca[]>`: paginado e ordenado por `em`.
  - `FsArmazenamento`: `ultimoUsoDaSessao` → `null`; `listarUsos` e `listarPresencas` → `[]`; `registrarPresenca` → não faz nada. `NuvemArmazenamento` repassa ao repositório.
  - `ServicoPlanejamento`:
    - `registrarUso(r)` lê `ultimoUsoDaSessao` quando há `sessao`, calcula com `custoDoTurno` e grava. O erro continua engolido como hoje (registra e segue).
    - `registrarPresenca(slug: string, email: string, etapa: EtapaId, visivel: boolean, segundosSemInteracao: number): Promise<void>`.
    - `metricasDoProjeto(slug: string, limites: Limites): Promise<MetricasProjeto>`.
    - `metricasGerais(limites: Limites): Promise<{ projetos: Array<ResumoProspect & { metricas: MetricasProjeto }>; medias: Partial<Record<EtapaId, MediaEtapa>> }>`: inclui todos os prospects ativos (com os de teste, marcados), e as médias usam `estado.etapas[id].status === "concluida"`.
  - `ServicoTurnos` passa `sessao: ev.sessionId ?? sessionId ?? null`, `modelosAcumulado: ev.uso?.modelos ?? null` e `esforco: null`.

- [ ] **Step 1: Escrever os testes que falham**

Contrato (memória e suíte viva):
- `registrarUso` com sessão e `ultimoUsoDaSessao` devolvem o último acumulado da sessão;
- `listarUsos` traz as colunas novas;
- `registrarPresenca` seguido de `listarPresencas(slug)` devolve em ordem;
- prospect excluído não aparece em nenhuma das duas listas.

Serviço:
- dois turnos da mesma sessão, com acumulado `0.3` e depois `0.5`, gravam `custoTurnoUsd` `0.3` e `0.2`;
- turno sem sessão grava `custoTurnoUsd = custoUsd` (Review Focus 3);
- `metricasGerais` exclui o cliente de teste das médias, mas o lista com `teste: true`.

Turnos (`servico-turnos.test.ts`): com o executor falso emitindo `fim` com `uso.modelos`, o registro gravado leva `sessao` e `modelosAcumulado`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/servico-planejamento.test.ts test/servico-turnos.test.ts test/nuvem`
Expected: FAIL

- [ ] **Step 3: Implementar.** Não rodar `test:supabase`: as colunas só existem depois da migração da Task 9.

- [ ] **Step 4: Rodar a suíte do core e do web e conferir os tipos**

Run: `npm test` (core), `npm test` (web) e `npm run typecheck` (web).
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): grava custo por turno e presença, e monta as métricas do projeto"
```

---

### Task 7: Rotas de presença e de métricas

**Files:**
- Create:
  - `src/apps/web/app/api/prospects/[slug]/presenca/route.ts` (`POST`);
  - `src/apps/web/app/api/admin/projetos/route.ts` (`GET`);
  - `src/apps/web/app/api/admin/projetos/[slug]/route.ts` (`GET`).
- Modify: `src/apps/web/app/api/rotas-exigem-usuario.test.ts` (a contagem de rotas de prospect passa de 18 para 19)
- Modify: `src/apps/web/lib/api.ts`
- Test: `src/apps/web/app/api/admin/projetos.test.ts` e `src/apps/web/app/api/presenca.test.ts`

**Interfaces:**
- Consumes (Task 6): `servico.registrarPresenca`, `servico.metricasDoProjeto`, `servico.metricasGerais`; `limitesDoAmbiente(process.env)`; `exigirAcessoAoProspect` e `exigirAdmin`; o helper `usuariosDaNuvem` em `app/api/admin/usuarios-da-nuvem.ts`, como modelo do 400 no modo fs.
- Produces:
  - `POST /api/prospects/[slug]/presenca` com `{ etapa, visivel, segundosSemInteracao }` → 204.
    - 400 quando a etapa não está em `ORDEM_ETAPAS`, `visivel` não é booleano ou `segundosSemInteracao` não é inteiro de 0 a 86400.
    - O e-mail vem do usuário da sessão. No modo `off`, `email` é null, e o aviso é aceito e descartado.
    - No modo `fs`, também é aceito e descartado.
  - `GET /api/admin/projetos` → o retorno de `metricasGerais`.
  - `GET /api/admin/projetos/[slug]` → `{ projeto: ResumoProspect, metricas: MetricasProjeto, medias }`.
    - 404 `Projeto não encontrado.` para um prospect inexistente.
  - No modo fs, as duas rotas de admin respondem 400 com a mensagem do Global Constraints.
  - `lib/api.ts`: `api.enviarPresenca(slug, corpo)` (com `keepalive: true` e sem lançar), `api.metricasGerais()` e `api.metricasDoProjeto(slug)`.

- [ ] **Step 1: Escrever os testes que falham**

Com memória por trás, no padrão de `acesso-prospect.test.ts`:
- presença de um usuário no próprio projeto → 204, e a linha gravada leva o e-mail da sessão;
- num projeto alheio → 404;
- `segundosSemInteracao: -1`, `86401` ou `"10"` → 400;
- `etapa: "99"` → 400;
- usuário comum nas rotas de admin → 403;
- admin recebe a lista com as médias e o detalhe;
- detalhe de slug inexistente → 404.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run app/api`
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar a suíte do web e conferir os tipos**

Run: `npm test` e `npm run typecheck`
Expected: PASS. A varredura classifica as rotas novas.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/app/api src/apps/web/lib/api.ts
git commit -m "feat(web): rota de presença e rotas de métricas para o admin"
```

---

### Task 8: Telas (aviso de presença, aba Projetos, detalhe e selo)

**Files:**
- Create: `src/apps/web/components/trabalho/aviso-presenca.tsx` (componente invisível) e `src/apps/web/lib/presenca.ts` (lógica pura)
- Create:
  - `src/apps/web/app/admin/projetos/page.tsx`;
  - `src/apps/web/app/admin/projetos/[slug]/page.tsx`;
  - `src/apps/web/components/admin/painel-projetos.tsx`;
  - `src/apps/web/components/admin/detalhe-projeto.tsx`.
- Create: `src/apps/web/components/trabalho/selo-custo.tsx`
- Modify:
  - `src/apps/web/components/admin/abas-admin.tsx` (aba "Projetos", em `/admin/projetos`);
  - `src/apps/web/components/marca/barra-topo.tsx` (prop opcional `extra?: ReactNode`, antes de `MenuConta`);
  - `src/apps/web/components/trabalho/area-de-trabalho.tsx` (monta o `AvisoPresenca` para todos e passa o `SeloCusto` em `extra` só quando `usePapel() === "admin"`).
- Test: `src/apps/web/lib/presenca.test.ts`

**Interfaces:**
- Consumes:
  - Task 7: `api.enviarPresenca`, `api.metricasGerais`, `api.metricasDoProjeto`;
  - Task 5: `formatarUsd`, `formatarDuracao`, `compararComMedia`, `tempoUtil`, de `@workspace/core/metricas/*`;
  - `usePapel()` de `conta-contexto`.
- Produces: `criarMedidorPresenca(agora: () => number): { registrarInteracao(): void; corpo(etapa: EtapaId, visivel: boolean): { etapa; visivel; segundosSemInteracao } }`. É puro e testável; `segundosSemInteracao` é arredondado para baixo.

`AvisoPresenca({ slug, etapa })`:
- Escuta `keydown`, `pointerdown`, `wheel` e `scroll` (na captura), e também `pointermove`, este limitado a no máximo um registro a cada 5 s.
- Envia um aviso a cada 30 s e outro em cada `visibilitychange`.
- Para tudo ao desmontar. Não renderiza nada.
- `etapa` é a etapa mostrada no momento na área de trabalho.

Telas de admin:
- Ficam sob o `admin/layout.tsx` existente, que já redireciona quem não é admin.
- As páginas carregam os dados no cliente pela `api`.
- `/admin/projetos` mostra "Médias por etapa" (com o aviso de base pequena) e a lista com busca. Ela é ordenada por `ultimaAtividade` decrescente, com projetos sem atividade no fim. Clicar abre `/admin/projetos/[slug]`.
- O detalhe mostra:
  - no topo, os quatro números;
  - a tabela por etapa, com a marca "estimado" e `compararComMedia`;
  - a tabela por pessoa;
  - o botão "Abrir projeto";
  - `Sem uso registrado ainda` quando não há turno nem presença.
- No modo fs, as duas mostram a mensagem de "só na nuvem" que vem da API.

`SeloCusto({ slug, etapa })`:
- Busca `api.metricasDoProjeto(slug)` ao montar e a cada 60 s.
- Mostra `US$ x · <tempo útil> úteis`. O tooltip traz o custo e o tempo da etapa aberta.
- É um link para `/admin/projetos/[slug]`. Some quando há erro.

- [ ] **Step 1: Escrever os testes que falham** (`presenca.test.ts`)
  - sem interação, 30 s depois do início, o corpo dá `segundosSemInteracao: 30`;
  - `registrarInteracao` zera esse valor;
  - `visivel` é repassado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/presenca.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar.** Seguir os componentes de `@workspace/ui/components/*` que as telas de admin já usam (`table`, `tooltip`).

- [ ] **Step 4: Rodar a suíte do web e conferir os tipos**

Run: `npm test` e `npm run typecheck`
Expected: PASS. A varredura de páginas aceita as páginas novas, que não chamam `servidor()`.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): aba Projetos com custos, tempo e médias, selo no projeto e aviso de presença"
```

---

### Task 9: Aplicação no Supabase, deploy e aceitação

Feita pelo controlador com o analista. Não é delegada.

- [ ] **Step 1:** Mostrar ao analista o SQL de `20261108120000_custos_e_tempo.sql`. Com o OK, aplicar pelo MCP (`apply_migration`, nome `planejamento_custos_e_tempo`). Conferir com `select column_name from information_schema.columns where table_schema='planejamento' and table_name in ('uso_turnos','presenca')`.
- [ ] **Step 2:** Rodar `npm run test:supabase` (core). Expected: PASS, e nenhuma linha de teste sobrando em `presenca`.
- [ ] **Step 3:** Abrir o PR. Depois do merge, o analista roda na VPS:
  `cd /opt/planejamento/app && git pull && docker build -t planejamento:vps . && cd .. && docker compose up -d app`.
- [ ] **Step 4:** Aceitação com o analista:
  1. um projeto aberto 10 min com uso normal;
  2. 20 min parado (5 min ociosos, 15 ociosos e depois descarte);
  3. um turno do agente;
  4. conferir a lista, o detalhe, o selo e as médias;
  5. confirmar que uma conta comum não vê selo nem aba.
