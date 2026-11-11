# Reports de bug e melhoria — desenho

Data: 2026-11-11 · Branch: `feat/reports`

## Objetivo

Qualquer usuário logado no app web reporta um bug ou sugere uma melhoria a partir de qualquer tela, com print marcado e comentário. O admin analisa os reports numa aba da Administração, muda o status e copia os reports em Markdown para trazer a uma conversa com o Claude.

Fora do escopo:
- O analista acompanhar os próprios reports (ele só envia).
- Avisos ou notificações.
- Integração com ferramentas externas (GitHub Issues, ClickUp etc.).
- Captura automática de erros de JavaScript ou de requisições.
- Uma skill que leia os reports direto do Supabase.

Isto não é etapa do Growth Cycle: não tem fluxograma, checkpoint nem handoff.

## Peças que já existem e são reaproveitadas

- `modern-screenshot` (`domToPng`), já usado pelo modo dev para capturar a tela.
- O editor de marcações do chat: `lib/anotacoes.ts` para a lógica e `lib/anotacoes-canvas.ts` para gerar o PNG anotado. Ele faz formas numeradas sobre uma imagem.
- O padrão de `notas_skills`:
  - tabela global no schema `planejamento`, com RLS e acesso só pela `service_role`;
  - método no `Armazenamento`, sem suporte em disco;
  - aba do admin;
  - exportação em Markdown.
- Supabase Storage, usado hoje nos buckets `planejamento-prospects` e `planejamento-sessoes`.

## Experiência do analista

1. **Abrir.** A `BarraTopo` ganha o botão "Reportar" (ícone de balão, com tooltip). Não há atalho de teclado. O botão só aparece quando os dados estão na nuvem; no modo `fs` ele some.
2. **Capturar.** Ao clicar, o app captura a tela inteira (`document.body`, área visível) **antes** de abrir o diálogo, para o diálogo não sair na imagem. Se a captura falhar, o diálogo abre sem print e mostra o aviso "Não consegui capturar a tela. Cole um print se quiser."
3. **Preencher o diálogo:**
   - **Tipo:** Bug ou Melhoria. É obrigatório e não vem marcado.
   - **Comentário:** obrigatório, de 1 a 2000 caracteres.
   - **Print da tela:** aparece no editor de marcações, onde o analista desenha formas numeradas. Dá para remover o print.
   - **Imagens extras:** até 3, coladas com Ctrl+V ou escolhidas por um seletor de arquivo. Aceita PNG ou JPEG, cada uma com no máximo 5 MB, e cada uma pode ser removida.
4. **Enviar.** O botão fica desabilitado enquanto envia. Se der certo, o diálogo fecha e aparece o toast "Recebido, obrigado!". Se der erro, o diálogo fica aberto com o que foi preenchido e mostra um toast com a mensagem do servidor.

O print vai com as marcações já desenhadas (PNG anotado). O original sem marcação não é guardado.

## Contexto automático

O analista não vê nem edita o contexto. O cliente monta e o servidor completa:

| Campo | Origem |
|---|---|
| `url` | `location.pathname + location.search` (sem host) |
| `prospect` | slug do prospect, extraído de `/prospects/[slug]` quando for essa a rota |
| `navegador` | `navigator.userAgent` |
| `tela` | `{ largura, altura }` de `window.innerWidth/innerHeight` |
| `autor` | e-mail do usuário da sessão, preenchido **pelo servidor** e nunca pelo corpo da requisição |

O campo `prospect` é opcional. A etapa aberta não é guardada, porque fica só no estado do cliente e não está na URL; o print já mostra qual é. O servidor valida o formato (o slug passa por `slug.ts`) e limita o tamanho de todos os campos de texto.

## Dados

### Tabela `planejamento.reports` (migração `supabase/migrations/2026111…_reports.sql`, idempotente)

| Coluna | Tipo |
|---|---|
| `id` | `bigint generated always as identity primary key` |
| `tipo` | `text not null check (tipo in ('bug','melhoria'))` |
| `comentario` | `text not null check (char_length between 1 and 2000)` |
| `status` | `text not null default 'aberto' check (status in ('aberto','em_andamento','resolvido','descartado'))` |
| `autor` | `text not null` |
| `contexto` | `jsonb not null default '{}'` |
| `imagens` | `text[] not null default '{}'`, com os caminhos no bucket, sendo o print da tela o primeiro quando existir |
| `nota_admin` | `text` (até 2000), nota interna do admin |
| `criado_em` | `timestamptz not null default now()` |
| `atualizado_em` | `timestamptz` |
| `atualizado_por` | `text` |

- Índice em `(status, criado_em desc)`.
- RLS ligado.
- `revoke all` de `public`, `anon` e `authenticated`, e `grant` para `service_role`, como em `notas_skills`.

### Bucket `planejamento-reports` (privado, criado na mesma migração)

