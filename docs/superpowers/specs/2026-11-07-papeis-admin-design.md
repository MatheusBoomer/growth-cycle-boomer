# Papéis e visibilidade (admin × usuário) — desenho

Data: 2026-11-07 · Peça 1 de 4 da melhoria "área de administrador"

## Contexto

O app na VPS aceita qualquer conta Google `@boomer.com.br` / `@gestaoboomer.com` e mostra tudo para
todos: todos os prospects e o cliente de teste. O único vínculo entre pessoa e projeto é
`planejamento.prospects.criado_por` (e-mail de quem criou). Não existe papel.

A melhoria pedida foi dividida em quatro peças, cada uma com desenho, plano e entrega próprios:

1. **Papéis e visibilidade** (este documento).
2. Painel de projetos e custos: gasto em US$ por etapa, por pessoa e no total, e modelo usado.
3. Modelo de IA por etapa e por subagente.
4. Catálogo de skills com texto, explicação do processo e fluxograma.

Esta peça é a base: as telas das peças 2 e 4 existem só para admin.

## Decisões

| Pergunta | Decisão |
|---|---|
| Com quem um projeto é compartilhado? | Só com o dono (`criado_por`). Admin vê e trabalha em todos e pode trocar o dono. |
| Admin pode bloquear uma pessoa? | Não. O acesso depende só de a conta Google estar ativa. |
| Onde fica o papel? | Em uma tabela própria, `planejamento.usuarios`. Descartados: `app_metadata` em `auth.users` (compartilhado com o `pit`, e a troca só vale quando a sessão renova) e lista no `.env` (não permite promover pela tela). |

## 1. Dados e regras

### Tabela `planejamento.usuarios`

Migração nova em `supabase/migrations/`, no mesmo padrão da existente: RLS ligado, sem políticas,
acesso só por `service_role`. Nada fora do schema `planejamento` é tocado.

| Coluna | Tipo | Observação |
|---|---|---|
| `email` | `text` primary key | sempre em minúsculas |
| `papel` | `text not null default 'usuario'` | `check (papel in ('admin','usuario'))` |
| `primeiro_acesso` | `timestamptz not null default now()` | |
| `ultimo_acesso` | `timestamptz not null default now()` | |
| `papel_alterado_por` | `text` | e-mail de quem fez a última troca |
| `papel_alterado_em` | `timestamptz` | |

A migração insere `matheus.moreira@boomer.com.br` como `admin` (`on conflict do nothing`).

### Registro e leitura do papel

- A cada requisição autenticada, o servidor lê o papel de quem está logado. É uma consulta por chave
  primária, sem cache, então uma troca de papel vale no próximo clique.
- Se o e-mail não está na tabela, ele é inserido como `usuario` (`on conflict do nothing`). Isso
  cobre quem já tinha sessão aberta antes do deploy.
- `ultimo_acesso` é atualizado só quando o valor gravado tem mais de 1 hora.
- Se a leitura falhar, a requisição falha. Nunca se presume `admin`.

### Regras de papel

- Só admin concede ou retira o papel de admin de qualquer pessoa, inclusive de outro admin e de si
  mesmo.
- **O último admin nunca pode ser rebaixado.** A troca é feita por uma função SQL
  (`planejamento.alterar_papel(alvo, novo_papel, autor)`) que trava as linhas de admin
  (`select … for update`), conta os admins e só rebaixa se sobrar pelo menos um, tudo em uma
  transação. Assim, dois rebaixamentos simultâneos não zeram a lista. A função também confere que o
  autor é admin.
- Promover alguém que já é admin, ou rebaixar quem já é usuário, não faz nada e responde sucesso.

### Regras de projeto

- Dono = `prospects.criado_por` (coluna existente, sem migração).
- **Usuário:** lista, abre e trabalha só nos prospects em que `criado_por` é o próprio e-mail.
- **Admin:** lista, abre e trabalha em todos.
- Prospect com `criado_por` nulo (anterior aos papéis): só admin.
- **Cliente de teste** (`estado.teste` presente): só admin vê, cria e reposiciona, mesmo que o dono
  gravado seja outra pessoa.
- **Trocar dono:** só admin, e só para um e-mail que existe em `planejamento.usuarios`. Atualiza
  `criado_por`.

### Modo sem login

Com `PLANEJAMENTO_AUTH=off` (uso local no Mac), todos são tratados como admin e nenhuma consulta de
papel é feita. O comportamento local não muda. O mesmo vale para `PLANEJAMENTO_DADOS=fs` (sem tabela
de usuários), mesmo com login: essa combinação não é usada em produção.

## 2. Telas

### Home

- **Usuário:** só os próprios projetos e o botão "Novo prospect". O botão "Cliente de teste" não
  aparece.
- **Admin:** todos os projetos, com o nome do dono no cartão (`nomeCurto(email)`, ou "Sem dono") e um
  filtro "Meus / Todos" que começa em "Todos". O botão "Cliente de teste" continua.
- No menu do cartão, o admin tem **"Trocar dono"**: uma lista das pessoas registradas e um botão de
  confirmação.

### Área de administração `/admin`

- O link "Administração" no topo aparece só para admin. Quem não é admin e abre `/admin` é
  redirecionado para `/`.
- A página tem abas. Nesta peça existe só **"Pessoas"**. As abas "Projetos e custos" (peça 2) e
  "Skills" (peça 4) entram depois na mesma estrutura.

### Aba "Pessoas"

- Tabela: nome (`nomeCurto`), e-mail, papel, primeiro acesso, último acesso e número de projetos
  (não excluídos) de cada pessoa.
