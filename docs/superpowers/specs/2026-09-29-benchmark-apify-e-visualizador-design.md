# Benchmark Meta Ads via Apify + Visualizador lateral redimensionável — Design

**Data:** 2026-09-29
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** duas partes independentes, implementadas nesta ordem:
(A) coleta do benchmark via Apify na Skill 06; (B) layout redimensionável e
visualizador lateral de HTML na interface web.

## 1. Objetivo

A agência tem uma skill mais madura de benchmark de anúncios
(`benchmark-meta-ads`), mas ela depende de o Claude controlar o Chrome para
navegar a Biblioteca de Anúncios do Meta — o analista sai do planejamento e
vai para um ambiente externo. A Skill 06 atual, por sua vez, coleta via
Firecrawl, que hoje está sem créditos, e segue regras menos completas.

Objetivo:

1. A Skill 06 passa a seguir **integralmente** as regras da skill nova
   (até 10 criativos por marca, ranking de intensidade, 7 perguntas
   estratégicas, regras de formato/funil/DPA/deduplicação/integridade).
2. A coleta é feita pelo ator `apify/facebook-ads-scraper` via API, sem
   navegador e sem bloqueio da Meta, dentro da mesma conversa do
   planejamento (terminal ou interface web).
3. Na interface web, o relatório HTML abre num painel lateral ao lado do chat,
   que pode ser fechado depois; e todas as colunas da área de trabalho são
   redimensionáveis (Resizable do shadcn).

**Critério de sucesso:** um analista roda a Skill 06 de um prospect pela
interface, do briefing ao `benchmark.html` aprovado, sem abrir navegador
externo nem baixar o arquivo para conferir; o relatório segue o template da
skill nova, com até 10 criativos por marca analisados a partir das imagens e
quadros de vídeo reais.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Regras que valem quando a skill nova e a Skill 06 divergem | A skill nova vale inteira (10 criativos, ranking, 7 perguntas dela). A Skill 06 só acrescenta o que é do planejamento (briefing, Lição + Evidência, checkpoint, caminhos de salvamento) |
| 2 | Análise de vídeo | Baixar o vídeo e extrair 5 quadros com ffmpeg; sem áudio |
| 3 | Achar a página certa de cada marca | Descoberta automática via Apify, com checkpoint só quando houver dúvida |
| 4 | Como falar com a Apify | Script Python próprio (`scripts/coleta_meta_ads.py`) chamando a API REST |
| 5 | Limite de catálogo (DPA) | No máximo 1 por anunciante na seleção final (a regra mais restritiva da skill nova) |
| 6 | Token | `APIFY_TOKEN` no ambiente ou em `.env` na raiz (fora do git) |
| 7 | Visualizador | Painel lateral de HTML, abre sozinho uma vez por HTML novo, acompanha a versão mais recente |
| 8 | Redimensionamento | Só as colunas (trilha, chat, visualizador, painel da etapa), com tamanhos salvos no navegador |

## 3. Parte A — Benchmark via Apify

### 3.1 Divisão de responsabilidades

- **Script (`coleta_meta_ads.py`):** tudo que é mecânico e verificável —
  chamar a Apify, agrupar páginas, contar anúncios ativos, deduplicar,
  aplicar limites (10 criativos, 1 DPA), descartar anúncio sem mídia, baixar
  imagens, extrair quadros de vídeo, gravar um resumo legível.
- **Claude, na conversa principal da Skill 06:** tudo que é interpretação —
  escolher a página em caso de dúvida (com o analista), olhar imagens e
  quadros, preencher descrição visual, tom, foco, texto sobreposto e quadro
  final, escrever a síntese por marca, responder as 7 perguntas, montar o
  HTML e a camada Lição + Evidência.
- **Subagente `pesquisador-benchmark`:** deixa de participar da Skill 06
  (a análise visual precisa acontecer onde as imagens são lidas). Continua na
  Skill 07 (benchmarking de mercado) e no uso pontual da Skill 02.

### 3.2 Fluxo da Skill 06

