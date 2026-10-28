# Fase C — Colocar o app no ar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app roda num contêiner Linux (Docker) com tudo que o agente precisa, desliga com segurança, funciona na nuvem sem os recursos que só existem no Mac, e as duas pendências da Fase B ficam fechadas. O deploy no provedor é o último passo e espera a escolha do provedor.

**Architecture:** Código novo pequeno no `core` e no app web (rota de saúde, drenagem de turnos, tratamento de `SIGTERM`, ajustes de `/api/sistema` e de interface, ambiente reduzido do agente) e arquivos de empacotamento na raiz (`Dockerfile`, `docker/entrypoint.sh`, `.dockerignore`, `docker/requirements.txt`). O contêiner é testado localmente com o Docker (Colima) antes de qualquer provedor.

**Tech Stack:** TypeScript, Next 16 (`proxy.ts`, `instrumentation.ts`), Vitest 5, Docker (imagem Debian 12 com Node 22), Python 3 em venv, LibreOffice, poppler, ImageMagick, ffmpeg, pandoc.

**Spec:** `docs/superpowers/specs/2026-10-27-fase-c-no-ar-design.md` (seção 3 é a planta da imagem; seção 4 os componentes; seção 6 os testes). As Fases A e B estão na `main`.

## Global Constraints

- Sem nenhuma variável nova, o comportamento é o de antes (modo local, pastas em disco, sem login). Os testes atuais seguem passando (`cd src && npx turbo run test typecheck`).
- Variáveis fixas da imagem: `PLANEJAMENTO_ROOT=/app`, `CLAUDE_CONFIG_DIR=/data/claude`, `HOME=/data/home`, `PLANEJAMENTO_EXECUTOR=sdk`, `PLANEJAMENTO_DADOS=supabase`, `PLANEJAMENTO_AUTH=google`, `NEXT_MANUAL_SIG_HANDLE=true`, `PLANEJAMENTO_URL_INTERNA=http://127.0.0.1:$PORT`, `PORT` padrão 3000. Segredos (`ANTHROPIC_API_KEY`, `SUPABASE_*`, `PLANEJAMENTO_APP_URL`, `APIFY_TOKEN`, `FIRECRAWL_API_KEY`) só entram por variável de ambiente em tempo de execução: nunca no `Dockerfile`, na imagem, no git nem em log.
- `/api/saude` responde `200 { "ok": true }`, só `GET`/`HEAD`, sem nenhum dado, livre para qualquer host, `cache-control: no-store`.
- Mensagens exatas: turno recusado durante o desligamento = `O servidor está reiniciando. Tente de novo em instantes.` (503, código `reiniciando`); aviso de sistema na nuvem sem chave = `Falta a chave da API do agente (ANTHROPIC_API_KEY).`
- Drenagem: prazo `PLANEJAMENTO_DRENAGEM_MS` (padrão 300000; valor inválido ou menor que 1000 = padrão). Depois do `SIGTERM` não nasce turno novo, nem pela fila.
- Ambiente do subprocesso do agente: lista de permissão. Passam apenas `PATH`, `HOME`, `LANG`, `LC_*`, `TZ`, `TMPDIR`, `VIRTUAL_ENV`, `PYTHON*`, `SSL_CERT_FILE`, `NO_PROXY`/`HTTP_PROXY`/`HTTPS_PROXY` (e minúsculas), `CLAUDE_*`, `ANTHROPIC_*`, `APIFY_*` e `FIRECRAWL_*`. Nenhuma variável `SUPABASE_*` passa.
- Imagem: usuário sem privilégio para o app e o agente (o `entrypoint.sh` começa como root só para preparar `/data` e baixa o privilégio com `gosu`); `tini` como processo 1; sem `.env*` nem dados de prospects em nenhuma camada.
- Código, nomes e comentários em português, no estilo do `core`. Nenhum travessão (—) em arquivos de `src` (o teste `sem-travessao` varre `core/src`, `mcp-planejamento/src` e `apps/web/{app,components,hooks,lib,proxy.ts}`; mantenha `instrumentation.ts` e `lib/desligamento.ts` sem travessão também). Antes de editar `instrumentation.ts`, `proxy.ts` ou o tratamento de sinais, ler os docs do Next instalado em `src/node_modules/next/dist/docs/` (Next 16).
- Nunca ler nem imprimir o `.env` nem o `.env.example`. Testes de rotina não tocam no banco nem em rede. A suíte ao vivo (`npm run test:supabase`) só o controlador roda.
- Docker local: Colima já instalado. Plataforma local `linux/arm64`; o provedor é `linux/amd64`. Nada no `Dockerfile` pode depender da arquitetura (sem URLs de binário fixas por plataforma).

