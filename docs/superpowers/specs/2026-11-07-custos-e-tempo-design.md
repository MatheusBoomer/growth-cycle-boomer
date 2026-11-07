# Custos e tempo por projeto e por etapa — desenho

Data: 2026-11-07 · Peça 2 de 4 da melhoria "área de administrador" (a peça 1, papéis admin × usuário, já está no ar)

## Objetivo

Mostrar ao admin quanto cada projeto custou em **dólares** e em **tempo**, no total, por etapa e por pessoa,
e comparar as etapas entre projetos para achar onde otimizar. Só o admin vê os números; a medição de tempo
vale para todos.

## Situação atual

- `planejamento.uso_turnos` grava, por turno, a etapa, o autor, `custo_usd`, os tokens, o início e o fim.
- `custo_usd` vem de `total_cost_usd` do SDK e é **acumulado na conversa** (o SDK documenta: "read the
  latest result rather than summing"). Somar os turnos infla o valor: na etapa 03 do `verdeluz-nuvem`, a
  soma dá US$ 105 e o real foi US$ 7,59.
- Não se grava qual conversa (sessão do SDK) gerou o turno. Uma etapa pode ter mais de uma conversa.
- Não se grava modelo nem esforço. O `result` do SDK traz `modelUsage` (acumulado por modelo, incluindo
  subagentes, com `costUSD`) e `session_id`.
- Não existe medição do tempo que o analista passa no projeto.

## Decisões

| Pergunta | Decisão |
|---|---|
| Onde o admin vê | Aba "Projetos" na Administração (lista, médias por etapa e detalhe) **e** um selo de resumo na tela do projeto |
| Limites de ociosidade | 5 min sem interação vira ocioso; ocioso seguido além de 15 min é descartado |
| Quem vê custo e tempo | Só admin |
| Como guardar o tempo | Cada aviso de 30 s vira uma linha; a classificação é calculada na leitura |

## 1. O que passa a ser gravado

### Custo: colunas novas em `planejamento.uso_turnos`

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `sessao` | `text` | `session_id` da conversa |
| `custo_turno_usd` | `numeric(10,4)` | custo só deste turno |
| `modelos` | `jsonb` | custo deste turno por modelo, ex. `{"claude-sonnet-5-5": 0.42, "claude-haiku-5-5": 0.03}` |
| `esforco` | `text` | nível de esforço configurado; `null` = padrão (preenchido na peça 3) |

**Como calcular o custo do turno.** Seja `A` o `total_cost_usd` deste turno e `B` o do turno anterior com a
mesma `sessao`:
- não há turno anterior: o custo é `A`;
- `A ≥ B`: o custo é `A − B`;
- `A < B` (a conversa recomeçou o total): o custo é `A`.

A mesma regra vale modelo a modelo, sobre `modelUsage[modelo].costUSD`. Um modelo que não aparecia no
turno anterior entra com o próprio valor.

`custo_usd` (acumulado) continua sendo gravado como hoje.

### Tempo: tabela nova `planejamento.presenca`

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `id` | `bigint` identity, primary key | |
| `slug` | `text not null`, FK `prospects(slug)` | projeto |
| `email` | `text not null` | pessoa (minúsculas) |
| `etapa` | `text not null` | etapa aberta na tela |
| `em` | `timestamptz not null default now()` | hora do servidor |
| `visivel` | `boolean not null` | aba visível |
| `segundos_sem_interacao` | `integer not null` | 0 a 86400 |

- Índices: `(slug, em)` e `(email, em)`.
- RLS ligado e sem políticas; acesso só por `service_role`. Nada fora do schema `planejamento`.

### Registros antigos

- Uma etapa com turnos sem `sessao` tem como custo estimado o **maior** `custo_usd` desses turnos, com a
  marca "estimado". O modelo aparece como "não registrado".
- Uma etapa com turnos antigos e turnos novos soma a estimativa dos antigos e o custo dos novos.
- Não há tempo antes desta peça.

### Backup

`presenca` entra em `TABELAS` (`scripts/backup/comum.mjs`) como tabela ligada a prospect (tem `slug`),
restaurada junto com ele. Um backup antigo sem `presenca.json` precisa continuar restaurável (a tabela é
nova). As colunas novas de `uso_turnos` vêm junto com a tabela.

## 2. Como os números são calculados

Num módulo puro do `core`, sem banco.

### Custo

- **Projeto:** soma de `custo_turno_usd` mais a estimativa dos registros antigos.
- **Etapa:** a mesma soma, separada por etapa.
- **Pessoa:** soma dos turnos cujo `autor` é a pessoa.
- **Modelo:** soma de `modelos` por chave.

### Tempo

O tempo é dividido em **blocos de 30 s** alinhados ao relógio, por pessoa e projeto. Cada bloco recebe uma
categoria, nesta ordem de prioridade:

1. **Agente trabalhando:** algum turno da pessoa naquele projeto cobre o bloco (entre `inicio` e `fim`).
   Conta mesmo sem aviso de presença, porque o agente roda no servidor. A etapa é a do turno.
2. **Analista ativo:** há aviso no bloco com `visivel = true` e `segundos_sem_interacao < OCIOSO`.
3. **Aberto ocioso:** há aviso no bloco, mas sem interação recente ou com a aba escondida.
4. **Descartado:** bloco ocioso numa sequência de blocos ociosos seguidos que já passou de `DESCARTE`.
   Os primeiros `DESCARTE` minutos da sequência contam como ocioso; o resto é descartado. Um bloco ativo ou
   de agente encerra a sequência.

Regras:
- Vários avisos no mesmo bloco (duas abas, por exemplo) contam uma vez. Vale o mais favorável: ativo vence
  ocioso.
- Bloco sem aviso e sem turno não conta nada (aba fechada, computador dormindo).
- A etapa do bloco é a do aviso; quando há avisos de etapas diferentes no mesmo bloco, vale o mais recente.

### Totais

- **Tempo útil** = agente trabalhando + analista ativo.
- **Tempo aberto** = tempo útil + ocioso.
- **Descartado** aparece separado e nunca entra nos totais.
- **Tempo do projeto** = soma das pessoas (tempo de equipe).

### Limites

- `PLANEJAMENTO_OCIOSO_MIN` (padrão 5) e `PLANEJAMENTO_DESCARTE_MIN` (padrão 15), no `.env` da VPS.
- Valor ausente, vazio ou inválido usa o padrão.
- Mudar um limite recalcula também o passado.

### Médias por etapa

Para cada etapa de 01 a 10:
- custo médio, tempo útil médio, mediana, menor e maior valor, e em quantos projetos se baseia (contado
  separadamente para custo e para tempo).
- **Entram só etapas concluídas**, de prospects ativos que **não** são cliente de teste.
- Custo estimado entra no custo; etapa sem nenhum aviso de presença não entra no tempo.
- Com menos de 5 projetos na base, o aviso "base pequena" aparece.

No detalhe de um projeto, cada etapa mostra a razão sobre a média ("2,4× a média"). Entre 0,8× e 1,25×
aparece "dentro da média". Sem média disponível, não mostra nada.

## 3. Telas

### Aba "Projetos" (`/admin/projetos`), ao lado de "Pessoas"

1. **Médias por etapa**, no topo, com a tabela da seção 2.
2. **Lista de projetos:** nome, dono, etapa atual, custo total, tempo útil e última atividade.
   - Ordenada pela atividade mais recente.
   - Busca por nome.
   - Clicar numa linha abre o detalhe.

A última atividade é o mais recente entre o último turno e o último aviso de presença.

### Detalhe do projeto (`/admin/projetos/[slug]`)

- **Topo:** custo total, tempo útil, tempo aberto, descartado e o botão "Abrir projeto".
- **Por etapa:** custo (com a marca "estimado" quando houver), turnos, modelos com o valor de cada um, tempo
  do agente, tempo do analista ativo, ocioso e a comparação com a média.
- **Por pessoa:** custo dos turnos que a pessoa disparou, tempo ativo, ocioso e descartado.
- Projeto sem turno nem presença mostra "Sem uso registrado ainda".

### Selo na tela do projeto (só admin)

- Na barra do topo: `US$ 9,80 · 3h12 úteis`.
- Ao passar o mouse, mostra o custo e o tempo da etapa aberta.
- Clicar leva ao detalhe.
- Não existe para o usuário comum. Uma falha ao carregar esconde o selo, sem mostrar erro.

### Medição de presença (todos os papéis)

- Um componente na tela do projeto envia o aviso a cada 30 s, e também imediatamente quando a aba muda
  entre visível e escondida.
- Ele guarda o horário da última interação (`keydown`, `pointerdown`, `wheel`, `scroll`, `pointermove`
  com limitação) e manda `segundosSemInteracao`.
- Não mostra nada ao analista. Uma falha de envio é ignorada em silêncio.

Formato de tempo: `3h12`, `45 min`, `< 1 min`. Custo: `US$ 9,80`.

## 4. Rotas, erros e testes

### Rotas

| Rota | Proteção | Conteúdo |
|---|---|---|
| `POST /api/prospects/[slug]/presenca` | `exigirAcessoAoProspect` | corpo `{ etapa, visivel, segundosSemInteracao }`; e-mail e hora vêm do servidor; 204 |
| `GET /api/admin/projetos` | `exigirAdmin` | lista e médias por etapa |
| `GET /api/admin/projetos/[slug]` | `exigirAdmin` | detalhe do projeto (também usado pelo selo) |

A varredura estática de rotas classifica as rotas novas como as demais (`[slug]` exige acesso ao prospect;
`api/admin` exige admin).

### Gravação do custo

`ServicoTurnos` lê o turno anterior da mesma `sessao` no repositório e calcula o custo do turno antes de
gravar. Continua valendo a regra atual: uma falha ao registrar uso nunca derruba o turno. O executor passa
a extrair `modelUsage` do `result` (no SDK e no CLI de stream-json).

### Erros

| Situação | Resposta |
|---|---|
| Aviso com etapa inválida, `segundosSemInteracao` fora de 0 a 86400 ou `visivel` não booleano | 400 |
| Aviso para prospect inacessível | 404 `Projeto não encontrado.` |
| Rota de admin chamada por usuário | 403 |
| Falha ao gravar o aviso | 500 no servidor; ignorada em silêncio pela página |
| Modo `fs` (sem banco) | aviso aceito e descartado (204); telas de admin mostram "só existe com os dados na nuvem" |

### Testes

- **Tempo (puro):**
  - fronteira de 5 min;
  - sequência ociosa de 15 min (até 15 conta, o resto é descartado);
  - interação no meio zera a sequência;
  - aba escondida;
  - duas abas valem uma;
  - agente com a aba fechada;
  - agente e analista no mesmo bloco contam uma vez;
  - bloco sem aviso;
  - limites lidos do ambiente, com padrão para valor inválido.
- **Custo do turno (puro):**
  - primeiro turno da sessão;
  - turnos seguintes;
  - acumulado que cai;
  - divisão por modelo, incluindo modelo novo no meio da sessão;
  - estimativa de registros antigos;
  - etapa mista (antigos + novos).
- **Médias (puro):**
  - só etapas concluídas;
  - cliente de teste e prospect excluído ficam fora;
  - mediana com quantidade par e ímpar;
  - aviso de base pequena;
  - razão "dentro da média".
- **Executor:** `modelUsage` extraído do `result`.
- **Rotas:**
  - 403, 404 e 400 da presença;
  - presença grava e-mail e hora do servidor;
  - lista e detalhe com dados de memória.
- **Supabase real (opt-in):** gravar e ler presença e as colunas novas, apagando os dados de teste no fim.

### Deploy

1. Aplicar a migração **antes** de reconstruir ou reiniciar a imagem do app. Ela acrescenta as colunas a
   `uso_turnos` e cria `presenca`, só no schema `planejamento`.
2. `git pull`, `docker build -t planejamento:vps .` e `docker compose up -d app`.
3. Aceitação com o admin:
   1. um projeto aberto 10 min com uso normal;
   2. 20 min parado;
   3. um turno do agente;
   4. conferir lista, detalhe, selo e médias.

## Fora do escopo

- Escolher modelo e esforço por etapa (peça 3); aqui só se mostra o que rodou.
- Filtro por período e por analista nas médias.
- Mostrar custo ou tempo ao usuário comum.
- Converter para reais.
- Medir tempo antes desta peça.
