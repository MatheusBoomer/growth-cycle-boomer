# Fase A — Dados no Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app, ainda rodando no Mac, passa a guardar estado, conversas, comentários, uso e arquivos de cada prospect no Supabase quando `PLANEJAMENTO_DADOS=supabase`, com a pasta local virando só mesa de trabalho e a memória do agente salva e restaurada da nuvem.

**Architecture:** `NuvemArmazenamento` estende o `FsArmazenamento` atual: estado, conversas e comentários vão a um `Repositorio`; arquivos continuam no disco e uma `Mesa` os sincroniza em três vias (base × disco × manifesto) com um `ArmazemArquivos` endereçado por conteúdo. `ServicoTurnos` sincroniza antes e depois de cada turno e usa uma `MemoriaSessao` para salvar e restaurar o `.jsonl` da sessão do agente, com retomada pelo histórico quando ele falta. Cada peça tem implementação em memória (testes) e Supabase.

**Tech Stack:** TypeScript, Node 20+, Vitest 5, `@supabase/supabase-js` 2.x, Supabase CLI 2.x (migrações), Postgres, Supabase Storage.

**Spec:** `docs/superpowers/specs/2026-10-27-deploy-railway-supabase-design.md` (seções 4, 5.1 a 5.4, 6 e 7, itens 1 a 4).

## Global Constraints

- Modo escolhido por `PLANEJAMENTO_DADOS=fs|supabase`; vazio = `fs`. Com `fs`, o comportamento atual não muda e todos os testes atuais seguem passando.
- Variáveis: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; testes de integração usam `SUPABASE_TESTE_URL` e `SUPABASE_TESTE_SERVICE_ROLE_KEY` e são pulados sem elas. Nenhuma chave aparece em arquivo versionado, log ou mensagem de erro.
- Só o servidor acessa o Supabase (chave de serviço). RLS ligado em todas as tabelas, sem políticas.
- Storage privado: buckets `prospects` (objetos `<slug>/<sha256>`) e `sessoes` (objetos `<slug>/<sessionId>.jsonl`).
- Fora da sincronização: `.DS_Store`, nomes começando com `~$`, qualquer segmento `__pycache__`, `*.tmp`, `.app/previas/`, `.app/estado.json`, `.app/conversas/`, `.app/comentarios/*.json` (direto em `.app/comentarios/`).
- Base da mesa em `clientes/.mesa/<slug>.json` (pasta com ponto: `listarSlugs` já ignora).
- Sincronização: 3 tentativas com espera de 500 ms, 1 s e 2 s; agendada 1 s depois da última gravação do app; nunca duas ao mesmo tempo para o mesmo prospect.
- Textos de aviso, exatos: `Não consegui baixar os arquivos do prospect. Tente de novo.` (erro, impede o turno); `Os arquivos desta resposta ainda não foram salvos na nuvem. Vou tentar de novo na próxima ação.` (alerta); `Retomei a etapa a partir do histórico.` (info).
- Caminho da sessão do agente: `<CLAUDE_CONFIG_DIR ou ~/.claude>/projects/<cwd com todo caractere fora de [a-zA-Z0-9] trocado por "-">/<sessionId>.jsonl`.
- Código, nomes e comentários em português, no estilo do `core` (classes com dependências injetadas, `agora` injetável, erros de `erros.ts`). Sem travessão em textos de interface (há teste `sem-travessao`).

## Review Focus

