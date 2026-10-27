# Fase B: login com Google e autoria — Design

**Data:** 2026-10-27
**Status:** aguardando revisão do documento
**Escopo:** só a Fase B do desenho `2026-10-27-deploy-railway-supabase-design.md` (seção 5.5). Depende da Fase A (dados no Supabase, PR #1). Detalha e, onde diz o contrário, substitui a seção 5.5 daquele desenho.

## 1. Objetivo

Hoje o app só aceita chamadas que vêm da própria máquina e não sabe quem é o analista. Ao fim da Fase B:

1. na nuvem, só entra quem faz login com uma conta Google `@boomer.com.br` ou `@gestaoboomer.com`;
2. cada ação do analista fica gravada com o e-mail de quem a fez;
3. quando outro analista está com o agente rodando numa etapa, a tela diz quem;
4. no Mac, sem configurar nada, o app segue como hoje, sem tela de login.

**Critério de sucesso:** com `PLANEJAMENTO_AUTH=google`, (a) uma conta `@boomer.com.br` e uma `@gestaoboomer.com` entram e usam o app; (b) uma conta de outro domínio é recusada e fica sem sessão; (c) uma chamada de API sem sessão recebe 401 e uma página sem sessão vai para o login; (d) o agente continua conseguindo propor entregáveis; (e) as linhas de `eventos_conversa`, `uso_turnos`, `prospects` e as decisões, insumos e comentários trazem o e-mail do autor.

**Não é objetivo:** lista fixa de e-mails, papéis e permissões diferentes por pessoa (todos veem tudo, como combinado), outros provedores de login, login de pessoas fora da Boomer, e bloquear no próprio Supabase o cadastro de e-mails de fora (seção 8).

## 2. Decisões

| # | Decisão | Escolha |
|---|---|---|
| 1 | Quando o login liga | Só com `PLANEJAMENTO_AUTH=google`. Vazio ou `off` = como hoje. Qualquer outro valor falha na subida (como `PLANEJAMENTO_DADOS`) |
| 2 | Falha segura | Com o login desligado, o app só atende pedidos de máquina local (regra atual, que passa a valer também para páginas). Esquecer de ligar o login na nuvem deixa o app fechado, e não aberto |
| 3 | Quem entra | Qualquer conta Google cujo e-mail termine em `@<domínio>` de uma lista, em `PLANEJAMENTO_DOMINIOS_PERMITIDOS` (separada por vírgulas; padrão `boomer.com.br,gestaoboomer.com`), com e-mail verificado. Só o domínio exato vale: subdomínios e domínios parecidos (`gestaoboomer.com.br`, `boomer.com`) são recusados. A checagem é no servidor. O parâmetro `hd` do Google não é usado, porque só aceita um domínio |
| 4 | Onde o login vive | Tudo no servidor. Nada de chave do Supabase no navegador, nenhuma variável `NEXT_PUBLIC_*`. O botão é um link para uma rota do próprio app |
| 5 | Como o servidor lê a sessão | `@supabase/ssr` com `createServerClient` e `getClaims()`, que confere a assinatura do token contra as chaves públicas do projeto. Nunca `getSession()` para decidir acesso |
| 6 | Porta do agente | `/api/interno/*` continua protegido pelo token de cada turno (já existe em `ServicoTurnos.contextoDoToken`), que é mais forte que o token único de subida da seção 5.5 anterior. Fica isento do login, não da autenticação |
| 7 | Autor | E-mail em minúsculas, ou `null` quando o login está desligado |
| 8 | Projeto do Supabase | O mesmo projeto compartilhado com o sistema `pit`. O `auth.users` dele está vazio (o `pit` tem login próprio), então ligar o Google não encosta em nada existente |

## 3. Fluxo

```
 navegador ──► proxy.ts ──► página/rota
                 │
                 ├─ modo off? ──► só aceita host local (como hoje)
                 ├─ /login, /auth/*, /api/interno/* ──► passa
                 ├─ sessão válida e domínio ok? ──► renova cookies e passa
                 └─ senão: página => redirect /login ; /api => 401 JSON

 /login ──► link /auth/entrar ──► Google ──► Supabase ──► /auth/callback?code=…
 /auth/callback: troca o código por sessão (cookies), confere domínio e e-mail verificado
      ok  => redirect para a página pedida (caminho relativo, validado)
      não => signOut + redirect /login?erro=dominio
```

## 4. Componentes

### 4.1 Configuração e modo (`core`)

`modoDeAutenticacao(env): "off" | "google"` em `packages/core/src/autenticacao.ts`, com a mesma regra de `modoDeDados` (aparar espaços; vazio ou `off` = off; `google` = google; outro valor lança erro; `google` sem `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY` lança erro com o nome da variável que falta).

`dominiosPermitidos(valor): string[]` (separa por vírgula, apara espaços, minúsculas, ignora vazios) e `emailPermitido(email, dominios): boolean`: minúsculas, exige exatamente um `@`, e a parte depois do `@` igual a um dos domínios. `usuario@boomer.com.br.evil.com`, `usuario@evilboomer.com.br`, `usuario@gestaoboomer.com.br`, `usuario@boomer.com`, `a@b@boomer.com.br` e e-mail vazio são recusados; `USUARIO@GestaoBoomer.com` é aceito. Funções puras, com testes próprios.

Variáveis novas: `PLANEJAMENTO_AUTH`, `PLANEJAMENTO_DOMINIOS_PERMITIDOS`, `SUPABASE_PUBLISHABLE_KEY` (a chave publicável do projeto; fica só no servidor), `PLANEJAMENTO_URL_INTERNA` (ver 4.4). Documentadas no `.env.example`.

### 4.2 Sessão no servidor (`apps/web/lib/sessao.ts`)

- `clienteSupabaseDoServidor(cookies)`: `createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies })`.
- `usuarioDaRequisicao(req): Promise<Usuario | null>` com `Usuario = { email: string }`: chama `getClaims()`, devolve null se não há sessão, o token é inválido, a conta não foi criada pelo Google, o e-mail não está verificado ou o domínio não é permitido. A conta precisa ter sido criada pelo Google: `app_metadata.provider` é `"google"` ou `app_metadata.providers` contém `"google"` (`app_metadata` o usuário não consegue escrever). Um `email_verified` presente (no topo das claims ou em `user_metadata`) e diferente do booleano `true` recusa; a flag ausente é aceita só com essa prova do Google, que já verificou o e-mail no login. `user_metadata` é gravável pelo próprio usuário, então nunca vale como prova, só como motivo de recusa. No modo `off` devolve `{ email: null }`, por isso o tipo é `Usuario = { email: string | null }`.
- `exigirUsuario(req)`: lança `ErroNaoAutenticado` (novo, `status 401`, `codigo "nao_autenticado"`) quando não há usuário. Toda rota que muda estado e toda leitura de dados de prospect chama esta função; o proxy sozinho não é a única barreira.

### 4.3 Porta de entrada (`apps/web/proxy.ts`)

`decidirAcesso(entrada): { tipo: "passar" | "login" | "recusar401" | "recusar403" }` pura, em `core`, testada por tabela:

- modo `off`: a regra atual (`requisicaoLocalPermitida`), agora também para páginas (o matcher passa de `/api/:path*` para tudo, menos arquivos estáticos do Next);
- modo `google`: host precisa ser local ou o host de `PLANEJAMENTO_APP_URL`; métodos que mudam estado só com `Origin` igual ao host (a defesa contra requisição de outro site, generalizada para o host público); rotas livres: `/login`, `/auth/*` e `/api/interno/*` (esta só com host local; o MCP fala por `PLANEJAMENTO_URL_INTERNA`); o resto exige sessão válida, inclusive `/api/sistema`, que mostra informações da máquina (a Fase C acrescenta uma rota de saúde própria, sem dados, para a Railway): página sem sessão vai para `/login?proximo=<caminho>`, API sem sessão recebe 401 JSON `{ erro, codigo: "nao_autenticado" }`.

O `proxy` também renova os cookies da sessão (`getClaims()` e `request.cookies.set` / `response.cookies.set`, como na documentação do Supabase para Next.js).

### 4.4 Rotas de login

- `GET /login`: página com o botão "Entrar com Google" (link para `/auth/entrar`), no visual da marca, e a mensagem de erro quando vem `?erro=dominio` ("Use a conta Google da Boomer (@boomer.com.br ou @gestaoboomer.com).") ou `?erro=falha`.
- `GET /auth/entrar`: `signInWithOAuth({ provider: "google", options: { redirectTo: <PLANEJAMENTO_APP_URL>/auth/callback } })` no servidor e redireciona para a URL devolvida. O `redirectTo` é a URL do callback EXATA, sem query: o Supabase compara a URL inteira com a lista de permitidas (que tem `<APP_URL>/auth/callback`), e uma query faria o login cair na Site URL do outro sistema. O destino pós-login (`proximo`, já validado como caminho relativo com uma única `/`) viaja no cookie `planejamento-proximo` (httpOnly, SameSite=Lax, path `/auth`, 600 s, `Secure` quando a requisição é https).
- `GET /auth/callback`: lê `planejamento-proximo` e o apaga em toda saída (sucesso e erro). `exchangeCodeForSession(code)`; depois `getClaims()`; se o e-mail não passa em `emailPermitido` e verificado, `signOut({ scope: "local" })` e `/login?erro=dominio`. O `proximo` do cookie é revalidado aqui: só vale se for caminho relativo que começa com uma única `/` (nunca `//`, nunca `http`), senão `/`. Atrás do balanceador da Railway, o redirecionamento usa `x-forwarded-host` (aceito só se for local ou o host de `PLANEJAMENTO_APP_URL`).
- Cookies de sessão e do PKCE: `httpOnly`, `SameSite=Lax`, path `/` e `Secure` conforme o protocolo efetivo da requisição (https por `x-forwarded-proto` ou pela URL), nunca pelo endereço público.
- `POST /auth/sair`: `signOut({ scope: "local" })` e redireciona para `/login`.
- O servidor MCP chama o app em `PLANEJAMENTO_URL_INTERNA` (padrão `http://127.0.0.1:<PORT>`), e não em `PLANEJAMENTO_APP_URL`, que passa a ser o endereço público usado nos redirecionamentos do login. `montarMcpConfig` e `servidor.ts` mudam para isso.

### 4.5 Autoria

O e-mail sai de `usuarioDaRequisicao` em cada rota e entra como parâmetro opcional `autor: string | null` nas operações abaixo (padrão `null`, então o modo `off` e os testes existentes não mudam):

| Dado | Onde fica | Operação que recebe o autor |
|---|---|---|
| Quem criou o prospect | `prospects.criado_por` | `ServicoPlanejamento.criarProspect` e `Repositorio.criarProspect` |
| Quem mandou cada mensagem | `eventos_conversa.autor` e campo `autor` no evento `mensagem_analista` | `ServicoTurnos.enviarMensagem` e `enviarMensagemComAjustes` |
| Quem rodou cada turno | `uso_turnos.autor` | `ServicoTurnos.iniciar` e os enviados acima |
| Quem decidiu um entregável | `Entregavel.decididoPor?: string` | aprovar e pedir ajuste |
| Quem enviou um insumo | `EstadoInsumo.enviadoPor?: string` | envio de insumo |
| Quem comentou | `Comentario.autor?: string` | criar comentário |

`Repositorio.anexarConversa` ganha o parâmetro `autor` para gravar a coluna. Campos novos nos tipos são opcionais: estados antigos continuam válidos.

### 4.6 Quem está com o agente rodando

- `ServicoTurnos.ativos` guarda o autor de cada turno em andamento; novo `ativoPor(slug): string | null`.
- `ErroTurnoAtivo` ganha o nome do analista quando há um outro autor: mensagem "<nome> está com o agente rodando nesta etapa." (nome = parte local do e-mail, com pontos virando espaços e iniciais maiúsculas, em `nomeCurto(email)`). Sem autor, a mensagem atual.
- `RespostaEstado` ganha `turnoPor: string | null`; a tela mostra o aviso no topo do chat e desabilita o envio quando o turno é de outra pessoa. Quando é do próprio analista, nada muda.
- Menu da conta no cabeçalho: nome curto, e-mail e "Sair" (só no modo `google`).

## 5. Falhas

| Situação | Comportamento |
|---|---|
| Conta de outro domínio | Recusada no retorno do login: `signOut()` e `/login?erro=dominio` |
| Google ou Supabase fora do ar no login | `/login?erro=falha` com texto "Não foi possível entrar agora. Tente de novo." |
| Sessão expirada no meio do uso | A próxima chamada de API recebe 401; a interface redireciona para `/login?proximo=…` |
| Cabeçalho `Origin` de outro site em método de escrita | 403, como hoje |
| `PLANEJAMENTO_AUTH=google` sem as variáveis do Supabase | O app não sobe, com o nome da variável que falta |
| Login ligado, mas o modo de dados é `fs` | Permitido (útil para testar o login no Mac), com aviso no log |
| Conta que não foi criada pelo Google, ou `email_verified` presente e diferente de `true` | Tratado como não autenticado. `email_verified` ausente é aceito só quando `app_metadata.provider` ou `app_metadata.providers` contém `"google"` |

## 6. Testes

1. `emailPermitido`, `modoDeAutenticacao` e `decidirAcesso`: tabelas com os casos da seção 4, inclusive hosts falsos (`127.0.0.1.evil.com`), `Origin` de outro site, `proximo` malicioso (`//evil.com`, `http://evil.com`, `/\evil.com`) e domínios parecidos.
2. Rotas e `exigirUsuario` com um provedor de sessão falso: sem sessão (401), com sessão de domínio errado, com sessão boa, no modo `off`.
3. Autoria: cada operação da tabela 4.5 grava o e-mail e, sem autor, grava `null`; contrato do `Repositorio` cobre `criado_por`, `autor` de conversa e `uso_turnos.autor` (suíte ao vivo, opt-in).
4. Turno ativo de outro analista: mensagem com o nome certo e `turnoPor` na resposta de estado.
5. `/api/interno/*`: só host local e só com token de turno válido.
6. Aceitação manual (precisa de você): login real com uma conta `@boomer.com.br`, recusa de uma conta pessoal, e duas pessoas na mesma etapa.
7. Os testes atuais seguem passando com o login desligado.

## 7. Pré-requisitos manuais (feitos por você, com roteiro)

1. No Google Cloud: criar uma credencial OAuth do tipo "Aplicativo da Web" e cadastrar como URI de redirecionamento `https://fkvvvnitxvfdvtexmidl.supabase.co/auth/v1/callback`. Na tela de consentimento, o tipo de usuário precisa ser **Externo** (e não "Interno"): como os e-mails são de dois domínios, uma credencial interna a um único Workspace deixaria o outro de fora. Escopos só `openid`, `email` e `profile`, que não exigem verificação do Google. Publicar o aplicativo ("Em produção") para não ficar limitado a usuários de teste
2. No Supabase (Authentication → Providers → Google): ligar o provedor e colar o ID e o segredo do cliente.
3. No Supabase (Authentication → URL Configuration): acrescentar `http://127.0.0.1:3000/auth/callback` à lista de URLs de redirecionamento permitidas (e, na Fase C, o endereço público). **Não mudar a "Site URL"**, que é do projeto inteiro.
4. Colocar `SUPABASE_PUBLISHABLE_KEY` no `.env`. A chave publicável fica no painel (API Keys) e eu consigo lê-la pelo MCP; a chave secreta não é usada na Fase B.

## 8. Riscos e limites conhecidos

- Contas de outro domínio que tentam entrar chegam a criar uma linha em `auth.users` antes de serem recusadas. Não têm acesso ao app. Bloquear o cadastro no próprio Supabase exige uma função de banco ("before user created hook") que mexe numa configuração do projeto compartilhado; fica como endurecimento opcional da Fase C.
- O `proxy.ts` do Next roda antes de cada rota; um erro de configuração do login deixa o app fora do ar, não aberto.
- A confiança no domínio depende do e-mail e do indicador de e-mail verificado que o Google devolve ao Supabase. A checagem usa o e-mail exatamente como o token traz, sem tentar interpretar apelidos.

## 9. Tarefas previstas (viram o plano de implementação)

| # | Entrega |
|---|---|
| 0 | Você: credenciais do Google, provedor ligado no Supabase, URL de redirecionamento e `SUPABASE_PUBLISHABLE_KEY` |
| 1 | `autenticacao.ts` no `core` (modo, `emailPermitido`, `decidirAcesso`, `nomeCurto`, `ErroNaoAutenticado`) com testes |
| 2 | Sessão no servidor (`sessao.ts`, `exigirUsuario`) e `proxy.ts` novo |
| 3 | Rotas e página de login, menu da conta e `PLANEJAMENTO_URL_INTERNA` |
| 4 | Autoria nas operações e no `Repositorio` (com migração só se faltar coluna: `criado_por` e `autor` já existem) |
| 5 | Aviso de quem está com o agente rodando |
| 6 | Aceitação manual com contas reais |
