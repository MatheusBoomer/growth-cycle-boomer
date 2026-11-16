# Modo ensaiado do cliente de teste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cliente de teste marcado como ensaio responde com uma rodada real gravada, tocada acelerada, enquanto cards, aprovações e etapas funcionam de verdade.

**Architecture:** Um executor novo (`ensaio`) implementa a interface `Executor` e é escolhido por prospect quando `estado.teste.ensaio` é verdadeiro. Cada turno do prospect consome o próximo trecho do `roteiro.json` da etapa, gravado antes por um invólucro do executor real e montado por um script. Toda ação do analista (mensagem, Aprovar, Pedir ajuste…) já vira um turno no app (aprovar e ajustar enfileiram mensagem), então "um turno = um trecho" cobre o roteiro inteiro.

**Tech Stack:** TypeScript, Next.js (apps/web), vitest, pacote `@workspace/core`.

**Spec:** `docs/superpowers/specs/2026-11-16-modo-ensaiado-design.md`

## Global Constraints

- Esperas gravadas tocam a 25% do tempo original e nenhuma passa de 2000 ms (`FATOR_TEMPO = 0.25`, `ESPERA_MAXIMA_MS = 2000`).
- O ensaio só vale para prospect com `estado.teste.ensaio === true`; sem a flag, o executor configurado no servidor (`PLANEJAMENTO_EXECUTOR`) segue igual.
- O ensaio nunca chama o Claude: o executor de ensaio não abre processo nem SDK.
- Pacote por etapa em `clientes/_fixtures/<fixture>/ensaio/<etapa>/` com `roteiro.json` e `arquivos/`.
- Aviso de ação fora do roteiro, exato: `Fora do roteiro: use Avançar ensaio ou reinicie a etapa.`
- Resposta quando o roteiro da etapa acabou, exata: `O ensaio desta etapa terminou. Use Concluir etapa, ou o seletor de etapa para recomeçar.`
- Rótulos de interface exatos: opção `Modo ensaiado`, selo `Ensaio`, botão `Avançar ensaio`.
- Tudo que é de ensaio exige admin (mesma regra de `/api/cliente-teste` e `/api/prospects/[slug]/teste`).
- Texto em PT-BR sem travessão (`test/sem-travessao.test.ts` verifica).
- Trabalhar numa branch nova a partir de `main` (`feat/modo-ensaiado`); conferir a branch antes de cada commit.

## Review Focus