1. **Arquivo com acento ou espaço no nome** (`dados/Relatório de clientes.xlsx`): tem de ir e voltar com o nome exato. Teste na Task 4 (`preserva nome com acento e espaço`).
2. **Queda do servidor entre gravar no disco e sincronizar**: na volta, a nuvem não pode sobrescrever o arquivo local mais novo. Teste na Task 4 (`disco mudado e nuvem igual: envia, não baixa`).
3. **Duas sincronizações do mesmo prospect ao mesmo tempo** (fim de turno e agendada): não podem enviar em dobro nem corromper a base. Teste na Task 4 (`sincronizações simultâneas rodam uma depois da outra`).
4. **Pasta local de um prospect que não existe no banco** (os prospects antigos do Mac, com `PLANEJAMENTO_DADOS=supabase`): não aparecem na lista, e criar um prospect com o mesmo slug falha com `ErroProspectExistente`, sem apagar nada. Teste na Task 5 (`pasta local sem linha no banco: some da lista e recusa recriar`).
5. **Sessão salva, mas o `.jsonl` remoto corrompido ou vazio**: retoma pelo histórico, não manda `resume` para uma sessão quebrada. Teste na Task 7 (`arquivo de sessão vazio cai na retomada`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/config.toml` | Projeto do Supabase CLI (gerado por `supabase init`) |
| `supabase/migrations/20261027120000_planejamento.sql` | Tabelas, índices, RLS e buckets |
| `src/packages/core/src/nuvem/tipos.ts` | Interfaces `Repositorio`, `ArmazemArquivos` e tipos de apoio |
| `src/packages/core/src/nuvem/memoria.ts` | `MemoriaRepositorio` e `MemoriaArmazem` (testes) |
| `src/packages/core/src/nuvem/supabase.ts` | `criarClienteSupabase`, `SupabaseRepositorio`, `SupabaseArmazem` |
| `src/packages/core/src/nuvem/mesa.ts` | `Mesa`: sincronização em três vias |
| `src/packages/core/src/nuvem/armazenamento-nuvem.ts` | `NuvemArmazenamento` |
| `src/packages/core/src/nuvem/memoria-sessao.ts` | `caminhoSessao`, `MemoriaSessao` |
| `src/packages/core/test/nuvem/*.test.ts` | Testes da pasta `nuvem/` |
| `src/packages/core/test/nuvem/contrato-*.ts` | Suítes de contrato reaproveitadas por memória e Supabase |
| Modificados | `armazenamento.ts`, `erros.ts`, `servico-comentarios.ts`, `servico-teste.ts`, `servico-planejamento.ts`, `servico-turnos.ts`, `prompts.ts`, `executor/tipos.ts`, `executor/stream-json.ts`, `core/package.json`, `apps/web/lib/servidor.ts`, `.env.example` |

---

### Task 0: Projeto Supabase de desenvolvimento (manual, feito pelo analista)

Não há Docker no Mac, então a Fase A usa um projeto Supabase na nuvem, no plano gratuito, só para desenvolvimento. O de produção é criado na Fase C.

- [ ] **Step 1:** Em supabase.com, criar o projeto `planejamento-dev`, na região São Paulo (`sa-east-1`). Anotar a senha do banco num gerenciador de senhas.
- [ ] **Step 2:** Em *Project Settings → API*, copiar a URL e a chave `service_role` para o `.env` da raiz como `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TESTE_URL` e `SUPABASE_TESTE_SERVICE_ROLE_KEY`, com os mesmos valores. Nunca colar a chave no chat.
- [ ] **Step 3:** Rodar `supabase login` no terminal.

Pronto quando: o `.env` tem as quatro variáveis e `supabase projects list` mostra `planejamento-dev`.

---

### Task 1: Esquema do banco e dos buckets

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261027120000_planejamento.sql`

**Interfaces:**
- Produces: tabelas `prospects`, `eventos_conversa`, `comentarios`, `uso_turnos`, `arquivos`, `arquivos_lixeira`; buckets privados `prospects` e `sessoes`.

- [ ] **Step 1: `supabase init` na raiz do projeto** (aceitar os padrões; não gerar configurações do VS Code).
- [ ] **Step 2: Escrever a migração** com:
  - `prospects(slug text primary key, nome text, estado jsonb, etapa_atual text, criado_por text, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), versao integer not null default 0, sincronizacao_pendente boolean not null default false, excluido_em timestamptz)`
  - `eventos_conversa(id bigint generated always as identity primary key, slug text not null references prospects(slug), etapa text not null, evento jsonb not null, autor text, em timestamptz not null)`, com índice `(slug, etapa, id)`
  - `comentarios(slug text not null references prospects(slug), entregavel_id text not null, lista jsonb not null, atualizado_em timestamptz not null default now(), primary key (slug, entregavel_id))`
  - `uso_turnos(id bigint generated always as identity primary key, slug text not null references prospects(slug), etapa text not null, autor text, custo_usd numeric(10,4), tokens_entrada integer, tokens_saida integer, inicio timestamptz not null, fim timestamptz not null, status text not null)`
  - `arquivos(slug text not null references prospects(slug), caminho text not null, sha256 text not null, tamanho bigint not null, atualizado_em timestamptz not null default now(), primary key (slug, caminho))`
  - `arquivos_lixeira(id bigint generated always as identity primary key, slug text not null, caminho text not null, sha256 text not null, removido_em timestamptz not null default now())`
  - `alter table … enable row level security` nas seis tabelas, sem políticas
  - `insert into storage.buckets (id, name, public) values ('prospects','prospects',false), ('sessoes','sessoes',false) on conflict do nothing`
- [ ] **Step 3: Aplicar no projeto de desenvolvimento**

Run: `supabase link --project-ref <ref do planejamento-dev> && supabase db push`
Expected: `Finished supabase db push.`; no painel, as seis tabelas e os dois buckets privados.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(supabase): esquema do planejamento (tabelas, RLS e buckets)"
```

---

### Task 2: Contratos em memória (`Repositorio` e `ArmazemArquivos`)

**Files:**
- Create: `src/packages/core/src/nuvem/tipos.ts`, `src/packages/core/src/nuvem/memoria.ts`, `src/packages/core/test/nuvem/contrato-repositorio.ts`, `src/packages/core/test/nuvem/contrato-armazem.ts`, `src/packages/core/test/nuvem/memoria.test.ts`
- Modify: `src/packages/core/src/erros.ts` (novos erros), `src/packages/core/package.json` (export `"./nuvem/*": "./src/nuvem/*.ts"`)

**Interfaces:**
- Produces (em `nuvem/tipos.ts`):

```ts
export interface EstadoVersionado { estado: Estado; versao: number }
export interface EntradaManifesto { caminho: string; sha256: string; tamanho: number }
export interface RegistroUsoTurno {
  slug: string; etapa: EtapaId; autor: string | null
  custoUsd: number | null; tokensEntrada: number | null; tokensSaida: number | null
  inicio: string; fim: string; status: "ok" | "interrompido" | "erro"
}
export interface Repositorio {
  listarSlugs(): Promise<string[]>                       // ordenados, sem excluídos
  existe(slug: string): Promise<boolean>                 // false se excluído
  criarProspect(slug: string): Promise<void>             // ErroProspectExistente se já existe (mesmo excluído)
  excluirProspect(slug: string): Promise<void>           // marca excluido_em; ErroNaoEncontrado se não existe
  lerEstado(slug: string): Promise<EstadoVersionado | null>   // null se estado ainda nulo
  gravarEstado(slug: string, estado: Estado, versaoLida: number): Promise<number> // nova versão; ErroConflitoVersao
  anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void>
  lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]>  // ordem de inclusão
  lerComentarios(slug: string, entregavelId: string): Promise<Comentario[]>  // [] se não há
  gravarComentarios(slug: string, entregavelId: string, lista: Comentario[]): Promise<void>
  registrarUso(r: RegistroUsoTurno): Promise<void>
  marcarSincronizacao(slug: string, pendente: boolean): Promise<void>
}
export interface ArmazemArquivos {
  listarManifesto(slug: string): Promise<EntradaManifesto[]>
  enviar(slug: string, caminho: string, dados: Uint8Array): Promise<EntradaManifesto> // grava objeto <slug>/<sha256> se faltar e faz upsert no manifesto
  baixar(slug: string, sha256: string): Promise<Uint8Array>  // ErroNaoEncontrado se não há objeto
  remover(slug: string, caminho: string): Promise<void>      // tira do manifesto e registra em arquivos_lixeira; ausente é ignorado
  enviarSessao(slug: string, sessionId: string, dados: Uint8Array): Promise<void>
  baixarSessao(slug: string, sessionId: string): Promise<Uint8Array | null>
}
```

- Produces (em `erros.ts`): `ErroConflitoVersao extends ErroDominio` (mensagem: `O estado do prospect "<slug>" mudou por fora do app. Recarregue a página.`), `ErroSincronizacao extends ErroDominio` (mensagem cita o `caminho` que falhou quando houver).
- Produces (em `nuvem/memoria.ts`): `MemoriaRepositorio implements Repositorio`, `MemoriaArmazem implements ArmazemArquivos`, ambos com `constructor()` sem argumentos. `MemoriaArmazem` aceita `falharEm?: (operacao: "listar" | "enviar" | "baixar" | "remover", caminho: string) => boolean` como propriedade pública, para os testes simularem falha.
- Produces (em `test/nuvem/contrato-*.ts`): `contratoRepositorio(nome: string, criar: () => Promise<Repositorio>)` e `contratoArmazem(nome: string, criar: () => Promise<ArmazemArquivos>)`, que registram `describe` e `it`.

- [ ] **Step 1: Escrever as suítes de contrato e `memoria.test.ts`** (que chama as duas com as implementações em memória). Cada `it` usa um slug próprio `contrato-<aleatório>` para rodar também contra um banco compartilhado. Casos do repositório:
  - `cria, lista e confere existência` (`listarSlugs` inclui o slug; `existe` true; criar de novo → `ErroProspectExistente`)
  - `estado começa nulo e grava com versão` (`lerEstado` null; `gravarEstado(slug, e, 0)` → 1; ler → `{ estado: e, versao: 1 }`)
  - `gravar com versão velha falha sem sobrescrever` (`gravarEstado(slug, e2, 0)` depois de chegar a 1 → `ErroConflitoVersao`; ler ainda devolve `e`)
  - `excluir tira da lista e de existe`
  - `conversa volta na ordem e separada por etapa`
  - `comentários: vazio, grava, substitui`
  - `registra uso e marca sincronização` (não lança)

  Casos do armazém:
  - `envia, lista e baixa pelo hash` (bytes iguais; `sha256` = hex do SHA-256; `tamanho` certo)
  - `preserva nome com acento e espaço` (`dados/Relatório de clientes.xlsx`)
  - `reenviar o mesmo caminho troca a entrada do manifesto`
  - `remover tira do manifesto e mantém o conteúdo baixável pelo hash`
  - `sessão: ausente é null; enviada volta igual`
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/nuvem/memoria.test.ts`
Expected: FAIL, módulo `../../src/nuvem/memoria` não encontrado.

- [ ] **Step 3: Implementar `tipos.ts`, os dois erros e `memoria.ts`** (mapas em memória; `structuredClone` na entrada e na saída do estado, para o teste não compartilhar referência).
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/nuvem/memoria.test.ts && npm run typecheck`
Expected: PASS, sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/nuvem src/packages/core/src/erros.ts src/packages/core/package.json src/packages/core/test/nuvem
git commit -m "feat(core): contratos do repositório e do armazém de arquivos, com versão em memória"
```

---

### Task 3: Implementações Supabase

**Files:**
- Create: `src/packages/core/src/nuvem/supabase.ts`, `src/packages/core/test/nuvem/supabase.test.ts`
- Modify: `src/packages/core/package.json` (dependência `@supabase/supabase-js` `^2.118.0`; script `"test:supabase": "vitest run test/nuvem/supabase.test.ts"`), `src/packages/core/vitest.config.ts` (`test.env: loadEnv("test", <raiz do projeto>, "SUPABASE_TESTE_")`, com `loadEnv` importado de `vite`: só as variáveis com esse prefixo entram nos testes)

**Interfaces:**
- Consumes: `Repositorio`, `ArmazemArquivos`, `contratoRepositorio`, `contratoArmazem` (Task 2).
- Produces: `criarClienteSupabase(url: string, chaveServico: string): SupabaseClient` (sem sessão persistida: `auth: { persistSession: false, autoRefreshToken: false }`); `SupabaseRepositorio(cliente: SupabaseClient, agora?: () => string)`; `SupabaseArmazem(cliente: SupabaseClient)`.

- [ ] **Step 1: Escrever `supabase.test.ts`**: `describe.skipIf(!process.env.SUPABASE_TESTE_URL)`, chamando `contratoRepositorio("supabase", …)` e `contratoArmazem("supabase", …)`; o `afterAll` apaga as linhas e os objetos dos slugs `contrato-*` criados.
- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:supabase`
Expected: FAIL, módulo `../../src/nuvem/supabase` não encontrado.

- [ ] **Step 3: Implementar.** Decisões que o contrato não fixa:
  - `gravarEstado`: `update prospects set estado, nome = estado.prospect.nome, etapa_atual, versao = versaoLida + 1, atualizado_em … where slug = ? and versao = versaoLida`, com `.select("versao")`. Zero linhas → `ErroConflitoVersao`. `etapa_atual` = primeira etapa de `ORDEM_ETAPAS` com status diferente de `concluida`, ou `null`.
  - `criarProspect`: `insert`; código Postgres `23505` → `ErroProspectExistente`.
  - `lerConversa`: `order("id")`, paginando de 1000 em 1000 até acabar.
  - `enviar`: SHA-256 com `node:crypto`; `storage.from("prospects").upload(\`${slug}/${sha}\`, dados, { upsert: true, contentType: "application/octet-stream" })`; depois `upsert` em `arquivos`.
  - `remover`: lê a entrada, insere em `arquivos_lixeira`, apaga do manifesto. Não apaga o objeto.
  - Toda falha do cliente vira `Error` com a mensagem do Supabase, sem a URL nem a chave.
- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:supabase && npm run typecheck`
Expected: PASS (com `SUPABASE_TESTE_URL` no `.env`); `npx vitest run` sem a variável mostra a suíte como pulada.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core src/package-lock.json
git commit -m "feat(core): repositório e armazém de arquivos no Supabase"
```

---

### Task 4: Mesa (sincronização em três vias)

**Files:**
- Create: `src/packages/core/src/nuvem/mesa.ts`, `src/packages/core/test/nuvem/mesa.test.ts`

**Interfaces:**
- Consumes: `ArmazemArquivos`, `MemoriaArmazem` (Task 2), `ErroSincronizacao`.
- Produces:

```ts
export interface ResumoSincronizacao { enviados: number; baixados: number; removidosNaNuvem: number; removidosNoDisco: number }
export function ignorarNaSincronizacao(caminho: string): boolean  // regras de Global Constraints
export class Mesa {
  constructor(d: { pastaClientes: string; armazem: ArmazemArquivos; esperar?: (ms: number) => Promise<void> })
  sincronizar(slug: string): Promise<ResumoSincronizacao>  // ErroSincronizacao depois de 3 tentativas
  esquecer(slug: string): Promise<void>                     // apaga a base clientes/.mesa/<slug>.json
}
```

- [ ] **Step 1: Escrever `mesa.test.ts`** (raiz temporária de `raizTemporaria()`, `MemoriaArmazem`, `esperar` instantâneo). Um teste para cada linha da tabela 5.2 do spec, mais:
  - `disco mudado e nuvem igual: envia, não baixa` (base e nuvem com `a.md`="1"; disco "2" → nuvem "2", disco "2")
  - `os dois mudaram: o disco vence`
  - `primeira sincronização sem base: baixa o que só está na nuvem e envia o que só está no disco`
  - `ignora .DS_Store, ~$x.xlsx, __pycache__/, .tmp, .app/previas/, .app/estado.json, .app/conversas/ e .app/comentarios/<id>.json, mas sincroniza .app/comentarios/<id>/c1.png`
  - `preserva nome com acento e espaço` (vai, apaga local, volta igual)
  - `sincronizações simultâneas rodam uma depois da outra` (`Promise.all` de duas chamadas; o armazém registra no máximo 1 envio por caminho; a base final bate com o manifesto)
  - `falha 3 vezes: ErroSincronizacao com o caminho e a base intacta` (`falharEm` sempre true para `enviar`; esperas pedidas = `[500, 1000, 2000]`)
  - `falha 2 vezes e depois passa`
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/nuvem/mesa.test.ts`
Expected: FAIL, módulo não encontrado.

- [ ] **Step 3: Implementar.** A base guarda `Record<caminho, sha256>` do último estado igual dos dois lados e só é regravada (escrita atômica) ao fim de uma passada sem erro. A trava por slug é um mapa de promessas, como o `exclusivo` do `ServicoPlanejamento`. Uma passada calcula o hash de cada arquivo do disco (sem os ignorados), lê o manifesto e aplica a tabela; cada tentativa refaz a passada inteira.
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/nuvem/mesa.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/nuvem/mesa.ts src/packages/core/test/nuvem/mesa.test.ts
git commit -m "feat(core): mesa de trabalho com sincronização em três vias"
```

---

### Task 5: `NuvemArmazenamento` e ganchos no `FsArmazenamento`

**Files:**
- Create: `src/packages/core/src/nuvem/armazenamento-nuvem.ts`, `src/packages/core/test/nuvem/armazenamento-nuvem.test.ts`
- Modify: `src/packages/core/src/armazenamento.ts`, `src/packages/core/src/servico-comentarios.ts:102-109`, `src/packages/core/src/servico-teste.ts` (fim de `reposicionarNoFixture`), `src/packages/core/src/servico-comentarios.ts` (depois da cópia da imagem do comentário, por volta da linha 188)

**Interfaces:**
- Consumes: `Repositorio`, `Mesa`, `MemoriaRepositorio`, `MemoriaArmazem`.
- Produces, em `FsArmazenamento` (usados pelos serviços nos dois modos):
  - `lerComentarios(slug: string, id: string): Promise<Comentario[]>` e `gravarComentarios(slug: string, id: string, lista: Comentario[]): Promise<void>`, com o comportamento atual de `.app/comentarios/<id>.json`. `ServicoComentarios.listar` e `gravar` passam a chamar estes.
  - `sincronizar(slug: string): Promise<void>`: no-op.
  - `agendarSincronizacao(slug: string): void`: no-op.
  - `registrarUso(r: RegistroUsoTurno): Promise<void>`: no-op.
- Produces, em `nuvem/armazenamento-nuvem.ts`:

```ts
export class NuvemArmazenamento extends FsArmazenamento {
  constructor(d: { raiz: string; repositorio: Repositorio; mesa: Mesa; atrasoAgendamentoMs?: number /* 1000 */ })
}
```

  Sobrescreve `listarSlugs`, `existe`, `criarPasta`, `excluir`, `moverParaLixeiraNoProspect`, `lerEstado`, `gravarEstado`, `anexarConversa`, `lerConversa`, `lerComentarios`, `gravarComentarios`, `gravarTexto`, `gravarBinario`, `copiar`, `moverParaDentro`, `sincronizar`, `agendarSincronizacao` e `registrarUso`, como na seção 5.3 do spec. Detalhes:
  - `lerEstado` sincroniza uma vez por processo e por slug antes de ler (conjunto `sincronizadosNestaExecucao`). A falha é registrada no console e não impede a leitura. Guarda a `versao` lida num mapa por slug para o `gravarEstado` seguinte. O `lerEstado` aplica a mesma normalização de etapas e `perguntas` do `FsArmazenamento` (extrair essa normalização para uma função `normalizarEstado(e: Estado): Estado` exportada em `armazenamento.ts`).
  - `sincronizar` chama `mesa.sincronizar` e então `marcarSincronizacao(slug, false)`. Com `ErroSincronizacao`, marca `true` e relança.
  - `agendarSincronizacao` reinicia um temporizador por slug e engole o erro (registra no console; a marca de pendente já foi feita).
  - `excluir` não usa a lixeira do sistema: `repositorio.excluirProspect`, `rm` da pasta local e `mesa.esquecer`.

- [ ] **Step 1: Escrever `armazenamento-nuvem.test.ts`** (raiz temporária, `MemoriaRepositorio`, `MemoriaArmazem`, `atrasoAgendamentoMs: 0`):
  - `criar prospect: linha no banco, _template no disco e na nuvem`
  - `estado e conversa vão ao repositório, não ao disco` (sem `.app/estado.json` nem `.app/conversas/` no disco)
  - `gravar arquivo agenda sincronização` (depois de `gravarTexto` e um tick, o manifesto tem o arquivo)
  - `primeira leitura do estado baixa os arquivos que faltam no disco` (apagar a pasta local, nova instância, `lerEstado` → arquivos de volta)
  - `pasta local sem linha no banco: some da lista e recusa recriar` (pasta `clientes/antigo/` criada à mão; `listarSlugs` sem `antigo`; `criarPasta("antigo")` → `ErroProspectExistente`; a pasta continua lá)
  - `excluir: some da lista e apaga a pasta local, conteúdo segue na nuvem`
  - `falha de sincronização marca pendente e a próxima que passa desmarca` (espiar `marcarSincronizacao`)
  - `comentários vão ao repositório`
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/nuvem/armazenamento-nuvem.test.ts`
Expected: FAIL, módulo não encontrado.

