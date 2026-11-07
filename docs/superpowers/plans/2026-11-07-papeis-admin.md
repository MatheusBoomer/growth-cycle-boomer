# Papéis e visibilidade (admin × usuário) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar os papéis admin e usuário. O usuário comum vê e trabalha só nos próprios projetos; o admin vê todos, troca o dono dos projetos e concede ou retira o papel de admin na aba "Pessoas" de `/admin`.

**Architecture:**
- O papel fica em `planejamento.usuarios`. A troca de papel é feita pela função SQL `planejamento.alterar_papel`, que trava as linhas e garante que sempre reste um admin.
- No `core`, um módulo puro (`papeis.ts`) decide quem vê qual prospect. Um repositório de usuários (memória e Supabase) registra acessos e troca papéis. O `Repositorio` de prospects ganha leitura e troca do dono (`criado_por`).
- No `web`, `lib/sessao.ts` ganha `exigirAdmin` e `exigirAcessoAoProspect`. A varredura de rotas existente passa a exigir essas checagens nas rotas certas.

**Tech Stack:**
- Next.js (App Router) e TypeScript.
- Vitest.
- `@supabase/supabase-js` 2.x e Postgres (Supabase compartilhado, schema `planejamento`).
- Docker (`postgres:16`), só para o teste local da função SQL.

**Spec:** `docs/superpowers/specs/2026-11-07-papeis-admin-design.md`

Todos os caminhos são relativos à raiz do repositório. Os comandos `npm` rodam em `src/`, salvo indicação.

## Global Constraints

- Nada fora do schema `planejamento` é criado, alterado ou removido no Supabase: o projeto é compartilhado com o `pit`.
- A migração SQL só é aplicada pelo MCP do Supabase (`apply_migration`), depois de mostrar o SQL ao analista e ele aprovar.
- Papéis válidos: exatamente `admin` e `usuario`.
- Admin inicial: `matheus.moreira@boomer.com.br`.
- E-mails são comparados e gravados em minúsculas, sem espaços nas pontas.
- `ultimo_acesso` é atualizado só quando o valor gravado tem mais de 1 hora.
- Com `PLANEJAMENTO_AUTH=off`, ou sem repositório de usuários (`PLANEJAMENTO_DADOS=fs`), todos são `admin` e nenhuma consulta de papel é feita.
- Uma falha ao ler o papel derruba a requisição (500). Nunca se presume admin.
- Textos fixos da interface e das respostas:
  - prospect inacessível: `Projeto não encontrado.` (404, código `nao_encontrado`);
  - rota de admin para usuário: `Só administradores podem fazer isso.` (403, código `sem_permissao`);
  - último admin: `É preciso manter pelo menos um administrador.` (409, código `ultimo_admin`);
  - confirmação ao rebaixar a si mesmo: `Você vai perder o acesso à administração.`
- Os textos da interface não usam travessão: o teste `sem-travessao.test.ts` do core já cobra isso.
- Nunca ler `.env` nem `.env.example`.

## Review Focus

1. **E-mail com maiúsculas.** Um `criado_por` antigo gravado como `Ana.Silva@boomer.com.br` continua sendo da `ana.silva@boomer.com.br`. Teste na Task 2.
2. **Prospect alheio × inexistente × excluído.** Os três respondem a mesma coisa (404 `Projeto não encontrado.`), sem revelar qual é o caso. Teste na Task 6.
3. **Admin que rebaixa a si mesmo.** A troca dá certo, e a próxima chamada de admin dessa pessoa responde 403. A interface manda a pessoa para `/`. Teste na Task 7.
4. **Trocar dono com e-mail digitado com maiúsculas ou espaços.** O e-mail é normalizado antes de conferir se existe. Um e-mail não registrado responde 400. Teste na Task 7.
5. **Cliente de teste cujo dono deixou de ser admin.** Ele some para essa pessoa, porque a marca `teste` vence o dono. Teste na Task 2.

---

### Task 1: Migração `usuarios` e função `alterar_papel`, testadas num Postgres descartável

**Files:**
- Create: `supabase/migrations/20261107120000_usuarios.sql`
- Create: `supabase/testes/usuarios.sql` (asserções em blocos `DO`)
- Create: `supabase/testes/testar-usuarios.sh` (sobe `postgres:16` no Docker, cria os papéis `anon`, `authenticated` e `service_role` e o schema `planejamento`, aplica a migração, roda as asserções e o teste de concorrência, e derruba o contêiner)

