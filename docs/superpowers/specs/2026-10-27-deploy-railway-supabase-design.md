# Deploy na nuvem (Railway + Supabase) — Design

**Data:** 2026-10-27
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** tirar o app de planejamento do Mac e colocá-lo na internet como ferramenta interna da equipe da Boomer, com os dados de cada prospect guardados no Supabase.

## 1. Objetivo

Hoje o app só roda no Mac de quem desenvolve: lê e grava em `clientes/<slug>/`, roda o agente com a assinatura do Claude e envia os eventos ao navegador pela memória do processo. O objetivo é que qualquer analista da Boomer:

1. entre pelo navegador, de qualquer lugar, com a conta Google `@boomer.com.br`;
2. crie um prospect novo, que nasce no Supabase (banco e storage), e não numa pasta local;
3. percorra as etapas 01 → final como hoje, com o mesmo método (skills `.md`, scripts Python, aprovação e handoff);
4. nunca perca contexto: nem entre etapas, nem dentro de uma etapa, nem com o servidor reiniciando.

**Critério de sucesso:** o cliente de teste Verdeluz percorre as etapas 01 a 03 no ambiente da Railway, com um reinício do servidor no meio de uma etapa, e o agente retoma a conversa onde parou; os prospects atuais do Mac chegam ao Supabase com a mesma quantidade de arquivos e a mesma impressão digital (hash) de cada um.

**Não é objetivo:** reescrever skills, agentes ou scripts em código; atender outras agências (multi-inquilino); cobrar por uso; escalar para dezenas de analistas simultâneos.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Quem usa | Equipe interna da Boomer. A agência paga a API; todos veem todos os prospects |
| 2 | Hospedagem | Railway, um único servidor sempre ligado (app + agente). A Vercel foi descartada: Functions sem disco persistente, sem Python/ffmpeg e com limite de tempo |
| 3 | Login | Google pelo Supabase Auth, aceitando só `@boomer.com.br` |
| 4 | Onde ficam os dados | Supabase é a fonte da verdade: banco (estado, conversas, comentários, uso) e storage (arquivos). O disco da Railway é só a mesa de trabalho |
| 5 | Skills e scripts | Não mudam. O Agent SDK lê os `.md` como estão |
| 6 | Prospects atuais | Migrados uma vez do Mac para o Supabase, sem as memórias de sessão do agente: as etapas em andamento retomam pelo histórico do chat |
| 7 | Motor de agentes na nuvem | Sempre o Agent SDK com `ANTHROPIC_API_KEY`. O CLI segue disponível só no Mac |
| 8 | Região | Supabase em São Paulo (`sa-east-1`), storage privado (LGPD) |
| 9 | Plano do Supabase | Pro, pelo backup diário automático |
| 10 | Execução | Quatro fases em sequência: A (dados), B (login), C (no ar), D (migração). Cada fase tem o próprio plano de implementação |

## 3. Arquitetura

```
 Analistas (navegador) ──► Login Google (Supabase Auth, @boomer.com.br)
                                │
 ┌────────────── RAILWAY (1 serviço, 1 instância) ─────────────────┐
 │  App Next.js ──► ServicoTurnos ──► Agent SDK (cwd fixo: /app)    │
 │      ▲  Barramento (memória)         │ lê .claude/skills/*.md    │
 │      └───────────────────────────────┤ roda scripts/*.py         │
 │                                      ▼                           │
 │  Volume /data: mesa de trabalho                                  │
 │    /data/clientes/<slug>/   (cópia de trabalho dos arquivos)     │
 │    /data/claude/            (CLAUDE_CONFIG_DIR: memória do agente)│
 └───────────────▲──────────────────────────┬──────────────────────┘
                 │ publicar (fim do turno)  │ hidratar (início do turno)
 ┌───────────────┴──────── SUPABASE ────────▼──────────────────────┐
 │  Postgres: prospects (estado jsonb), eventos_conversa,           │
 │            comentarios, uso_turnos, arquivos (manifesto)          │
 │  Storage (privado): prospects/<slug>/..., sessoes/<slug>/...      │
 └──────────────────────────────────────────────────────────────────┘
```