- [ ] **Step 3: Implementar** os ganchos no `FsArmazenamento`, a classe nova, as chamadas de `ServicoComentarios` a `lerComentarios`/`gravarComentarios`, e `arm.agendarSincronizacao(slug)` no fim de `reposicionarNoFixture` e depois da cópia da imagem do comentário.
- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run typecheck`
Expected: PASS em toda a suíte do `core` (os testes atuais confirmam que o modo `fs` não mudou).

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): armazenamento na nuvem sobre repositório e mesa"
```

---

### Task 6: Turnos sincronizam antes e depois

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts` (método novo), `src/packages/core/src/servico-turnos.ts:249-330`
- Test: `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Consumes: `FsArmazenamento.sincronizar` (Task 5).
- Produces: `ServicoPlanejamento.sincronizarArquivos(slug: string): Promise<void>` (delega a `arm.sincronizar`).

- [ ] **Step 1: Escrever os testes** em `servico-turnos.test.ts`, com um `FsArmazenamento` cujo `sincronizar` é espiado ou forçado a falhar:
  - `sincroniza antes e depois do turno` (ordem: sincronizar → executor → sincronizar)
  - `falha antes do turno: não chama o executor e avisa` (evento `aviso` nível `erro` com o texto exato de Global Constraints e `turno_fim` status `erro`)
  - `falha depois do turno: avisa com alerta e o turno fica ok` (aviso nível `alerta`, texto exato; `turno_fim` `ok` registrado antes do aviso)
  - `turno interrompido também sincroniza no fim`
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/servico-turnos.test.ts`
Expected: FAIL nos quatro casos novos.

- [ ] **Step 3: Implementar** em `executarTurno`: sincronizar antes de `turno_inicio`; se falhar, registrar `turno_inicio`, o aviso de erro e `turno_fim` `erro` com `detalhe` igual ao texto do aviso, e retornar. Depois do laço (num `finally` próprio, depois de `turno_fim`), sincronizar e, se falhar, registrar o aviso de alerta.
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): turnos sincronizam os arquivos do prospect antes e depois"
```

