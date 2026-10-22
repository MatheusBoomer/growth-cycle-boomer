# Cliente de teste (Verdeluz) — Design

**Data:** 2026-10-22
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** um cliente fictício de e-commerce com o planejamento inteiro pronto e um seletor no app que reposiciona o cliente no início de qualquer etapa.

## 1. Objetivo

Hoje, para testar a etapa 5, o analista precisa passar pelas etapas 1 a 4 com um prospect de verdade. O objetivo é um cliente de teste em que ele:

1. abre o cliente na lista de prospects e escolhe a etapa que quer testar (por exemplo, a 3);
2. recebe o cliente como se o planejamento tivesse ido até o fim da etapa 2 e a 3 estivesse liberada, com os resumos, os arquivos e os ativos aprovados das etapas anteriores no lugar;
3. recebe, para a etapa escolhida, o **kit do analista**: os arquivos que precisa enviar e um roteiro com as respostas para o que o agente vai perguntar;
4. repete o teste quantas vezes quiser, voltando ao mesmo ponto de partida.

**Critério de sucesso:** reposicionar o cliente em qualquer das 10 etapas (01 a 09 e Apresentação final) produz um estado que o app aceita, um dossiê completo para o agente e um kit que passa pelos validadores de insumo.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Como escolher a etapa | Seletor dentro do app, com confirmação antes de apagar o trabalho feito no cliente de teste |
| 2 | Negócio fictício | Cosméticos veganos (skincare direto ao consumidor) |
| 3 | Concorrentes | Reais, para a coleta da etapa 07 poder rodar de verdade |
| 4 | Como guardar o cliente | Uma cópia completa do planejamento mais um manifesto de qual arquivo pertence a qual etapa |
| 5 | Site | Link fictício (`.example`) e um arquivo com o texto das páginas, que o agente lê no lugar da raspagem |
| 6 | Versionamento | O fixture vai para o git (`clientes/_fixtures/`); o cliente em uso (`clientes/verdeluz-teste/`) não |
| 7 | Execução | Dois subprojetos em sequência: A (mecanismo) e B (conteúdo) |

## 3. O cliente fictício

**Verdeluz Cosméticos Veganos** (nome provisório, domínio `.example`). Marca de skincare que vende direto ao consumidor, de Curitiba/PR, criada em 2021 por duas sócias. O histórico cobre 12 meses fechados, **OUT/25 a SET/26**. Usa Meta e Google (ao contrário do Sottile, em que o Google estava parado), o que exercita as duas plataformas e a quebra por meio de pagamento na etapa 03.

**História embutida nos números**, para cada etapa ter o que achar:

- **Mídia e conversão:** o CAC sobe ao longo do ano e o ROAS cai. A conversão do site é razoável (cerca de 1,4%), mas o carrinho abandona muito.
- **Produto:** três produtos carregam a Curva A (sérum de vitamina C, hidratante e protetor solar). Faltou estoque do sérum em MAR e ABR, e as vendas caíram.
- **Clientes:** recompra de cerca de 31%, com LTV alto em quem compra kit.
- **Sazonalidade:** a Black Friday concentra a receita e consome margem com desconto. Dia das Mães e Natal são os outros picos.

**Concorrentes reais:** Sallve, Simple Organic e Care Natural Beauty, mais um quarto a confirmar. Antes de fechar a lista, confere-se que todos têm anúncios ativos na Biblioteca do Meta.

**Site.** A marca não existe. O link informado na etapa 01 é fictício, e o fixture traz `contexto/brutos/site-simulado.md` com o texto da home, de duas páginas de produto e da página de frete e trocas. O roteiro da etapa 01 diz ao analista para avisar o agente que o site é simulado e apontar esse arquivo.

## 4. Kit do analista por etapa

Ao escolher a etapa N, o analista recebe dois itens em `kit-de-teste/` e no painel da tela: os **arquivos para enviar** e o **roteiro de respostas**.

| Etapa | Arquivos para enviar | Roteiro de respostas |
|---|---|---|
| 01 | Transcrição bruta do kickoff (.docx, com ruído de reunião), formulário pré-kickoff (.docx), link do site | Apontar o site simulado |
| 02 | Nenhum | Respostas às perguntas estratégicas |
| 03 | `historico-mensal.xlsx`, `produtos-curva-abc.xlsx`, `quebra-pagamento.xlsx` (opcional) | Escolhas de período, de benchmark e de critério |
| 04 | `clientes-historico.xlsx` (sem dado pessoal) | Ressalvas de critério |
| 05 | Nenhum | O que o cliente já tentou e as prioridades |
| 06 | Nenhum | Meta, prazo, sazonalidade e disposição para mudanças |
| 07 | Nenhum | Lista de concorrentes |
| 08 | Prints das campanhas (simulados, opcional) | Verba e plataformas |
| 09 | Nenhum | Responsáveis e capacidade do time |
| Final | Nenhum | Preferências da apresentação |