**Interfaces:**
- Produces:
  - tabela `planejamento.usuarios` (colunas do spec, seção 1);
  - função `planejamento.alterar_papel(alvo text, novo_papel text, autor text) returns void`;
  - exceções com `errcode = 'P0001'` e as mensagens exatas `autor_nao_admin`, `alvo_inexistente`, `ultimo_admin` e `papel_invalido`.

- [ ] **Step 1: Escrever as asserções em `supabase/testes/usuarios.sql`**

Cada caso é um bloco `DO` que dá `raise exception` quando falha. Partem de uma tabela limpa, com `a@x` admin e `b@x` usuário.

| Caso | Resultado esperado |
|---|---|
| `alterar_papel('b@x','admin','a@x')` | `b@x` vira admin |
| `alterar_papel('a@x','usuario','b@x')` | `a@x` vira usuário (rebaixamento de outro admin) |
| `alterar_papel('b@x','usuario','b@x')` sendo o único admin | erro `ultimo_admin` |
| `alterar_papel('b@x','admin','c@x')`, com `c@x` não admin | erro `autor_nao_admin` |
| alvo inexistente | erro `alvo_inexistente` |
| `novo_papel = 'dono'` | erro `papel_invalido` |
| promover quem já é admin | sem erro; `papel_alterado_em` não muda |
| troca bem-sucedida | grava `papel_alterado_por` e `papel_alterado_em` |
| a migração aplicada | `matheus.moreira@boomer.com.br` existe como admin |

- [ ] **Step 2: Escrever `supabase/testes/testar-usuarios.sh` e rodar**

O script também tem o teste de concorrência:
1. Com dois admins (`a@x` e `b@x`), duas sessões `psql` em segundo plano rodam ao mesmo tempo `begin; select planejamento.alterar_papel('a@x','usuario','b@x'); select pg_sleep(1); commit;` e o rebaixamento inverso.
2. Depois, `select count(*) from planejamento.usuarios where papel='admin'` precisa dar `1`, e uma das sessões precisa ter falhado com `ultimo_admin`.
3. O seed do Matheus é apagado antes desse caso, para que a contagem só envolva `a@x` e `b@x`.

Run: `bash supabase/testes/testar-usuarios.sh`
Expected: FAIL, porque a migração ainda não existe.

- [ ] **Step 3: Escrever a migração**

- Usa `create table if not exists`. A coluna `papel` tem o `check` do spec.
- RLS ligado, sem políticas.
- `grant all` para `service_role`. `revoke all` da tabela e da função para `public`, `anon` e `authenticated`; `grant execute` da função para `service_role`.
- O seed usa `insert … on conflict do nothing`.

Algoritmo da função (`language plpgsql`, `security invoker`, `set search_path = ''`), na ordem:
1. `novo_papel` diferente de `admin` e `usuario` → `papel_invalido`.
2. `perform 1 from planejamento.usuarios where papel = 'admin' for update`.
3. O autor não é admin → `autor_nao_admin`.
4. O alvo não existe → `alvo_inexistente`.
5. O papel atual já é o pedido → `return`.
6. Rebaixamento com `count(admin) <= 1` → `ultimo_admin`.
7. `update`, gravando `papel`, `papel_alterado_por = autor` e `papel_alterado_em = now()`.

- [ ] **Step 4: Rodar o script**