## Review Focus

1. **`SIGTERM` no meio de um turno:** o turno termina, os arquivos sincronizam, nenhuma escrita se perde; passado o prazo, o turno sobrante vira "interrompido" e mesmo assim sincroniza; nenhum turno novo nasce (inclusive os da fila). Pinado na Task 3.
2. **`/api/saude` não pode virar atalho:** nenhum dado, só `GET`/`HEAD`, e as outras rotas continuam recusando host desconhecido. Pinado na Task 2.
3. **O agente não enxerga as chaves do banco:** o ambiente do subprocesso é uma lista de permissão; testes com `SUPABASE_SERVICE_ROLE_KEY` e variáveis de nome parecido no ambiente de origem. Pinado na Task 5.
4. **Nada de segredo na imagem e nada de privilégio:** `.dockerignore` e as camadas não contêm `.env*`, o processo do app roda como usuário comum. Pinado na Task 6 (`docker/testar-conteiner.sh`).
5. **Volume vazio e segunda subida:** o `entrypoint.sh` prepara `/data` do zero, é idempotente, atualiza `_template` e `_fixtures` e não mexe em pastas de prospects que já estão no volume. Pinado na Task 6.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/packages/core/src/erros.ts` | Novo `ErroReiniciando` |
| `src/packages/core/src/autenticacao.ts` | `/api/saude` livre em `decidirAcesso` |
| `src/packages/core/src/servico-turnos.ts` | `drenar`, `aceitando`, autor da fila |
| `src/packages/core/src/nuvem/armazenamento-nuvem.ts`, `armazenamento.ts` | `sincronizarTudo` |
| `src/packages/core/src/sistema.ts` | `executorDoAmbiente`, `chaveApiConfigurada` |
| `src/packages/core/src/executor/ambiente-agente.ts` | `ambienteDoAgente` (lista de permissão) |
| `src/apps/web/app/api/saude/route.ts` | Rota de saúde |
| `src/apps/web/lib/desligamento.ts` | Tratamento de `SIGTERM` |
| `src/apps/web/instrumentation.ts`, `proxy.ts` | Liga o desligamento; `/login` com sessão |
| `Dockerfile`, `docker/entrypoint.sh`, `docker/requirements.txt`, `docker/testar-conteiner.sh`, `.dockerignore` | Imagem e teste do contêiner |
| Modificados | `servico-planejamento.ts`, `executor/agent-sdk.ts`, `servico-turnos.ts` (`montarMcpConfig`), rotas `sistema` e `abrir-pasta`, `verificacao-sistema.tsx`, `card-prospect.tsx`, `trilha-etapas.tsx`, `uso-assinatura.tsx`, `layout.tsx`, `src/apps/web/package.json` |

---

### Task 0: Provedor de hospedagem (manual, adiada)

A Railway pausou novas contas (incidente de 21/10, sem data de reabertura). Não bloqueia as Tasks 1 a 7.

- [ ] **Step 1:** Quando a Railway reabrir, ou se o analista escolher outro provedor com Docker e disco persistente (Fly.io, Render), criar a conta e fazer o login do CLI (`railway login`).
- [ ] **Step 2:** Definir um limite de gasto no Console da Anthropic para a chave do servidor.

---

### Task 1: Pendências da Fase B

**Files:**
- Modify: `src/packages/core/src/tipos.ts` (`ItemFila`), `servico-planejamento.ts` (`enfileirar`, `retirarFila`, os chamadores), `servico-turnos.ts` (`processarFila`), `src/apps/web/proxy.ts`
- Test: `test/servico-planejamento.test.ts`, `test/servico-turnos.test.ts`, `src/apps/web/proxy.test.ts`

**Interfaces:**
- Produces:

```ts
// tipos.ts
export interface ItemFila { etapa: EtapaId; texto: string; autor?: string | null }
// servico-planejamento.ts
enfileirar(slug: string, etapa: EtapaId, texto: string, autor?: string | null): Promise<void>
retirarFila(slug: string): Promise<{ etapa: EtapaId; texto: string; autor: string | null } | null>
// autor do lote: o primeiro autor não nulo entre os itens da mesma etapa, ou null
```

- [ ] **Step 1: Escrever os testes.**
  - `servico-planejamento.test.ts`: aprovar um entregável com autor enfileira o item com esse autor; pedir ajuste e receber insumo idem; os caminhos sem autor (por exemplo reabrir etapa) enfileiram `autor: null` e o JSON do estado de quem nunca teve autor não ganha a chave `autor`; `retirarFila` com itens de dois autores na mesma etapa devolve o primeiro não nulo.
  - `servico-turnos.test.ts`: o turno disparado pela fila grava `uso_turnos.autor` e o `mensagem_analista` automático com o autor do item, e `ativoPor` o devolve durante o turno; sem autor no item, `null` (substitui o teste "turno da fila não herda autor").
  - `proxy.test.ts` (modo `google`): `/login` com sessão válida responde redirecionamento 307 para o `proximo` seguro (ou `/`), com os cookies renovados; `/login` sem sessão passa; `proximo=//evil.com` vira `/`; o modo `off` não muda.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-planejamento.test.ts test/servico-turnos.test.ts` e `cd ../../apps/web && npx vitest run proxy.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar.** Passar `autor` dos chamadores existentes (`aprovarEntregavel`, `pedirAjuste`, `pedirAjustes`, `receberInsumoArquivo`, `receberInsumoLink`) para `enfileirar`; só incluir a chave `autor` no item quando houver autor; `processarFila` usa o autor do item em `ativos`, no evento automático e no `registrarUso`. No proxy, em `/login` com o modo `google`, validar a sessão com a mesma `usuarioDeClaims` e redirecionar quando válida.
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: autor dos turnos da fila e /login com sessão válida"
```

---

### Task 2: Rota de saúde

**Files:**
- Create: `src/apps/web/app/api/saude/route.ts`, `src/apps/web/app/api/saude/route.test.ts`
- Modify: `src/packages/core/src/autenticacao.ts`, `src/packages/core/test/autenticacao.test.ts`, `src/apps/web/app/api/rotas-exigem-usuario.test.ts` (lista de isentas)

**Interfaces:**
- Consumes: `decidirAcesso` (Fase B).
- Produces: `GET /api/saude` => `200 {"ok":true}` com `cache-control: no-store`; em `decidirAcesso`, o caminho exato `/api/saude` com `GET`/`HEAD` é `passar` para qualquer host e qualquer modo; qualquer outro método nele é `recusar`.

- [ ] **Step 1: Escrever os testes.** Tabela em `autenticacao.test.ts`: `/api/saude` GET com host `healthcheck.railway.app`, `127.0.0.1:3000` e `evil.example.com`, nos modos `off` e `google`, sem sessão: `passar`; `HEAD`: `passar`; `POST`/`DELETE`: `recusar`; caminhos parecidos (`/api/saude/x`, `/api/saudex`, `/API/saude`, `/api/saude/../prospects`) seguem a regra normal (host fora do permitido é `recusar`, sem sessão é `nao_autenticado`). `route.test.ts`: corpo exato, status e cabeçalho. A varredura `rotas-exigem-usuario.test.ts` declara `api/saude/route.ts` como isenta e continua falhando se ela chamar `exigirUsuario` ou `servidor`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/autenticacao.test.ts` e `cd ../../apps/web && npx vitest run app/api/saude app/api/rotas-exigem-usuario.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** a rota (sem importar `servidor`, sem ler nada) e a regra em `decidirAcesso`, antes da checagem de host, só para o caminho exato.
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: rota de saúde /api/saude livre para qualquer host"
```

