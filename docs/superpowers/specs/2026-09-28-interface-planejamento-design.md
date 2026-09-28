# Interface do Planejamento Estratégico — Design

**Data:** 2026-09-28
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** protótipo local (v1). Fases 2 e 3 registradas no fim, fora do escopo.

## 1. Objetivo

Hoje o planejamento de cada prospect é conduzido no Claude Code, ativando as
skills 01–08 manualmente, na mesma conversa. O objetivo é uma interface no
estilo Claude Cowork em que o analista:

1. cria (ou exclui) um prospect com um clique;
2. conversa com o agente numa área de trabalho por etapa;
3. aprova gráficos, tabelas e textos por botões, não por texto;
4. recebe o pedido de cada insumo com o modelo para baixar e a área para enviar;
5. conclui uma etapa com um botão, o que libera automaticamente a próxima.

As skills, os subagentes, os scripts e os MCPs atuais continuam sendo a fonte
da verdade do processo. A interface é uma casca sobre eles.

**Critério de sucesso do protótipo:** um analista conduz o prospect
`sottile-teste` das etapas 01 a 03 inteiramente pela interface, sem abrir o
terminal, com os entregáveis aprovados saindo em `entrega/ativos-aprovados/`
no mesmo formato e nomes produzidos hoje (referência: `clientes/adda/` e
`clientes/sottile-jalecos/`).

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Onde roda | Local na máquina do analista, com fronteiras separadas (armazenamento, executor do agente, UI) para migrar para hospedado depois |
| 2 | Conversa entre etapas | Um chat por etapa; cada etapa nova recebe um dossiê das anteriores |
| 3 | Aprovações | Cards com Aprovar / Pedir ajuste; o app salva o aprovado; o botão Concluir depende de condições |
| 4 | Modelos de insumo | Modelos oficiais da agência colocados no projeto; o validador segue as colunas deles |
| 5 | Reabrir etapa | Permitido, com cascata: as posteriores concluídas viram "Desatualizadas" |
| 6 | Layout | Três colunas: trilha de etapas, chat, painel de entregáveis e insumos |
| 7 | Motor do agente | Claude Code headless (`claude -p`) com a assinatura do usuário, atrás de um adaptador trocável |
| 8 | Excluir prospect | Confirmação digitando o nome; a pasta vai para a Lixeira do macOS |

## 3. Arquitetura

Tudo roda local. Três camadas:

```
Navegador  ── app Next.js (src/apps/web) + shadcn (src/packages/ui)
   │  rotas internas do Next + SSE para streaming
Servidor local (Node, dentro do app Next)
   ├─ Catálogo de etapas        lê .claude/skills/_shared/etapas.json
   ├─ Máquina de estados        única escritora do estado de cada prospect
   ├─ Montador de dossiê        contexto inicial de cada etapa
   ├─ Validador de insumos      chama scripts/validar_insumo.py
   ├─ Armazenamento [trocável]  v1: pasta clientes/<slug>/  · futuro: Google Drive
   └─ Executor do agente [trocável]  v1: claude -p  · futuro: Agent SDK
   │  processo filho, stream-json, --resume por etapa
Claude Code headless (raiz do projeto)
   ├─ CLAUDE.md, skills 01–08, subagentes, scripts Python, MCPs (Firecrawl, Canva)
   └─ MCP "planejamento" (novo): propor_entregavel, solicitar_insumo, sinalizar_etapa_pronta
```

### 3.1 Módulos do servidor local

Cada módulo tem uma responsabilidade e uma interface pequena. Nenhum módulo
fora do executor sabe que o motor é o CLI.

- **Catálogo de etapas.** Carrega o manifesto `etapas.json`: para cada etapa,
  `id`, `titulo`, `descricao`, `skill`, `insumos` (ids do catálogo de
  insumos, com obrigatório/opcional). A ordem das etapas define as
  dependências; o tipo de cada entregável vem em `propor_entregavel`.
  Inclui as etapas 01–08 e a "Apresentação final" (subagente
  `designer-apresentacao`). Também define o catálogo de insumos: `id`,
  `nome_para_o_analista`, `descricao`, `tipo` (`arquivo` ou `link`, ex.: o
  site do prospect), `formatos_aceitos`, `modelo`
  (caminho ou nulo), `destino` (caminho canônico em `dados/` ou
  `contexto/brutos/`), `validador` (nome do schema ou nulo), `sensivel`
  (bool).