1. **Avançar ensaio aprovando vários pendentes de uma vez:** a fila junta itens da mesma etapa num turno só, o que consumiria um trecho para várias aprovações. Esperado: aprovar um pendente por vez e só aprovar o próximo quando o turno anterior terminar (teste na Task 6).
2. **Rascunho no lugar certo antes da ferramenta:** na nuvem o disco é sincronizado pela mesa. O arquivo do pacote precisa estar em `<cwd>/clientes/<slug>/.app/rascunhos/...` antes de chamar `propor_entregavel`, senão a ferramenta recusa (teste na Task 3).
3. **Etapa sem pacote de ensaio:** esperado aviso de erro no chat e `turno_fim` com `status: "erro"`, sem travar o prospect (teste na Task 4).
4. **Reposicionar o teste no meio do ensaio:** o índice do trecho da etapa volta a 0 e `avancando` é limpo (teste na Task 2).
5. **Prospect comum com o mesmo fluxo:** nunca usa o executor de ensaio, nem se alguém chamar a rota de avançar (rota responde 409 `ErroNaoEhTeste`, teste na Task 6).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/packages/core/src/ensaio/roteiro.ts` (novo) | Tipos do pacote, leitura do `roteiro.json`, classificação do gatilho de um turno |
| `src/packages/core/src/ensaio/montar.ts` (novo) | Gravação → roteiro (função pura) |
| `src/packages/core/src/executor/ensaio.ts` (novo) | Executor que toca um trecho |
| `src/packages/core/src/executor/gravador.ts` (novo) | Invólucro que grava turnos reais |
| `src/packages/core/scripts/ensaio-montar.ts` (novo) | CLI que chama `montar.ts` |
| `src/packages/core/src/executor/tipos.ts` | `PedidoTurno.contexto` |
| `src/packages/core/src/tipos.ts` | `Estado.teste.ensaio`, índice de trechos, `avancando` |
| `src/packages/core/src/servico-planejamento.ts` | Criar teste com ensaio, consumir trecho, gatilho do próximo trecho, avançar |
| `src/packages/core/src/servico-teste.ts` | Reposicionar zera o ensaio da etapa |
| `src/packages/core/src/servico-turnos.ts` | Escolher executor por prospect, avisos, encadear o Avançar |
| `src/apps/web/lib/servidor.ts` | Montar executor de ensaio e gravador |
| `src/apps/web/app/api/cliente-teste/route.ts` | Aceitar `ensaio` |
| `src/apps/web/app/api/prospects/[slug]/teste/ensaio/route.ts` (novo) | GET gatilho, POST avançar |
| `src/apps/web/components/home/dialogo-cliente-teste.tsx` | Opção Modo ensaiado |
| `src/apps/web/components/teste/faixa-teste.tsx` | Selo Ensaio e botão Avançar ensaio |
| `src/apps/web/components/chat/compositor.tsx` | Texto preenchido |
| `src/apps/web/lib/api.ts` | Chamadas novas |

---

### Task 1: Formato do pacote e leitura do roteiro

**Files:**
- Create: `src/packages/core/src/ensaio/roteiro.ts`
- Test: `src/packages/core/test/ensaio-roteiro.test.ts`

**Interfaces:**
- Produces:
  - `type TipoGatilho = "mensagem" | "aprovar" | "ajuste" | "automatica"`
  - `interface EventoGravado { dtMs: number; evento: EventoExecutor }` (eventos `sessao`, `uso`, `limite` e `fim` não entram no pacote)
  - `interface ChamadaGravada { dtMs: number; ferramenta: string; entrada: Record<string, unknown> }` (nome sem o prefixo `mcp__planejamento__`)
  - `interface TrechoEnsaio { gatilho: TipoGatilho; textoPreenchido: string | null; passos: (EventoGravado | ChamadaGravada)[] }`
  - `interface RoteiroEnsaio { versao: 1; etapa: EtapaId; trechos: TrechoEnsaio[] }`
  - `function pastaEnsaio(raiz: string, fixture: string, etapa: EtapaId): string` → `<raiz>/clientes/_fixtures/<fixture>/ensaio/<etapa>`
  - `async function carregarRoteiro(raiz: string, fixture: string, etapa: EtapaId): Promise<RoteiroEnsaio>`: lança `ErroFixture` com mensagem que cita o caminho quando falta o arquivo ou o JSON é inválido
  - `function classificarGatilho(mensagem: string, automatica: boolean): TipoGatilho`: `"aprovar"` se a mensagem começa com `O analista APROVOU`; `"ajuste"` se contém `AJUSTE no entregável`; senão `"automatica"` quando `automatica`, senão `"mensagem"`

- [ ] **Step 1: Write the failing tests**
  - `classificarGatilho` com `mensagemAprovacao("T","n","d")` → `"aprovar"`; com `mensagemAjuste("T","n","x")` e com `mensagemAjustes("x",[…])` → `"ajuste"`; `"oi"` com `false` → `"mensagem"`; `"oi"` com `true` → `"automatica"`.
  - `carregarRoteiro` lê um roteiro gravado num diretório temporário e devolve os trechos; pasta sem `roteiro.json` → rejeita com `ErroFixture` cuja mensagem contém `ensaio/03/roteiro.json`; JSON com `versao: 2` → rejeita.
- [ ] **Step 2: Run** `npx vitest run test/ensaio-roteiro.test.ts` em `src/packages/core`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** em `src/ensaio/roteiro.ts`, importando os construtores de mensagem de `prompts.ts` só nos testes.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): formato e leitura do roteiro de ensaio`

### Task 2: Flag de ensaio no estado e no cliente de teste

**Files:**
- Modify: `src/packages/core/src/tipos.ts:162` (`teste?`)
- Modify: `src/packages/core/src/servico-planejamento.ts:812-840`
- Modify: `src/packages/core/src/servico-teste.ts` (`reposicionarNoFixture`)
- Test: `src/packages/core/test/servico-cliente-teste.test.ts`