Um único processo continua sendo o dono dos turnos e do `Barramento`, como hoje: com uma instância, os eventos em memória e a trava de "um turno por prospect" seguem válidos. O código, as skills, os scripts e `clientes/_template/` vêm do git (cada `git push` na branch principal faz deploy). Os dados de prospects nunca vão para o git.

`clientes/` dentro de `/app` é um link para `/data/clientes`, para o caminho `clientes/<slug>/` que skills e dossiê usam continuar igual.

## 4. Contexto e memória

Três camadas de contexto, cada uma com destino próprio:

| Camada | Hoje | Na nuvem |
|---|---|---|
| Entre etapas: resumo de decisões, handoff, `contexto/decisoes/`, ativos aprovados | `estado.json` e arquivos do prospect | `prospects.estado` (banco) e storage |
| Na tela: histórico do chat | `.app/conversas/` | tabela `eventos_conversa` |
| Dentro da etapa: memória da sessão do agente | `~/.claude/projects/<cwd>/<sessionId>.jsonl` no Mac | storage `sessoes/<slug>/<sessionId>.jsonl`, restaurado em `CLAUDE_CONFIG_DIR` |

Regras da memória da sessão:

1. `CLAUDE_CONFIG_DIR=/data/claude` e `cwd=/app` fixos: a memória é indexada pelo caminho do `cwd`, então ele nunca muda entre deploys.
2. Ao fim de cada turno, o `.jsonl` da sessão da etapa é publicado no storage junto com os arquivos do prospect.
3. Antes de um turno com `sessionId`, o `.jsonl` é restaurado se faltar no volume ou estiver diferente do storage.
4. Se a sessão não puder ser restaurada (arquivo ausente ou corrompido), o turno começa sessão nova com um prompt de retomada montado a partir de `eventos_conversa` da etapa e do dossiê, e o chat mostra o aviso "Retomei a etapa a partir do histórico".

## 5. Componentes

### 5.1 Repositório (banco)

Interface `Repositorio` com duas implementações: `FsRepositorio` (o comportamento atual, em `.app/`, usada no Mac e nos testes) e `SupabaseRepositorio`.

Tabelas:

- `prospects`: `slug` (PK), `nome`, `estado jsonb` (o `Estado` de hoje, inteiro), `etapa_atual`, `criado_por`, `criado_em`, `atualizado_em`, `versao int` (controle de concorrência otimista), `sincronizacao_pendente bool`, `excluido_em`.
- `eventos_conversa`: `id`, `slug`, `etapa`, `evento jsonb`, `autor`, `em`. Só inclusão.
- `comentarios`: o conteúdo de `.app/comentarios/` hoje, uma linha por comentário.
- `uso_turnos`: `slug`, `etapa`, `autor`, `custo_usd`, `tokens_entrada`, `tokens_saida`, `inicio`, `fim`, `status`. Vem do resultado final do SDK.
- `arquivos`: manifesto por prospect: `slug`, `caminho`, `sha256`, `tamanho`, `atualizado_em`, `excluido_em`.

`gravarEstado` grava com `where versao = <lida>`. Se outra gravação chegou antes, relê o estado, reaplica a mudança e tenta de novo (até 3 vezes).

Só o servidor acessa o banco e o storage (chave de serviço). O navegador nunca fala com o banco diretamente, então não há políticas de RLS por usuário: RLS fica ligado e fechado para a chave pública.

### 5.2 Mesa (sincronização)

`Mesa` cuida da cópia de trabalho de um prospect em `/data/clientes/<slug>/`:

- `hidratar(slug)`: compara o manifesto `arquivos` com os hashes da pasta local e baixa o que falta ou difere; apaga localmente o que o manifesto marca como excluído.
- `publicar(slug)`: calcula o hash de cada arquivo local, envia ao storage os que mudaram, atualiza o manifesto e marca como excluídos os que sumiram. Ignora `.DS_Store`, `~$*` e `__pycache__`.

Chamadas: `hidratar` antes de cada turno e antes de abrir um prospect; `publicar` ao fim de cada turno (inclusive interrompido ou com erro) e depois de cada `propor_entregavel`.