---

### Task 7: Memória da sessão e retomada pelo histórico

**Files:**
- Create: `src/packages/core/src/nuvem/memoria-sessao.ts`, `src/packages/core/test/nuvem/memoria-sessao.test.ts`
- Modify: `src/packages/core/src/prompts.ts`, `src/packages/core/src/servico-turnos.ts`
- Test: `src/packages/core/test/prompts.test.ts`, `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Consumes: `ArmazemArquivos.enviarSessao/baixarSessao` (Task 2).
- Produces:

```ts
export function caminhoSessao(configDir: string, cwd: string, sessionId: string): string
export interface MemoriaDeSessao {
  /** true se o .jsonl está no disco (e não vazio) depois de tentar restaurar. */
  restaurar(slug: string, sessionId: string): Promise<boolean>
  /** Envia o .jsonl local; ausente é ignorado. */
  salvar(slug: string, sessionId: string): Promise<void>
}
export class MemoriaSessao implements MemoriaDeSessao {
  constructor(d: { armazem: ArmazemArquivos; configDir: string; cwd: string })
}
// prompts.ts
export function promptRetomadaEtapa(p: { slug: string; etapa: EtapaCatalogo; dossie: string; historico: EventoConversa[] }): string
```

- `DependenciasTurnos` ganha `memoria?: MemoriaDeSessao`. Sem ela, nada muda.

- [ ] **Step 1: Escrever os testes**
  - `memoria-sessao.test.ts`:
    - `caminho da sessão troca todo caractere fora de [a-zA-Z0-9] por "-"` (`caminhoSessao("/c", "/Users/m/Projetos Boomer/x-v2", "s1")` → `"/c/projects/-Users-m-Projetos-Boomer-x-v2/s1.jsonl"`)
    - `salvar e restaurar devolvem o mesmo conteúdo`
    - `restaurar sem nada na nuvem e sem arquivo local → false`
    - `arquivo local presente e igual à nuvem → true sem baixar`
    - `arquivo de sessão vazio cai na retomada` (nuvem com 0 bytes → `false`)
  - `prompts.test.ts`: `retomada inclui o prompt inicial da etapa e o histórico em ordem` (só `mensagem_analista` como `**Analista:**` e `texto_agente` como `**Agente:**`); `histórico longo guarda as mensagens mais recentes até 40000 caracteres`.
  - `servico-turnos.test.ts`:
    - `com sessionId e memória restaurada, envia resume e salva no fim`
    - `memória não restaurada: sessão nova, prompt de retomada e aviso info` (pedido com `sessionId: null`, mensagem começando pelo prompt de retomada, evento `aviso` `info` com `Retomei a etapa a partir do histórico.`)
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/nuvem/memoria-sessao.test.ts test/prompts.test.ts test/servico-turnos.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar.** `promptRetomadaEtapa` = `promptInicialEtapa(...)` + `\n\n---\n\n### Histórico desta etapa (a sessão anterior não pôde ser restaurada)\n\n` + as mensagens. Em `executarTurno`: se `sessionId` e `memoria`, `restaurar`; se `false`, `sessionId = null`, a mensagem passa a ser `[promptRetomadaEtapa(...), texto]` (ou `"Continue de onde parou."` sem texto), registrar o aviso; o `sessionId` novo é gravado pelo fluxo atual, quando chega o evento `sessao`. No fim (junto da sincronização da Task 6), `memoria.salvar(slug, sessionId)` se houver `sessionId`, com falha registrada no console, sem aviso.
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): memória da sessão do agente na nuvem, com retomada pelo histórico"
```

---

### Task 8: Custo de cada turno

**Files:**
- Modify: `src/packages/core/src/executor/tipos.ts`, `src/packages/core/src/executor/stream-json.ts:72-82`, `src/packages/core/src/servico-planejamento.ts`, `src/packages/core/src/servico-turnos.ts`
- Test: `src/packages/core/test/stream-json.test.ts`, `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Produces: o evento `fim` ganha `uso?: { custoUsd: number | null; tokensEntrada: number | null; tokensSaida: number | null }`; `ServicoPlanejamento.registrarUso(r: RegistroUsoTurno): Promise<void>` (delega a `arm.registrarUso`).