**Interfaces:**
- Produces:
  - `Estado.teste?: { fixture: string; etapaInicial: EtapaId; ensaio?: boolean; trechos?: Partial<Record<EtapaId, number>>; avancando?: EtapaId | null }`
  - `criarClienteTeste(fixtureId: string, etapaInicial?: EtapaId, autor?: string | null, ensaio = false): Promise<string>`
  - `ServicoPlanejamento.consumirTrechoEnsaio(slug: string, etapa: EtapaId): Promise<number>`: devolve o índice atual e grava índice + 1 (sob `mutar`)
  - `ServicoPlanejamento.gatilhoEnsaio(slug: string, etapa: EtapaId): Promise<{ gatilho: TipoGatilho; textoPreenchido: string | null } | null>`: o trecho no índice atual; `null` se não for ensaio ou o roteiro acabou
  - `reposicionarNoFixture` preserva `ensaio` e zera `trechos[etapa]` e `avancando` para a etapa escolhida e as seguintes

- [ ] **Step 1: Write the failing tests**
  - `criarClienteTeste("mini", "03", null, true)` → `estado.teste.ensaio === true`; sem o 4º argumento → `ensaio` ausente ou `false`.
  - `consumirTrechoEnsaio` três vezes na `"03"` devolve 0, 1, 2.
  - Depois de consumir 2 trechos na 03 e chamar `reposicionarTeste(slug, "03")`, `consumirTrechoEnsaio` devolve 0 e `teste.avancando` é `null`; `ensaio` continua `true`.
  - `gatilhoEnsaio` com um roteiro de 2 trechos no fixture de teste devolve o gatilho do índice 0, depois do 1, depois `null`.
- [ ] **Step 2: Run** `npx vitest run test/servico-cliente-teste.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Para o teste do `gatilhoEnsaio`, faça `criarFixtureMinimo` (`test/fixture-minimo.ts`) gravar também `ensaio/03/roteiro.json` com 2 trechos (`"mensagem"` com `textoPreenchido: "Segue a planilha."` e `"aprovar"` sem texto), cada um com um passo `texto`.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): cliente de teste com modo ensaiado e índice de trechos`

### Task 3: Executor de ensaio

**Files:**
- Modify: `src/packages/core/src/executor/tipos.ts` (`PedidoTurno`)
- Create: `src/packages/core/src/executor/ensaio.ts`
- Test: `src/packages/core/test/executor-ensaio.test.ts`

**Interfaces:**
- Consumes: Task 1 (`RoteiroEnsaio`, `TrechoEnsaio`, `pastaEnsaio`).
- Produces:
  - `PedidoTurno.contexto?: { slug: string; etapa: EtapaId; fixture: string | null; trecho: TrechoEnsaio | null; textoAnalista: string | null }` (preenchido pelo ServicoTurnos, Task 4)
  - `const FATOR_TEMPO = 0.25`, `const ESPERA_MAXIMA_MS = 2000`
  - `function criarExecutorEnsaio(opcoes: { dormir?: (ms: number) => Promise<void>; chamarFerramenta?: (pedido: PedidoTurno, nome: string, entrada: unknown) => Promise<string> }): Executor`
    - padrão de `chamarFerramenta`: POST em `${PLANEJAMENTO_APP_URL}/api/interno/ferramentas` com o token do `mcpConfig`, como `criarExecutorDemo`
  - Comportamento por turno: `sessao` com id fixo `ensaio-<slug>-<etapa>`; para cada passo, `dormir(min(dtMs * FATOR_TEMPO, ESPERA_MAXIMA_MS))`; `EventoGravado` é reemitido; `ChamadaGravada` primeiro copia, se a entrada tiver `arquivo_rascunho`, o arquivo de `<pastaEnsaio>/arquivos/<basename>` para `<cwd>/clientes/<slug>/.app/rascunhos/<basename>`, reescreve `arquivo_rascunho` para esse caminho e então chama a ferramenta e emite `ferramenta` + `ferramenta_resultado`; termina com `fim` ok
  - `contexto.trecho === null` → um `texto` com a resposta fixa de fim de roteiro (Global Constraints) e `fim` ok
  - Arquivo do pacote ausente → `fim` com `ok: false` e `erro` citando o caminho