---

### Task 3: Desligamento seguro

**Files:**
- Create: `src/apps/web/lib/desligamento.ts`, `src/apps/web/lib/desligamento.test.ts`
- Modify: `src/packages/core/src/erros.ts`, `servico-turnos.ts`, `armazenamento.ts`, `nuvem/armazenamento-nuvem.ts`, `src/apps/web/instrumentation.ts`, `src/apps/web/instrumentation.test.ts`
- Test: `test/servico-turnos.test.ts`, `test/nuvem/armazenamento-nuvem.test.ts`

**Interfaces:**
- Produces:

```ts
// erros.ts: 503, código "reiniciando", mensagem exata das Global Constraints
export class ErroReiniciando extends ErroDominio
// servico-turnos.ts
ServicoTurnos.drenar(prazoMs: number): Promise<{ abortados: string[] }>   // slugs abortados por prazo
// reservar() lança ErroReiniciando depois de drenar() começar; processarFila() não inicia turno depois disso
// armazenamento.ts / nuvem: FsArmazenamento.sincronizarTudo(): Promise<void> (no-op);
// NuvemArmazenamento.sincronizarTudo(): cancela todos os temporizadores e sincroniza cada slug tocado desde a subida
// desligamento.ts
export function prazoDeDrenagem(env: Record<string, string | undefined>): number
export function instalarDesligamento(d: {
  env: Record<string, string | undefined>
  servidor: () => { turnos: ServicoTurnos; armazenamento: FsArmazenamento } | undefined  // undefined = serviços nunca criados
  sair: (codigo: number) => void
  processo?: Pick<NodeJS.Process, "on">
  log?: (mensagem: string) => void
}): void   // instala SIGTERM e SIGINT uma única vez
```