- Cada imagem fica em `<id do report>/<n>.<png|jpg>`.
- O fluxo de envio grava primeiro a linha e depois as imagens. Se o upload falhar, o servidor apaga a linha e as imagens já enviadas, e devolve erro.
- Apagar reports não faz parte do escopo: o admin usa o status "descartado".

### Núcleo (`packages/core/src/reports.ts`, sem imports de `node:`)

- Tipos `Report`, `TipoReport`, `StatusReport`, `ContextoReport` e `NovoReport`.
- Constantes `LIMITE_COMENTARIO = 2000`, `LIMITE_IMAGENS_EXTRAS = 3` e `LIMITE_IMAGEM_BYTES = 5 MB`.
- `validarNovoReport(entrada)` devolve o `NovoReport` normalizado ou lança `ErroValidacao` com mensagem em português.
- `textoReports(reports)` gera o Markdown de exportação (ver "Aba Reports").

### Armazenamento

A interface de armazenamento ganha estes métodos:
- `criarReport(novo, imagens: Array<{ bytes, tipo: 'png' | 'jpg' }>)`;
- `listarReports(filtro?: { status?, tipo? })`;
- `imagemReport(id, indice)`;
- `atualizarReport(id, { status?, notaAdmin? }, por)`.

Eles são implementados no Supabase (`nuvem/supabase.ts`), no backend em memória dos testes (`nuvem/memoria.ts`) e no armazenamento em disco, que lança "indisponível em disco", como as notas.

A validação dos bytes da imagem fica no servidor e confere três coisas: a assinatura PNG/JPEG, o tamanho e a quantidade (no máximo 1 print + 3 extras).

## API (app web)

| Rota | Acesso | Faz |
|---|---|---|
| `POST /api/reports` | usuário logado | Cria o report. O corpo é `multipart/form-data` com `dados` (JSON: tipo, comentário, contexto), `tela` (opcional) e `extras[]`. Responde 201 com `{ id }`. |
| `GET /api/admin/reports?status=&tipo=` | admin | Lista os reports. |
| `PATCH /api/admin/reports/[id]` | admin | Muda o `status` e/ou a `nota_admin`. |
| `GET /api/admin/reports/[id]/imagens/[n]` | admin | Devolve os bytes da imagem com o `Content-Type` certo e `Cache-Control: private`. |

As rotas novas entram na varredura de `rotas-exigem-usuario.test.ts`. Elas devolvem 400 quando a validação falha, 401/403 quando o acesso é negado, 404 quando o report não existe e 400 no modo `fs`, com a mensagem "Os reports só existem com os dados na nuvem.", seguindo o padrão das notas.

## Aba "Reports" no admin

- A rota é `app/admin/reports/page.tsx`, com uma entrada nova em `AbasAdmin`.
- **Lista.** Mostra selo de tipo, comentário cortado em uma linha, autor (`nomeCurto`), página (`url`), data e status.
  - Os filtros são por tipo (todos, bug, melhoria) e por status. O filtro de status abre em "abertos + em andamento".
  - A ordem é do mais recente para o mais antigo.
- **Detalhe.** Abre num painel lateral ao clicar.
  - Mostra o comentário inteiro, as imagens em tamanho grande (clicar abre a imagem em tamanho real) e o contexto (página com link, prospect, navegador e tela).
  - Tem o seletor de status e o campo de nota interna, salvos por `PATCH`.
  - Mostra quem atualizou por último e quando.
- **"Copiar para o Claude".** Copia em Markdown os reports filtrados na tela. Cada report vira um bloco `## #<id> · <Bug|Melhoria> · <status>` com comentário, autor, data, contexto e a lista de imagens com o link da rota de imagem.

## Testes

- **Núcleo:** `validarNovoReport` (limites, tipos, campos opcionais, autor nunca vindo da entrada) e `textoReports`.
- **Rotas:** testadas com o backend em memória.
  - Sem sessão a resposta é 401, e um usuário comum nas rotas de admin recebe 403.
  - Imagem inválida, grande demais ou acima da quantidade recebe 400.
  - O autor vem da sessão.
  - O `PATCH` registra `atualizado_por`.
  - O modo `fs` devolve 400 com a mensagem de nuvem.
- **Supabase:** um caso em `test:supabase` cobre criar, listar, ler a imagem e atualizar, e confirma que `anon` não acessa a tabela nem o bucket.
- **Varredura de rotas:** as rotas novas aparecem na varredura e passam.
- **Build:** rodar `next build` numa worktree sem `.env` antes do PR, porque um componente de cliente não pode importar módulo com `node:`.

## Entrega

Na ordem:
1. Aplicar a migração no Supabase.
2. Abrir e fazer o merge do PR.
3. Fazer o deploy na VPS.
4. Conferir no navegador que o report é enviado como usuário comum e aparece na aba do admin com os prints.