O roteiro da etapa N reúne as respostas que, na produção do conteúdo, geraram o resultado da etapa N. O que o analista digita leva a um resultado próximo do que está no fixture, e ele pode comparar.

## 5. Estrutura do fixture

```
clientes/_fixtures/verdeluz/
  manifesto.json          caminho de cada arquivo → etapa a que pertence
  estado-completo.json    as 10 etapas prontas: resumos, handoffs, entregáveis, insumos
  base/                   contexto/, dados/, entrega/ e propostas com o planejamento inteiro
  roteiros/NN.md          o roteiro de respostas da etapa NN
```

- `clientes/*` é ignorado no git, com exceção de `_template/`, porque dado de prospect real nunca vai para o repositório. O `.gitignore` ganha a exceção `!clientes/_fixtures/`. A Verdeluz é toda fictícia, então não há risco. O `.app/` continua ignorado; por isso as propostas do fixture ficam em `base/propostas/` e são copiadas para `.app/propostas/` no reposicionamento.
- A listagem de prospects já ignora pastas que começam com `_`, então `_fixtures` não aparece como cliente.
- O manifesto é gerado pelo script de construção do conteúdo e conferido por teste: todo arquivo de `base/` precisa estar nele, e todo caminho citado precisa existir.
- Estimativa de tamanho: 15 a 20 MB, quase tudo no `.pptx` e nos gráficos.

## 6. Reposicionar na etapa N

`reposicionarTeste(slug, etapa)`, em `packages/core`:

1. **Trava de segurança.** Só age se o `estado.json` do cliente tiver `teste: { fixture }` e o fixture existir. Em qualquer outro prospect, recusa com erro explícito. Recusa também se o agente estiver rodando um turno naquele prospect.
2. **Limpa** o que o app e as etapas geram: `contexto/`, `dados/`, `entrega/`, `.app/` (conversas, propostas, rascunhos, comentários) e `kit-de-teste/`. Mantém o `CLAUDE.md` do cliente.
3. **Copia** de `base/` apenas os arquivos cuja etapa no manifesto é menor que N.
4. **Monta o estado** a partir de `estado-completo.json`:
   - etapas anteriores a N: `concluida`, com `resumoDecisoes` e `handoff`, `origem: "app"` e `sessionId: null`;
   - etapa N: `liberada`;
   - etapas posteriores: `bloqueada`;
   - entregáveis e insumos: só os das etapas anteriores a N;
   - `perguntas` e `filaAutomatica` vazios, `teste` preservado.
5. **Prepara o kit.** Copia para `kit-de-teste/` os arquivos de insumo da etapa N e o `roteiro.md` dela.
6. **Regera** `contexto/status-planejamento.md` pelo mecanismo que já existe (`status-md.ts`).

Escolher a mesma etapa de novo desfaz as tentativas e volta ao ponto de partida. Escolher 01 equivale a um prospect novo, só com o kit.

**Erros tratados:** etapa inválida, cliente que não é de teste, fixture ausente ou com manifesto inconsistente, turno do agente em andamento. Todos viram mensagens em português na interface, no padrão das rotas atuais (`respostaDeErro`).

## 7. Mudanças no app

Tudo é aditivo e só aparece quando o cliente é de teste.

**`packages/core`**
- `Estado` ganha `teste?: { fixture: string }` (a versão do estado continua 1).
- Novo `servico-teste.ts` com `reposicionarTeste` e `lerKit(slug)` (arquivos do kit e roteiro da etapa).
- Novo `fixture.ts` que lê e valida `manifesto.json` e `estado-completo.json`.

**API**
- `GET /api/prospects/[slug]/teste`: etapa atual, arquivos do kit e roteiro; para prospect comum, responde que não é teste.
- `POST /api/prospects/[slug]/teste/reposicionar` com `{ etapa }`: reposiciona e emite o evento que já atualiza a tela.
- "Mostrar no Finder" reaproveita `POST /api/prospects/[slug]/abrir-pasta` com `{ caminho }`.

