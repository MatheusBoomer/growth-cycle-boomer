# UX da janela de prospects e do painel de Projetos (admin)

Data: 2026-11-09. Status: desenho conversado com o usuário; aguardando revisão do documento.

## Por quê

Hoje há poucos projetos, mas o administrador já tem dificuldade de reconhecer de relance **de quem é** cada projeto e **em que etapa está** (o cartão mostra a etapa quase só como número). Quando houver muitos projetos, e muitos já concluídos, a lista única vai virar bagunça. No painel de **Projetos** (Administração), as informações de custo e tempo são tabelas de números sem contexto: o usuário quer entender os gastos de forma **gráfica**, com filtros. A equipe ainda não usa bem o painel; por isso ele precisa responder "quanto estamos gastando, onde e com quem" sem esforço.

## Objetivos

### 1. Janela de prospects (home), opção "A" escolhida pelo usuário

- Cartões separados em duas seções: **Em andamento** (aberta) e **Concluídos** (recolhida por padrão, com a contagem ao lado e um clique para abrir). "Concluído" = nenhuma etapa atual (`etapaAtual === null`).
- Cada cartão mostra, de relance: nome do projeto; **analista responsável com a foto do Gmail dele** e o nome; **etapa atual pelo nome** (ex.: "04 · Unidade econômica", que já vem em `rotuloEtapaAtual`).
- Decisões minhas (confirmar ao ler): manter a barra de progresso (8 segmentos, concluídas/atuais/futuras), a data da última atividade e o selo "N aprovação(ões) pendente(s)", pois já existem e são o que mais pede ação.
- Topo da página: busca por nome; filtros por **analista**, **etapa** e "com aprovação pendente"; ordenação (padrão: atividade mais recente). O alternador "Meus / Todos" de hoje passa a ser um atalho do filtro de analista.
- Usuário comum continua vendo só os projetos dele, com a mesma organização em seções, sem o filtro de analista.
- **Foto:** o login já é Google. Decisão minha: guardar a URL da foto (`avatar_url`/`picture` do perfil Google) no momento do login, numa coluna nova de `planejamento.usuarios`, e não buscar em `auth.users` do projeto Supabase compartilhado. Quem nunca entrou no app, ou sem foto, aparece com as **iniciais numa bolinha colorida** (cor derivada do e-mail). O nome exibido continua sendo o derivado do e-mail (`nomeCurto`), já que o app não guarda nome de pessoa.

### 2. Painel de Projetos (Administração → Projetos)

Layout validado em mockup (dados fictícios), de cima para baixo:

1. **Barra de filtros:** período (7 dias, 30 dias, 90 dias, ano, personalizado), analista, projeto, etapa, modelo, "incluir testes" (desligado por padrão).
2. **Quatro números grandes:** custo no período (com variação contra o período anterior); tempo útil (idem); custo médio por projeto concluído (com mediana e N); projetos ativos e concluídos, com quantos têm aprovação pendente.
3. **Gráfico de área** "custo ao longo do tempo": por semana, empilhado por modelo, com tooltip ao passar o mouse.
4. **Rosca** "custo por etapa" (etapas pequenas agrupadas em "Outras"; a etapa arquivada `briefing-benchmark` entra em "Outras" ou numa fatia própria rotulada "Briefing e benchmark (arquivada)", escolha do construtor).
5. **Barras horizontais** "custo por projeto" (empilhadas por fase, ordenadas do maior para o menor) e **barras empilhadas** "tempo por analista" (agente, analista ativo, ocioso).
6. **Lista de projetos** com abas Em andamento / Concluídos / Todos, busca, e colunas Projeto, Analista (foto), Etapa atual (nome), Custo, Tempo útil, Atividade; linha leva ao detalhe do projeto.
- **Interação:** tudo reage aos filtros; clicar numa fatia, barra ou analista aplica esse filtro ao resto da página (filtro cruzado), com um jeito visível de limpar.
- Decisão minha, aceita por associação ao mockup: botão "Exportar CSV" da visão filtrada (item de menor prioridade; pode ficar por último).
- **Detalhe do projeto** (`/admin/projetos/[slug]`): sem redesenho. Mudanças pequenas: explicar na tela os termos "Agente", "Analista ativo", "Ocioso" e "Descartado" (tooltip ou legenda), mostrar o modelo com o selo de modelo que já existe, e barras simples no lugar de números soltos nas tabelas por etapa e por pessoa. (Decisão minha.)

### 2b. Definições que o painel precisa (decisões minhas, resolvidas depois da leitura do desenho)

- **"Analista"** tem dois sentidos, e a tela os separa:
  - O filtro **Analista** e a foto no cartão e na lista são o **dono do projeto** (`dono`, o e-mail de `criado_por`), igual à janela de prospects. Filtrar por analista seleciona projetos inteiros; o custo continua sendo do projeto.
  - O gráfico passa a se chamar **"Tempo por pessoa"** e agrupa por **quem realmente trabalhou** (e-mail de `presenca` para tempo e `autor` de `uso_turnos` para custo), como o "Por pessoa" do detalhe de hoje. Se um colega abre o projeto de outro, o tempo dele aparece no nome dele. Clicar numa barra de pessoa só destaca a barra e mostra o tooltip; não filtra o resto da página.
  - Linhas antigas de `uso_turnos` sem `autor` ficam fora do gráfico por pessoa (como já acontece em `custoPorPessoa`), e a tela diz isso em uma nota discreta.
