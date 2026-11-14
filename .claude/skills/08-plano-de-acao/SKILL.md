---
name: plano-de-acao
description: Transforma tudo que foi decidido no planejamento em um plano de ação que o cliente executa só lendo, com 10 campos por ação (dono, datas, evidência, meta e gatilho) organizado em ondas, cada uma com checkpoint, e gera o documento Word (.docx) e a planilha Excel (.xlsx) do plano a partir da mesma lista. Última etapa de conteúdo antes da apresentação final. Use após midia-paga, com o planejamento completo aprovado.
---

# Skill 08 — Plano de Ação Estratégico

Skill 8 de 10 — última etapa de conteúdo. Corresponde ao Prompt 9 do processo
manual (`prompts/`). Não é etapa de análise de dados, de revisão de cenários
nem de estratégia nova: toda ação nasce do que já foi decidido. A única
exceção é a ação corretiva de um problema já diagnosticado sem solução no
planejamento, sempre marcada [VALIDAR].

O plano sai em duas versões obrigatórias, geradas do mesmo JSON pelo mesmo
comando: documento (.docx) e planilha (.xlsx).

O plano é organizado em **ondas** (modelo de referência: o plano da Happy
Duck). Cada onda é uma janela do calendário estratégico de mídia (07) com as
ações que começam nela e termina em um **checkpoint**: uma reunião com data,
pauta, o que precisa estar pronto para liberar a próxima onda e quem decide.
Os horizontes (Imediato, Curto prazo e Médio prazo) continuam em cada ação; a
onda é a segunda leitura, por tempo e por decisão.

## Antes de começar

Skills 01 a 07 concluídas e aprovadas. Leia o kickoff limpo,
`contexto/decisoes/` e `contexto/solucoes.json` do disco (na interface cada
etapa roda na própria conversa e nada disso está no contexto). Mostre ao
analista, numa mensagem, o que já sabe de cada item abaixo. Depois confirme
ou pergunte o que falta, **uma pergunta por mensagem**, com a sua sugestão
pré-preenchida quando houver, e espere a resposta antes da próxima:

1. **Data de hoje.** O plano é datado a partir dela; nenhuma ação cai em
   período que já passou. Vira `data_referencia`.
2. **Cenário de referência e números da meta**, exatamente como aprovados nas
   etapas 06 e 07 (Realista, salvo decisão contrária). O plano não pode ter
   nenhum número diferente do deck.
3. **Frentes prioritárias**: os 2 ou 3 maiores problemas do diagnóstico. Elas
   definem o que entra no Imediato.
4. **Quem executa do lado do cliente** (time de e-commerce, designer,
   atendimento, TI, terceiros).
5. **Quem opera a mídia**: Boomer, agência parceira ou o próprio cliente. Se
   for agência parceira, pergunte o nome dela; ele vai em `agencia_parceira`
   e pode aparecer como empresa no campo Dono.
6. **Ferramentas do cliente**: plataforma, CRM, gateway, ferramenta de
   WhatsApp.
7. **Restrições de calendário**: lançamentos, férias da equipe, troca de
   plataforma prevista.
8. **Margem de contribuição antes da mídia**, em %. Pergunte com estas
   palavras: é a receita menos custo do produto, impostos, frete, taxa de
   gateway e comissões, **antes** de descontar a mídia; não é margem bruta
   nem margem líquida. Ela calcula o piso de ROAS. Sem margem, o piso fica
   [PREENCHER] e a etapa não fecha.
9. **Como a empresa aparece no campo Dono**: "Agência" ou "Boomer". A
   resposta vai em `empresa_agencia` e é a única forma aceita para a empresa
   nos donos do lado da agência.

## Objetivo e pergunta-guia

Transformar o que foi decidido em um plano que o cliente execute sem ninguém
ao lado explicando, e que permita provar, ação por ação, se foi executado.

Pergunta-guia: **"Se o cliente fizer exatamente isto, e só isto, por 3 meses,
eu apostaria o dinheiro do projeto que o resultado vem?"** Se a resposta não
for um "sim" tranquilo, o plano ainda não está pronto.

## Base de dados