- **Máquina de estados.** Única escritora de `.app/estado.json`. Aplica as
  transições da seção 4, calcula as condições do botão Concluir e a cascata.
  A cada transição, regera `contexto/status-planejamento.md` no formato
  atual (tabela de etapas + bloco "Próximo passo").
- **Montador de dossiê.** Para a etapa N, junta: `contexto/decisoes/*.md` das
  etapas anteriores concluídas; a lista de arquivos em
  `entrega/ativos-aprovados/`; a seção "Overrides" do `CLAUDE.md` do
  prospect; os arquivos de contexto persistido existentes
  (`contexto/kickoff-transcricao.md`, `contexto/contextualizacao-estrategica.md`)
  como caminhos para o agente ler.
- **Validador de insumos.** Recebe o arquivo enviado e o id do insumo, chama
  `scripts/validar_insumo.py` e devolve `ok` ou uma lista de problemas em
  linguagem do analista.
- **Armazenamento de prospects.** Interface: `listar`, `criar(nome, site)`,
  `excluir(slug)`, `ler`, `gravar`, `copiar`, `existe`. Implementação v1 sobre
  `clientes/`. `criar` reproduz as regras da skill `criar-prospect`
  (normalização do nome, recusa se já existir, cópia de `_template/`);
  `excluir` move a pasta para a Lixeira do macOS.
- **Executor do agente.** Interface: `executarTurno({prospect, etapa,
  mensagem, anexos, sessionId?}) → fluxo de eventos` e `parar()`.
  Implementação v1 descrita na seção 6.

## 4. Ciclo de vida de uma etapa

Estados: `bloqueada`, `liberada`, `em_andamento`, `pronta`, `concluida`,
`desatualizada`.

| De | Para | Gatilho |
|---|---|---|
| bloqueada | liberada | Etapa anterior foi para `concluida` |
| liberada | em_andamento | Analista clica "Iniciar etapa" |
| em_andamento | pronta | Agente chama `sinalizar_etapa_pronta` **e** todas as condições abaixo valem |
| pronta | em_andamento | Analista envia nova mensagem, ou um card novo fica pendente |
| pronta | concluida | Analista clica "Concluir etapa" |
| concluida | em_andamento | Analista clica "Reabrir" (retoma o mesmo chat) |
| concluida | desatualizada | Uma etapa anterior foi reaberta |
| desatualizada | concluida | Analista clica "Confirmar que continua válida" |
| desatualizada | em_andamento | Analista clica "Revisar" |

**Condições do botão "Concluir etapa"** (todas obrigatórias):

1. todos os insumos obrigatórios da etapa enviados e validados;
2. nenhum entregável em "aguardando aprovação";
3. o agente sinalizou que o critério de conclusão da skill foi atingido.

O botão bloqueado mostra a lista do que falta (sempre visível logo abaixo do botão).

**Ao concluir**, o app grava `contexto/decisoes/NN-<etapa>.md` (resumo de
decisões enviado pelo agente), grava o handoff, regera o
`status-planejamento.md` e libera a próxima etapa.

**Cascata.** Reabrir a etapa K marca como `desatualizada` toda etapa > K que
esteja `concluida`. Uma etapa > K em andamento recebe no chat um aviso
automático de que a etapa K foi alterada, e o dossiê dela é refeito. Nada é
apagado. A "Apresentação final" só é liberada sem nenhuma etapa
desatualizada.

## 5. Telas

Visual baseado em shadcn (Base UI, estilo `base-nova`, já configurado em
`src/`).

1. **Home.** Grade de cards de prospect: nome, etapa atual, barra de
   progresso, selos de pendência ("1 aprovação pendente"), última
   atualização. Busca. Botão "+ Novo prospect". Menu ⋯ por prospect com
   Abrir, Abrir pasta no Finder e Excluir…