Run: `bash supabase/testes/testar-usuarios.sh`
Expected: `usuarios: todas as asserções passaram` e `concorrência: 1 admin restante`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261107120000_usuarios.sql supabase/testes/
git commit -m "feat(banco): tabela de usuários e troca de papel que nunca zera os admins"
```

---

### Task 2: Regras puras de papel e os erros novos

**Files:**
- Create: `src/packages/core/src/papeis.ts`
- Modify: `src/packages/core/src/erros.ts` (duas classes novas)
- Test: `src/packages/core/test/papeis.test.ts`

**Interfaces:**
- Produces:
  - `type Papel = "admin" | "usuario"`
  - `interface UsuarioComPapel { email: string | null; papel: Papel }`
  - `interface DadosDeAcesso { criadoPor: string | null; teste: boolean }`
  - `normalizarEmail(email: string): string` (aparar e passar para minúsculas)
  - `ehAdmin(u: UsuarioComPapel): boolean`
  - `podeVerProspect(u: UsuarioComPapel, p: DadosDeAcesso): boolean`
  - `class ErroSemPermissao extends ErroDominio` (403, `sem_permissao`, `Só administradores podem fazer isso.`)
  - `class ErroUltimoAdmin extends ErroDominio` (409, `ultimo_admin`, `É preciso manter pelo menos um administrador.`)

- [ ] **Step 1: Escrever os testes que falham**

```ts
const ana = { email: "ana.silva@boomer.com.br", papel: "usuario" } as const
const admin = { email: "chefe@boomer.com.br", papel: "admin" } as const
it("usuário vê o próprio prospect, mesmo com maiúsculas no criado_por", () => {
  expect(podeVerProspect(ana, { criadoPor: "Ana.Silva@boomer.com.br", teste: false })).toBe(true)
})
it("usuário não vê prospect de outra pessoa nem sem dono", () => {
  expect(podeVerProspect(ana, { criadoPor: "bia@boomer.com.br", teste: false })).toBe(false)
  expect(podeVerProspect(ana, { criadoPor: null, teste: false })).toBe(false)
})
it("cliente de teste é só de admin, mesmo quando o dono gravado é o usuário", () => {
  expect(podeVerProspect(ana, { criadoPor: "ana.silva@boomer.com.br", teste: true })).toBe(false)
  expect(podeVerProspect(admin, { criadoPor: null, teste: true })).toBe(true)
})
it("admin vê tudo", () => { expect(podeVerProspect(admin, { criadoPor: "x@y", teste: false })).toBe(true) })
it("modo sem login (e-mail nulo, admin) vê tudo", () => {
  expect(podeVerProspect({ email: null, papel: "admin" }, { criadoPor: null, teste: false })).toBe(true)
})
it("erros novos têm status e código", () => {
  expect(new ErroSemPermissao().status).toBe(403)
  expect(new ErroUltimoAdmin().codigo).toBe("ultimo_admin")
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/papeis.test.ts` (em `src/packages/core`)
Expected: FAIL, com o módulo não encontrado.

- [ ] **Step 3: Implementar `papeis.ts` e as classes de erro**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/papeis.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/papeis.ts src/packages/core/src/erros.ts src/packages/core/test/papeis.test.ts
git commit -m "feat(core): regras de quem vê qual prospect e erros de permissão"
```

---

### Task 3: Repositório de usuários (memória e Supabase)

**Files:**
- Create: `src/packages/core/src/nuvem/usuarios.ts`, com a interface e `MemoriaUsuarios`
- Create: `src/packages/core/src/nuvem/usuarios-supabase.ts`, com `SupabaseUsuarios`
- Create: `src/packages/core/test/nuvem/contrato-usuarios.ts`, a suíte compartilhada
- Create: `src/packages/core/test/nuvem/usuarios.test.ts`, que roda o contrato contra a memória e casos do `SupabaseUsuarios` com o falso de `supabase-fake.test.ts`
- Modify: `src/packages/core/test/nuvem/supabase.test.ts`, que passa a rodar o contrato na suíte viva

**Interfaces:**
- Consumes (Task 2): `Papel`, `normalizarEmail`, `ErroSemPermissao`, `ErroUltimoAdmin`, `ErroNaoEncontrado`.
- Produces:

```ts
export interface PessoaRegistrada { email: string; papel: Papel; primeiroAcesso: string; ultimoAcesso: string }
export interface RepositorioUsuarios {
  /** Registra como "usuario" se faltar; atualiza ultimo_acesso se tiver mais de 1 h; devolve o papel. */
  registrarAcesso(email: string): Promise<Papel>
  /** Ordenado por e-mail. */
  listar(): Promise<PessoaRegistrada[]>
  existe(email: string): Promise<boolean>
  /** ErroSemPermissao (autor não admin), ErroNaoEncontrado (alvo), ErroUltimoAdmin, ErroEntrada (papel inválido). */
  alterarPapel(alvo: string, papel: Papel, autor: string): Promise<void>
}
// Os dois construtores recebem `agora: () => Date` opcional, para os testes controlarem a hora.
// MemoriaUsuarios: construtor (admins: string[] = [], agora?)
// SupabaseUsuarios: construtor (cliente: SupabaseClient, agora?)
```

- [ ] **Step 1: Escrever `contrato-usuarios.ts`**

Assinatura: `contratoUsuarios(nome, criar: (agora: () => Date) => Promise<{ repo: RepositorioUsuarios; semearAdmin(email: string): Promise<void> }>)`. Cada caso usa e-mails próprios, `contrato-<hex>@teste.invalid`, gerados por uma função nova `novoEmail()` em `suite-viva.ts`. Casos:
- o primeiro `registrarAcesso` devolve `usuario` e a pessoa aparece em `listar()`;
- `registrarAcesso("  ANA@X  ")` grava `ana@x`;
- `ultimo_acesso` não muda 30 min depois e muda 61 min depois;
- um admin semeado promove outra pessoa, e o `registrarAcesso` dela passa a devolver `admin`;
- um admin rebaixa outro admin (havendo dois ou mais);
- autor não admin → `ErroSemPermissao`;
- alvo não registrado → `ErroNaoEncontrado`.

O caso "último admin" fica fora do contrato, porque na suíte viva a tabela tem o admin real. Ele vai para um teste só da memória, em `usuarios.test.ts`, além do teste SQL da Task 1.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/nuvem/usuarios.test.ts`
Expected: FAIL, com o módulo não encontrado.

- [ ] **Step 3: Implementar `MemoriaUsuarios` e `SupabaseUsuarios`**

`SupabaseUsuarios.registrarAcesso`:
1. Um `select papel, ultimo_acesso` por e-mail.
2. Se a pessoa não existe, `upsert({ email }, { onConflict: "email", ignoreDuplicates: true })` e um novo `select`.
3. Se o acesso tem mais de 1 hora, `update ultimo_acesso`.

No caso comum, isso é uma consulta só.

`alterarPapel` chama `cliente.rpc("alterar_papel", { alvo, novo_papel, autor })` e converte `error.message` assim:

| Mensagem | Erro |
|---|---|
| `autor_nao_admin` | `ErroSemPermissao` |
| `alvo_inexistente` | `ErroNaoEncontrado("Pessoa não encontrada.")` |
| `ultimo_admin` | `ErroUltimoAdmin` |
| `papel_invalido` | `ErroEntrada` |
| qualquer outra | o `falha(error)` que já existe |

Os e-mails passam por `normalizarEmail`.

- [ ] **Step 4: Ligar o contrato na suíte viva**

Em `supabase.test.ts`:
- `semearAdmin` faz `upsert` direto com o papel `admin`;
- o `afterAll` apaga `usuarios` cujo e-mail termina em `@teste.invalid` e começa com o prefixo de contrato.

- [ ] **Step 5: Rodar**

Run: `npx vitest run test/nuvem/usuarios.test.ts`
Expected: PASS

Run: `npm run test:supabase`
Expected: PASS, ou pulado sem `SUPABASE_TESTE_*`. Esta suíte só passa depois da Task 9, quando a migração for aplicada. Até lá, anote como pendente.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core/src/nuvem/usuarios*.ts src/packages/core/test/nuvem/
git commit -m "feat(core): repositório de usuários com registro de acesso e troca de papel"
```

---

### Task 4: Dono do prospect e listagem filtrada no serviço

**Files:**
- Modify: `src/packages/core/src/nuvem/tipos.ts` (`Repositorio`)
- Modify: `src/packages/core/src/nuvem/memoria.ts` e `src/packages/core/src/nuvem/supabase.ts`
- Modify: `src/packages/core/src/armazenamento.ts` (`FsArmazenamento`) e `src/packages/core/src/nuvem/armazenamento-nuvem.ts`
- Modify: `src/packages/core/src/tipos.ts` (`ResumoProspect.dono`)
- Modify: `src/packages/core/src/servico-planejamento.ts`
- Test: `src/packages/core/test/nuvem/contrato-repositorio.ts`, `src/packages/core/test/servico-planejamento.test.ts` e `src/packages/core/test/nuvem/armazenamento-nuvem.test.ts`

**Interfaces:**
- Consumes (Task 2): `UsuarioComPapel`, `podeVerProspect`, `normalizarEmail`.
- Produces:
  - `Repositorio.lerDono(slug: string): Promise<string | null>`: `ErroNaoEncontrado` se o prospect não existe ou foi excluído.
  - `Repositorio.listarDonos(): Promise<Map<string, string | null>>`: só prospects ativos.
  - `Repositorio.trocarDono(slug: string, email: string): Promise<void>`: `ErroNaoEncontrado` se o prospect não existe.
  - `FsArmazenamento`:
    - `lerDono` devolve `null`;
    - `listarDonos` devolve um `Map` vazio;
    - `trocarDono` lança `ErroEntrada("Trocar o dono só existe com os dados na nuvem.")`.
  - `NuvemArmazenamento` repassa esses métodos ao repositório.
  - `ResumoProspect.dono: string | null`
  - `ServicoPlanejamento`:
    - `listarProspects(usuario: UsuarioComPapel)`: filtrada por `podeVerProspect`, com `dono` preenchido (um único `listarDonos`);
    - `prospectVisivel(usuario: UsuarioComPapel, slug: string): Promise<boolean>`: `false` para prospect inexistente ou excluído, sem lançar; para admin, só confere se o prospect existe;
    - `trocarDono(slug: string, email: string): Promise<void>`: normaliza o e-mail e repassa.

- [ ] **Step 1: Escrever os testes que falham**

- Contrato (`contrato-repositorio.ts`, roda na memória e na suíte viva):
  - `lerDono` devolve o criador;
  - `trocarDono` muda o valor lido;
  - `listarDonos` não traz prospect excluído;
  - `lerDono` de um prospect excluído lança `ErroNaoEncontrado`.
- Serviço (`servico-planejamento.test.ts`, com `NuvemArmazenamento` sobre `MemoriaRepositorio`, como os testes de nuvem já fazem):
  - `listarProspects` de um usuário traz só os dele, com `dono` preenchido;
  - admin recebe todos;
  - o cliente de teste não aparece para um usuário comum;
  - `prospectVisivel` dá `false` para um prospect alheio, um inexistente e um excluído, e `true` para o próprio.
- Disco: `listarProspects({ email: null, papel: "admin" })` continua trazendo todos, com `dono: null`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/servico-planejamento.test.ts test/nuvem/memoria.test.ts test/nuvem/armazenamento-nuvem.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar e atualizar quem chama `listarProspects`**

`grep -rn "listarProspects(" src/apps src/packages --include='*.ts' --include='*.tsx'` mostra os chamadores. Por enquanto, as chamadas do `web` passam `{ email: null, papel: "admin" }`; as Tasks 5 e 6 trocam pelo usuário real.

- [ ] **Step 4: Rodar a suíte do core inteira**

Run: `npm test` (em `src/packages/core`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): dono do prospect e listagem filtrada por papel"
```

---

### Task 5: Sessão com papel, `exigirAdmin` e `exigirAcessoAoProspect`

**Files:**
- Modify: `src/apps/web/lib/sessao.ts`
- Modify: `src/apps/web/lib/servidor.ts` (`Servidor.usuarios`)
- Test: `src/apps/web/lib/sessao.test.ts`

**Interfaces:**
- Consumes:
  - Task 2: `Papel`, `UsuarioComPapel`, `ErroSemPermissao`;
  - Task 3: `RepositorioUsuarios`, `SupabaseUsuarios`;
  - Task 4: `servico.prospectVisivel`.
- Produces:
  - `Usuario` passa a ser `UsuarioComPapel`. `usuarioDeClaims` continua devolvendo só `{ email }`, com o tipo `{ email: string }`.
  - `Servidor.usuarios: RepositorioUsuarios | null`: `SupabaseUsuarios` no modo `supabase` (mesmo cliente de `montarNuvem`), `null` no modo `fs`.
  - `usuarioDaRequisicao(): Promise<Usuario | null>`:
    - modo `off` → `{ email: null, papel: "admin" }`;
    - claims válidas e `usuarios === null` → `papel: "admin"`;
    - senão, `papel = await usuarios.registrarAcesso(email)`. Essa chamada fica fora do `try` das claims, para que uma falha suba e nunca vire `null` nem admin.
  - `exigirAdmin(): Promise<Usuario>`: 401 sem usuário, `ErroSemPermissao` se não for admin.
  - `exigirAcessoAoProspect(params: Promise<{ slug: string }>): Promise<Usuario>`: 401 sem usuário; `ErroNaoEncontrado("Projeto não encontrado.")` quando `prospectVisivel` dá `false`. Recebe o `ctx.params` da rota, para poder ser a primeira instrução do handler (exigência da varredura).

- [ ] **Step 1: Escrever os testes que falham**

Em `sessao.test.ts`, com `@/lib/servidor` simulado:
- modo `off` → admin, sem chamar `registrarAcesso`;
- `registrarAcesso` devolve `usuario` → `exigirAdmin` lança 403;
- `registrarAcesso` rejeita → `usuarioDaRequisicao` rejeita (não devolve `null`);
- `exigirAcessoAoProspect(Promise.resolve({ slug: "x" }))` com `prospectVisivel` falso → 404 com a mensagem `Projeto não encontrado.`;
- com `prospectVisivel` verdadeiro → devolve o usuário.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/sessao.test.ts` (em `src/apps/web`)
Expected: FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/sessao.test.ts lib/servidor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/lib/sessao.ts src/apps/web/lib/servidor.ts src/apps/web/lib/sessao.test.ts
git commit -m "feat(web): sessão com papel e checagens de admin e de acesso ao prospect"
```

---

### Task 6: Aplicar as checagens nas rotas existentes e cobrar na varredura

**Files:**
- Modify: `src/apps/web/app/api/varredura-rotas.ts`
- Modify: `src/apps/web/app/api/rotas-exigem-usuario.test.ts`
- Modify: as 20 rotas em `src/apps/web/app/api/prospects/[slug]/**/route.ts` (as 2 de `teste/` ficam com `exigirAdmin`; as outras 18 com `exigirAcessoAoProspect`)
- Modify:
  - `src/apps/web/app/api/prospects/route.ts`;
  - `src/apps/web/app/api/cliente-teste/route.ts`;
  - `src/apps/web/app/api/sistema/route.ts`;
  - `src/apps/web/app/api/uso/route.ts`.
- Modify: `src/apps/web/app/page.tsx` e `src/apps/web/app/prospects/[slug]/page.tsx`
- Test: `src/apps/web/app/api/acesso-prospect.test.ts`

**Interfaces:**
- Consumes (Task 5): `exigirAdmin`, `exigirAcessoAoProspect`, `usuarioDaRequisicao`; (Task 4) `servico.listarProspects(usuario)`, `servico.prospectVisivel`.
- Produces:
  - `problemasDeRota(fonte: string, exigida?: "usuario" | "admin" | "prospect"): string[]`. Sem o segundo argumento, aceita qualquer uma das três checagens.
  - A regra da primeira instrução passa a aceitar `await exigirUsuario()`, `await exigirAdmin()` e `await exigirAcessoAoProspect(<id>.params)`, com ou sem `const|let usuario =`.
  - `IMPORTA_EXIGIR` aceita qualquer um dos três nomes.

- [ ] **Step 1: Escrever os testes que falham**

Em `rotas-exigem-usuario.test.ts`:
- Na varredura nova, rotas sob `api/admin/`, `api/cliente-teste/`, `api/prospects/[slug]/teste/`, `api/sistema/` e `api/uso/` exigem `admin`.
- As demais rotas sob `api/prospects/[slug]/` exigem `prospect`.
- Sondas novas: uma rota em `[slug]` que chama só `exigirUsuario()` é reprovada quando a exigência é `prospect`; `await exigirAcessoAoProspect(ctx.params)` é aceita.
- Atualizar os mocks de `@/lib/sessao` do arquivo para incluir `exigirAdmin` e `exigirAcessoAoProspect`.

Em `acesso-prospect.test.ts`, com o `servidor` simulado e o `MemoriaRepositorio` atrás:
- usuário comum, na rota de estado, recebe exatamente o mesmo corpo e status (`404`, `Projeto não encontrado.`) para um prospect alheio, um inexistente e um excluído (Review Focus 2);
- `GET /api/prospects` de um usuário comum traz só os prospects dele;
- usuário comum em `POST /api/cliente-teste` recebe 403.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run app/api` (em `src/apps/web`)
Expected: FAIL. A varredura lista as rotas sem a checagem nova.

- [ ] **Step 3: Trocar a primeira instrução de cada rota**

- Rotas `[slug]`: `const usuario = await exigirAcessoAoProspect(ctx.params)`. O resto do handler continua lendo `ctx.params` como antes.
- Rotas de admin: `await exigirAdmin()`.
- `api/prospects/route.ts`, no `GET`: `servico.listarProspects(usuario)`.
- `app/page.tsx`: passa o usuário a `listarProspects`.
- `prospects/[slug]/page.tsx`: chama `usuarioDaRequisicao()` (sem usuário, `redirect("/login")`) e `servidor().servico.prospectVisivel(usuario, slug)` (falso, `notFound()`) antes de renderizar.

- [ ] **Step 4: Rodar a suíte do web**

Run: `npm test` (em `src/apps/web`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/app
git commit -m "feat(web): cada rota de prospect confere o dono e rotas de operação são só de admin"
```

---

### Task 7: API de administração (pessoas, papel e dono)

**Files:**
- Create: `src/apps/web/app/api/admin/pessoas/route.ts` (`GET`)
- Create: `src/apps/web/app/api/admin/pessoas/papel/route.ts` (`POST`)
- Create: `src/apps/web/app/api/admin/prospects/[slug]/dono/route.ts` (`POST`)
- Modify: `src/apps/web/lib/api.ts`
- Test: `src/apps/web/app/api/admin/admin.test.ts`

**Interfaces:**
- Consumes:
  - Task 5: `exigirAdmin`, `servidor().usuarios`;
  - Task 3: `RepositorioUsuarios`;
  - Task 4: `servico.trocarDono` e `armazenamento.listarDonos`.
- Produces:
  - `GET /api/admin/pessoas` → `{ pessoas: Array<PessoaRegistrada & { projetos: number }>, admins: number }`. `projetos` conta os prospects ativos com `criado_por` igual ao e-mail, sem diferença de maiúsculas.
  - `POST /api/admin/pessoas/papel` com `{ email: string, papel: Papel }` → `{ ok: true }`. Erros: 400 (papel inválido), 404, 409 `ultimo_admin`.
  - `POST /api/admin/prospects/[slug]/dono` com `{ email: string }` → `{ ok: true }`. Normaliza o e-mail; 400 `Essa pessoa ainda não entrou no app.` se `usuarios.existe` dá falso; 404 se o prospect não existe.
  - Com `usuarios === null` (modo `fs`), as três rotas respondem 400 `A administração de pessoas só existe com os dados na nuvem.`
  - Em `lib/api.ts`: `api.listarPessoas()`, `api.alterarPapel(email, papel)` e `api.trocarDono(slug, email)`, no padrão das funções vizinhas.

- [ ] **Step 1: Escrever os testes que falham**

Com `MemoriaUsuarios(["chefe@boomer.com.br"])` e `MemoriaRepositorio`:
- usuário comum → 403 nas três rotas;
- o admin rebaixa a si mesmo havendo outro admin → 200, e a chamada seguinte de `GET /api/admin/pessoas` com esse usuário → 403 (Review Focus 3);
- rebaixar o último admin → 409 com o código `ultimo_admin`;
- `trocarDono` com `"  Bia@Boomer.com.br "` → grava `bia@boomer.com.br` (Review Focus 4);
- e-mail não registrado → 400.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run app/api/admin`
Expected: FAIL

- [ ] **Step 3: Implementar as rotas e as funções de `api.ts`**

- [ ] **Step 4: Rodar a suíte do web, incluindo a varredura**

Run: `npm test` (em `src/apps/web`)
Expected: PASS. A varredura confirma `exigirAdmin` nas rotas novas.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/app/api/admin src/apps/web/lib/api.ts
git commit -m "feat(web): API de administração para pessoas, papéis e dono do prospect"
```

---

### Task 8: Telas (contexto do papel, barra, home e `/admin/pessoas`)

**Files:**
- Modify: `src/apps/web/components/marca/conta-contexto.tsx`, com `papel` no provedor e o hook `usePapel(): Papel`
- Modify: `src/apps/web/app/layout.tsx`, que repassa `usuario.papel`, com `"usuario"` como padrão quando falha
- Modify: `src/apps/web/components/marca/barra-topo.tsx`, com o link "Administração" (`/admin/pessoas`) só para admin
- Modify:
  - `src/apps/web/components/home/grade-prospects.tsx`;
  - `src/apps/web/components/home/card-prospect.tsx`.
- Create:
  - `src/apps/web/components/home/dialogo-trocar-dono.tsx`;
  - `src/apps/web/lib/filtro-prospects.ts`, com a função pura `filtrarProspects(lista, { busca, apenasMeus, email })`.
- Create:
  - `src/apps/web/app/admin/layout.tsx`, que chama `usuarioDaRequisicao()` e, se não for admin, `redirect("/")`; tem `BarraTopo` e abas, por enquanto só "Pessoas";
  - `src/apps/web/app/admin/page.tsx`, com `redirect("/admin/pessoas")`.
- Create:
  - `src/apps/web/app/admin/pessoas/page.tsx`;
  - `src/apps/web/components/admin/tabela-pessoas.tsx`.
- Test:
  - `src/apps/web/lib/filtro-prospects.test.ts`;
  - `src/apps/web/components/admin/tabela-pessoas.test.ts`, com a função pura `rotuloAcao(pessoa, { admins, euMesmo })`.

**Interfaces:**
- Consumes:
  - Task 4: `ResumoProspect.dono`;
  - Task 7: `api.listarPessoas`, `api.alterarPapel` e `api.trocarDono`;
  - `nomeCurto`, que já existe em `@workspace/core/autenticacao`.
- Produces:
  - `rotuloAcao(p, ctx)` devolve `{ texto: "Tornar admin" | "Retirar admin"; desabilitado: boolean; motivo: string | null; confirmacao: string }`.
  - Para a linha do próprio admin, `confirmacao` inclui `Você vai perder o acesso à administração.`
  - Com `admins === 1` e a pessoa sendo admin, `desabilitado` é `true` e `motivo` é `É preciso manter pelo menos um administrador.`

- [ ] **Step 1: Escrever os testes que falham**

`filtrarProspects`:
- `apenasMeus` traz só os prospects com `dono` igual ao e-mail, sem diferença de maiúsculas;
- a busca continua funcionando junto com o filtro.

`rotuloAcao`:
- os três casos do bloco Produces;
- usuário comum → `Tornar admin` habilitado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/filtro-prospects.test.ts components/admin`
Expected: FAIL

- [ ] **Step 3: Implementar**

Home:
- Para quem não é admin, `DialogoClienteTeste` não é renderizado.
- O admin vê o alternador "Meus / Todos" (começa em "Todos") e, no cartão, `nomeCurto(dono)` ou "Sem dono".
- No menu do cartão do admin, o item "Trocar dono" abre `DialogoTrocarDono`. O diálogo carrega `api.listarPessoas()`, mostra uma lista de seleção e confirma; depois chama `router.refresh()`.

Tabela "Pessoas":
- Colunas: nome, e-mail, papel, primeiro acesso, último acesso e projetos. As datas usam o formato `pt-BR`.
- Botão de ação conforme `rotuloAcao`, com o motivo em tooltip quando desabilitado.
- A confirmação usa o `AlertDialog` do pacote `ui`.
- Depois de rebaixar a si mesmo, `router.push("/")`. Nos outros casos, recarrega a lista.

Para os componentes de interface, seguir os que o app já usa em `@workspace/ui/components/*` (por exemplo `dropdown-menu`, `dialog`, `table`, `tabs`, `alert-dialog`, `tooltip`). Componente que faltar entra com a skill `shadcn`.

- [ ] **Step 4: Rodar a suíte do web e conferir os tipos**

Run: `npm test` (em `src/apps/web`) e `npx tsc --noEmit -p apps/web` (em `src`)
Expected: PASS, sem erros de tipo. A varredura de páginas confirma que `/admin/*` checa a sessão antes de `servidor()`.

- [ ] **Step 5: Ver no navegador, no modo local**

Com o app em modo `off` (todos são admin), abrir `http://127.0.0.1:3000`. Conferir:
- o link "Administração" na barra;
- a aba "Pessoas", que mostra o aviso de "só na nuvem" porque o modo é `fs`;
- o filtro "Meus / Todos" na home.

Não rodar o app local com o `.env` de produção (`supabase` + `google`) sem trocar o modo.

- [ ] **Step 6: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): área de administração com a aba Pessoas e home filtrada por papel"
```

---

### Task 9: Backup, aplicação no Supabase, deploy e aceitação

**Files:**
- Modify: `scripts/backup/comum.mjs`, com `{ nome: "usuarios", chave: ["email"] }` na lista `TABELAS`, depois de `prospects`
- Test: os testes existentes de `scripts/backup` (`grep -l TABELAS scripts/backup -r` mostra quais)

- [ ] **Step 1: Incluir `usuarios` no backup e rodar os testes do backup**

Run: os testes de backup existentes.
Expected: PASS

- [ ] **Step 2: Commit**

```bash
git add scripts/backup/comum.mjs
git commit -m "feat(backup): tabela de usuários no backup diário"
```

- [ ] **Step 3: Aplicar a migração**

1. Mostrar ao analista o SQL de `20261107120000_usuarios.sql`.
2. Com o OK dele, aplicar pelo MCP do Supabase (`apply_migration`, nome `planejamento_usuarios`).
3. Conferir com `select email, papel from planejamento.usuarios;`. Esperado: uma linha, `matheus.moreira@boomer.com.br | admin`.

- [ ] **Step 4: Rodar a suíte viva**

Run: `npm run test:supabase` (em `src/packages/core`)
Expected: PASS. Depois, `select count(*) from planejamento.usuarios where email like '%@teste.invalid'` deve dar `0`.

- [ ] **Step 5: Abrir o PR e fazer o deploy**

Depois do merge na `main`, o analista roda na VPS:

```bash
cd /opt/planejamento/app && git pull && docker build -t planejamento:vps . && cd .. && docker compose up -d app
```

- [ ] **Step 6: Aceitação manual com o analista**

1. Uma segunda conta `@boomer.com.br` entra e vê só os projetos que ela mesma criou, sem o botão "Cliente de teste" e sem o link "Administração".
2. Ela cola o endereço de um projeto do Matheus e recebe "Projeto não encontrado".
3. O Matheus a promove em "Pessoas"; ela passa a ver todos os projetos e rebaixa o Matheus.
4. Com um admin só, o botão "Retirar admin" fica desabilitado.
5. "Trocar dono" passa um projeto de uma pessoa para a outra, e ele aparece na home da nova dona.

Ao final, o backup do dia seguinte deve listar `usuarios=` no resumo.