Use exclusivamente o que já foi decidido (`contexto/decisoes/` e o registro
de soluções):

- Diagnóstico: problemas, causas prováveis e números de cada achado (03 e 04).
- Registro `contexto/solucoes.json` (05): toda solução precisa virar ação.
- Cenários projetados, meta e KPIs influenciadores (06).
- Estratégia por Curva ABC, calendário estratégico, planejamento financeiro
  de mídia (canais, campanhas, verba) e redução de dependências (07).
- Benchmarking aplicado ao projeto.

Não busque dado novo.

## Horizontes

Exatamente três, nesta ordem, sempre com data real em cada ação:

- **Imediato:** primeira semana após a apresentação. Ações que desbloqueiam
  as outras (rastreamento, acessos, reestruturação). Cada uma cabe em até 7
  dias entre início e entrega (o validador avisa quando passa). É também a
  onda 1.
- **Curto prazo:** até o primeiro grande marco do calendário (primeiro mês
  de Pico ou Escala).
- **Médio prazo:** até o fim do ciclo de 12 meses do cenário (`fim_ciclo`).

## Janela de prova

A janela de prova (`janela_prova`, início e fim) começa na data de início do
plano, o primeiro dia do Imediato (logo após a apresentação e a aprovação),
e dura 3 meses (ex.: 26/10/2026 a 25/01/2027). Não confunda com o início do
ciclo do cenário: `fim_ciclo` continua sendo o fim dos 12 meses do cenário.
Toda ação cuja alavanca é um KPI da meta (`alavanca_da_meta: true`) começa e
entrega dentro dela, mesmo estando no Médio prazo. Preparação de pico
posterior fica com `alavanca_da_meta: false`. O campo é obrigatório em toda
ação (true ou false, nunca omitido). A janela tem de 85 a 95 dias, começa na
data de referência ou depois e termina antes do fim do ciclo.

## Frentes

Nomes exatos, para bater com o registro de soluções:

1. `Mídia Paga / Canal Principal`: reestruturação, ativação e otimização das
   campanhas conforme o planejamento financeiro.
2. `Eficiência Operacional`: gargalos que impedem o investimento de virar
   receita (quebra, conversão, CRO, checkout).
3. `Produto / Mix / Portfólio`: priorização, lançamento, kits, preço e
   ruptura.
4. `Redução de Dependências`: canal, plataforma, sazonalidade, público, base
   própria e CRM.
5. `Monitoramento e Governança`: rastreamento, painel de KPIs, revisões e
   critérios de validação.

## Regras de ouro

1. **O que não está escrito no plano não existe.** Tudo que o cliente precisa
   fazer para o resultado vir entra como ação, mesmo que já apareça em outro
   capítulo do deck: expectativa sobre metas fora de alcance, critérios de
   validação e planos B. Ex.: se o deck diz "se o lote não ficar pronto até
   31/10, o produto entra na Black Friday e a verba volta para os campeões",
   isso vira uma linha do plano, com dono, data e gatilho.
2. **Plano raso vira problema.** Cada desafio do diagnóstico vira um bloco de
   ações suficiente para resolvê-lo. Projeto grande (ex.: troca de
   plataforma) entra quebrado em etapas, com marcos.
3. **Quando a meta é desafiadora, peque pelo excesso.** Não há limite de
   ações, desde que cada uma tenha os 10 campos e nenhuma se repita.
4. **Plano vago vira disputa.** Toda ação tem uma evidência que prova que foi
   feita.

## Os 6 critérios que toda ação passa

1. **Rastreável:** nasce de um achado do diagnóstico, com o número. Todo
   achado crítico tem pelo menos uma ação.
2. **Cobre a meta:** se o cenário assume que um KPI melhora (ex.: conversão
   +X%), existe ação que entrega essa melhora.
3. **Executável:** clara o suficiente para o executor entender sem
   explicação adicional.
4. **Verificável:** daqui a 3 meses dá para provar se foi feita ou não.
5. **Dono definido:** disciplina do profissional responsável e empresa, sem
   nomear a pessoa.
6. **Datado e sequenciado:** início e entrega, e o que depende do quê.