2. **Novo prospect** (Dialog). Campos: nome (mostra ao vivo a pasta que será
   criada) e site. Se a pasta já existir, oferece abrir o existente ou
   trocar o nome, e nunca sobrescreve. O site informado já conta como o insumo
   `site` da Etapa 01 (gravado em `contexto/site-referencia.md`, como hoje).
   Ao criar, abre a área de trabalho com a Etapa 01 liberada.
3. **Excluir** (AlertDialog). Explica que a pasta vai para a Lixeira. O botão
   só libera depois de digitar o slug do prospect. Fica bloqueado enquanto
   houver turno do agente em andamento naquele prospect.
4. **Área de trabalho** (três colunas).
   - Esquerda: nome do prospect, volta para a home, trilha de etapas com o
     estado de cada uma.
   - Centro: chat da etapa selecionada, com streaming, anexos por arrastar,
     botão Parar durante o turno. O campo de mensagem fica bloqueado
     enquanto o agente responde.
   - Direita (recolhível): entregáveis da etapa (status de cada um), insumos
     (status de cada um), botão "Concluir etapa" no rodapé.
   - Etapa concluída: chat só leitura e botão "Reabrir".
   - Etapa sem chat (importada do terminal): aviso "conversa feita no
     terminal" e os entregáveis no painel.
5. **Etapa liberada.** Descrição da etapa, o que preparar (texto de handoff da
   etapa anterior) com o modelo para baixar quando houver, botão "Iniciar
   etapa".
6. **Card de insumo** (no chat e no painel). Nome, para que serve, instrução
   de preenchimento, botão "Baixar modelo" (quando o insumo tem modelo),
   área de envio, resultado da validação em linguagem clara, "Enviar outra
   versão". Insumos sem modelo (transcrição do kickoff, formulário, prints
   de campanha) usam o mesmo card sem o botão de modelo.
7. **Card de entregável.** Segue o padrão já produzido no Claude Code (ver
   `clientes/adda/` e `clientes/sottile-jalecos/entrega/ativos-aprovados/`):
   - mostra o **arquivo real** gerado pelo agente; a UI nunca redesenha
     gráfico ou tabela;
   - gráfico: PNG em matplotlib seguindo `padrao-visual.md`; tabela: PNG no
     estilo atual (`tabela-*.png`); seção de texto: `.md` renderizado,
     recolhível; planilha `.xlsx`, documento `.docx` e `benchmark.html`:
     prévia quando possível e download;
   - mostra o nome com que o arquivo vai para a apresentação;
   - mostra a pergunta de validação do `padrao-visual.md` acima dos botões
     nos gráficos;
   - botões: Aprovar, Pedir ajuste… (campo curto enviado ao agente como
     mensagem), Ampliar;
   - uma nova proposta com o mesmo nome final marca o card anterior como
     "substituído".

## 6. Fluxo de dados

### 6.1 Arquivos por prospect

O que existe hoje continua igual. Novidades:

```
clientes/<slug>/
  contexto/status-planejamento.md   gerado pelo app a partir do estado
  contexto/decisoes/NN-<etapa>.md   NOVO — gravado ao concluir a etapa
  dados/                            insumos validados, com nome canônico
  entrega/ativos-aprovados/         só o app escreve aqui (ao Aprovar)
  .app/estado.json                  NOVO — estado das etapas, session_id, cards
  .app/rascunhos/                   NOVO — arquivos do agente antes da aprovação
  .app/conversas/NN.jsonl           NOVO — histórico exibido na UI, por etapa
  .app/propostas/<id><ext>          NOVO — cópia congelada de cada proposta (o card mostra sempre a versão proposta)
```

O histórico do chat fica na pasta do prospect, e não só nos arquivos internos
do Claude Code, para que a troca de armazenamento (Drive) e de executor (SDK)
não dependa deles. `estado.json` é gravado de forma atômica (arquivo
temporário + renomear).

### 6.2 Um turno

1. Analista envia mensagem (com anexos opcionais) para a rota do app.
2. Se for o primeiro turno da etapa, o app monta o prompt inicial: etapa,
   skill a rodar, pasta do prospect, dossiê e o lembrete do modo interface.
