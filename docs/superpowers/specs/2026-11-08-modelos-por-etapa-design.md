# Modelo e esforço por etapa — desenho

Data: 2026-11-08 · Peça 3 de 4 da melhoria "área de administrador" (peças 1 e 2 já no ar)

## Objetivo

Deixar o admin escolher, por etapa, o modelo de IA e o nível de esforço do agente principal e de cada
subagente que a etapa usa, pela tela e sem deploy. Assim a equipe testa trocas (ex.: etapa 03 no Sonnet)
e mede o efeito no painel de custos da peça 2. A lista de modelos acompanha os lançamentos da Anthropic.

## Situação atual

- Nenhum modelo é escolhido: `montarOpcoesSdk` (`src/packages/core/src/executor/agent-sdk.ts`) não passa
  `model` nem `effort`, e os subagentes (`.claude/agents/analista-dados.md`, `pesquisador-benchmark.md`)
  não têm `model`. Tudo roda no padrão (Opus 5.5, confirmado nos turnos de 2026-11-08).
- O SDK aceita `model`, `effort` (`low` | `medium` | `high` | `xhigh` | `max`) e `agents` (definição de
  subagente com `model` e `effort`) por chamada. Ele também informa os modelos disponíveis com
  `supportedModels()`, que devolve, para cada um, `value`, `displayName`, `description`, `supportsEffort`
  e `supportedEffortLevels`.
- O Claude Code em linha de comando aceita `--model`, `--effort` e `--agents`.
- `uso_turnos` já tem as colunas `modelos` e `esforco` (peça 2).

## Decisões

| Pergunta | Decisão |
|---|---|
| Onde fica a escolha | Aba "Modelos" na Administração, gravada no banco, valendo no próximo turno |
| De onde vem a lista de modelos | Do SDK (`supportedModels`), com os apelidos `haiku`, `sonnet` e `opus` no topo |
| Configuração inicial | Tudo em "padrão" (igual a hoje), com sugestões visíveis e botão "Aplicar" |
| Subagentes | Modelo e esforço por etapa, inclusive dos subagentes |
| Como chega ao agente | Pelas opções do SDK (e flags do CLI) a cada turno; nenhum arquivo é reescrito |

## 1. Dados e regras

### Tabela `planejamento.config_modelos`

| Coluna | Tipo | Observação |
|---|---|---|
| `etapa` | `text not null` | `01`…`09` ou `final` |
| `alvo` | `text not null` | `principal`, `analista-dados` ou `pesquisador-benchmark` |
| `modelo` | `text` | `null` = padrão |
| `esforco` | `text` | `null` = padrão; `check (esforco in ('low','medium','high','xhigh','max'))` |
| `alterado_por` | `text` | e-mail |
| `alterado_em` | `timestamptz` | |

- Chave primária: `(etapa, alvo)`.
- RLS ligado, sem políticas, acesso só por `service_role`. Nada fora do schema `planejamento`.
- Linha ausente equivale a padrão nos dois campos.

### Subagentes de cada etapa

Campo novo `subagentes: string[]` em cada etapa de `.claude/skills/_shared/etapas.json`:

| Etapa | Subagentes |
|---|---|
| 02 | `pesquisador-benchmark` |
| 03 | `analista-dados` |
| 05 | `analista-dados`, `pesquisador-benchmark` |
| 06 | `analista-dados` |
| 08 | `analista-dados`, `pesquisador-benchmark` |
| demais | nenhum (`[]`) |

O alvo de uma configuração precisa ser `principal` ou um subagente listado na etapa.

### Sugestões

Arquivo versionado `.claude/skills/_shared/sugestoes-modelos.json`, com uma lista de
`{ etapa, alvo, modelo, esforco | null, motivo }`. O conteúdo inicial vem da nota de economia de tokens:

| Etapa | Alvo | Sugestão | Motivo |
|---|---|---|---|
| 01 | principal | `haiku` | só organiza a transcrição |
| 03 | principal | `sonnet` | análise que vai para o deck, com volume grande de gráficos |
| 04 | principal | `sonnet` | cálculo de CAC/LTV com barreira de PII |
| 03 | analista-dados | `haiku` | gera gráficos a partir de código padronizado |
| 05 | analista-dados | `haiku` | gráficos e contas simples |
| 06 | analista-dados | `sonnet` | o JSON da projeção, com meses posicionais, é frágil |
| 08 | analista-dados | `haiku` | gráficos |
| 02, 05, 08 | pesquisador-benchmark | `haiku` | raspagem e resumo |
| 10 | principal | `haiku` | monta o .pptx a partir do roteiro aprovado |

As etapas 02, 05, 06, 07, 08 e 09 no agente principal não têm sugestão: ficam no padrão, porque são
estratégia e texto que vende. Nada é aplicado automaticamente.

### Regras

- Só admin altera.
- **Validação ao salvar:**
  - `modelo` é `null`, um apelido (`haiku`, `sonnet`, `opus`) ou um `value` da lista atual do SDK;
  - `esforco` é `null` ou um nível de `supportedEffortLevels` do modelo escolhido;
  - com modelo `null` (padrão), aceita-se qualquer nível válido.
- Cada turno lê a configuração da etapa ao começar, sem cache. A mudança vale no próximo turno; um turno
  em andamento não é afetado.
- Um modelo salvo que sumiu da lista após uma atualização do SDK gera o aviso `modelo não está mais na
  lista` na célula. O turno continua enviando esse modelo.
- O esforço do agente principal usado no turno é gravado em `uso_turnos.esforco`.