- Ação por linha: **"Tornar admin"** / **"Retirar admin"**, sempre com confirmação. Na própria
  linha, a confirmação avisa: "Você vai perder o acesso à administração." Depois de confirmar, a
  pessoa volta para `/`.
- Se só existe um admin, o botão "Retirar admin" dele fica desabilitado, com a explicação "É preciso
  manter pelo menos um administrador."

## 3. Aplicação, erros e testes

### Servidor (`src/apps/web/lib/sessao.ts` e `src/packages/core`)

- `exigirUsuario()` passa a devolver `{ email, papel }`.
- `exigirAdmin()` protege:
  - todas as rotas de `/api/admin/*` (listar pessoas, alterar papel, trocar dono);
  - `/api/cliente-teste` e `/api/prospects/[slug]/teste`;
  - `/api/sistema` e `/api/uso`.
- `exigirAcessoAoProspect(slug)` aplica as regras de projeto em toda rota de
  `/api/prospects/[slug]/*`: estado, eventos, mensagens, arquivos, download, prévia, biblioteca,
  entregáveis, comentários, insumos e abrir pasta.
- As regras de visibilidade ficam em um módulo puro do `core` (por exemplo
  `podeVerProspect(usuario, prospect)`), usado tanto pela checagem de rota quanto pelo filtro da
  listagem. A listagem filtra no servidor.
- A fila de turnos e `/api/interno/ferramentas` continuam protegidas pelo token do turno. O token só
  nasce de uma mensagem que já passou por `exigirAcessoAoProspect`.
- As páginas `/prospects/[slug]` e `/admin` fazem a mesma checagem no servidor antes de renderizar.

### Erros

| Situação | Resposta |
|---|---|
| Prospect de outra pessoa, sem dono ou cliente de teste, pedido por usuário | 404 "Projeto não encontrado" (não revela que ele existe) |
| Rota de admin chamada por usuário | 403 |
| Rebaixar o último admin | 409 "É preciso manter pelo menos um administrador." |
| Trocar dono para e-mail não registrado | 400 |
| Falha ao ler o papel no banco | 500 (nunca presume admin) |

### Testes

- **Varredura de rotas** (`src/apps/web/app/api/rotas-exigem-usuario.test.ts`): passa a exigir
  `exigirAcessoAoProspect` em toda rota sob `prospects/[slug]` e `exigirAdmin` em toda rota sob
  `api/admin`. Rota nova sem a checagem quebra o teste.
- **Regras puras (core):**
  - usuário vê só os próprios prospects;
  - prospect sem dono é só de admin;
  - cliente de teste é só de admin;
  - admin vê tudo;
  - modo `off` = admin.
- **Rotas:**
  - 404 em prospect alheio;
  - 403 em rota de admin;
  - troca de dono;
  - listagem filtrada.
- **Função SQL em um Postgres descartável (Docker, no Mac).** A tabela real já tem o admin de
  produção, então nela o caso "um admin só" não pode ser criado.
  - `alterar_papel` bloqueia o último admin;
  - dois rebaixamentos simultâneos deixam exatamente um admin;
  - um autor que não é admin é recusado.
- **Supabase real (opt-in, `npm run test:supabase`), com e-mails de teste apagados no fim:**
  - registro no primeiro acesso;
  - promover e rebaixar entre dois admins de teste;
  - um autor que não é admin é recusado.
- **Aceitação manual na VPS** (Matheus e uma segunda conta):
  1. A segunda conta entra e vê só o que ela mesma criou, sem o cliente de teste.
  2. Ela não abre um projeto do Matheus nem colando o endereço.
  3. O Matheus a promove; ela vê todos os projetos e rebaixa o Matheus.
  4. Com um admin só, o rebaixamento é bloqueado.
  5. A troca de dono passa um projeto de uma pessoa para a outra.

### Deploy

1. Aplicar a migração no projeto Supabase compartilhado (só o schema `planejamento`), ANTES de
   reconstruir ou reiniciar a imagem do app.
2. Seguir o deploy de sempre na VPS: `git pull`, `docker build -t planejamento:vps .`,
   `docker compose up -d app`.
3. Acrescentar `usuarios` à lista `TABELAS` em `scripts/backup/comum.mjs`. A restauração só repõe o
   que falta, então ela não sobrescreve papéis já existentes.

## Limitações conhecidas e notas de operação

- **Leitura pelo agente.** O agente de IA de uma etapa roda na raiz do projeto com ferramentas de
  leitura (Read, Glob, Grep, `cat`, `python3`) e, a pedido do analista, consegue ler arquivos de
  outros prospects em `clientes/`. A regra "cada um vê só o seu" vale para a interface e a API, não
  para o que o agente lê do disco. Fechar isso exige restringir as ferramentas do agente à pasta do
  prospect; fica para uma melhoria futura.
- **Ordem do deploy.** Aplicar a migração `20261107120000_usuarios.sql` ANTES de subir a imagem
  nova. Sem a tabela, toda requisição autenticada dá erro 500 e o backup diário falha.
- **Restauração.** A restauração completa repõe as pessoas que faltam com o papel que tinham no
  backup (pode trazer de volta um admin removido). Restaurar um backup anterior à tabela de
  usuários não recria nenhum admin, e é preciso inserir o admin por SQL.
- **Troca de dono ou de papel.** Não interrompe um turno do agente nem a conexão de eventos já
  aberta; vale a partir da próxima requisição.
- **Avisos de configuração.** Usuários comuns não veem os avisos de configuração do sistema (a
  rota é só de admin).

## Fora do escopo

- Bloquear pessoas e compartilhar um projeto com mais de uma pessoa.
- Custos, tokens e modelo por etapa (peças 2 e 3).
- Catálogo de skills (peça 4).