- [ ] **Step 1: Write the failing tests** (com `dormir` falso que registra os ms pedidos e `chamarFerramenta` falso)
  - Trecho com `texto_delta`(dt 400), `texto`(dt 10000), chamada `propor_entregavel`(dt 100) → eventos na ordem `sessao, texto_delta, texto, ferramenta, ferramenta_resultado, fim`; esperas pedidas `[100, 2000, 25]`.
  - Antes da chamada, o arquivo existe em `<cwd>/clientes/<slug>/.app/rascunhos/grafico.png` e a entrada recebida por `chamarFerramenta` tem `arquivo_rascunho` apontando para ele.
  - `trecho: null` → um `texto` igual à resposta fixa e `fim` ok, sem chamar ferramenta.
  - Arquivo citado ausente em `arquivos/` → último evento `fim` com `ok: false` e `erro` contendo `arquivos/grafico.png`.
- [ ] **Step 2: Run** `npx vitest run test/executor-ensaio.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/executor/ensaio.ts`.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): executor de ensaio`

### Task 4: Turnos escolhem o executor por prospect

**Files:**
- Modify: `src/packages/core/src/servico-turnos.ts:60-70` (`DependenciasTurnos`), `:442-520` (`rodarTurno`)
- Modify: `src/apps/web/lib/servidor.ts:148-160`
- Test: `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Consumes: Task 2 (`consumirTrechoEnsaio`), Task 3 (`PedidoTurno.contexto`, `criarExecutorEnsaio`), Task 1 (`carregarRoteiro`, `classificarGatilho`).
- Produces:
  - `DependenciasTurnos.executorEnsaio?: Executor`
  - Em `rodarTurno`: se `estado.teste?.ensaio` e há `executorEnsaio`, consome o índice, carrega o roteiro, monta `contexto` com o trecho do índice (ou `null` se acabou) e usa `executorEnsaio`; senão, o executor de sempre com `contexto` sem trecho. `textoAnalista` é o texto do último `mensagem_analista` não automático da conversa da etapa no início do turno.
  - Se o gatilho do turno (`classificarGatilho(texto, automática)`) difere de `trecho.gatilho`, registra `aviso` nível `"alerta"` com o texto exato de fora do roteiro e toca o trecho mesmo assim.
  - Roteiro inexistente (`ErroFixture`): registra `aviso` nível `"erro"` com a mensagem do erro e `turno_fim` `"erro"`.
  - `servidor.ts` passa `executorEnsaio: criarExecutorEnsaio({})`.

- [ ] **Step 1: Write the failing tests**
  - Prospect sem `teste.ensaio`: o `FakeExecutor` principal recebe o pedido; o de ensaio não.
  - Prospect com `ensaio`: o executor de ensaio recebe `contexto.trecho` igual ao trecho 0 e, no turno seguinte, ao trecho 1.
  - Turno de aprovação onde o trecho espera `"ajuste"`: a conversa tem um `aviso` com `Fora do roteiro: use Avançar ensaio ou reinicie a etapa.`
  - Ensaio numa etapa sem pacote: a conversa termina com `aviso` `"erro"` e `turno_fim` `"erro"`, e o prospect aceita um turno novo depois.
- [ ] **Step 2: Run** `npx vitest run test/servico-turnos.test.ts`. Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` em `src/packages/core`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): turnos usam o executor de ensaio no cliente ensaiado`

### Task 5: Gravador e montagem do roteiro

**Files:**
- Create: `src/packages/core/src/executor/gravador.ts`
- Create: `src/packages/core/src/ensaio/montar.ts`
- Create: `src/packages/core/scripts/ensaio-montar.ts`
- Modify: `src/apps/web/lib/servidor.ts` (embrulhar o executor real quando `PLANEJAMENTO_GRAVAR_ENSAIO=1`)
- Test: `src/packages/core/test/gravador-ensaio.test.ts`, `src/packages/core/test/ensaio-montar.test.ts`

