# Redesign visual do Growth Cycle

Data: 2026-11-12 · Branch: `feat/redesign-visual` (worktree `.claude/worktrees/redesign-visual`, saída da `main` em 044774f)

## Intenção

O app funciona, mas a equipe acha a cara dele simples demais: fonte padrão (Inter), tudo com o mesmo peso,
cards iguais, quase nada se move. O pedido é deixá-lo "slim, moderno, bonito", no nível de sites de agência
de referência, sem perder o que já funciona. O app é ferramenta de trabalho diário dos analistas (horas no
chat com o agente), e também é a vitrine da Boomer por dentro.

Referências que o usuário trouxe e que definem a linguagem:
- recto.framer.website e conversion.framer.media: fundo quase preto, um brilho quente difuso atrás do título,
  título grande misturando sem serifa com uma palavra em serifada itálica colorida, botões e menus em pílula,
  cards com borda fina.
- Behance "UI/UX Design for Marketing Agency Website" (Adspace): mesma mistura de fontes, cards de vidro com
  números grandes, um card de cor sólida para chamar ação, diagrama circular.

O laranja da Boomer (#eb610a) faz o papel da cor de destaque.

## Protótipos aprovados (referência visual exata)

Em `docs/superpowers/specs/assets/redesign-visual/`. Abrem direto no navegador (carregam fontes do Google).
Cada arquivo traz opções; o que vale está abaixo.

| Arquivo | O que vale |
|---|---|
| `1-entrada.html` | Opção **B** (gigante, de borda a borda), com a velocidade de `2-home.html` (33% mais rápida que a do arquivo 1) |
| `2-home.html` | Arranjo **B** (bento) **mais a barra de filtros do arranjo A** acima da grade |
| `3-tela-de-trabalho.html` | A tela inteira, menos o confete (o confete é o do projeto, ver abaixo) |
| `4-modo-claro.html` | Tema **Claro pérola** (os temas creme e gelo foram descartados) |
| `5-login.html` | Opção **B** (centrado e editorial) |
| `6-admin.html` | As cinco abas, o painel lateral de Modelos, o detalhe de Reports e o diálogo Reportar |
| `7-fundo-dithered.html` | Opção **B sutil** (o primeiro quadro), com intensidade "sutil", pixel "fino" e 4 tons. O A é só comparação |

Os protótipos usam dados fictícios e HTML solto. Eles definem aparência, hierarquia, movimento e textos; a
estrutura de dados e o comportamento vêm do app atual.

## Objetivos

1. Uma linguagem visual única no app inteiro: tipografia, cores, pílulas, cards, tabelas, selos.
2. Dois temas, escuro e claro pérola, ambos de primeira classe.
3. Movimento nos momentos que importam (entrada, chegada de conteúdo, aprovação pendente, fim de etapa),
   nunca no caminho do trabalho.
4. Todas as telas: entrada, login, home, tela de trabalho, admin (Pessoas, Projetos, Modelos, Skills,
   Reports, detalhe do projeto) e o diálogo Reportar.

## Não objetivos

- Visual da apresentação final (.pptx), dos gráficos que o agente gera nas etapas
  (`.claude/skills/_shared/padrao-visual.md`) e dos fluxogramas `.mmd`. Nada disso muda.
- Layout próprio para celular. As telas não podem quebrar em tela estreita, mas não ganham desenho novo.
- Mudar regra de negócio, dados ou rotas. É um projeto de interface.

## Anti-objetivos (falharia mesmo funcionando)

- Efeito que atrapalhe o chat: animação contínua chamativa na área de trabalho, travada ao rolar, texto que
  demora a aparecer.
- Cara de landing page no uso diário: a entrada é um momento; o resto é ferramenta.
- Gráfico esticado. Regra dura do usuário: alturas explícitas, legendas em HTML, nada de
  `preserveAspectRatio="none"` (há teste estático que guarda isso).
- Perder contraste no tema claro ou ignorar `prefers-reduced-motion`.
- Borda ou brilho "exagerado". O usuário pediu explicitamente que a borda do card esperando aprovação seja
  sutil e delicada.

## Restrições

- Next.js 16 (ler `node_modules/next/dist/docs/` antes de mexer em fontes e layout), React 19,
  Tailwind 4, shadcn com estilo `base-nova` (Base UI, não Radix). Componentes de base em `src/packages/ui`,
  tokens em `src/packages/ui/src/styles/globals.css`.
- Textos da interface em português do Brasil, no tom atual.
- 83 arquivos de teste no app web; uns 6 conferem classes CSS (`card-prospect`, `grade-prospects`,
  `painel-projetos`, `lista-projetos`, `link-administracao`, `fundo-ondas-ascii`) e vão precisar de ajuste.
  `npm test` em `src/apps/web` e `src/packages/core` tem que passar em cada PR.
- **Número de etapas vem dos dados, nunca fixo.** Os protótipos mostram 8 etapas porque foram feitos numa
  branch antiga. Na `main`, `ORDEM_ETAPAS` é `01–08, final, 10`: a "Apresentação final" (`final`) não tem
  número e a etapa 10 ("Revisão pós-apresentação") fica na fase "Pós-apresentação". `ResumoProspect`
  traz `concluidas` e `totalEtapas`. Anel, barrinhas, "N de M etapas" e a árvore usam esses números e o
  catálogo (`etapas.json`, campo `fase`), e etapas sem número aparecem só pelo título (sem "Etapa NN").
  Projetos antigos podem ter etapas na fase arquivada (`FASE_ARQUIVADA`): mostrar como hoje.
- Deploy na VPS a cada PR, como hoje.

## Abordagens consideradas

1. **Base primeiro, depois tela por tela (escolhida).** Um PR de fundação (fontes, tokens, pílulas, fim do
   ASCII) muda o app inteiro de cara; depois um PR por tela. A equipe vê progresso a cada deploy; um
   problema numa tela não segura as outras. Custo: por alguns dias, telas novas convivem com telas que só
   ganharam cores e fontes.
2. **Tudo de uma vez.** Virada limpa, mas revisão enorme, risco concentrado num deploy e o usuário só vê no
   fim.
3. **Novo visual atrás de uma chave.** Útil se a equipe não pudesse estranhar a interface, mas cada tela seria
   mantida em dobro durante a transição.

O usuário ouviu as três com a recomendação da 1 e mandou seguir.

## Decisões

### Tipografia

- **Geist** (sem serifa) substitui a Inter em toda a interface. **Geist Mono** continua para números
  técnicos (relógio, contadores `0/1`, ids).
- **Instrument Serif** (itálico e normal) entra como fonte de destaque, só em: a palavra de destaque dos
  títulos de página ("Seus Growth *Cycles*", "Projetos *e custos*"), nomes de etapa em destaque
  (cabeçalho da etapa, cards da home, títulos de entregável), números grandes dos cards de métrica e a
  entrada. Nunca em texto corrido, tabela ou botão.
- Títulos de página grandes (56 a 64 px), com espaçamento negativo; a palavra em serifada vai na cor de
  destaque.
- Carregar as três por `next/font/google`.

### Cores e temas

Valores de partida nos protótipos (`--bg`, `--fg`, `--muted`, `--line`... em `4-modo-claro.html` e
`6-admin.html`). Mapear para os tokens que já existem em `globals.css` (`--background`, `--card`,
`--primary`, `--texto-forte`, `--sucesso`, `--aviso`, `--selo-*`, `--vidro-*`...), sem criar um segundo
sistema.

- **Escuro:** fundo quase preto neutro (#0a0a0b no lugar do azul-marinho #070a12), texto #f4f4f5, linhas
  brancas a 8% e 14%, cards com gradiente branco de 4,5% para 1,5%.
- **Claro pérola:** substitui o claro atual (#f5f6fa). Página #e8e6e2, fundo #f7f6f3, cards brancos puros,
  texto #17150f, sombra suave quente. O laranja de **texto** escurece para #c94d05 por contraste; botões,
  anel e o card laranja de aprovações seguem no laranja da marca.
- Cores de status e de família de modelo continuam com os mesmos papéis (Haiku verde, Sonnet azul, Opus
  roxo, Padrão tracejado; aviso âmbar, sucesso verde, perigo vermelho), com os tons dos protótipos.
- Brilho de fundo: um gradiente radial laranja suave no topo de cada tela. **O fundo ASCII
  (`fundo-ondas-ascii`) é removido**, componente e teste. O fundo dithered (abaixo) entra só em três lugares.

### Forma

- Botões, abas, filtros e selos em **pílula** (raio total). Abas sublinhadas viram controle segmentado em
  pílula.
- Cards com raio 18 px, borda fina, sem sombra pesada no escuro e sombra quente suave no claro.
- Tabelas sem grade: só linhas horizontais finas, cabeçalho pequeno e apagado, hover suave na linha.
- Selos de status e de modelo com fundo translúcido da própria cor.

### Movimento (regras gerais)

- Conteúdo que chega entra com desfoque + subida curta (Blur Fade), escalonado quando é lista.
- Números grandes contam de 0 até o valor ao aparecer (Number Ticker), uma vez.
- Tudo respeita `prefers-reduced-motion`: sem movimento, o estado final aparece direto.
- Nada se move continuamente na tela de trabalho, exceto: o indicador da etapa atual (pulso leve), a borda
  sutil do entregável pendente e o Thought Line enquanto o agente trabalha.

### Componentes das bibliotecas

Registrar `@magicui` (`https://magicui.design/r/{name}.json`) e `@react-bits`
(`https://reactbits.dev/r/{name}.json`) no `components.json`; instalar pelo CLI do shadcn, que copia o
código para o projeto. Variantes TS + Tailwind da React Bits. A dependência nova esperada é `motion`.
O Thought Line e o Branched Menu usam Hugeicons: trocar para Lucide ao trazer.

| Componente | Origem | Onde |
|---|---|---|
| Dia Text Reveal | Magic UI `dia-text-reveal` | Entrada |
| Animated Theme Toggler | Magic UI `animated-theme-toggler` | Botão de tema na barra do topo |
| Blur Fade | Magic UI `blur-fade` | Chegada de cards, listas e mensagens |
| Number Ticker | Magic UI `number-ticker` | Números grandes da home e do admin |
| Magic Card | Magic UI `magic-card` | Luz que segue o mouse nos cards da home |
| Border Beam / Shine Border | Magic UI | Borda sutil: card da home com aprovação pendente e entregável aguardando aprovação |
| Progressive Blur | Magic UI `progressive-blur` | Bordas de cima e de baixo do chat |
| Thought Line | React Bits | Substitui a lista "Processo" do chat |
| Branched Menu | React Bits | Trilha de etapas da tela de trabalho |

Se um componente da biblioteca não chegar no visual do protótipo com ajuste razoável, vale reproduzir o
efeito à mão. O protótipo é a referência, não o componente.

### Fundo dithered

Escolha do usuário: **React Bits `Dither`, versão sutil** (`7-fundo-dithered.html`, primeiro quadro).

- Ondas lentas de ruído quantizadas em **4 tons**, retícula Bayer 8×8, **pixel fino** (2 px CSS), intensidade
  **"sutil"** (60% da força), velocidade a 60% da padrão.
- Paleta escura: #0a0a0b → #120b07 → #4a1f08 → #9a420e. Paleta pérola: #f7f6f3 → #f2e9e0 → #ead2bd →
  #dba57c.
- O centro (atrás do texto e do botão) fica quase limpo: as ondas aparecem nas bordas e no rodapé.
- O mouse abre um rastro discreto no padrão (`mouseEffect` "erase"); sem ondas de clique.
- **Onde entra:** login (tela inteira), entrada (atrás do "Growth Cycle" gigante) e uma faixa fraca no topo da
  home e do admin, que some antes dos cards (força ~45%). **Não entra na tela de trabalho.**
- Pausa fora da tela e com a aba escondida; parado para quem pede menos movimento; sem WebGL2, fica o brilho
  quente simples. Os valores do protótipo são de um shader feito à mão que imita o componente: calibrar as
  props do `Dither` até chegar no mesmo visual.

### Entrada ("Bem-vindo ao Growth Cycle")

- Opção B: "Bem-vindo ao" em serifada itálica apagada em cima; "Growth" (sem serifa, 600) e "*Cycle*"
  (serifada itálica, laranja) gigantes, de borda a borda. Logo no canto superior esquerdo, relógio
  "HH:MM em São Paulo" no direito. Rodapé: "Diagnóstico · Metas · Mídia · Plano de ação" à esquerda e
  "N projetos em andamento" à direita (N real).
- Uma faixa de cor varre o texto (Dia Text Reveal, cores laranja/âmbar/azul) e ele assenta na cor final.
  Tempos: varredura de 1,07 s, atrasos de 0,17 s e 0,33 s nas palavras, cerca de 2,4 s até começar a sair,
  saída de 0,6 s (desfoque + leve zoom) revelando a home, cujos blocos entram escalonados.
- Toca **só logo depois de um login de verdade** (decisão do usuário, ponto importante para ele): o retorno
  do Google em `/auth/callback` marca a chegada (cookie de vida curta ou parâmetro equivalente) e a home
  consome essa marca uma vez. **Refresh, abrir o app já logado, voltar de outra aba ou navegar entre telas
  nunca mostram a entrada.** No modo sem login (`PLANEJAMENTO_AUTH=off`) ela não toca. Clique ou Esc pula.
  Com movimento reduzido, não toca.

### Login (opção B)

- Centrado: selo em pílula "Growth Cycle · acesso da equipe" com ponto verde; frase grande "Do diagnóstico
  ao *contrato fechado.*" (serifada laranja na segunda parte), em duas linhas; texto "Entre com a sua conta
  Google da Boomer para continuar os planejamentos."; botão em pílula "Entrar com Google" com o G colorido
  e um brilho que passa de tempos em tempos.
- Logo e relógio nos cantos de cima; as fases do ciclo no rodapé, lidas do catálogo (Contexto · Diagnóstico ·
  Soluções e metas · Mídia e ação · Apresentação · Pós-apresentação), sem números.
- Fundo: o dithered B sutil em tela inteira, com o centro limpo atrás da frase (o pontilhado de
  `5-login.html` era só um lugar reservado; vale o `7-fundo-dithered.html`).
- Os alertas de erro atuais continuam ("Use a conta Google da Boomer (@boomer.com.br ou
  @gestaoboomer.com)." e "Não foi possível entrar agora. Tente de novo."), no estilo novo, logo abaixo do
  botão.

### Barra do topo (todas as telas internas)

- Logo à esquerda; menu em pílula no centro **só para admin** (Prospects · Administração). A "Biblioteca" que
  aparece nos protótipos não existe como página e sai: ela continua no painel da tela de trabalho;
  à direita: Reportar (onde existe hoje), relógio em mono, botão de tema (Animated Theme Toggler, troca em
  círculo a partir do botão; sem View Transitions, troca direta) e avatar/menu da conta.
- Na tela de trabalho, à esquerda vira "Growth Cycles / Nome do prospect" e entra o selo de custo da etapa.
- O que a barra mostra por papel e por ambiente (nuvem ou local) continua como hoje.

### Home

Arranjo B com os filtros do A, em quatro faixas:

1. **Cabeçalho:** selo "N em andamento · N aprovação(ões) pendente(s)", título "Seus Growth *Cycles*",
   botões "Cliente de teste" (contorno) e "+ Novo prospect" (laranja).
2. **Bento:** à esquerda (7/12), o card **"Continue de onde parou"** com o prospect de atividade mais
   recente (`atualizadoEm`) entre os que a pessoa vê e que não estão concluídos: nome, "Etapa NN" e o nome
   da etapa grande em serifada laranja, botão "Abrir etapa →" e o **anel do ciclo** (um segmento por etapa de `totalEtapas`: verde
   concluída, laranja atual com brilho, apagado o resto; no centro "3/9 etapas concluídas"). À direita
   (5/12), três números: "em andamento", "concluídos" (total; não há data de conclusão para "no mês", ver
   chamadas abaixo) e o **card laranja sólido** "N aprovação(ões) esperando você · nome do prospect",
   com seta. Clicar nele abre o prospect se for um só, ou aplica o filtro "Com aprovação pendente" se forem
   vários. Com zero pendências, o card fica neutro ("Nenhuma aprovação esperando").
3. **Filtros (do arranjo A):** busca em pílula ("Buscar prospect, etapa ou analista", atalho ⌘K/Ctrl+K
   foca a busca), etapa e ordenação à direita, para todos. Segmentado por papel: **admin** vê "Todos · Meus ·
   Com aprovação pendente" e mantém o seletor por analista de hoje; **quem não é admin** vê "Todos · Com
   aprovação pendente" (a lista dele já vem filtrada pelo servidor, então "Meus" seria igual a "Todos").
   O filtro de pendência passa a existir para todos, porque o card laranja depende dele. Os filtros valem
   só para a grade; o bento mostra sempre o panorama.
4. **Grade de projetos:** cards compactos em 4 colunas: nome e menu "···", "Etapa NN" + nome da etapa em
   serifada, as 8 barrinhas de progresso (atual em laranja com pulso leve), selo "N aprovação(ões)
   pendente(s)" ou "Teste", rodapé "N de M etapas · quando". Avatar do analista para admin, como hoje.
   Luz que segue o mouse (Magic Card) e borda sutil só nos que têm pendência. Seção "Concluídos"
   recolhida, como hoje. As barrinhas são uma por etapa contada em `totalEtapas`.

### Tela de trabalho

Três painéis, como hoje (incluindo recolher o painel do centro/direita).

- **Esquerda (Branched Menu):** "Prospect" + nome; linha com mini-anel e "N de M etapas · em <fase>"; a
  árvore: as **fases do catálogo** (`fase` em `etapas.json`: Contexto, Diagnóstico, Soluções e metas,
  Mídia e ação, Apresentação, Pós-apresentação) são os ramos, com ponto de status (verde feita, laranja atual) e contagem
  "1/2"; as etapas saem delas com uma curva fina e ícone de status (check verde, anel laranja pulsando,
  cadeado apagado), número em mono e título. A curva da etapa aberta fica laranja, e um **marcador laranja
  desliza no tronco** até ela. Fases abrem e fecham; abertas por padrão as que têm etapa feita ou atual.
  Abaixo: "Arquivos" com Biblioteca e contagem; no pé, a barra de uso da assinatura.
- **Centro:**
  - Cabeçalho: "Etapa 04 · Diagnóstico" pequeno e o nome da etapa grande em serifada; selo "Agente
    trabalhando" (ponto laranja pulsando) enquanto houver turno ativo; botão do painel.
  - Mensagem da pessoa: bolha discreta à direita, com anexos em pílula.
  - **Thought Line** no lugar da lista "Processo": ✦ que respira, rótulo com brilho mostrando o passo atual,
    cronômetro em mono; os passos (os mesmos eventos de hoje) entram um a um numa linha vertical, com
    check verde nos feitos e ponto pulsando no atual. Ao terminar, recolhe sozinho em "Pensou por 4,4 s ▸";
    clicar reabre. Para conversas antigas (sem tempo medido), "Processo · N passos".
  - Resposta do agente: texto direto, sem bolha, com as ações de copiar e citar como hoje.
  - **Card de entregável:** tipo e "proposta N" pequenos, título em serifada, selo "● Aguardando
    aprovação" (âmbar) / "✓ Aprovado" (verde), prévia, ações "Aprovar" (laranja, com brilho que passa) e
    "Pedir ajuste". Enquanto aguarda, uma luz **sutil** corre na borda: faixa curta e transparente
    (âmbar ~28%, laranja ~38% sobre linha de 7%), uma volta a cada 9 s. Aprovado: contorno verde fino
    (~28%), parado. **Aprovar não solta confete.**
  - Desfoque progressivo nas bordas de cima e de baixo do chat; compositor flutuante em pílula grande, com
    brilho laranja no foco.
- **Direita:** "Entregáveis da etapa" e "Insumos" com contagem em mono ("0/1"), itens em cards finos
  (insumo recebido com check verde e resumo). **"Concluir etapa" não aparece enquanto faltar algo**: nada
  de botão desabilitado nem lista do que falta. Quando todas as condições são cumpridas, o bloco entra
  devagar com "✓ Tudo aprovado nesta etapa" e o botão "Concluir etapa e ir para <próxima> →". A mesma regra
  vale para o fim de etapa dentro do chat (`fim-da-etapa`). "Reabrir etapa" segue como hoje.
  - Exceção: `condicoesConcluir` também exige que o agente tenha sinalizado a etapa (`sinalizada`), e isso não
    aparece em contador nenhum. Quando insumos e entregáveis estão completos mas falta só a sinalização, no
    lugar do botão aparece uma linha discreta: "✓ Tudo aprovado · esperando o agente fechar a etapa". Não é
    botão desabilitado nem lista de pendências.
- **Confete:** fica o atual (`src/apps/web/lib/confete.ts`), disparado só ao concluir a etapa, sem mudança.

### Administração

Layout comum: barra do topo com "Administração" ativa; cabeçalho com selo de contexto, título grande com
palavra em serifada e uma frase; abas em pílula **Pessoas · Projetos · Modelos · Skills · Reports** (Reports
com contagem de abertos). Conteúdo entra com Blur Fade ao trocar de aba.

- **Pessoas** ("Pessoas *da equipe*"): três números (pessoas com acesso, admins, ativas nos últimos 7 dias)
  e a tabela (avatar + nome + e-mail, selo de papel, primeiro e último acesso, projetos, botão
  Tornar/Retirar admin). Diálogo de confirmação e regras como hoje.
- **Projetos** ("Projetos *e custos*"): filtros em pílula (período segmentado; Analista, Projeto, Etapa,
  Modelo; "Incluir testes" como interruptor; Atualizar e Exportar CSV); quatro números em serifada com selo
  de variação (âmbar quando o custo sobe, verde quando cai); os quatro gráficos atuais com a paleta nova
  (área empilhada por modelo, rosca por fase/etapa com total no centro, barras por projeto, tempo por
  pessoa); lista com abas segmentadas e busca; "Médias por etapa" recolhida. Gráficos continuam em
  Recharts; comportamento (filtros na URL, cliques que filtram) igual.
- **Detalhe do projeto:** mesma linguagem (título grande, quatro números, tabelas finas com barras
  proporcionais). Sem protótipo próprio: seguir Projetos.
- **Modelos** ("Modelos *por etapa*"): cards por etapa em duas colunas, com título da etapa em serifada; cada
  agente numa linha com selo do modelo na cor da família e régua de esforço de 5 barrinhas; caixa de
  sugestão com "Aplicar"; rodapé com custo médio. Clicar abre o painel lateral (desliza da direita) com
  seletores em pílula, régua, frase do nível, "Alterado por…" e "Voltar ao padrão".
- **Skills** ("Skills *e fluxos*"): três colunas como hoje; a lista ganha número laranja de notas abertas; o
  centro tem o título em serifada, o fluxograma Mermaid num card e os botões "Ampliar" e "Ver texto
  completo"; notas à direita com o campo novo e "Marcar como resolvida". O tema do Mermaid acompanha a
  paleta nova nos dois temas.
- **Reports** ("Reports *da equipe*"): filtros (tipo segmentado; status em pílulas multi-seleção) e "Copiar
  para o Claude"; lista à esquerda (selo Bug vermelho / Melhoria cinza, texto, linha de meta, selo de
  status) e detalhe fixo à direita (antes era painel lateral): título "[Bug] *Report #12*", comentário,
  print com as marcações numeradas, Página/Prospect/Tela/Navegador, status em pílulas, nota interna e
  "Salvar nota".
- **Diálogo Reportar** (qualquer pessoa): título "Reportar *um bug ou ideia*", segmentado Bug/Melhoria,
  comentário com contador, print com marcações e ferramentas (retângulo, círculo, número), imagens extras,
  Cancelar/Enviar (laranja). Comportamento atual mantido.

## Ordem de entrega (um PR por linha)

1. **Fundação:** fontes, tokens dos dois temas, pílulas, cards, tabelas e selos nos componentes de base,
   brilho de fundo no lugar do ASCII, registros e `motion`, botão de tema animado. Depois deste PR o app
   inteiro já muda de cara. (A branch do roteiro já está na `main`; não há espera.)
2. **Entrada, login e fundo dithered.**
3. **Home.**
4. **Tela de trabalho.**
5. **Administração e diálogo Reportar.**

Cada PR: `npm test` nos dois pacotes, conferência nos dois temas e com movimento reduzido, deploy na VPS.

## Chamadas minhas (o usuário não decidiu; corrigir se preciso)

- "Concluídos no mês" virou "concluídos" no total: não existe data de conclusão no resumo do prospect.
- "Continue de onde parou" usa o prospect não concluído com `atualizadoEm` mais recente, entre os que a
  pessoa vê (para admin, entre todos).
- Card laranja com zero pendências fica neutro; com várias, aplica o filtro em vez de abrir um prospect.
- Entrada uma vez por sessão do navegador, pulável com clique ou Esc.
- Bolha só na mensagem da pessoa; resposta do agente sem bolha.
- Detalhe de Reports fixo ao lado da lista, em vez de painel lateral.
- Atalho ⌘K/Ctrl+K para a busca da home.
- Filtro "Com aprovação pendente" liberado para quem não é admin (hoje é só do admin).
- "Biblioteca" sai do menu do topo; o menu em pílula fica só para admin.
- Número de etapas e fases seguem o catálogo e os dados (inclui a etapa 10 e a fase Pós-apresentação).
- Linha "esperando o agente fechar a etapa" quando só falta a sinalização do agente (recomendação feita duas
  vezes ao usuário, sem resposta; ele pode trocar por "nada").
- Dithered no login, na entrada e no topo da home e do admin (os lugares mostrados no protótipo; o usuário
  escolheu o efeito e a calibragem, não os lugares).

## O que fica com quem constrói

Valores finos de tokens além dos protótipos, a estrutura interna dos componentes, se cada efeito vem da
biblioteca ou é feito à mão, os ajustes dos testes, o tema do Mermaid e do Recharts, e o comportamento em
tela estreita (não pode quebrar).