### 5.3 Armazenamento na nuvem

`NuvemArmazenamento` mantém os métodos públicos do `FsArmazenamento` atual (os serviços não mudam), delegando:

- estado, conversas e comentários ao `Repositorio`;
- leitura de arquivo à mesa local (já hidratada);
- gravação de arquivo (`gravarTexto`, `gravarBinario`, `copiar`, `moverParaDentro`) à mesa **e** ao storage, na mesma operação (gravação imediata). Uma falha no storage deixa o prospect com `sincronizacao_pendente`;
- `criarPasta`: copia `clientes/_template/` (do git) para a mesa e para o storage e cria a linha em `prospects`;
- `excluir` e `moverParaLixeiraNoProspect`: a lixeira do sistema (`trash`) dá lugar a `excluido_em` no banco e à pasta `lixeira/` no storage, que é recuperável.

`servidor.ts` escolhe `FsArmazenamento` ou `NuvemArmazenamento` por `PLANEJAMENTO_DADOS=fs|supabase`.

### 5.4 Memória da sessão

Funções `salvarSessao(slug, sessionId)` e `restaurarSessao(slug, sessionId)` sobre `CLAUDE_CONFIG_DIR`, chamadas pelo `ServicoTurnos` antes e depois do executor. O prompt de retomada (seção 4, regra 4) é montado em `prompts.ts`.

### 5.5 Login

- O Supabase Auth com o provedor Google. No retorno do login, o app recusa e-mail que não termine em `@boomer.com.br` (`hd` do Google conferido também) e encerra a sessão.
- O `proxy.ts` do Next protege todas as páginas e rotas `/api`, exceto o retorno do login e `/api/interno/*`.
- `/api/interno/*` (MCP → app) exige o cabeçalho com `PLANEJAMENTO_TOKEN_INTERNO`, gerado no boot e passado ao MCP pela configuração do turno. Nunca é exposto ao navegador.
- O autor (e-mail) passa a ser gravado em eventos de conversa, decisões de entregável, insumos enviados, comentários e `uso_turnos`.
- A tela mostra "Fulano está com o agente rodando nesta etapa" quando outro analista tem turno ativo no prospect.

### 5.6 Empacotamento e deploy

