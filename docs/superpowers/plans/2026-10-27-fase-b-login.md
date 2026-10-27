# Fase B — Login com Google e autoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com `PLANEJAMENTO_AUTH=google`, só contas Google `@boomer.com.br` ou `@gestaoboomer.com` usam o app; cada ação do analista grava o e-mail do autor; a tela mostra quem está com o agente rodando; sem a variável, o app segue como hoje.

**Architecture:** Regras de acesso puras no `core` (`autenticacao.ts`: modo, domínios, `decidirAcesso`). No app web, `lib/sessao.ts` lê a sessão do Supabase no servidor com `@supabase/ssr` e `getClaims()`; o `proxy.ts` aplica `decidirAcesso` e renova os cookies; as rotas `/login` e `/auth/*` fazem o fluxo OAuth inteiro no servidor (nenhuma chave no navegador). O autor entra como parâmetro opcional `autor: string | null` nos serviços.

**Tech Stack:** TypeScript, Next 16 (`proxy.ts`), `@supabase/ssr` ^0.12, `@supabase/supabase-js` ^2.118, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-27-fase-b-login-design.md` (substitui a seção 5.5 de `2026-10-27-deploy-railway-supabase-design.md`). A Fase A (PR #1) é pré-requisito: esta branch parte de `feat/fase-a-dados-supabase`.

## Global Constraints

- Login só com `PLANEJAMENTO_AUTH=google`. Vazio ou `off` = comportamento atual (regra de host local, agora também para páginas). Qualquer outro valor lança erro na subida e no `proxy`, no formato de `modoDeDados`: `PLANEJAMENTO_AUTH inválido: "<valor>" (use off ou google).`. `google` sem `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY` lança `PLANEJAMENTO_AUTH=google exige <variável> no .env da raiz.` com o nome da que falta.
- Domínios: `PLANEJAMENTO_DOMINIOS_PERMITIDOS`, separada por vírgulas, padrão exato `boomer.com.br,gestaoboomer.com`. Só o domínio exato vale (sem subdomínio, sem `gestaoboomer.com.br`, sem `boomer.com`). E-mail em minúsculas. E-mail verificado é obrigatório.
- Nada de `NEXT_PUBLIC_*` e nenhuma chave do Supabase no navegador. `SUPABASE_PUBLISHABLE_KEY` só existe no servidor. A chave secreta (`service_role`) não é usada nesta fase.
- A decisão de acesso usa `getClaims()` (assinatura conferida contra as chaves públicas do projeto), nunca `getSession()`.
- `/api/interno/*` fica fora do login, mas só com host local e continua exigindo o token do turno (`ServicoTurnos.contextoDoToken`). O servidor MCP passa a chamar o app em `PLANEJAMENTO_URL_INTERNA` (padrão `http://127.0.0.1:<PORT>`); `PLANEJAMENTO_APP_URL` passa a ser o endereço público (base do `redirectTo` e do host permitido).
- O parâmetro `hd` do Google não é usado. Não mudar a "Site URL" do Supabase (projeto compartilhado com o sistema `pit`).
- `proximo` (destino depois do login) só vale como caminho relativo que começa com uma única `/`; senão `/`.
- Mensagens exatas: página `/login` com erro `dominio` = `Use a conta Google da Boomer (@boomer.com.br ou @gestaoboomer.com).`; erro `falha` = `Não foi possível entrar agora. Tente de novo.`; `ErroNaoAutenticado` = `Você precisa entrar para continuar.` (401, código `nao_autenticado`); turno de outro analista = `<Nome> está com o agente rodando nesta etapa.`
- Código, nomes e comentários em português, no estilo do `core`. Nenhum travessão (—) em arquivos de `src` (o teste `sem-travessao` varre `core/src`, `mcp-planejamento/src` e `apps/web/{app,components,hooks,lib,proxy.ts}`).
- Antes de editar `proxy.ts`, ler a documentação do Next instalado em `src/node_modules/next/dist/docs/` (o Next 16 tem mudanças em relação ao que se conhece). Nunca ler nem imprimir o `.env`.
- Testes de rotina (`npm test`) não tocam no banco nem no Google. Não há teste automático com login real; a aceitação é manual (Task 7).

## Review Focus

1. **`proximo` malicioso** (`//evil.com`, `/\evil.com`, `http://evil.com`, `javascript:`): sempre vira `/`. Pinado na Task 1.
2. **Host falso e Origin de outro site** com o login ligado (`127.0.0.1.evil.com`, `meuapp.railway.app.evil.com`, POST com `Origin` diferente): recusados. `/api/interno/*` pelo host público: recusado. Pinado na Task 1.
3. **Domínios parecidos e e-mail sem verificação** (`x@boomer.com.br.evil.com`, `x@gestaoboomer.com.br`, `x@boomer.com`, `a@b@boomer.com.br`, `email_verified` falso ou ausente): sem usuário. Pinado nas Tasks 1 e 2.
4. **Uma rota que esquece `exigirUsuario`**: um teste varre todos os `route.ts` e falha se algum, fora da lista de isentas, não chamar `exigirUsuario`. Pinado na Task 5.
5. **Sessão expirada no meio do uso**: a API devolve 401 `nao_autenticado` e a interface vai para `/login?proximo=…`; a tela de login não dispara chamadas que dariam 401 em laço (o `VerificacaoSistema` do layout). Pinado na Task 3.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/packages/core/src/autenticacao.ts` | Modo, domínios, `emailPermitido`, `nomeCurto`, `caminhoProximoSeguro`, `decidirAcesso` (tudo puro) |
| `src/packages/core/src/erros.ts` | Novo `ErroNaoAutenticado` |
| `src/packages/core/test/autenticacao.test.ts` | Tabelas de teste das regras acima |
| `src/apps/web/lib/sessao.ts` | `usuarioDeClaims`, cliente Supabase do servidor, `usuarioDaRequisicao`, `exigirUsuario` |
| `src/apps/web/proxy.ts` | Aplica `decidirAcesso`, renova a sessão |
| `src/apps/web/app/login/page.tsx`, `app/auth/{entrar,callback,sair}/route.ts` | Fluxo de login |
| `src/apps/web/components/marca/menu-conta.tsx` | Menu da conta (nome, e-mail, Sair) dentro de `barra-topo.tsx` |
| Modificados | `servidor.ts`, `servico-turnos.ts`, `servico-planejamento.ts`, `servico-comentarios.ts`, `armazenamento.ts`, `nuvem/armazenamento-nuvem.ts`, `nuvem/tipos.ts`, `nuvem/memoria.ts`, `nuvem/supabase.ts`, `tipos.ts`, `comentarios.ts`, rotas de `apps/web/app/api/**`, `lib/api.ts`, `components/chat/chat-etapa.tsx`, `.env.example` |

---

### Task 0: Credenciais do Google e do Supabase (manual, feita pelo analista)

Roteiro passo a passo entregue pelo controlador no chat. Resultado esperado: provedor Google ligado no Supabase, URL de retorno liberada e `SUPABASE_PUBLISHABLE_KEY` no `.env`.

- [ ] **Step 1:** Google Cloud: credencial OAuth "Aplicativo da Web"; URI de redirecionamento `https://fkvvvnitxvfdvtexmidl.supabase.co/auth/v1/callback`; tela de consentimento **Externo**, escopos `openid`, `email`, `profile`, publicado em produção.
- [ ] **Step 2:** Supabase (Authentication → Providers → Google): ligar e colar o ID e o segredo do cliente.
- [ ] **Step 3:** Supabase (Authentication → URL Configuration → Redirect URLs): acrescentar `http://127.0.0.1:3000/auth/callback`. Não alterar a "Site URL".
- [ ] **Step 4:** `.env` da raiz: `SUPABASE_PUBLISHABLE_KEY=<chave publicável>`. O controlador a lê pelo MCP e confere só o nome, nunca o valor.

Pronto quando: o provedor aparece ligado no painel e o `.env` tem a variável.

---

### Task 1: Regras de acesso no `core`

**Files:**
- Create: `src/packages/core/src/autenticacao.ts`, `src/packages/core/test/autenticacao.test.ts`
- Modify: `src/packages/core/src/erros.ts`, `src/packages/core/src/seguranca.ts` (só se precisar expor a regra de escrita)

**Interfaces:**
- Consumes: `requisicaoLocalPermitida` e `DadosRequisicao` de `seguranca.ts`.
- Produces:

```ts
export type ModoAutenticacao = "off" | "google"
export function modoDeAutenticacao(env: Record<string, string | undefined>): ModoAutenticacao   // valida as variáveis do modo google
export function dominiosPermitidos(valor: string | undefined): string[]   // padrão ["boomer.com.br","gestaoboomer.com"]
export function emailPermitido(email: string | null | undefined, dominios: readonly string[]): boolean
export function nomeCurto(email: string): string   // "ana.silva@x.com" -> "Ana Silva"
export function caminhoProximoSeguro(proximo: string | null | undefined): string   // "/" se inseguro
export interface EntradaAcesso {
  modo: ModoAutenticacao; metodo: string; caminho: string   // caminho com query, ex. "/prospects/a?x=1"
  host: string | null; origin: string | null; secFetchSite: string | null
  hostPublico: string | null   // URL(PLANEJAMENTO_APP_URL).host, ou null
  autenticado: boolean
}
export type DecisaoAcesso =
  | { tipo: "passar" }
  | { tipo: "login"; proximo: string }
  | { tipo: "nao_autenticado" }
  | { tipo: "recusar" }
export function decidirAcesso(e: EntradaAcesso): DecisaoAcesso
// erros.ts
export class ErroNaoAutenticado extends ErroDominio   // 401, código "nao_autenticado", mensagem das Global Constraints
```

- [ ] **Step 1: Escrever os testes** em `autenticacao.test.ts`, em tabela:
  - `modoDeAutenticacao`: undefined, vazio, `off` e `" off "` (a regra aparar espaços e comparar exato, como `modoDeDados`) → `off`; `OFF` e `Google` → erro de valor inválido; `google` com as duas variáveis → `google`; `google` sem `SUPABASE_URL` e sem `SUPABASE_PUBLISHABLE_KEY` → erros com o nome da variável; `goggle` → erro `PLANEJAMENTO_AUTH inválido: "goggle" (use off ou google).`
  - `dominiosPermitidos`: undefined e vazio → padrão; `" Boomer.com.br , ,x.com "` → `["boomer.com.br","x.com"]`.
  - `emailPermitido` com o padrão: aceitos `ana@boomer.com.br`, `ANA@GestaoBoomer.com`; recusados `x@boomer.com.br.evil.com`, `x@evilboomer.com.br`, `x@gestaoboomer.com.br`, `x@boomer.com`, `x@sub.boomer.com.br`, `a@b@boomer.com.br`, `@boomer.com.br`, `x@`, `""`, `null`.
  - `nomeCurto`: `ana.silva@boomer.com.br` → `Ana Silva`; `joao_pedro-souza@gestaoboomer.com` → `Joao Pedro Souza`; só `x@y.com` → `X`.
  - `caminhoProximoSeguro`: `/prospects/a?x=1` mantém; `//evil.com`, `/\evil.com`, `http://evil.com`, `javascript:alert(1)`, `evil`, `""`, `undefined`, `/\t/evil.com` e caminho com `\r\n` → `/`.
  - `decidirAcesso`, modo `off`: host `127.0.0.1:3000` GET → `passar`; host `app.exemplo.com` → `recusar` (inclusive para página); POST com `Origin` de outro host → `recusar`.
  - `decidirAcesso`, modo `google`, com `hostPublico: "planejamento.boomer.com.br"`: GET página sem sessão → `{ tipo: "login", proximo: "/prospects/a" }`; GET `/api/prospects` sem sessão → `nao_autenticado`; com sessão → `passar`; host `planejamento.boomer.com.br.evil.com` e `127.0.0.1.evil.com` → `recusar`; POST com `Origin: https://evil.com` mesmo autenticado → `recusar`; `/login` e `/auth/callback` sem sessão → `passar`; `/api/interno/ferramentas` com host local → `passar`, com host público → `recusar`; host local sempre aceito (o desenvolvedor testa o login no Mac).
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/autenticacao.test.ts`
Expected: FAIL, módulo `../src/autenticacao` não encontrado.

- [ ] **Step 3: Implementar** as funções com as assinaturas acima, em `autenticacao.ts`, e `ErroNaoAutenticado` em `erros.ts` no estilo dos erros existentes. A regra de escrita (método que muda estado só com `Origin` igual ao host, ou sem `Origin`) já existe dentro de `requisicaoLocalPermitida`; extraia-a em uma função exportada de `seguranca.ts` (`origemDeEscritaPermitida`) sem mudar o comportamento atual, que os testes de `seguranca.test.ts` fixam.
- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): regras de acesso do login (modo, domínios, decidirAcesso)"
```

---

### Task 2: Sessão no servidor e `proxy.ts`

**Files:**
- Create: `src/apps/web/lib/sessao.ts`, `src/apps/web/lib/sessao.test.ts`, `src/apps/web/proxy.test.ts`
- Modify: `src/apps/web/proxy.ts`, `src/apps/web/package.json` (`@supabase/ssr` `^0.12.7` e `@supabase/supabase-js` `^2.118.0`), `src/package-lock.json`

**Interfaces:**
- Consumes: `modoDeAutenticacao`, `dominiosPermitidos`, `emailPermitido`, `decidirAcesso`, `ErroNaoAutenticado` (Task 1).
- Produces:

```ts
export interface Usuario { email: string | null }   // null no modo off
export function usuarioDeClaims(claims: unknown, dominios: readonly string[]): Usuario | null  // pura
export async function usuarioDaRequisicao(): Promise<Usuario | null>   // lê cookies de next/headers; modo off => { email: null }
export async function exigirUsuario(): Promise<Usuario>                 // lança ErroNaoAutenticado
```

- [ ] **Step 1: Escrever os testes.** `sessao.test.ts`: `usuarioDeClaims` com claims boas (`email`, e-mail verificado em `user_metadata.email_verified` ou `email_verified`) devolve o e-mail em minúsculas; sem `email`, verificado falso ou ausente, domínio de fora, `null`, objeto estranho e `email` não texto → `null`. `exigirUsuario` com `vi.mock` do cliente do servidor: sem sessão lança `ErroNaoAutenticado`; modo `off` devolve `{ email: null }` sem consultar o Supabase. `proxy.test.ts`: com o modo `off` e host local, a resposta deixa passar; com o modo `google`, sem sessão, página responde redirecionamento para `/login?proximo=…` e API responde 401 JSON `{ erro, codigo: "nao_autenticado" }`; host de fora responde 403 `origem_recusada` (mensagem atual). Use um cliente falso no lugar de `@supabase/ssr`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run lib/sessao.test.ts proxy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Instalar e implementar.** `npm install @supabase/ssr@^0.12.7 @supabase/supabase-js@^2.118.0 -w web` (a partir de `src/`). Em `sessao.ts`, `createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies })` e `getClaims()`. No `proxy.ts`, seguir o padrão da documentação do Supabase para Next.js: criar o cliente com os cookies da requisição, chamar `getClaims()` (renova a sessão e escreve os cookies na requisição e na resposta), montar `EntradaAcesso` e responder conforme `DecisaoAcesso` (`passar` = `NextResponse.next({ request })` com os cookies renovados; `login` = redirecionamento; `nao_autenticado` = 401 JSON; `recusar` = 403 JSON com o texto atual de origem recusada). O `matcher` passa a cobrir tudo, menos `_next/static`, `_next/image`, `favicon.ico` e arquivos de imagem. No modo `off` o proxy não cria cliente Supabase.
- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run && npm run typecheck`
Expected: PASS; os testes atuais do app seguem passando.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web src/package-lock.json
git commit -m "feat(web): sessão do Supabase no servidor e proxy com decidirAcesso"
```

---

### Task 3: Rotas e página de login, menu da conta e URL interna do MCP

**Files:**
- Create: `src/apps/web/app/login/page.tsx`, `src/apps/web/app/auth/entrar/route.ts`, `src/apps/web/app/auth/callback/route.ts`, `src/apps/web/app/auth/sair/route.ts`, `src/apps/web/components/marca/menu-conta.tsx`, testes ao lado de cada rota (`route.test.ts`)
- Modify: `src/apps/web/components/marca/barra-topo.tsx`, `src/apps/web/app/layout.tsx` ou `components/sistema/verificacao-sistema.tsx`, `src/apps/web/lib/api.ts`, `src/apps/web/lib/servidor.ts`, `.env.example`

**Interfaces:**
- Consumes: `usuarioDeClaims`, cliente do servidor (Task 2), `caminhoProximoSeguro`, `nomeCurto` (Task 1).
- Produces: rotas `GET /auth/entrar`, `GET /auth/callback`, `POST /auth/sair`, página `/login`; `servidor()` passa `urlApp: process.env.PLANEJAMENTO_URL_INTERNA ?? http://127.0.0.1:${PORT ?? 3000}` ao `ServicoTurnos`.

- [ ] **Step 1: Escrever os testes** (cliente do Supabase falso via `vi.mock`):
  - `entrar`: chama `signInWithOAuth` com `provider: "google"`, `redirectTo` = `<PLANEJAMENTO_APP_URL>/auth/callback?proximo=<caminho seguro>` e **sem** `queryParams.hd`; redireciona para a `url` devolvida; erro do Supabase redireciona para `/login?erro=falha`.
  - `callback`: sem `code` → `/login?erro=falha`; com `code` e e-mail `@boomer.com.br` ou `@gestaoboomer.com` verificado → `exchangeCodeForSession` e redirecionamento para `proximo` seguro; e-mail `@gmail.com` → `signOut()` chamado e redirecionamento `/login?erro=dominio`; `proximo=//evil.com` → `/`; atrás do balanceador (`x-forwarded-host`/`x-forwarded-proto`), o redirecionamento usa o host público e não `localhost`.
  - `sair`: chama `signOut()` e redireciona para `/login`.
  - Página `/login`: renderiza o botão "Entrar com Google" (link para `/auth/entrar`) e as mensagens exatas de `erro=dominio` e `erro=falha`, sem nenhuma chamada de API ao carregar.
  - `lib/api.ts`: um 401 com `codigo: "nao_autenticado"` leva o navegador para `/login?proximo=<caminho atual>` (função isolada e testada; sem laço quando já está em `/login`).
  - `servidor.test.ts`: `urlApp` do MCP usa `PLANEJAMENTO_URL_INTERNA` quando definida e o endereço local quando não.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run app/auth app/login lib/api.test.ts lib/servidor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** as rotas e a página no visual da marca (reutilize `LogoBoomer`, `FundoBoomer` e os componentes de `@workspace/ui`; consulte os componentes de `components/marca`). O `VerificacaoSistema` do layout não pode chamar `/api/sistema` em `/login` nem tratar 401 como "sistema com problema": pule a verificação nessa rota. O `MenuConta` (nome curto, e-mail, botão "Sair" que faz `POST /auth/sair`) aparece em `barra-topo.tsx` só quando o modo é `google` (o servidor informa o e-mail ao componente; no modo `off` nada aparece). Acrescente ao `.env.example`, com valor vazio e um comentário cada: `PLANEJAMENTO_AUTH`, `PLANEJAMENTO_DOMINIOS_PERMITIDOS`, `SUPABASE_PUBLISHABLE_KEY`, `PLANEJAMENTO_URL_INTERNA`; e comente que `PLANEJAMENTO_APP_URL` é o endereço público.
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web .env.example
git commit -m "feat(web): login com Google, rotas de entrada e saída, menu da conta e URL interna do MCP"
```

---

### Task 4: Autoria no `core`

**Files:**
- Modify: `src/packages/core/src/tipos.ts`, `comentarios.ts`, `servico-planejamento.ts`, `servico-comentarios.ts`, `servico-turnos.ts`, `armazenamento.ts`, `nuvem/armazenamento-nuvem.ts`, `nuvem/tipos.ts`, `nuvem/memoria.ts`, `nuvem/supabase.ts`
- Test: `test/servico-planejamento.test.ts`, `test/servico-turnos.test.ts`, `test/servico-comentarios.test.ts`, `test/nuvem/armazenamento-nuvem.test.ts`, `test/nuvem/contrato-repositorio.ts`, `test/nuvem/supabase-fake.test.ts`

**Interfaces:**
- Produces (todos os parâmetros novos são opcionais e vão por último, padrão `null`, então os chamadores e testes atuais não mudam):

```ts
// tipos.ts
Entregavel.decididoPor?: string          // quem aprovou ou pediu ajuste
EstadoInsumo.enviadoPor?: string
EventoConversa "mensagem_analista" ganha autor?: string
// comentarios.ts
Comentario.autor?: string
// serviços
ServicoPlanejamento.criarProspect(nome, site, autor?: string | null)
ServicoPlanejamento.aprovarEntregavel(slug, id, autor?: string | null)
ServicoPlanejamento.pedirAjuste(slug, id, texto, imagem?, autor?: string | null)
ServicoPlanejamento.pedirAjustes(...atuais, autor?: string | null)
ServicoPlanejamento.receberInsumoArquivo(...atuais, autor?: string | null) e receberInsumoLink(..., autor?: string | null)
ServicoComentarios.criar(slug, id, d, autor?: string | null)
ServicoTurnos.iniciar(slug, etapa, autor?: string | null), enviarMensagem(slug, etapa, texto, autor?: string | null), enviarMensagemComAjustes(slug, etapa, texto, ajustes, autor?: string | null)
// repositório
Repositorio.criarProspect(slug, criadoPor?: string | null)   // grava prospects.criado_por
Repositorio.anexarConversa: a coluna eventos_conversa.autor vem de evento.autor quando o evento é "mensagem_analista"
NuvemArmazenamento.criarPasta(slug, criadoPor?: string | null)  // FsArmazenamento.criarPasta aceita e ignora o parâmetro
uso_turnos.autor: ServicoTurnos grava o autor do turno em registrarUso (hoje fixo em null)
```

- [ ] **Step 1: Escrever os testes**, um por linha da tabela de autoria do spec (4.5), cada um com e sem autor: criar prospect grava `criado_por` (memória e fake do Supabase, e caso novo no contrato do repositório); mensagem do analista traz `autor` no evento e na coluna; o turno grava `uso_turnos.autor`; aprovar e pedir ajuste gravam `decididoPor`; insumo recebido grava `enviadoPor`; comentário grava `autor`. Sem autor, nada disso aparece (campo ausente ou `null`), e um estado antigo continua carregando.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar** os parâmetros e campos acima. Para o `uso_turnos.autor` e a mensagem, `ServicoTurnos` guarda o autor da vaga ativa no mapa `ativos` (a Task 6 reaproveita isso).
- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run typecheck`
Expected: PASS (a suíte ao vivo `test:supabase` roda depois, no fim da Task 4, só pelo controlador).

- [ ] **Step 5: Commit**

```bash
git add src/packages/core
git commit -m "feat(core): autor gravado nas ações do analista"
```

---

### Task 5: Rotas exigem usuário e passam o autor

**Files:**
- Modify: todos os `src/apps/web/app/api/**/route.ts` listados em `apps/web/app/api` que não estejam na lista de isentas
- Create: `src/apps/web/app/api/rotas-exigem-usuario.test.ts`

**Interfaces:**
- Consumes: `exigirUsuario` (Task 2) e os parâmetros `autor` (Task 4).
- Isentas (não chamam `exigirUsuario`): `app/api/interno/ferramentas/route.ts` (token do turno) e `app/api/dev/**` (modo dev, só em `next dev`; confirme que continuam inacessíveis em produção).

- [ ] **Step 1: Escrever o teste de varredura** `rotas-exigem-usuario.test.ts`: lê todos os `route.ts` de `app/api` e exige que cada um, fora da lista de isentas (que o próprio teste declara), importe e chame `exigirUsuario`. Falha com a lista dos que esqueceram. Mais um teste por amostra de três rotas (`GET /api/prospects`, `POST .../mensagens`, `POST /api/prospects`) com `exigirUsuario` simulado: sem sessão responde 401 `nao_autenticado`; com sessão chama o serviço com o e-mail como `autor`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/apps/web && npx vitest run app/api`
Expected: FAIL, com a lista de rotas sem `exigirUsuario`.

- [ ] **Step 3: Implementar.** Em cada rota, `const usuario = await exigirUsuario()` no começo do `try` (o `respostaDeErro` já converte `ErroNaoAutenticado` em 401) e, nas rotas que criam prospect, mandam mensagem, iniciam etapa, aprovam, pedem ajuste, enviam insumo ou criam comentário, passe `usuario.email` como `autor`.
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web
git commit -m "feat(web): todas as rotas exigem usuário e repassam o autor"
```

---

### Task 6: Aviso de quem está com o agente rodando

**Files:**
- Modify: `src/packages/core/src/servico-turnos.ts`, `erros.ts`, `tipos.ts` (`RespostaEstado`), `servico-planejamento.ts` (`respostaEstado`), `src/apps/web/app/api/prospects/[slug]/estado/route.ts`, `src/apps/web/components/chat/chat-etapa.tsx`
- Test: `test/servico-turnos.test.ts`, `test/servico-planejamento.test.ts`, teste do componente de chat

**Interfaces:**
- Produces:

```ts
ServicoTurnos.ativoPor(slug: string): string | null        // e-mail do autor do turno ativo, ou null
ErroTurnoAtivo(autor?: string | null)                       // com autor: "<Nome> está com o agente rodando nesta etapa."
RespostaEstado.turnoPor: string | null
ServicoPlanejamento.respostaEstado(slug, turnoAtivo, turnoPor?: string | null)
```

- [ ] **Step 1: Escrever os testes:** com um turno ativo de `ana.silva@boomer.com.br`, `enviarMensagem` de outro autor lança `ErroTurnoAtivo` com a mensagem `Ana Silva está com o agente rodando nesta etapa.`; sem autor no turno ativo a mensagem atual não muda; `ativoPor` devolve o e-mail e depois do fim do turno volta `null`; a rota `estado` devolve `turnoPor`; no chat, `turnoPor` diferente do e-mail do usuário mostra o aviso com o nome e desabilita o envio, e `turnoPor` igual ao do próprio usuário (ou `null`) não mostra nada.
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/servico-turnos.test.ts test/servico-planejamento.test.ts` e `cd ../../apps/web && npx vitest run components/chat`
Expected: FAIL.

- [ ] **Step 3: Implementar.** A tela já recebe o e-mail do usuário pelo contexto da Task 3. O aviso fica no topo do chat da etapa, com o texto exato das Global Constraints.
- [ ] **Step 4: Rodar tudo**

Run: `cd src && npx turbo run test typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: aviso de quem está com o agente rodando na etapa"
```

---

### Task 7: Aceitação manual (feita pelo analista, com o controlador conferindo o banco)

- [ ] **Step 1:** `.env`: `PLANEJAMENTO_AUTH=google`, `PLANEJAMENTO_DADOS=supabase`, `PLANEJAMENTO_EXECUTOR=sdk`, `PLANEJAMENTO_APP_URL=http://127.0.0.1:3000`. `npm run dev` em `src/apps/web`.
- [ ] **Step 2:** Abrir `http://127.0.0.1:3000`: deve ir para `/login`. Entrar com uma conta `@boomer.com.br`: abre o app; o menu mostra o nome e o e-mail.
- [ ] **Step 3:** Sair e entrar com uma conta `@gestaoboomer.com`: também entra. Sair e tentar uma conta pessoal (`@gmail.com`): volta ao `/login` com a mensagem de domínio e fica sem sessão.
- [ ] **Step 4:** Entrar de novo, criar um prospect, mandar uma mensagem e aprovar um entregável. O controlador confere no Supabase que `criado_por`, `eventos_conversa.autor`, `uso_turnos.autor` e as decisões trazem o e-mail.
- [ ] **Step 5:** Com um turno do agente rodando, abrir o mesmo prospect com a outra conta (janela anônima): o aviso "<Nome> está com o agente rodando nesta etapa." aparece e o envio fica bloqueado.
- [ ] **Step 6:** Sem sessão (janela anônima, sem login), `curl -i http://127.0.0.1:3000/api/prospects` devolve 401 `nao_autenticado`.

Pronto quando os seis passos se confirmam (critério da Fase B no spec).