## Os 7 erros que o plano não pode ter

- **Erro 1 · Plano raso para diagnóstico complexo.** Cada desafio do deck
  vira um bloco de ações com Como, meta e data. Nada de 10 linhas genéricas
  para 5 problemas pesados.
- **Erro 2 · Investigar sem dizer o que fazer depois.** Proibido terminar em
  "auditar", "mapear" ou "investigar" sem a ação corretiva. Use causa → ação
  → prazo para cada causa provável. Ex. para taxa de quebra: antifraude →
  revisar regras com o gateway até dd/mm; Pix ou boleto expirado → régua de
  recuperação 1h e 24h no CRM; ruptura de estoque → bloquear anúncio de SKU
  sem estoque. E a meta: quebra de X% para Y% até o fim da janela de prova.
- **Erro 3 · Meta que o histórico não sustenta.** A meta de 3 meses é
  ancorada no melhor mês do próprio cliente, não no benchmark. Benchmark é
  horizonte, não compromisso. Nunca use meta sem número ("redução gradual",
  "melhorar"). Se o cliente pediu uma meta fora do alcance, o plano diz por
  escrito o que cabe nos 3 meses e quanto custaria ir além.
- **Erro 4 · Plano que contradiz o deck.** Um número por KPI, igual ao deck.
  A lógica de mídia segue o diagnóstico (canal de maior ROAS, papel de cada
  plataforma). Documento e planilha têm as mesmas ações, datas e números (o
  gerador garante, porque os dois saem do mesmo JSON).
- **Erro 5 · Sem prazo.** Nenhuma ação com "A definir" ou "Imediato" no lugar
  da data. Todas têm início e entrega, e cada onda tem janela e checkpoint com
  data.
- **Erro 6 · Copiar o julgamento de outro cliente.** Piso de ROAS sai da
  margem deste cliente, nunca de um padrão. Você não calcula nem digita o
  piso: informe `margem_contribuicao` (e `taxa_quebra`, se as decisões a
  trouxerem) e o `gerar_plano_acao.py` calcula piso sobre a receita aprovada
  = 1 ÷ margem (20% → 5) e piso sobre a captada = piso aprovada ÷ (1 −
  quebra) (quebra 20% → 6,25). O piso é o empate da primeira compra: entra
  como referência de gatilho, não como meta de ROAS (a meta é a do cenário,
  e o LTV da 04 pode justificar aquisição abaixo do piso). Sem margem, o
  piso sai [PREENCHER: margem de contribuição].
- **Erro 7 · Ação que não dá para verificar.** Toda ação tem uma entrega
  visível. "Direcionar esforço", "priorizar" e "acompanhar" sozinhos não são
  ações. Toda decisão que fica com o cliente vem com a recomendação da
  Boomer e o critério de escolha, no campo `decisao_cliente` da ação.

## Os 10 campos de cada ação

Campo vazio significa ação que não está pronta.

1. **Ação:** verbo de execução + objeto. Certo: "Ativar régua de recuperação
   de Pix expirado". Errado: "Otimizar checkout".
2. **Achado de origem:** seção do diagnóstico e o número que justificam a
   ação. Ex.: "Receita total × aprovada: quebra de 37%". Cite a seção e o
   número, **nunca "slide N"**: o plano é feito antes da apresentação, e o
   número do slide ainda não existe.
3. **Alavanca da meta:** o KPI que a ação move (conversão, quebra, ticket
   médio, CPS, % de dependência de mídia paga, ROAS, CAC).
4. **Como:** passos objetivos, com valores (verba, público, ferramenta,
   regra). Ex.: "Google com R$ 616 em outubro, cerca de R$ 20 por dia. Não
   escalar antes das primeiras vendas atribuídas". Desça até o nível que o
   executor precisa, sem escrever copies, roteiros de criativo nem passo a
   passo de configuração de plataforma.
5. **Dono:** disciplina · empresa. Ex.: "Gestor de tráfego · Boomer", "Time
   de e-commerce · Cliente", "Designer · Cliente". Um dono principal por
   ação. A empresa é `empresa_agencia`, "Cliente" (ou o nome do prospect) ou
   `agencia_parceira`.