**Fase 1 — Briefing do Cliente:** inalterada, exceto a seção 7 do template,
que passa a ter, por concorrente: nome, site, @ do Instagram, e "por que
analisar"; mais "pontos de atenção" (opcional) e "perguntas estratégicas
customizadas" (opcional — substituem as 7 padrão, como na skill nova).

**Fase 2 — Benchmark:**

- **2a. Lista de anunciantes.** Concorrentes da seção 7 + o próprio prospect.
  Mais de 4 concorrentes → perguntar quais 4 priorizar. Concorrente sem site
  informado → pesquisar o site oficial (WebSearch) antes da descoberta.
- **2b. Descoberta das páginas.** Para cada anunciante sem link informado,
  rodar `descobrir`. Página marcada `confirmada` → segue direto. Qualquer
  `ambigua` ou `nao_encontrada` → checkpoint: o Claude mostra a tabela das
  candidatas (nome, `page_id`, curtidas, categoria, domínios, volume na
  amostra) e pergunta ao analista qual usar, ou pede o link. É uma pergunta de
  escolha, não um entregável: tanto no terminal quanto na interface é feita no
  chat (não usa `propor_entregavel`, para não copiar nada para
  `ativos-aprovados/`). Se o analista informou um link com
  `view_all_page_id`, usa-o direto.
- **2c. Coleta e análise.** Um anunciante por vez, concorrentes na ordem do
  briefing, o prospect por último. Para cada um: rodar `coletar` (Bash com
  timeout de 600000 ms), ler `resumo.md`, abrir com Read cada imagem e cada
  quadro listado, preencher a tabela de atributos, escrever a síntese.
  Ao fim de cada anunciante, acrescentar o bloco dele ao arquivo de análise
  `dados/benchmark-meta/analise-benchmark.md` (o "OUTPUT PROMPT 1" da skill
  nova: texto corrido, sem tabelas). Se a execução cair, retomar a partir dos
  anunciantes que já estão nesse arquivo.
- **2d. Relatório.** Montar o HTML a partir de `_shared/benchmark-template.html`
  seguindo `_shared/relatorio-benchmark.md`. Checkpoint do HTML:
  - interface: salvar em `.app/rascunhos/benchmark.html` e
    `propor_entregavel` (tipo `html`, `nome_final` `benchmark.html`);
  - terminal: pedir a checagem no chat e, aprovado, salvar em
    `entrega/ativos-aprovados/benchmark/benchmark.html`.
  Depois, a camada estratégica (Lição + Evidência por concorrente +
  destaques) em `secoes/06-benchmark.md`, como hoje. A Evidência passa a usar
  o total de anúncios ativos vindo do script.

Encerramento e handoff da Skill 06: inalterados.

### 3.3 O script `scripts/coleta_meta_ads.py`

**Interface:**

```
python3 scripts/coleta_meta_ads.py descobrir --marca "Nome" [--site dominio.com.br] --saida <pasta>
python3 scripts/coleta_meta_ads.py coletar --page-id N --marca "Nome" --saida <pasta> [--limite 10]
```

`--saida` é a pasta do prospect em `dados/benchmark-meta/`. O script cria a
subpasta `<marca-normalizada>/` (mesma normalização de slug do projeto). Saída
na tela: um resumo curto em português (o Claude lê os detalhes nos arquivos).

**`descobrir`:**

1. Chama o ator com a URL de busca por palavra-chave da Biblioteca
   (`country=BR`, `active_status=active`, `ad_type=all`,
   `search_type=keyword_unordered`, `q=<marca>`), `resultsLimit` ~30.
2. Agrupa por `pageID`: nome da página, curtidas, categorias, domínios de
   destino (a partir do link/caption do snapshot), nº de anúncios na amostra.
3. Classifica:
   - `confirmada` — a página de maior volume tem nome compatível (comparação
     normalizada: sem acento, caixa, espaços e pontuação) **e** anuncia para o
     domínio do `--site` (mesmo domínio registrável);
   - `ambigua` — qualquer outro caso com resultados;
   - `nao_encontrada` — sem resultados. Se o nome tiver mais de uma palavra,
     tenta de novo com as palavras juntas, sem espaço, antes de concluir isso.