3. O executor dispara, na raiz do projeto:
   `claude -p --output-format stream-json --verbose --include-partial-messages
   --mcp-config <config do MCP planejamento> --allowedTools <lista>
   [--resume <session_id>]`, com a mensagem pela entrada padrão. O
   `session_id` retornado é salvo no estado da etapa.
4. Eventos vão para a UI por SSE e para `.app/conversas/NN.jsonl`.
5. Chamadas às ferramentas do MCP "planejamento" são repassadas pelo servidor
   MCP ao app (HTTP em localhost, com token gerado por execução); o app
   atualiza o estado e a UI mostra o card.
6. Cliques em cards viram ações do app mais uma mensagem automática ao agente
   (ex.: "Analista aprovou `investimento-total-mensal`"), que abre um novo
   turno.
7. Um turno por prospect por vez (trava por prospect). "Parar" encerra o
   processo filho.

### 6.3 MCP "planejamento"

Servidor MCP stdio pequeno, parte do app, iniciado pelo `claude` via
`--mcp-config`. As ferramentas não bloqueiam esperando o analista: registram
o pedido e respondem ao agente que aguarde a decisão.

| Ferramenta | Entrada | Comportamento |
|---|---|---|
| `propor_entregavel` | `tipo` (grafico, tabela, secao, planilha, documento, html), `titulo`, `arquivo_rascunho` (em `.app/rascunhos/`), `nome_final` (estável, kebab-case) | Valida existência e nome; cria o card. Ao aprovar, o app copia para o destino pelo tipo: grafico/tabela → `graficos/<nome>.png`; secao → `secoes/NN-<nome>.md`; planilha → `projecao/`; documento → `plano-de-acao/`; html → `benchmark/`. Sobrescreve a versão anterior. |
| `solicitar_insumo` | `insumo_id` do catálogo | Cria o card de insumo com modelo, formatos, destino e validador do catálogo. Id desconhecido → erro ao agente. |
| `sinalizar_etapa_pronta` | `resumo_decisoes` (markdown), `handoff_proxima` (texto ao analista) | Confere as condições da seção 4. Se falta algo, devolve ao agente a lista do que falta. Se não, etapa vai para `pronta`. |

### 6.4 Permissões e travas

- O modo headless não pede aprovação interativa. O app passa ao `claude` uma
  lista fechada de ferramentas: leitura e escrita de arquivos, Bash limitado a
  `python3` (os scripts do projeto e o pandas/matplotlib do `analista-dados`)
  e a comandos de leitura, Skill, subagentes, Firecrawl, Canva e o MCP
  "planejamento".
- Um hook `PreToolUse` do Claude Code, ativo quando o app roda o agente,
  **bloqueia** Write/Edit fora de `clientes/<slug>/` e Write/Edit direto em
  `entrega/ativos-aprovados/`. A Regra 2 (salvar só o aprovado) passa a ser
  garantida por código para as ferramentas de arquivo.
- Limite conhecido: scripts rodados via Bash (ex.:
  `preencher_projecao_xlsx.py --output ...`) não passam pelo hook. Para eles,
  a Regra 7 manda gravar a saída em `.app/rascunhos/`, e o app, ao receber
  `propor_entregavel`, recusa arquivo fora de `.app/rascunhos/`. Se algo for
  gravado direto em `ativos-aprovados/` mesmo assim, o painel mostra o arquivo
  como "não aprovado pela interface".

## 7. Ajustes nas skills e arquivos compartilhados

As skills continuam funcionando no terminal. O modo interface é aditivo.

- **`regras-de-validacao.md` — nova Regra 7, "Modo interface".** Quando as
  ferramentas do MCP "planejamento" estiverem disponíveis: checkpoints via
  `propor_entregavel` com arquivos em `.app/rascunhos/` (em vez de pedir
  confirmação em texto e salvar); insumos via `solicitar_insumo`; encerramento
  via `sinalizar_etapa_pronta` (em vez de editar `status-planejamento.md`).
- **Regra 6 estendida.** Toda etapa grava `contexto/decisoes/NN-<etapa>.md` ao
  concluir, nos dois modos (no modo interface, quem grava é o app com o
  `resumo_decisoes`).