- [ ] **Step 1: Escrever os testes** (relógio falso do Vitest):
  - `servico-turnos`: depois de `drenar`, `iniciar`/`enviarMensagem`/`enviarMensagemComAjustes` lançam `ErroReiniciando`; o turno em andamento termina normalmente e `drenar` resolve com `abortados: []`; se o turno passa do prazo, `drenar` aborta o turno, espera ele registrar `turno_fim` `interrompido` e devolve o slug; o turno da fila que estava para nascer não nasce (o item continua em `filaAutomatica`); `drenar` sem turno ativo resolve na hora.
  - `armazenamento-nuvem`: `sincronizarTudo` cancela o temporizador pendente e sincroniza o slug escrito há menos de 1 s; um slug sem escrita não sincroniza; erro de um slug não impede os outros e o último erro é relançado depois de tentar todos.
  - `desligamento.test.ts`: `prazoDeDrenagem` (padrão, valor válido, `abc`, `500`, vazio); no `SIGTERM`, a ordem é `drenar`, depois `sincronizarTudo`, depois `sair(0)`; segundo `SIGTERM` não repete; sem serviços criados (`servidor()` devolve `undefined`) sai direto com 0; falha ao drenar ou sincronizar ainda chama `sair(1)` e loga sem imprimir valores secretos.
  - `instrumentation.test.ts`: com `NEXT_MANUAL_SIG_HANDLE=true`, `register()` instala o desligamento; sem a variável, não instala.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-turnos.test.ts test/nuvem/armazenamento-nuvem.test.ts` e `cd ../../apps/web && npx vitest run lib/desligamento.test.ts instrumentation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.** `servidor` de `instalarDesligamento` lê o registro global de `servidor.ts` (`globalThis.__planejamento`) sem criar serviços. Confirmar nos docs do Next 16 que `NEXT_MANUAL_SIG_HANDLE=true` desliga o tratamento próprio e que `register()` termina antes da primeira requisição; registrar a confirmação no relatório. Itens que ficam em `filaAutomatica` depois do desligamento só rodam na próxima ação do analista no prospect (limite aceito; descrever no relatório).
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: desligamento seguro com drenagem de turnos e sincronização final"
```

---

### Task 4: Ajustes para a nuvem (sistema, abrir pasta, painel de uso)

**Files:**
- Modify: `src/packages/core/src/sistema.ts`, `src/apps/web/app/api/sistema/route.ts`, `src/apps/web/app/api/prospects/[slug]/abrir-pasta/route.ts`, `src/apps/web/components/sistema/verificacao-sistema.tsx`, `components/sistema/uso-assinatura.tsx` e onde ele é montado, `components/home/card-prospect.tsx`, `components/trabalho/trilha-etapas.tsx`, `src/apps/web/app/layout.tsx`
- Test: `test/sistema.test.ts`, testes ao lado das rotas e dos componentes

**Interfaces:**
- Produces:

```ts
// core/sistema.ts
export type ExecutorDoAmbiente = "sdk" | "cli" | "demo"
export function executorDoAmbiente(env: Record<string, string | undefined>): ExecutorDoAmbiente   // mesma regra de servidor(): demo, sdk, senão cli (aparar espaços)
export function chaveApiConfigurada(env: Record<string, string | undefined>): boolean            // ANTHROPIC_API_KEY não vazia; nunca devolve o valor
// /api/sistema devolve também: { executor, chaveApi: boolean, nuvem: boolean }   // nuvem = PLANEJAMENTO_DADOS === "supabase"
// layout.tsx (servidor) informa { executor, nuvem } aos componentes cliente por um contexto, junto do e-mail da conta
```

- [ ] **Step 1: Escrever os testes.** `executorDoAmbiente` e `chaveApiConfigurada` em tabela (vazio, espaços, `sdk`, `demo`, `SDK` maiúsculo cai em `cli` como hoje). `/api/sistema` com `executor: "sdk"`: não executa `claude --version` nem `claude auth status`, devolve `chaveApi`, e a checagem de `soffice` só tenta o caminho do macOS quando `process.platform === "darwin"`; com `cli` a resposta e o comportamento atuais não mudam. `verificacao-sistema`: com `sdk` e sem chave, a janela mostra `Falta a chave da API do agente (ANTHROPIC_API_KEY).` e NÃO pede instalar o Claude Code; com `sdk` e chave, não bloqueia; com `cli` tudo como hoje; as mensagens de ffmpeg e Apify, na nuvem, não dizem "brew" nem ".env da raiz" (dizem que o item precisa ser configurado no servidor). `abrir-pasta`: com `PLANEJAMENTO_DADOS=supabase` responde 404 (`ErroNaoEncontrado`, mensagem `Disponível só no modo local.`) depois de `exigirUsuario`; no modo `fs` abre como hoje. `card-prospect` e `trilha-etapas`: com `nuvem` verdadeiro, os itens "Abrir pasta no Finder" e "Mostrar no Finder" não aparecem; com falso, aparecem. `uso-assinatura`: não renderiza (nem busca `/api/uso`) quando `executor !== "cli"`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/sistema.test.ts` e `cd ../../apps/web && npx vitest run`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar** seguindo os contratos acima; `servidor.ts` passa a usar `executorDoAmbiente` em vez da condição solta (sem mudar o comportamento).
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(web): verificação de sistema, abrir pasta e painel de uso conscientes da nuvem"
```

---

### Task 5: Firecrawl no SDK e ambiente reduzido do agente

**Files:**
- Create: `src/packages/core/src/executor/ambiente-agente.ts`, `src/packages/core/test/ambiente-agente.test.ts`
- Modify: `src/packages/core/src/executor/agent-sdk.ts`, `servico-turnos.ts` (`montarMcpConfig`), `src/packages/core/test/agent-sdk.test.ts`, `test/servico-turnos.test.ts`

**Interfaces:**
- Produces:

```ts
export function ambienteDoAgente(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv   // só a lista de permissão das Global Constraints
// agent-sdk.ts: o AgentSdkExecutor passa ambienteDoAgente(process.env) em vez de { ...process.env }
// servico-turnos.ts
montarMcpConfig(config: ConfigTurnos, token: string, env?: NodeJS.ProcessEnv): string
// com env.FIRECRAWL_API_KEY não vazia: mcpServers.firecrawl = { command: "firecrawl-mcp", args: [], env: { FIRECRAWL_API_KEY } }
// sem a variável, o JSON é idêntico ao atual
```

- [ ] **Step 1: Escrever os testes.** `ambiente-agente.test.ts`: dado um ambiente com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_TESTE_URL`, `PLANEJAMENTO_AUTH`, `PLANEJAMENTO_APP_URL`, `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, `PATH`, `HOME`, `LANG`, `LC_ALL`, `ANTHROPIC_API_KEY`, `CLAUDE_CONFIG_DIR`, `APIFY_TOKEN`, `FIRECRAWL_API_KEY`, `VIRTUAL_ENV`, `HTTPS_PROXY`, `https_proxy`, o resultado tem só os da lista de permissão, com os mesmos valores; chave com nome parecido (`SUPABASE_X`, `xANTHROPIC_API_KEY`, `MY_PATH`) não passa; valores `undefined` não viram chave; o objeto de entrada não é alterado. `agent-sdk.test.ts`: o `env` recebido pelo `consulta` não tem nenhuma chave `SUPABASE_*` e tem `ANTHROPIC_API_KEY`. `servico-turnos.test.ts`: `montarMcpConfig` com e sem `FIRECRAWL_API_KEY`, e o servidor `planejamento` não muda.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/ambiente-agente.test.ts test/agent-sdk.test.ts test/servico-turnos.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar.** Quem chama `montarMcpConfig` em `servico-turnos.ts` passa `process.env` só quando o executor é o SDK (a configuração do Claude Code do analista já traz o Firecrawl no modo CLI): faça `ServicoTurnos` receber o modo pelo `ConfigTurnos` (campo opcional `firecrawlNoMcp?: boolean`, ligado em `servidor.ts` quando `executorDoAmbiente(env) === "sdk"`).
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(core): ambiente reduzido do agente e Firecrawl no MCP do SDK"
```

---

### Task 6: Imagem do servidor

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker/entrypoint.sh`, `docker/requirements.txt`, `docker/testar-conteiner.sh`
- Modify: `src/apps/web/package.json` (script `start:nuvem`)

**Interfaces:**
- Produces: imagem `planejamento:local` que sobe com `docker run -p 3000:3000 -v <pasta>:/data` (mais as variáveis de segredo por `-e` ou `--env-file`); `docker/testar-conteiner.sh [imagem]` roda a bateria de verificações abaixo com ambiente FALSO (nenhum segredo real) e sai com código diferente de zero se uma falhar; `npm run start:nuvem` em `src/apps/web` = `next start -H 0.0.0.0 -p ${PORT:-3000}`.

- [ ] **Step 1: Escrever `docker/testar-conteiner.sh` primeiro**, como o teste que define a imagem (usa `docker run` com `PLANEJAMENTO_AUTH=google`, `SUPABASE_URL=https://exemplo.invalid`, `SUPABASE_PUBLISHABLE_KEY=sb_publishable_falsa`, `PLANEJAMENTO_APP_URL=http://127.0.0.1:<porta>`, `ANTHROPIC_API_KEY=falsa` e um volume temporário vazio). Verificações, cada uma com mensagem `OK:`/`FALHA:`:
  1. a imagem constrói; o processo do app roda com usuário diferente de root (`id -u` do processo 1 filho);
  2. `GET /api/saude` responde 200 `{"ok":true}` e, com `Host: evil.example.com`, também 200; `GET /api/prospects` responde 401 `nao_autenticado`; `GET /` responde 307 para `/login`; `GET /login` traz "Entrar com Google";
  3. dentro do contêiner: `python3 -c "import pptx, openpyxl, PIL, pandas, numpy, matplotlib, requests"`; gera um `.pptx` e um `.xlsx` mínimos com python e converte cada um para PDF com `soffice --headless --convert-to pdf` e depois para PNG com `pdftoppm`; `ffmpeg -version`, `ffprobe -version`, `pandoc --version`, `convert -version` e `firecrawl-mcp --help` (ou `--version`) funcionam; a fonte Arial é resolvida por Liberation (`fc-match Arial` contém "Liberation");
  4. `/data/clientes/_template` existe e `/app/clientes` é um link para `/data/clientes`; criar uma pasta `/data/clientes/ja-existe` com um arquivo, parar e subir de novo: a pasta e o arquivo continuam, e `_template` foi atualizado (alterar o `_template` na imagem de teste não é preciso; basta conferir que `_template` e `_fixtures` existem e que a segunda subida não falha nem apaga `ja-existe`);
  5. nenhuma camada da imagem tem `.env`, `.env.example` com valores, `clientes/<prospect>` nem `.superpowers` (`docker history`/`docker run ... find`); `env` do processo do app não contém variável com valor do `.env` real (não há `.env` na imagem);
  6. `docker stop -t 30` com o app ocioso encerra com código 0 em segundos e o log mostra a linha de desligamento.
- [ ] **Step 2: Rodar o script e ver falhar**

Run: `bash docker/testar-conteiner.sh`
Expected: FALHA na primeira verificação (não há `Dockerfile`).

- [ ] **Step 3: Implementar a imagem** conforme a seção 3 do spec: base `node:22-bookworm-slim`; pacotes `apt` (python3, python3-venv, libreoffice-impress, libreoffice-calc, libreoffice-writer, poppler-utils, imagemagick, ffmpeg, pandoc, fonts-liberation, fonts-dejavu-core, ca-certificates, curl, tini, gosu), com `--no-install-recommends` e limpeza do cache; venv em `/opt/venv` com `docker/requirements.txt` (versões exatas que funcionem em Python 3.11, descobertas no build e fixadas: `python-pptx`, `openpyxl`, `Pillow`, `requests`, `pandas`, `numpy`, `matplotlib`); `npm i -g firecrawl-mcp@<versão fixa mais recente>`; camadas na ordem sistema, Python, `package*.json` e `npm ci` em `src/`, código, `next build`; `ENV` das Global Constraints; usuário `app` (uid 1000); `ENTRYPOINT ["/usr/bin/tini","--","/app/docker/entrypoint.sh"]`; `entrypoint.sh` conforme o spec 3 (cria `/data/{clientes,claude,home}`, `chown` para `app`, copia `/app/clientes-base/{_template,_fixtures}` para `/data/clientes/` substituindo só essas duas pastas, `ln -sfn /data/clientes /app/clientes`, `exec gosu app npm run start:nuvem` em `src/apps/web`); `.dockerignore` conforme o spec 3. O Next já usa o transpile de pacotes do workspace; confira que `next build` não precisa do `.env`.
- [ ] **Step 4: Rodar o script e ver passar**

Run: `bash docker/testar-conteiner.sh`
Expected: todas as verificações `OK:` e código de saída 0. Registrar no relatório o tamanho da imagem (`docker images`) e o tempo do primeiro build e de um rebuild só de código.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore docker src/apps/web/package.json
git commit -m "feat: imagem Docker do servidor com Python, LibreOffice e ferramentas do agente"
```

---

### Task 7: Aceitação local do contêiner (feita pelo analista, com o controlador conferindo o banco)

- [ ] **Step 1:** `docker build -t planejamento:local .` (o controlador já o fez na Task 6) e `mkdir -p ~/planejamento-data`.
- [ ] **Step 2:** Subir com as chaves reais, sem colar nada no chat: `docker run --rm -p 3000:3000 -v ~/planejamento-data:/data --env-file .env -e PLANEJAMENTO_APP_URL=http://127.0.0.1:3000 planejamento:local`. (O `--env-file` lê o `.env` da raiz; ele já tem `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_PUBLISHABLE_KEY`. As variáveis fixas da imagem têm prioridade apenas onde o `.env` não as define; se o `.env` tiver `PLANEJAMENTO_EXECUTOR`, `PLANEJAMENTO_DADOS` ou `PLANEJAMENTO_AUTH` diferentes, o controlador orienta o ajuste.) O Docker lê o `--env-file` sem remover aspas e sem entender `export`: se alguma linha do `.env` usar aspas, o valor chega ao contêiner com elas, e o controlador orienta a conversão (sem ler o arquivo, só pelo sintoma). Abrir `http://127.0.0.1:3000`, entrar com a conta Google e criar o prospect `verdeluz-nuvem`.
- [ ] **Step 3:** Percorrer as etapas 01 a 03; abrir a prévia de uma planilha e de uma apresentação (usa o LibreOffice do contêiner); ver um gráfico gerado.
- [ ] **Step 4:** Com um turno em andamento, `docker stop` (o `-t` padrão de 10 s é curto: usar `docker stop -t 330`). Conferir no log a drenagem e a sincronização; subir de novo; conferir que o chat e os arquivos continuam.
- [ ] **Step 5:** Apagar `~/planejamento-data`, subir de novo e abrir o prospect: os arquivos voltam do Supabase e o agente retoma (com o aviso de retomada, se a sessão não voltar).
- [ ] **Step 6:** O controlador confere no Supabase `uso_turnos` (autor e custo, inclusive dos turnos da fila), `prospects` e os buckets.

Pronto quando os seis passos se confirmam (critérios (b) a (d) do spec, no contêiner local).

---

### Task 8: Deploy no provedor e aceitação pelo endereço público (depende da Task 0)

- [ ] **Step 1:** Criar o projeto, o serviço (build a partir do `Dockerfile` do repositório, na `main`) e o volume montado em `/data`.
- [ ] **Step 2:** Variáveis do painel: segredos da seção 3 do spec; `PLANEJAMENTO_APP_URL` com o endereço público gratuito que o provedor gerar; espera de desligamento do provedor MAIOR que a drenagem em pelo menos 60 s, para o turno abortado no prazo ainda registrar o fim e sincronizar (na Railway, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=360` com a drenagem padrão de 300 s); verificação de saúde em `/api/saude`; uma réplica só.
- [ ] **Step 3:** No Google Cloud e no Supabase, acrescentar o endereço público às listas de URLs de retorno (`https://<endereço>/auth/callback`, exato, sem curinga). Não mudar a "Site URL".
- [ ] **Step 4:** Repetir o roteiro da Task 7 pelo endereço público, mais: conferir que `Host` e `x-forwarded-*` do provedor passam na regra de acesso (a falha é fechada, 403) e que um segundo analista vê o aviso de turno ativo.
- [ ] **Step 5:** Limite de gasto da Anthropic conferido (Task 0, passo 2).

Pronto quando o roteiro passa pelo endereço público.