- [ ] **Step 1: Escrever os testes**
  - `stream-json.test.ts`: `result traz custo e tokens` (`total_cost_usd: 0.42`, `usage: { input_tokens: 1000, output_tokens: 200 }` → `uso: { custoUsd: 0.42, tokensEntrada: 1000, tokensSaida: 200 }`); `result sem custo traz uso com nulos`.
  - `servico-turnos.test.ts`: `registra o uso do turno com início, fim, status e autor nulo`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/stream-json.test.ts test/servico-turnos.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar.** `executarTurno` guarda o `inicio` (`this.agora()` antes do executor) e, ao processar `fim`, chama `registrarUso` com o status registrado no `turno_fim`. Falha ao registrar uso vai para o console e não afeta o turno.
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): custo e tokens de cada turno registrados"
```

---

### Task 9: Ligar o modo Supabase no app e aceitar com a Verdeluz

**Files:**
- Modify: `src/apps/web/lib/servidor.ts`, `.env.example`

**Interfaces:**
- Consumes: `criarClienteSupabase`, `SupabaseRepositorio`, `SupabaseArmazem` (Task 3), `Mesa` (Task 4), `NuvemArmazenamento` (Task 5), `MemoriaSessao` (Task 7).

- [ ] **Step 1: Ligar em `servidor()`.** Com `PLANEJAMENTO_DADOS === "supabase"`: sem `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`, lançar `Error("PLANEJAMENTO_DADOS=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env da raiz.")`. Senão, montar cliente, repositório, armazém, `Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem })`, `NuvemArmazenamento` e `MemoriaSessao({ armazem, configDir: process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), cwd: raiz })`, e passar `memoria` ao `ServicoTurnos`. Somar ao `console.info` atual ` | dados: supabase` ou ` | dados: fs` (sem URL nem chave).
- [ ] **Step 2: Documentar no `.env.example`** `PLANEJAMENTO_DADOS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TESTE_URL` e `SUPABASE_TESTE_SERVICE_ROLE_KEY`, com valores vazios e uma linha de comentário cada.
- [ ] **Step 3: Verificação automática**

Run: `cd src && npx turbo run test typecheck`
Expected: tudo PASS.

- [ ] **Step 4: Aceitação manual** (`PLANEJAMENTO_DADOS=supabase`, `PLANEJAMENTO_EXECUTOR=sdk`, `npm run dev` em `src/apps/web`):
  1. Criar o cliente de teste Verdeluz pelo app e posicioná-lo na etapa 01.
  2. Rodar as etapas 01 a 03: enviar insumos, aprovar ao menos um entregável por etapa.
  3. No meio da etapa 02, parar o `next dev`, apagar `clientes/verdeluz-teste/` e a sessão em `~/.claude/projects/<raiz codificada>/<sessionId>.jsonl`, subir de novo e mandar uma mensagem. Esperado: os arquivos voltam e o chat mostra `Retomei a etapa a partir do histórico.`
  4. Repetir o passo 3 apagando só a pasta (sem apagar a sessão). Esperado: os arquivos voltam e o agente segue sem o aviso de retomada.
  5. No painel do Supabase, conferir as linhas em `prospects`, `eventos_conversa`, `arquivos`, `uso_turnos` (com `custo_usd`) e os objetos nos buckets.

Pronto quando os cinco itens se confirmarem (critério da Fase A no spec).

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/servidor.ts .env.example
git commit -m "feat(web): modo de dados Supabase escolhido por PLANEJAMENTO_DADOS"
```