6. **Início e entrega:** datas dd/mm/aaaa, nunca "Imediato" ou "A definir".
7. **Depende de:** números das ações que precisam estar prontas antes. Ex.:
   "Depende da Ação 2 (GA4 corrigido)". Sem dependência: "Nenhuma" (lista
   vazia no JSON).
8. **Evidência:** o que prova que foi feito: print, link, relatório, fluxo
   ativo, campanha no ar.
9. **KPI e meta:** de quanto para quanto, até quando, ancorado no histórico
   do cliente. Ex.: "Conversão de 1,4% para 1,5% até 31/12". Ação de
   estrutura sem KPI próprio usa a entrega como meta (ex.: "Evento de compra
   registrando 100% dos pedidos da Shopify até 20/10").
10. **Gatilho:** o que acontece se a meta não vier, no formato "Se [KPI]
    passar de [limite] por [tempo], então [decisão]". Ex.: "Se o CPS do Meta
    passar de R$ 3,80 por 2 semanas, então concentrar a verba nos 2 melhores
    conjuntos". Ação de estrutura tem gatilho de prazo: "Se não estiver
    concluída até dd/mm, então a Ação X é adiada". "Se a performance cair,
    revisamos" não é gatilho.

Cada ação também leva `solucoes`: os ids do registro que ela executa (ex.:
`["P1.S1"]`; lista vazia para governança).

**Decisão do cliente.** A ação que só anda depois de uma escolha do cliente
(verba, desconto máximo, canal, fornecedor) leva `decisao_cliente`:
`{"ate": "dd/mm/aaaa", "recomendacao": "..."}`. `ate` é o prazo da decisão
(entre `data_referencia` e `fim_ciclo`) e `recomendacao` é o que a Boomer
recomenda, com o critério da escolha. Ação sem decisão do cliente não leva o
campo (ou leva `null`).

Mostre cada ação ao analista neste formato:

```
AÇÃO [nº]: [verbo + objeto]
FRENTE: [frente] · HORIZONTE: [Imediato / Curto prazo / Médio prazo]
ACHADO DE ORIGEM: [seção do diagnóstico + número]
ALAVANCA DA META: [KPI]
COMO: [passos com valores]
DONO: [disciplina · empresa]
INÍCIO E ENTREGA: [dd/mm/aaaa a dd/mm/aaaa]
DEPENDE DE: [nº das ações ou "Nenhuma"]
EVIDÊNCIA: [o que prova que foi feito]
KPI E META: [de quanto para quanto, até quando]
GATILHO: [Se ... então ...]
SOLUÇÕES: [ids do registro, ex.: P1.S1]
```

## Formato do plano (JSON v2)

O plano é um único JSON, versão 2. O esquema completo está em
`docs/superpowers/specs/2026-11-10-plano-de-acao-prompt-9-design.md`
(Parte 2). Chaves de topo: `versao` (2), `prospect`, `data_referencia`,
`janela_prova` (`inicio`, `fim`), `fim_ciclo`, `empresa_agencia`,
`agencia_parceira` (ou `null`), `abertura` (`cenario`, `metas`,
`cabe_nos_3_meses`, `nao_cabe`, `premissas`, `margem_contribuicao`,
`taxa_quebra`, fração entre 0 e 1, ex.: 0.055) e `horizontes` (3, com `nome`, `titulo`, `intro`, `acoes`).
Cada ação tem `numero`, `frente`, os 10 campos (`acao`, `achado_origem`,
`alavanca`, `como`, `dono`, `inicio`, `entrega`, `depende_de`, `evidencia`,
`kpi_meta`, `gatilho`), `alavanca_da_meta` e `solucoes`, e, quando depende de
escolha do cliente, `decisao_cliente`. Pisos de ROAS e tabela-resumo são
derivados pelo gerador e não entram no JSON.

**Chaves do plano em ondas.** Para o gerador e o validador elas são opcionais
(um plano antigo, só com horizontes, continua válido, com aviso). **Para esta
skill são obrigatórias**: o plano que ela entrega é sempre em ondas.

- `ondas`: lista numerada de 1 a N, na ordem. Cada onda tem `numero`, `nome`,
  `inicio` e `fim` (dd/mm/aaaa), `calendario_midia`, `objetivo`, `acoes` (os
  números das ações) e `checkpoint` (ver a Fase 1).
- `como_funciona`: lista de `{titulo, texto}`, o texto "Como este plano
  funciona" (ver a Fase 1).
- `metas_mensais`: `{cenario, colunas, linhas, observacao}`, **gerada pelo
  `scripts/metas_mensais.py`** a partir da projeção aprovada (Fase 3). Nunca
  digite as linhas.
- `sessoes_nao_pagas`: `{colunas, linhas, premissas, risco}`, o volume de
  sessões não pagas que cada ação entrega e o risco de a meta depender só da
  mídia. É livre e específica de cada prospect: monte a tabela com a lógica da
  projeção aprovada (06), sem número novo. `premissas` e `risco` são texto
  (ou lista de textos).
- `protocolo_mudanca`: `{intro, regras}` (lista de textos), o protocolo de
  mudanças (ver a Fase 1).
- `kpis_acompanhamento`: lista de `{kpi, meta_limite}`, os KPIs vigiados entre
  os checkpoints (ver a Fase 1).

Os blocos de texto não levam `[VALIDAR]`, `[PREENCHER]` nem as variantes
"(a confirmar ...)" e "(a preencher ...)" nos arquivos finais. No rascunho,
`[VALIDAR]` e `[PREENCHER]` são aceitos (Fase 2); as variantes entre parênteses
nunca entram: dado que falta vira pergunta ao analista, não marca no texto.

Onde fica o JSON:
- **Em edição** (Fases 1 e 2), `plano-de-acao.json`:
  - Interface: `clientes/<slug>/.app/rascunhos/plano-de-acao.json`.
  - Terminal: `clientes/<slug>/entrega/plano-de-acao.json`.
- **Validado**, `plano-de-acao-estrategico.json`: gravado pelo
  `gerar_plano_acao.py` com `--saida-json` na Fase 3, junto com o documento e
  a planilha, a partir do JSON em edição (o gerador não grava por cima do
  arquivo que está lendo). É ele que a etapa 10 (revisão pós-apresentação)
  lê como registro do plano apresentado.
  - Interface: `clientes/<slug>/.app/rascunhos/plano-de-acao-estrategico.json`
    (nome exato: o app o copia junto quando o analista aprova o documento).
  - Terminal: `clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json`.

## Fase 1 · Abertura do plano

Monte a abertura: cenário de referência; metas do plano, um número por KPI,
cada uma com o mês e o valor de origem no cenário (`fonte`, ex.: "06 ·
Realista, JAN/27"; o mês da meta é o último mês da janela de prova); o que
cabe e o que não cabe nos 3 meses (quando a meta pedida for maior
que o cenário); premissas (o que precisa ser verdade: verba aprovada,
estoque, acessos, prazos de terceiros); margem, quebra e os pisos de ROAS
resultantes, com uma frase dizendo com qual ROAS cada piso se compara
(aprovada ou captada). Defina também `janela_prova` e `fim_ciclo`.

Monte também a **estrutura em ondas**, a partir do calendário estratégico de
mídia (07) e dos horizontes:

1. **Ondas.** O Imediato é a onda 1. As demais seguem os meses do calendário
   (cada mês é Contenção, Escala, Pico ou Manutenção). Uma onda pode juntar
   meses seguidos da mesma fase. Cada uma tem:
   - `nome`: título curto do que a onda faz (ex.: "Destravar medição, estoque
     e margem");
   - `calendario_midia`: a fase do calendário e o mês (ex.: "Contenção
     (nov/26)", "Pico e Manutenção");
   - `objetivo`: uma frase com o que a onda entrega;
   - `inicio` e `fim`: a janela, dd/mm/aaaa.
2. **Regras da janela.** As ondas ficam em ordem, e o `fim` de uma é
   **estritamente anterior** ao `inicio` da seguinte (se terminam e começam no
   mesmo dia, é sobreposição e dá ERRO; use dias consecutivos). A onda 1 não
   começa antes da `data_referencia` e a última não termina depois do
   `fim_ciclo`.
3. **Ações por onda.** Uma onda agrupa as ações pela **data de início**: cada
   ação está em exatamente uma onda e o `inicio` dela cai dentro da janela
   dessa onda. A `entrega` pode passar do `fim` da onda (ex.: a rotina semanal
   que começa na onda 2 e entrega só no fim da janela de prova). Liste os
   números em `acoes` na Fase 2, quando as ações existirem.
4. **Checkpoint.** Toda onda, menos a última, termina em um `checkpoint`; a
   última pode ter `null`. Ele tem `data`, `duracao` (ex.: "30 minutos"),
   `pauta` (o que se confere, com os números das ações), `para_liberar` (o que
   precisa estar pronto para a próxima onda começar) e `quem_decide`. A `data`
   cai entre o início da onda e o início da seguinte (na última, até o
   `fim_ciclo`), de preferência nos últimos dias úteis da onda.
5. **Como este plano funciona** (`como_funciona`, lista de `{titulo, texto}`),
   no tom do plano de referência: a lógica do plano (primeiro destravar a
   medição e o estoque, medir, depois escalar a mídia); a data-base e a
   primeira ação; as datas-âncora do calendário (ex.: Black Friday e o que
   congela em volta dela); o **plano mínimo** se o rastreamento ou os
   responsáveis não ficarem prontos na onda 1; os horizontes e as datas deles;
   o dono (disciplina e empresa); as frentes; e como ler cada ação (achado,
   como, evidência, KPI e meta, gatilho). Datas e números saem do plano
   aprovado, não do texto de outro prospect.
6. **Protocolo de mudança** (`protocolo_mudanca`, `{intro, regras}`): uma
   mudança por vez, anotada no registro (data, quem, o quê, por quê, como
   desfazer, resultado); backup antes (exportar o contêiner do GTM, registrar
   as campanhas, backup do tema); testar antes de publicar; 48 a 72 horas
   entre mudanças no mesmo sistema; nada na sexta à tarde nem no fim de
   semana; e o congelamento das datas-âncora do calendário, com as datas.
7. **KPIs de acompanhamento** (`kpis_acompanhamento`, lista de `{kpi,
   meta_limite}`): os KPIs vigiados em cada checkpoint, cada um com a meta ou
   o limite que dispara a decisão, **com o número do cenário aprovado** (06),
   nunca um número novo.
8. **Sessões não pagas** (`sessoes_nao_pagas`): a tabela de quanto tráfego não
   pago cada ação entrega, com as premissas de volume e o risco quando o
   cenário aprovado depende quase só da mídia. Parta da projeção (06) e do que
   foi decidido; ação sem volume definido não entra na conta.

Checkpoint: o analista aprova a abertura e a estrutura em ondas, ou seja, as
janelas, os checkpoints, o texto "Como este plano funciona" e a tabela de
sessões não pagas (Regra 1; na interface, pergunte no chat).

## Fase 2 · Ações

Monte a lista completa, por horizonte e, dentro dele, por frente, com os 10
campos. Distribua as ações pelas ondas (preencha `acoes` de cada onda pela
data de início de cada ação) e coloque `decisao_cliente`, com a recomendação
da Boomer, em toda ação que depende de escolha do cliente. O achado de origem
cita a seção do diagnóstico e o número, nunca "slide N". O que exige
julgamento do analista sai marcado [VALIDAR]; dado ausente, [PREENCHER]. Antes
de mostrar, grave o JSON e rode:

```
python3 scripts/validar_plano_acao.py \
  --plano <plano-de-acao.json> \
  --registro clientes/<slug>/contexto/solucoes.json \
  --rascunho
```

`--rascunho` aceita as marcações e a margem ausente (`null` ou [PREENCHER] no
rascunho; na versão final, margem ausente é erro). `ERRO:` → corrija o
plano e rode de novo antes de mostrar; nunca apague solução do registro para
passar. `AVISO:` → corrija ou mostre ao analista com a sua leitura. O
validador dá ERRO para onda fora de ordem ou sobreposta, ação fora de onda ou
em mais de uma, ação cujo início cai fora da janela da onda, checkpoint fora
do intervalo permitido e `decisao_cliente.ate` fora do ciclo; dá AVISO para
plano sem ondas, onda sem ação, onda sem checkpoint (exceto a última) e plano
sem `kpis_acompanhamento`. Aviso de ondas ou de KPIs não se deixa passar: esta
skill sempre os resolve.

Checkpoint: o analista resolve cada [VALIDAR] e [PREENCHER] e aprova a lista.

## Fase 3 · Arquivos

Com o plano aprovado e sem marcações, primeiro gere as **metas mensais** a
partir da projeção aprovada (06), no JSON em edição:

```
python3 scripts/metas_mensais.py \
  --plano <plano-de-acao.json> \
  --projecao clientes/<slug>/entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx \
  --cenario Realista --meses 3 \
  --rotulos "Nov/26,Dez/26,Jan/27" \
  --checks "dd/mm/aaaa,dd/mm/aaaa,dd/mm/aaaa"
```

`--cenario` é o da `abertura` (Realista, Pessimista ou Otimista). `--meses` é
3, os meses da janela de prova; `--rotulos` (um por mês, no formato `Nov/26`)
e `--checks` (a data do check de cada mês, dd/mm/aaaa, coerente com os
checkpoints das ondas) têm de ter a mesma quantidade que `--meses`. O script
recalcula a cadeia de KPIs da projeção e grava o bloco `metas_mensais` no
JSON; diz `OK` ou `ERRO:`. Nunca digite essas linhas na mão, e rode de novo se
o cenário ou as datas mudarem. Onde os mesmos KPIs aparecem, os números
dos meses têm de bater com as metas da abertura (mesmo cenário, mesma fonte).

Depois, gere os dois arquivos e o JSON validado de uma vez:

```
python3 scripts/gerar_plano_acao.py \
  --plano <plano-de-acao.json> \
  --registro clientes/<slug>/contexto/solucoes.json \
  --saida-docx <pasta>/plano-de-acao-estrategico.docx \
  --saida-xlsx <pasta>/plano-de-acao-estrategico.xlsx \
  --saida-json <pasta>/plano-de-acao-estrategico.json
```

O script valida em modo final (sem `--rascunho`): com `ERRO:`, não gera nada
e sai com código diferente de zero; volte à Fase 2. Nunca escreva o `.docx`,
o `.xlsx` ou o `plano-de-acao-estrategico.json` na mão. O `.docx` usa o modelo
`.claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx` (padrão;
`--modelo-docx` troca); `--modelo-xlsx` preenche um modelo de planilha quando
existir. Com `--modelo-xlsx` e um plano em ondas, o novo layout é escrito a
partir da linha 1 das abas "Plano de Ação Estratégico" e "Resumo por frente" do
modelo, e o modelo precisa ter também a aba "Metas do plano".

- **Interface:** `<pasta>` = `clientes/<slug>/.app/rascunhos/`. Proponha os
  dois com `propor_entregavel`: o `.docx` com tipo `documento` e o `.xlsx`
  com tipo `planilha`, ambos com `nome_final` `plano-de-acao-estrategico`.
  O `plano-de-acao-estrategico.json` não é proposto: o app o leva junto com
  o documento aprovado.
- **Terminal:** `<pasta>` = `clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/`
  (nome estável, sobrescreve).

Checkpoint: o analista confere e aprova os dois arquivos.

## Fase 4 · Relatório de verificação

No chat, curto e **sem tabelas**:

1. **Mapa de cobertura:** cada achado crítico do diagnóstico e os números das
   ações que o atacam. Aponte achado sem ação.
2. **Cobertura da meta:** cada KPI influenciador do cenário e as ações que o
   movem.
3. **Cobertura por onda:** toda ação está em exatamente uma onda e começa
   dentro da janela dela; toda onda tem ação e, menos a última, checkpoint com
   data, pauta, o que libera a próxima onda e quem decide; as ondas não se
   sobrepõem e ficam dentro do ciclo (da `data_referencia` ao `fim_ciclo`). Diga quantas ações
   há em cada onda e aponte qualquer onda vazia ou sem checkpoint.
4. **Coerência:** confirme que todo número do plano é igual ao do cenário
   aprovado (06) e ao do plano de mídia (07), incluindo as metas mensais e os
   KPIs de acompanhamento, e que documento e planilha são iguais (garantido
   pelo `gerar_plano_acao.py`, que gera os dois do mesmo JSON). Aponte
   qualquer divergência.
5. **Pendências:** o que ficou marcado [VALIDAR] ou [PREENCHER] em algum
   momento e como foi resolvido, ou o que falta. Nada disso, nem "(a
   confirmar ...)" ou "(a preencher ...)", pode estar nos arquivos finais.
6. **Riscos:** dono que talvez não tenha capacidade, meta acima do melhor mês
   do histórico, premissa frágil.
7. **Pergunta-guia:** a sua resposta sincera. Se não, diga o que falta.

Pergunte ao analista a resposta dele à pergunta-guia. A etapa só fecha com
"sim". "Não" volta à Fase 2 com o que falta, e as Fases 3 e 4 rodam de novo.

## Restrições

- Não propor ação sem base no diagnóstico e no planejamento. A exceção é a
  ação corretiva de problema já diagnosticado, sempre [VALIDAR].
- Não alterar cenários nem KPIs já validados.
- Não propor ação em período que já passou.
- Não usar "Imediato", "A definir" ou "Agência" genérico no lugar de data ou
  dono (o dono é sempre disciplina · empresa).
- Não deixar decisão com o cliente sem a recomendação da Boomer
  (`decisao_cliente`).
- Não citar "slide N" no achado de origem nem em nenhum texto do plano.
- Não deixar `[VALIDAR]`, `[PREENCHER]`, "(a confirmar ...)" ou "(a preencher
  ...)" nos arquivos finais, e não criar legenda nem permissão para elas.
- Não digitar `metas_mensais` na mão: é do `scripts/metas_mensais.py`.
- Não descer a nível operacional (copies, roteiros de criativo,
  configuração de plataforma).
- Não mencionar a garantia nos arquivos.

## Critério de conclusão

- Toda ação com os 10 campos preenchidos e nenhum [VALIDAR], [PREENCHER],
  "(a confirmar ...)" ou "(a preencher ...)" nos arquivos.
- Plano em ondas: toda ação em exatamente uma onda, começando dentro dela;
  toda onda, menos a última, com checkpoint; `como_funciona`,
  `protocolo_mudanca`, `kpis_acompanhamento` e `metas_mensais` preenchidos, com
  as metas mensais geradas pelo `scripts/metas_mensais.py`.
- Todo achado crítico do diagnóstico e toda solução do registro com pelo
  menos uma ação.
- Ações que são alavanca da meta dentro da janela de prova.
- `gerar_plano_acao.py` sem `ERRO:`, e os dois arquivos (documento e
  planilha) gerados e aprovados pelo analista.
- Relatório de verificação entregue e "sim" do analista à pergunta-guia.

## Encerramento e handoff

Ao concluir, converse com o analista em linguagem natural, sem citar caminho
de arquivo:

"Nesta sessão, o plano de ação ficou fechado, em documento e planilha — esta
era a última etapa de conteúdo! Não preciso de nada novo. O próximo passo é
montar a apresentação final, um arquivo .pptx editável no molde da agência,
com o roteiro slide a slide para você aprovar antes.

Quando estiver pronto, rode `/apresentacao-final`."

Depois, conforme o modo (Regras 6 e 7):

- **Terminal:** marque "08 · Plano de ação" como ✅ em
  `contexto/status-planejamento.md`, reescreva o bloco "Próximo passo" desse
  arquivo com o mesmo pedido e grave `contexto/decisoes/08-plano-de-acao.md`.
- **Interface:** não edite `contexto/status-planejamento.md` nem
  `contexto/decisoes/`. Chame `sinalizar_etapa_pronta` com o
  `resumo_decisoes` e o mesmo texto de handoff; o app grava os dois.