4. Grava `descoberta.json` e imprime a tabela de candidatas + a classificação.

**`coletar`:**

1. Total de anúncios ativos da página: execução com `onlyTotal: true`.
2. Anúncios: URL `view_all_page_id=N` (`country=BR`, ativos), ordenação por
   mais recentes, `resultsLimit` 40.
3. Seleção, em código:
   - descarta anúncio sem nenhuma mídia (imagem, vídeo ou card);
   - deduplica: mesmo `collationID` → um só; depois, mesmo texto principal
     normalizado **e** mesma imagem (hash médio de 8×8 via Pillow, distância
     de Hamming ≤ 5) → um só;
   - no máximo 1 catálogo (DPA) — `display_format` de catálogo; os demais são
     pulados;
   - ordena por data de início (mais recente primeiro) e fica com até
     `--limite` (10). Com menos disponíveis, fica com todos.
4. Mídia, por anúncio, em `midia/<ad_id>/`:
   - imagem: a de maior resolução disponível;
   - carrossel/catálogo: os 3 primeiros cards;
   - vídeo: baixa o de melhor qualidade, extrai 5 quadros com ffmpeg (em
     ~2 s, 25%, 50%, 75% e ~0,5 s antes do fim; vídeos com menos de 3 s usam
     início, meio e fim), baixa também a imagem de capa e apaga o arquivo de
     vídeo. Se o ffmpeg falhar, fica só a capa e o anúncio é marcado
     `quadros: falhou`.
   - download que falhar: nova tentativa uma vez; falhou de novo → o anúncio
     é descartado e substituído pelo próximo da lista (regra "ID que não
     carrega" da skill nova).
5. Grava:
   - `anuncios.json` — dados normalizados dos selecionados: `ad_id`, link da
     Biblioteca, formato, texto principal, título, CTA, domínio, plataformas,
     data de início, nº de versões (`collationCount`), impressões (quando
     houver), caminhos da mídia;
   - `bruto.json` — resposta crua da Apify (auditoria);
   - `resumo.md` — cabeçalho (marca, página, `page_id`, total de anúncios
     ativos, data da coleta) + um bloco por anúncio com os campos acima e os
     caminhos das imagens/quadros + "Notas de coleta" automáticas (ex.: "só 4
     anúncios ativos", "37 anúncios eram o mesmo criativo", "nenhum catálogo
     disponível", "2 descartados por mídia indisponível").
   - Página sem anúncio ativo não é erro: `resumo.md` diz "Nenhum anúncio
     ativo encontrado" e o relatório usa o bloco `bm-sem-anuncios`.

**Chamada à Apify:** `POST /v2/acts/apify~facebook-ads-scraper/runs`, consulta
de status até `SUCCEEDED` (intervalo crescente, limite de 10 min), depois
leitura do dataset. Token no cabeçalho `Authorization: Bearer`, nunca na URL
nem em log. Token lido de `APIFY_TOKEN` no ambiente; se ausente, do `.env` na
raiz do projeto (leitura simples de `CHAVE=valor`, sem dependência nova).

**Erros** (mensagem em português, código de saída ≠ 0):

| Situação | Mensagem orienta a |
|---|---|
| Token ausente | criar o token na Apify e colocar em `.env` |
| Token inválido (401) | conferir o token |
| Sem créditos / limite do plano (402/403) | verificar o plano na Apify |
| Execução falhou (`FAILED`, `ABORTED`) | tentar de novo; mostra o status |
| Tempo esgotado (10 min) | tentar de novo com a execução ainda visível no painel da Apify (mostra o id) |
| ffmpeg ausente | instalar com `brew install ffmpeg` |

**Dependências:** `requests` e Pillow (já presentes no Python do projeto —
Pillow vem com o matplotlib), `ffmpeg` no sistema. Nenhuma dependência nova de
Python.

**Custo de referência:** ~5 anunciantes × (30 da descoberta + 40 da coleta) ≈
350 anúncios por benchmark — ordem de US$ 1–2 no pior plano da Apify.

### 3.4 Arquivos da skill e regras compartilhadas

| Arquivo | Mudança |
|---|---|
| `.claude/skills/06-briefing-e-benchmark/SKILL.md` | Fase 2 reescrita (2a–2d); seção 7 do briefing ampliada; checklist inicial menciona `APIFY_TOKEN` |
| `.claude/skills/_shared/benchmark-coleta-e-analise.md` (novo) | Regras de classificação e análise da skill nova (`coleta-e-analise.md`) adaptadas: formato, funil (CTA + domínio), tom, foco, integridade ("só o que foi visualmente confirmado; senão —"), análise de vídeo pelos quadros (descrever a partir do quadro de ~2 s, textos sobrepostos, quadro final), síntese por anunciante. Sai tudo que é de navegador |
| `.claude/skills/_shared/relatorio-benchmark.md` | Substituído pelas regras de `geracao-relatorio.md` da skill nova (checklist, 7 perguntas, ranking proporcional, `bm-nota`, `bm-sem-anuncios`), mantendo as regras do planejamento: PII, copy como evidência, só concorrentes da lista, caminhos de salvamento, checkpoint |
| `.claude/skills/_shared/benchmark-template.html` | Substituído pelo `assets/template.html` da skill nova, sem alterar estrutura, classes ou cores; comentário de cabeçalho indica onde é salvo e qual arquivo de regras seguir |
| `.claude/agents/pesquisador-benchmark.md` | Remove o uso na Skill 06 e a seção "Dados estruturados para o relatório detalhado"; mantém Skill 07 e Skill 02 |
| `CLAUDE.md` (raiz) | Descrição do `pesquisador-benchmark` (só Skills 07 e 02); linha sobre `APIFY_TOKEN` e ffmpeg como pré-requisitos da Skill 06 |
| `clientes/_template/dados/README.md` | Menciona `benchmark-meta/` (gerada pela Skill 06, não é insumo do analista) |
| `.env.example` (novo, raiz) | `APIFY_TOKEN=` |
| `README.md` | Seção curta: como gerar o token na Apify e onde colocar |

O `scripts/extract_ad_ids.js` da skill nova não entra (o script substitui a
extração de IDs).

### 3.5 Integração com a interface

- `Bash(python3 *)` já está na lista de ferramentas permitidas — sem mudança.
  O agente herda o ambiente do app, e o script lê o `.env` sozinho.
- `src/apps/web/app/api/sistema/route.ts` e a tela de verificação do sistema:
  dois itens novos — "ffmpeg instalado" e "Token da Apify configurado"
  (verifica se existe no ambiente ou no `.env`; nunca expõe o valor).
- `src/packages/core/src/atividade.ts`: comando Bash contendo
  `coleta_meta_ads` → "Coletando anúncios na Biblioteca do Meta".

## 4. Parte B — Layout redimensionável e visualizador de HTML

### 4.1 Layout da área de trabalho

O grid fixo de `AreaDeTrabalho` (`240px | chat | 320px`) vira um
`ResizablePanelGroup` horizontal (shadcn `resizable`, sobre
`react-resizable-panels` v4), com `ResizableHandle` com grip entre colunas:

| Coluna | Inicial | Mín. / máx. | Recolhível |
|---|---|---|---|
| Trilha de etapas | 15% | 10% / 25% | sim |
| Chat | restante | mín. 25% | não |
| Visualizador HTML (só quando aberto) | 50% | mín. 25% | fecha pelo botão |
| Painel da etapa | 22% | 15% / 40% | sim — o botão atual de recolher/mostrar passa a recolher/expandir este painel |

- Tamanhos salvos no `localStorage` do navegador, em dois layouts separados:
  sem visualizador e com visualizador. Abrir um relatório não altera o layout
  do dia a dia.
- Abrir o visualizador não recolhe mais o painel da etapa automaticamente.
- Durante o arraste de qualquer alça, iframes ficam com `pointer-events: none`
  (senão o iframe captura o mouse e a alça trava).

### 4.2 Visualizador

- **Card de entregável HTML:** a prévia inline (iframe de 384 px) sai. Fica um
  bloco compacto com o título e o botão **Abrir**; Aprovar e Pedir ajuste
  continuam no card.
- **Painel:** cabeçalho com título, status do entregável e ações **Tela
  cheia** (recolhe trilha, chat e painel da etapa; clicar de novo restaura o
  layout anterior), **Abrir em nova aba** (URL da rota de arquivo; útil para
  exportar em PDF) e **Fechar** (também pela tecla Esc).
- **Abertura automática:** quando chega um entregável HTML novo (evento de
  estado) e o analista está naquela etapa, o visualizador abre uma vez. Depois
  disso, só por clique.
- **Versão mais recente:** o visualizador guarda `{ etapa, nomeFinal }`, não o
  id do entregável. Ele sempre mostra o entregável não substituído mais
  recente com esse `nomeFinal` (rascunho, se pendente; aprovado, se aprovado),
  então um ajuste troca o conteúdo sozinho.
- **Entregáveis do painel da etapa:** itens HTML da lista viram clicáveis e
  abrem no visualizador.
- **Iframe:** `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`,
  sem `allow-same-origin` (o HTML é gerado pelo agente). Os popups são
  necessários para os links dos anúncios abrirem em nova aba.

### 4.3 Arquivos

- `src/packages/ui/src/components/resizable.tsx` — novo (`shadcn add resizable`);
  dependência `react-resizable-panels@^4` no pacote `ui`.
- `src/apps/web/components/trabalho/area-de-trabalho.tsx` — layout
  redimensionável e estado do visualizador.
- `src/apps/web/components/trabalho/visualizador-html.tsx` — novo.
- `src/apps/web/components/cards/previa-arquivo.tsx`,
  `components/cards/card-entregavel.tsx`,
  `components/trabalho/painel-etapa.tsx` — botão Abrir e itens clicáveis.
- Função pura para escolher a versão exibida (ex.:
  `entregavelVisivel(entregaveis, etapa, nomeFinal)`) em `@workspace/core`,
  para ser testável.

## 5. Testes

**Parte A — pytest em `scripts/tests/test_coleta_meta_ads.py`, sem rede:**

- fixture JSON com a forma da resposta da Apify (anúncios de imagem, vídeo,
  carrossel, catálogo, duplicados por `collationID` e por texto+imagem, sem
  mídia);
- seleção: limite de 10, no máximo 1 DPA, deduplicação, descarte sem mídia,
  ordem por data, menos de 10 disponíveis;
- descoberta: `confirmada` (nome + domínio), `ambigua` (domínio diferente,
  duas páginas parecidas), `nao_encontrada` com nova tentativa sem espaço;
- quadros: vídeo sintético gerado pelo ffmpeg no teste (ex.: 6 s) → 5 quadros;
  vídeo de 2 s → 3 quadros;
- erros: token ausente, 401, 402, tempo esgotado (HTTP simulado);
- `resumo.md`: campos e notas de coleta esperados.

**Parte A — verificação real (manual, uma vez):** rodar `descobrir` e
`coletar` contra 1 marca real com o token do analista e conferir a pasta
gerada; depois, uma Skill 06 completa num prospect de teste.

**Parte B:**

- vitest para `entregavelVisivel` (pendente vs. aprovado, substituído
  ignorado, várias versões, `nomeFinal` inexistente);
- verificação no navegador do app: arrastar cada alça, recarregar e conferir
  que os tamanhos persistem (com e sem visualizador), recolher/expandir
  trilha e painel, abrir/fechar o visualizador, Esc, tela cheia e restaurar,
  arrastar por cima do iframe, pedir ajuste e ver o conteúdo trocar, clicar
  num link de anúncio e ver abrir em nova aba.

## 6. Fora do escopo

- Transcrição do áudio dos vídeos.
- Divisões verticais dentro do painel da etapa.
- Comentar ou editar o HTML dentro do visualizador.
- Coleta de outras plataformas (TikTok, Google Ads Transparency).
- Mudanças na Skill 07 (continua usando o `pesquisador-benchmark` com
  Firecrawl; a falta de créditos do Firecrawl é um problema à parte).