- **Skills 06 e 08.** Trocar "ler todo o histórico da conversa desde a Skill
  01" / "tudo que já foi decidido nesta conversa" por "ler
  `contexto/decisoes/*.md` e a conversa atual".
- **Novo `.claude/skills/_shared/etapas.json`** (catálogo de etapas e de
  insumos). Mesma regra de consistência do handoff: se o "Antes de começar"
  de uma skill mudar, o catálogo muda junto.
- **Novo `.claude/skills/_shared/modelos-insumo/`** com os três modelos
  oficiais (`historico-mensal.xlsx`, `produtos-curva-abc.xlsx`,
  `clientes-historico.xlsx`) e a descrição das colunas esperadas de cada um.
- **Novo `scripts/validar_insumo.py`** (Python, openpyxl): confere colunas
  obrigatórias, 12 meses no histórico mensal, colunas vazias por mês e, nos
  insumos marcados `sensivel`, detecta CPF, e-mail, telefone e cartão.
  Usável pelo app e pelas skills no terminal.
- **`clientes/_template/`** ganha `contexto/decisoes/`.
- **`criar-prospect`** continua valendo no terminal; o app implementa as
  mesmas regras em código.

## 8. Erros

| Situação | O que o analista vê |
|---|---|
| Claude Code não instalado ou não logado | Tela de configuração ao abrir o app, com o passo a passo |
| Limite da assinatura atingido | Aviso no chat, turno "interrompido", botão "Tentar de novo" |
| Processo cai no meio do turno / app fechado | Resposta parcial mantida, turno "interrompido", retomada pela mesma sessão |
| Agente propõe arquivo inexistente ou nome fora do padrão | Nada; a ferramenta devolve o erro ao agente, que corrige |
| Insumo inválido | Lista de problemas no card de insumo |
| Nome de prospect já existe | Opção de abrir o existente ou trocar o nome |
| Prospect antigo sem `estado.json` (Adda, Sottile) | Estado importado do `status-planejamento.md`; etapas concluídas com aviso "conversa feita no terminal" |

## 9. Testes

- **Unitários:** máquina de estados (transições, condições do Concluir,
  cascata); normalização de slug; `validar_insumo.py` com fixtures derivadas
  da Sottile; montador de dossiê; mapeamento tipo → destino de
  `propor_entregavel`; importação de `status-planejamento.md`.
- **Integração sem consumir assinatura:** executor falso que reproduz um
  `stream-json` gravado de uma sessão real, cobrindo UI, cards e MCP de ponta
  a ponta.
- **Validação real:** conduzir `sottile-teste` pela interface nas etapas 01–03
  (critério de sucesso da seção 1).

## 10. Dependências e pré-requisitos

- Máquina do analista: Node ≥ 22.18 (o servidor MCP e o hook rodam como `.ts` direto), Python 3 com openpyxl, pandas e matplotlib
  (os mesmos que o `analista-dados` já usa), Claude Code instalado e logado.
- **Dependência do usuário:** colocar os três modelos oficiais de insumo em
  `.claude/skills/_shared/modelos-insumo/`. Só a validação dos insumos das
  etapas 03 e 04 depende disso; o resto pode ser construído antes.
- Canva (etapa final) e Firecrawl (etapas 06–07) precisam estar autenticados
  no Claude Code do analista, como hoje.

## 11. Fora do escopo da v1 (plano futuro)

- **Fase 2 — após validar o protótipo:** trocar o executor para o Claude Agent
  SDK com chave de API da organização. Só o módulo executor muda; as
  ferramentas do MCP "planejamento" passam a ser ferramentas em processo do
  SDK, com o mesmo contrato.
- **Fase 3:** versão hospedada, com login e multiusuário; armazenamento no
  Google Drive (implementação nova do módulo de armazenamento).
- Edição manual de arquivos aprovados pela UI; qualquer versionamento de
  entregáveis (continua valendo "só a versão aprovada mais recente importa").
- Servidor de desenvolvimento escuta só em 127.0.0.1; a versão hospedada
  (Fase 3) precisa de autenticação antes de abrir para a rede.