## 2. Execução e tela

### Execução

- `PedidoTurno` (`src/packages/core/src/executor/tipos.ts`) ganha:
  - `modelo?: string`;
  - `esforco?: NivelEsforco`;
  - `agentes?: Record<string, DefinicaoAgente>`, onde `DefinicaoAgente` tem `description`, `prompt`,
    `tools`, `model?` e `effort?`.
- **SDK:** `montarOpcoesSdk` passa `model`, `effort` e `agents` quando definidos. Sem nada definido, as
  opções ficam idênticas às de hoje.
- **CLI:** `--model`, `--effort` e `--agents '<json>'`, pelos mesmos critérios.
- **Definição de subagente:** lê `.claude/agents/<nome>.md`. O cabeçalho dá `description` e `tools`
  (separadas por vírgula); o corpo é o `prompt`. Entram em `agentes` só os subagentes com modelo ou
  esforço configurado na etapa.
- **Falha ao ler a configuração ou o `.md`:** o turno segue no padrão e o erro é registrado no log.
- **Modelo recusado pela Anthropic:** o turno termina com erro e com a mensagem
  `O modelo <modelo> foi recusado. Ajuste em Administração → Modelos.`

### Lista de modelos

- Uma rota de admin chama `supportedModels()`. Ela abre uma consulta do SDK sem enviar mensagem e a
  encerra logo depois, então não gasta tokens.
- O resultado fica em memória por 1 hora.
- Os apelidos vêm no topo como `Haiku (mais recente)`, `Sonnet (mais recente)` e `Opus (mais recente)`.
  O esforço deles segue o do modelo para o qual o apelido aponta (`resolvedModel`), quando a lista traz
  essa informação; sem ela, aceitam `low`, `medium` e `high`.
- Se a consulta falhar, só os apelidos aparecem, com o aviso `lista completa indisponível agora`.

### Aba "Modelos" (`/admin/modelos`)

- Uma linha por etapa, de 01 a 10, com o rótulo do catálogo.
- Colunas: **Agente principal**, **analista-dados** e **pesquisador-benchmark**. Cada célula tem um
  seletor de modelo (com `Padrão` como primeira opção) e um de esforço. O de esforço só mostra os níveis
  aceitos pelo modelo e fica desligado quando o modelo não aceita esforço. Nas etapas que não usam o
  subagente, a célula mostra `não usa`.
- Cada célula mostra:
  - a sugestão, quando houver, em cinza, com o motivo no tooltip e o botão `Aplicar`;
  - `Alterado por <nome> em <dd/mm>`;
  - o aviso de modelo fora da lista, quando for o caso.
- Cada mudança salva na hora, com toast de confirmação. `Voltar ao padrão` limpa a célula.
- Sob a tabela, o link `Ver o custo por modelo em Projetos`.

## 3. Rotas, erros e testes

### Rotas

| Rota | Proteção | Conteúdo |
|---|---|---|
| `GET /api/admin/modelos` | `exigirAdmin` | configuração por etapa e alvo, sugestões, subagentes por etapa, lista de modelos (ou só apelidos e o aviso) |
| `PUT /api/admin/modelos/[etapa]/[alvo]` | `exigirAdmin` | corpo `{ modelo, esforco }`; `null` nos dois volta ao padrão |

### Erros

| Situação | Resposta |
|---|---|
| Usuário comum | 403 |
| Etapa inexistente ou alvo que a etapa não usa | 404 |
| Modelo fora da lista ou esforço não aceito | 400, com a mensagem listando o que vale |
| Modo `fs` | aba e rotas: 400 `A administração de pessoas só existe com os dados na nuvem.`; o turno usa o padrão |
| Falha ao ler a configuração no turno | o turno segue no padrão e o erro vai para o log |
| Modelo recusado pela Anthropic | o turno termina com erro e com a mensagem da seção 2 |

### Testes

- **`montarOpcoesSdk`:**
  - sem configuração, as opções são idênticas às de hoje;
  - com o principal configurado, levam `model` e `effort`;
  - com um subagente configurado, levam `agents` com a definição do `.md` mais o modelo e o esforço;
  - um subagente sem configuração não entra.
- **CLI:** os argumentos `--model`, `--effort` e `--agents`.
- **Leitura do `.md` de subagente:** a descrição, as ferramentas e o corpo saem certos.
- **Validação:**
  - modelo fora da lista é recusado;
  - esforço não aceito é recusado;
  - apelido é aceito;
  - os dois em `null` volta ao padrão.
- **Rotas:** 403, 404, 400 e a listagem completa.
- **Turno:**
  - grava `esforco`;
  - uma falha ao ler a configuração mantém o padrão;
  - uma recusa do modelo gera a mensagem orientando o ajuste.
- **Supabase real (opt-in):** gravar e ler `config_modelos`, apagando as linhas de teste no fim.

### Deploy

1. Aplicar a migração de `config_modelos` antes da imagem nova.
2. `config_modelos` entra no backup como tabela global, como `usuarios`.
3. Aceitação:
   1. aplicar a sugestão Haiku na etapa 01 e rodar um turno;
   2. confirmar no painel de custos que a etapa 01 mostra Haiku;
   3. voltar ao padrão e confirmar que o turno seguinte sai no Opus.

## Fora do escopo

- Trocar o modelo de um turno em andamento.
- Histórico de mudanças da configuração. O painel de custos já mostra o modelo de cada turno.
- Limite de gasto por etapa.
- Um campo para digitar um modelo que não está na lista.