- **Projeto concluído** = o projeto está sem etapa atual (`etapaAtual === null`, ou seja, a etapa `final` concluída). A **data de conclusão** vem de `estado.etapas.final.concluidaEm`, que já existe, então não há coluna nova nem migração por isso. Projetos concluídos sem essa data aparecem nas listas, mas ficam fora de contas por período.
- **Custo médio por projeto concluído**: média (e mediana, e N) do **custo total de vida** dos projetos cuja data de conclusão cai dentro do período filtrado. Os contadores "ativos / concluídos" dos números grandes mostram o estado **de hoje** e não mudam com o período; a variação "vs. período anterior" vale só para custo e tempo.
- **Fase** (empilhamento do gráfico "custo por projeto") = agrupamento fixo das etapas: Contexto (01 e 02), Diagnóstico (03 e 04), Soluções e metas (05 e 06), Mídia e ação (07 e 08), Apresentação (`final`). O agrupamento mora como campo `fase` em cada etapa de `.claude/skills/_shared/etapas.json` (a fonte única da numeração, que já mudou uma vez), e o código o lê de lá. A etapa arquivada `briefing-benchmark` entra numa fase própria "Arquivada".
- **Filtro de modelo** filtra **a parcela do custo**: com um modelo escolhido, totais, rosca, área e lista mostram só os dólares gastos naquele modelo (`modelos` de cada turno). O **tempo não tem modelo**, então o tempo e os números de tempo seguem os demais filtros (período, projeto, analista, etapa), e a tela avisa "tempo não filtra por modelo" enquanto o filtro está ativo.

### 3. Moeda

Todos os valores de gasto em **dólar (US$)**, como a Anthropic cobra e como o app já mostra. Sem conversão para reais. (Decisão do usuário.)

## Não objetivos

- Conversão para reais; orçamento/alerta de limite de gasto; previsão de gasto.
- Redesenhar as abas Pessoas, Modelos e Skills.
- Mudar como custo e tempo são medidos (continua `src/packages/core/src/metricas/`, custo por turno por diferença do acumulado da sessão, tempo em blocos de 30 s).
- Atualização em tempo real do painel (atualiza ao abrir, ao mudar filtro e por um botão de atualizar).
- Mostrar qualquer métrica de gasto a quem não é administrador.

## Anti-objetivos (seria fracasso mesmo funcionando)

- **Gráficos esticados ou distorcidos**, nas linhas, nos traços e principalmente nos textos e legendas, quando a janela muda de largura. Exigência explícita do usuário, depois de ver o mockup SVG esticado. Conferir em larguras de celular, tablet e desktop largo, nos temas claro e escuro.
- Números de custo errados por somar o acumulado da sessão: o custo de um turno é a diferença do acumulado (já resolvido em `metricas/custo.ts`); a série temporal e os totais precisam usar esse mesmo valor, e o que for estimado (linhas antigas) continua marcado como estimado.
- Painel que fica lento conforme o histórico cresce: hoje cada chamada relê todo `uso_turnos` e `presenca`.
- Projetos de teste poluindo médias e gráficos por padrão.
- Lista de prospects em que o analista ou a etapa só aparecem em número ou depois de abrir o projeto.

## Restrições

- **Stack existente:** Next.js 16 modificado (ler `src/apps/web/node_modules/next/dist/docs/` antes de código específico do Next, como pede `src/apps/web/AGENTS.md`), shadcn sobre `@base-ui/react` (não Radix), Tailwind v4, tema escuro (padrão) e claro com `next-themes`, paleta Boomer (laranja `#eb610a`, azul `#3987e5`, verde `#199e70`). Todo texto em português.
- **Biblioteca de gráficos:** hoje não há nenhuma. Decisão minha: usar o componente `chart` do shadcn (Recharts), que dimensiona sem distorcer e já usa os tokens `--chart-*`. Os tokens `--chart-1..5` estão definidos só para o tema claro e precisam ganhar valores para o escuro.
- **Dados só existem na nuvem** (`uso_turnos`, `presenca`); no modo disco as listas vêm vazias, e o painel deve mostrar estado vazio claro.
- **Série temporal é novo:** as métricas atuais devolvem só totais. É preciso um novo cálculo no servidor que agrupe por semana (e, para períodos curtos, por dia) a partir de `inicio`/`fim`, `custo_turno_usd` e `modelos` de `uso_turnos`, aplicando os filtros no servidor. Decisão minha: uma rota nova de agregação (uma passada nos dados, com cache curto em memória) em vez de fazer o navegador baixar tudo.
- **Permissão:** tudo do painel só para administrador, como hoje (`/admin` redireciona quem não é admin).
- **Já existe** `ResumoProspect` com `dono` (e-mail), `rotuloEtapaAtual`, `concluidas`, `totalEtapas`, `pendencias`, `atualizadoEm`; só faltam foto e agrupamento.
- A página de login Google e o `usuarios` pertencem ao projeto Supabase compartilhado com o `pit`: a coluna nova fica no schema `planejamento`, nada fora dele é tocado.
- Regra do projeto: mudou skill ou fluxo, o `fluxo.mmd` muda junto (provavelmente não se aplica aqui).

## O que fica para o construtor

Escala de cores e ordem das séries; textos exatos; esqueletos de carregamento e estados vazios; comportamento em celular; acessibilidade (rótulos e contraste, tooltips acessíveis por teclado); como juntar o filtro cruzado com os filtros da barra; nomes de rotas e componentes; paginação ou virtualização da lista quando houver muitos projetos (hoje são 6).