**Interfaces:**
- Consumes: Task 1 (tipos), Task 3 (`PedidoTurno.contexto`).
- Produces:
  - `interface LinhaGravacao { mensagem: string; automatica: boolean; textoAnalista: string | null; eventos: { tMs: number; evento: EventoExecutor }[] }` (`tMs` desde o início do turno)
  - `class GravadorExecutor implements Executor { constructor(interno: Executor, opcoes: { raiz: string; agora?: () => number }) }`: repassa todos os eventos; só grava quando `pedido.contexto?.fixture` existe; ao fim do turno acrescenta uma `LinhaGravacao` em `<pastaEnsaio>/gravacao.jsonl` e copia para `<pastaEnsaio>/arquivos/` cada arquivo citado em `arquivo_rascunho` das ferramentas `propor_entregavel` e `propor_validacao_cliente` (lido de `<cwd>/clientes/<slug>/`)
  - `function montarRoteiro(etapa: EtapaId, linhas: LinhaGravacao[]): RoteiroEnsaio`: um trecho por linha; `gatilho = classificarGatilho(mensagem, automatica)`; `textoPreenchido = textoAnalista` quando o gatilho é `"mensagem"` ou `"ajuste"`, senão `null`; `dtMs` = diferença de `tMs` para o evento anterior; `ferramenta` de `mcp__planejamento__*` vira `ChamadaGravada` com `arquivo_rascunho` reduzido ao basename; descarta `sessao`, `uso`, `limite`, `fim` e `ferramenta_resultado`; demais `ferramenta` (Read, Bash…) ficam como `EventoGravado` para a tela mostrar a atividade
  - Script: `npx tsx scripts/ensaio-montar.ts <fixture> <etapa>` lê `gravacao.jsonl` e grava `roteiro.json` formatado (2 espaços), sem apagar `arquivos/`

- [ ] **Step 1: Write the failing tests**
  - Gravador com `FakeExecutor` que emite `ferramenta` `mcp__planejamento__propor_entregavel` com `arquivo_rascunho: "clientes/<slug>/.app/rascunhos/g.png"`: depois do turno existe `gravacao.jsonl` com 1 linha e `arquivos/g.png`; sem `contexto.fixture`, nada é gravado.
  - `montarRoteiro` com duas linhas (uma mensagem livre, uma aprovação) → 2 trechos, gatilhos `"mensagem"` e `"aprovar"`, `textoPreenchido` só no primeiro; `dtMs` corretos; `arquivo_rascunho` reduzido a `g.png`; nenhum passo `sessao` ou `fim`.
- [ ] **Step 2: Run** os dois testes. Expected: FAIL.
- [ ] **Step 3: Implement** os três arquivos e o embrulho em `servidor.ts`.
- [ ] **Step 4: Run** `npm test` em `src/packages/core`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): gravador de turnos e montagem do roteiro de ensaio`

### Task 6: Avançar ensaio

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts`
- Modify: `src/packages/core/src/servico-turnos.ts` (fim do turno)
- Create: `src/apps/web/app/api/prospects/[slug]/teste/ensaio/route.ts`
- Test: `src/packages/core/test/servico-turnos.test.ts`, `src/apps/web/app/api/prospects/[slug]/teste/ensaio/route.test.ts`

**Interfaces:**
- Consumes: Task 2, Task 4.
- Produces:
  - `ServicoPlanejamento.avancarEnsaio(slug: string, etapa: EtapaId, autor: string | null): Promise<void>`: lança `ErroNaoEhTeste` sem `teste.ensaio`; grava `teste.avancando = etapa`; aprova **um** entregável pendente da etapa (o mais antigo) via `aprovarEntregavel`; sem pendente, enfileira a mensagem automática `Siga para o próximo passo.` para disparar o trecho seguinte
  - Em `ServicoTurnos`, ao fim de um turno de ensaio com `teste.avancando === etapa`: se ainda há trecho e há pendente na etapa, chama `avancarEnsaio` de novo; se o roteiro acabou ou a etapa ficou pronta para concluir, grava `avancando = null`
  - Rota `GET /api/prospects/[slug]/teste/ensaio?etapa=NN` → `{ gatilho: TipoGatilho; textoPreenchido: string | null } | null` (admin)
  - Rota `POST /api/prospects/[slug]/teste/ensaio` com `{ etapa }` → `{ ok: true }` (admin; 409 sem ensaio)