**Tela**
- **Faixa "Cliente de teste"** no topo da área de trabalho, com o botão **Reposicionar**. Abre um diálogo com as 10 etapas; o analista escolhe uma, lê o aviso de que o trabalho feito no cliente será apagado e confirma.
- **Painel "Kit desta etapa"** ao lado da etapa liberada: arquivos para enviar (com "Mostrar no Finder") e o roteiro em markdown, renderizado por `components/markdown.tsx`.
- **Selo "Teste"** no `card-prospect` da home.
- Componentes novos em arquivos novos; edições em `area-de-trabalho.tsx`, `card-prospect.tsx` e `tipos.ts` mínimas.

**Criação do cliente.** `npm run cliente-teste -- --etapa 01` cria `clientes/verdeluz-teste/` a partir do fixture e o deixa na etapa pedida (padrão 01). Serve também para recriar o cliente em outra máquina.

**Cuidado com trabalho em andamento.** O repositório tem alterações não commitadas de outra frente (chat, cards, `servico-planejamento.ts`, `tipos.ts`). A implementação do subprojeto A deve rodar em um worktree separado, para não misturar.

## 8. Produção do conteúdo (subprojeto B)

Na ordem das dependências:

1. **Dados-fonte**, por script determinístico (semente fixa): `historico-mensal`, `produtos-curva-abc`, `quebra-pagamento` e `clientes-historico`, com as colunas dos modelos da agência. Os totais fecham entre si (clientes, pedidos e receita) e carregam a história da seção 3. O cliente histórico tem só ID e nome fictício, sem dado pessoal. Cada arquivo passa por `scripts/validar_insumo.py`.
2. **Brutos:** transcrição do kickoff em `.docx` com ruído de reunião de verdade (conversa paralela, repetição, assunto fora do tema), formulário pré-kickoff, `site-simulado.md` e prints simulados de campanha (PNG).
3. **As 10 etapas na ordem real**, conduzidas com as skills, os scripts e os subagentes do projeto (`projecao.py`, `validar_solucoes.py`, `preencher_projecao_xlsx.py`, `preencher_plano_acao_docx.py`, `gerar_apresentacao.py`). Gráficos conforme `padrao-visual.md`. Cada etapa deixa o resumo de decisões, o handoff, as seções aprovadas, os gráficos, a projeção, o plano em `.docx` e a apresentação em `.pptx`.
4. **Roteiros**, escritos a partir das respostas dadas durante a produção.
5. **Benchmark da etapa 07.** Tenta-se a coleta real pela Apify para os concorrentes reais. Se o `APIFY_TOKEN` não estiver configurado, o benchmark do fixture usa apenas informação pública e verificável, marcada como ilustrativa, sem número inventado sobre marca real. O teste real da coleta fica para o analista, na etapa 07.
6. **Montagem:** `estado-completo.json`, `manifesto.json` e `roteiros/`.

**Marcação de ficção.** Os arquivos do fixture trazem "FICTÍCIO" onde couber, e o site usa domínio `.example`. Os textos seguem a regra de escrita da agência (sem travessão no meio de frase).

## 9. Testes e verificação

**Automatizados** (Vitest em `packages/core`, mais uma checagem de consistência do fixture real):

- reposicionar com um fixture mínimo: estado, arquivos copiados, kit e `status-planejamento.md` corretos para cada etapa, inclusive 01 e `final`;
- trava: recusa em cliente que não é de teste, com fixture ausente e com turno em andamento;
- repetir a mesma etapa devolve exatamente o mesmo estado;
- fixture real: todo arquivo de `base/` está no manifesto; todo caminho do manifesto existe; para N de 01 a `final`, o estado é válido, `montarDossie` não cita arquivo inexistente e `condicoesConcluir` da etapa liberada lista só o que falta enviar;
- cada arquivo de kit de dados passa pelo validador de insumo, e nenhum arquivo do fixture contém padrão de CPF, e-mail ou telefone;
- o teste existente `sem-travessao.test.ts` continua passando (os textos novos do app seguem a regra).

**No app de verdade:** reposicionar, abrir o cliente no navegador e conferir a faixa, o diálogo, o kit e a etapa liberada em 01, 03 e `final`.

**Fora do que eu rodo:** o agente do app (`claude -p`) sobre o cliente de teste, porque gasta a assinatura. O primeiro teste de ponta a ponta com ele fica por conta do analista.

## 10. Fora de escopo

- Gerar o cliente de teste de outros segmentos (a estrutura do fixture permite, mas só a Verdeluz é feita agora).
- Reabrir etapas com cascata em cima do cliente de teste (o reposicionamento substitui isso para teste).
- Publicar um site real para a marca fictícia.
- Rodar o agente do app automaticamente para validar as respostas dos roteiros.