- `Dockerfile` na raiz: Node 22, Python 3 com `requirements.txt` (novo: `python-pptx`, `openpyxl`, `requests` e o que os scripts e o `analista-dados` usam; levantado na Fase C a partir de `scripts/` e das skills), `ffmpeg`, `npm ci` e `next build` de `src/apps/web`.
- `railway.json`: um serviço, uma réplica, volume em `/data`, verificação de saúde em `/api/sistema`.
- Desligamento gracioso: no `SIGTERM`, o app recusa turnos novos e espera os em andamento terminarem (até 5 minutos, configurados no tempo de drenagem do deploy na Railway; com volume não há duas instâncias ao mesmo tempo, então o app fica fora do ar nesse intervalo). Passado o prazo, interrompe, publica e encerra.
- Variáveis na Railway: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, chave do Firecrawl, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PLANEJAMENTO_EXECUTOR=sdk`, `PLANEJAMENTO_DADOS=supabase`, `CLAUDE_CONFIG_DIR=/data/claude`, `PLANEJAMENTO_APP_URL`. Nenhuma aparece em arquivo gerado, log ou conversa.
- O MCP do Firecrawl, que o `pesquisador-benchmark` usa, passa a ser declarado na configuração de MCP do turno, com a chave vinda do ambiente.

### 5.7 O que sai ou muda na interface

- `api/prospects/[slug]/abrir-pasta` e o botão "Abrir pasta" dão lugar a "Baixar arquivo" (download pelo app, com login).
- O painel de uso da assinatura (`uso-assinatura.ts`, `api/uso`) fica escondido quando `PLANEJAMENTO_EXECUTOR=sdk`.
- O modo dev de comentários (`.dev-comentarios/`) continua só local: desligado em produção.

### 5.8 Migração

Script `src/packages/core/scripts/migrar-para-supabase.ts`:

1. `--ensaio`: lista, por prospect, quantos arquivos e bytes seriam enviados, quantas conversas e comentários, e quais etapas em andamento vão retomar pelo histórico, sem gravar nada.
2. Envio: para cada pasta em `clientes/` (exceto `_template` e `_fixtures`), cria a linha em `prospects` a partir do `estado.json`, envia os arquivos e o manifesto e insere conversas e comentários.
3. Conferência: compara a quantidade e o hash de cada arquivo entre o Mac e o Supabase e imprime as divergências. Pode ser rodado de novo sem duplicar nada (idempotente por `slug` + `caminho`).

As memórias de sessão do Mac (`~/.claude/projects/`) não são migradas. O `sessionId` das etapas fica no estado migrado. No primeiro turno de uma etapa em andamento, a restauração não encontra o `.jsonl`, e a etapa retoma pelo histórico (seção 4, regra 4). Na data deste desenho, isso vale para 4 etapas: `adda` e `adda-demo` (final), `sottile-jalecos` (01) e `sottile-teste` (07).

## 6. Falhas

| Situação | Comportamento |
|---|---|
| Supabase indisponível ao hidratar | O turno não começa. Aviso no chat: "Não consegui baixar os arquivos do prospect. Tente de novo." |
| Falha ao publicar no fim do turno | 3 tentativas com espera crescente. Se falhar, marca `sincronizacao_pendente`, mostra um aviso e tenta de novo na próxima ação do prospect. Os arquivos seguem no volume |
| Duas gravações de estado ao mesmo tempo | Concorrência otimista por `versao` (5.1) |
| Turno ativo no prospect | O segundo analista não consegue iniciar turno nesse prospect e vê quem está rodando |
| Login fora do domínio | Recusado no retorno do login, antes de qualquer dado |
| Sessão do agente não restaurada | Retomada pelo histórico (seção 4, regra 4) |
| Deploy com turno em andamento | Desligamento gracioso (5.6). Se o prazo estourar: turno "interrompido", publicado, e o analista reenvia |
| `ANTHROPIC_API_KEY` ausente | Mensagem atual, apontando para as variáveis da Railway |

## 7. Testes

1. Os testes atuais de `core` e `web` seguem passando com `PLANEJAMENTO_DADOS=fs`.
2. Testes de contrato do `Repositorio` e da `Mesa`: o mesmo conjunto roda contra a implementação em disco e contra o Supabase local (`supabase start`, via Docker).
3. Testes unitários da `Mesa`: hidratar com arquivo faltando, diferente ou excluído; publicar só os alterados; arquivos ignorados.
4. Testes da memória da sessão: salvar, restaurar e cair na retomada pelo histórico quando o `.jsonl` falta.
5. Teste do login: e-mail de fora do domínio recusado; `/api/interno` sem token recusado.
6. Ensaio na Railway com a Verdeluz: criar, enviar insumos, etapas 01 a 03, aprovar entregáveis, reiniciar o serviço no meio da etapa 02 e confirmar que o agente retoma.
7. Migração: `--ensaio`, envio e conferência sem divergências antes de o Mac deixar de ser a fonte.

## 8. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| A. Dados | `Repositorio`, `Mesa`, `NuvemArmazenamento`, memória da sessão, tabelas e storage no Supabase | O app no Mac com `PLANEJAMENTO_DADOS=supabase` (Supabase local) roda a Verdeluz de 01 a 03, e os testes 1 a 4 passam |
| B. Login | Supabase Auth com Google, `proxy.ts`, token interno, autor nos registros | O teste 5 passa e a tela mostra quem está com o agente |
| C. No ar | `Dockerfile`, `requirements.txt`, `railway.json`, volume, desligamento gracioso, ajustes da 5.7, domínio | O teste 6 passa no ambiente da Railway |
| D. Migração | Script da 5.8 | O teste 7 passa, os prospects atuais abrem na nuvem com o chat, e uma etapa em andamento retoma pelo histórico |

## 9. Custos estimados

Railway de US$ 5 a 20 por mês, Supabase Pro US$ 25 por mês e uso da API da Anthropic conforme o volume (registrado em `uso_turnos`).