- [ ] **Step 1: Write the failing tests**
  - Com dois entregáveis pendentes, `avancarEnsaio` aprova só o mais antigo; o segundo só é aprovado depois que o turno disparado pela primeira aprovação termina.
  - Quando o último trecho toca, `teste.avancando` volta a `null` e nenhuma aprovação nova acontece.
  - Rota POST em prospect comum → 409; usuário não admin → 403; GET devolve o gatilho do trecho atual.
- [ ] **Step 2: Run** os testes. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` em `src/packages/core` e `src/apps/web`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: avançar ensaio aprova e toca os trechos até o fim da etapa`

### Task 7: Interface do ensaio

**Files:**
- Modify: `src/apps/web/app/api/cliente-teste/route.ts` (aceita `ensaio?: boolean`)
- Modify: `src/apps/web/components/home/dialogo-cliente-teste.tsx`
- Modify: `src/apps/web/components/teste/faixa-teste.tsx`
- Modify: `src/apps/web/components/chat/compositor.tsx`
- Modify: `src/apps/web/lib/api.ts`
- Test: `src/apps/web/app/api/cliente-teste/route.test.ts`

**Interfaces:**
- Consumes: Task 6 (rotas), Task 2 (`teste.ensaio` no estado que o front já recebe em `RespostaEstado`).
- Produces:
  - `api.criarClienteTeste(etapa, ensaio)`, `api.gatilhoEnsaio(slug, etapa)`, `api.avancarEnsaio(slug, etapa)`
  - Diálogo: checkbox `Modo ensaiado`, desmarcado por padrão, com a descrição `O agente é substituído pela rodada gravada; nada chama o Claude.`
  - Faixa de teste: com `teste.ensaio`, selo `Ensaio` e botão `Avançar ensaio` (desabilitado com turno ativo)
  - Compositor: com `teste.ensaio`, sem turno ativo e caixa vazia, busca `gatilhoEnsaio` e, se o gatilho for `"mensagem"` ou `"ajuste"`, preenche a caixa com `textoPreenchido` (só uma vez por trecho; o analista pode apagar)

- [ ] **Step 1: Write the failing test**: POST `/api/cliente-teste` com `{ etapa: "03", ensaio: true }` chama `criarClienteTeste` com o 4º argumento `true`; `ensaio` não booleano → 400.
- [ ] **Step 2: Run** `npx vitest run app/api/cliente-teste/route.test.ts` em `src/apps/web`. Expected: FAIL.
- [ ] **Step 3: Implement** rota, `api.ts`, diálogo, faixa e compositor.
- [ ] **Step 4: Run** `npm test` em `src/apps/web` e, no app local (`PLANEJAMENTO_AUTH=off PLANEJAMENTO_DADOS=fs`), criar um Verdeluz ensaiado na 03 com um roteiro de 2 trechos feito à mão: o selo aparece, a caixa vem preenchida, enviar toca o trecho, Avançar ensaio aprova e toca o seguinte. Expected: tudo como descrito, sem erro no console.
- [ ] **Step 5: Commit** `feat(web): modo ensaiado no cliente de teste`

### Task 8: Gravar, montar e ensaiar o Verdeluz

Sem código novo; é a produção do conteúdo e a entrega.

- [ ] **Step 1:** App local com o agente real e `PLANEJAMENTO_GRAVAR_ENSAIO=1`; criar o Verdeluz comum (sem Modo ensaiado) na 01 e rodar 01 a 08 e a apresentação final seguindo as notas de demo dos decks (na 02 responder 2 perguntas; na 03 pedir ajuste no gráfico 1 e aprovar o 2; na final comentar um slide do roteiro e uma área do deck).
- [ ] **Step 2:** `npx tsx scripts/ensaio-montar.ts verdeluz <etapa>` para cada etapa; revisar cada `roteiro.json` (encurtar textos longos, conferir `textoPreenchido`).
- [ ] **Step 3:** Ensaio completo local, sem `PLANEJAMENTO_GRAVAR_ENSAIO`, etapa por etapa, conferindo que nenhum turno chama o Claude (custo do projeto continua zero no selo de admin).
- [ ] **Step 4:** Commit do pacote `clientes/_fixtures/verdeluz/ensaio/` (`chore(fixture): roteiros de ensaio do Verdeluz`); PR, merge e `~/bin/vps-deploy deploy`.
- [ ] **Step 5:** Ensaio completo no app no ar antes do treinamento.
