# Relatório de benchmark Meta Ads

Referenciado pela etapa `briefing-e-benchmark` (Fase 2), hoje desativada em
`.claude/skills/_desativadas/`. Não copie este
conteúdo para dentro de uma skill — referencie este arquivo.

Adaptado de `docs/referencias/benchmark-meta-ads/references/geracao-relatorio.md`.
Vale **apenas para a pesquisa de concorrentes** (etapa `briefing-e-benchmark`). O
benchmarking de mercado da Skill 07 (mídia paga) continua em texto livre.

## O que é

Um relatório HTML autocontido que apresenta a análise dos anúncios ativos de
cada concorrente na Biblioteca de Anúncios do Meta, do próprio prospect, as
respostas às perguntas estratégicas e o ranking de intensidade de mídia. É o
artefato visual que pode ser mostrado ao prospect; **não substitui** a camada
Lição + Evidência (`secoes/07-benchmark.md`).

## Template

Use `.claude/skills/_shared/benchmark-template.html` como esqueleto
**exato** — não modifique a estrutura HTML, as classes CSS ou as cores. Copie
o arquivo, substitua os placeholders entre colchetes pelo conteúdo real e
duplique os blocos repetíveis: um `.bm-concorrente` por concorrente, um
`.bm-cliente` para o prospect, um `.bm-ad-card` por anúncio, um par
`.bm-sq`/`.bm-sa` por pergunta e uma `.bm-rank-row` por anunciante.

Fonte do conteúdo: `dados/benchmark-meta/analise-benchmark.md` e os
`resumo.md` de cada anunciante.

## Checklist obrigatório antes de salvar

- Todo ID de anúncio é um link que abre em nova aba:
  `<a href="https://www.facebook.com/ads/library/?id=ID" target="_blank" rel="noopener noreferrer">ID</a>`.
- A análise do prospect vem depois dos concorrentes e antes da síntese
  estratégica geral.
- O prospect está incluído no ranking de intensidade de mídia.
- Toda tabela de anúncio inclui "Etapa de funil" (com justificativa breve).
- Máximo de 1 catálogo (DPA) por anunciante, inclusive o prospect; anúncios de
  catálogo usam o badge `bm-badge bm-badge-dpa`.
- Anunciante sem anúncios ativos aparece com o bloco `bm-sem-anuncios`:
  "Nenhum anúncio ativo encontrado no momento da pesquisa — confirmado pelo
  Analista."
- Quando a coleta de um anunciante tiver algo digno de nota (poucos anúncios
  ativos, sem catálogo, forte reuso de criativo, vídeo sem quadros), inclua um
  bloco `bm-nota` logo abaixo dos links daquele anunciante, em uma frase.
- Cabeçalho: data da pesquisa, número de concorrentes analisados e a fonte.

## Perguntas estratégicas

Se o briefing (seção 8) trouxe perguntas customizadas, use-as. Caso contrário,
use estas 7:

1. Como os concorrentes comunicam autenticidade e confiança?
2. Quais concorrentes têm campanhas separadas para buyers e sellers?
3. Quem usa posicionamento de valor vs. promoção de preço?
4. Quais formatos predominam no mercado? (vídeo, carrossel, estático,
   catálogo)
5. Há uso de figura pública, fundador ou influenciador?
6. Como cada marca distribui seus anúncios pelo funil? (topo, meio, fundo)
7. Quem está investindo mais intensamente? (volume de anúncios ativos)

Cada resposta compara nominalmente todos os anunciantes analisados,
concorrentes e prospect. Não é observação genérica de mercado.

## Ranking de intensidade de mídia

Uma `bm-rank-row` por anunciante, ordenado do maior para o menor número de
anúncios ativos (o "Anúncios ativos (total)" de cada `resumo.md`). A barra
(`bm-rank-bar`, `style="width:N%"`) do maior volume é 100%; as demais são
`(volume / maior volume) × 100`, arredondado. Se a Apify não informou o total
de algum anunciante, use o "Anúncios da página na amostra" do `resumo.md` e
marque o valor com "≥" (ex.: "≥ 15"). Mantenha a estrutura estética do template — é a seção mais
visual e a mais fácil de descuidar.

## Regras do planejamento

- **Nunca inventar contagem de anúncios** nem criativos.
- **Copy é evidência observada**, permitida no campo Copy e truncada com "…"
  quando longa. Todo texto que vem dos anúncios (copy, título, CTA, nome de
  página) entra no HTML **escapado**: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`.
  Nunca cole HTML cru vindo de um anúncio. Descrição visual, síntese e Lição vão com suas palavras —
  nunca reaproveitar a copy de um concorrente como recomendação de criativo
  para o prospect.
- **PII** (`CLAUDE.md` raiz): protege o cliente **final** do prospect.
  Influenciadores, creators e marcas que aparecem publicamente em anúncios não
  são PII e podem ser nomeados.
- Só reportar concorrentes da lista aprovada pelo analista.

## Onde salvar

- Modo interface (Regra 7 de `regras-de-validacao.md`): salvar em
  `clientes/<slug>/.app/rascunhos/benchmark.html` e chamar
  `propor_entregavel` com tipo `html`, `nome_final` `benchmark`. O app copia
  para `entrega/ativos-aprovados/benchmark/benchmark.html` quando o analista
  aprova.
- Terminal: pedir a checagem no chat e, aprovado, salvar em
  `clientes/<slug>/entrega/ativos-aprovados/benchmark/benchmark.html`.
- Nome estável, sem versionamento: uma nova aprovação sobrescreve.
- Arquivo autocontido (CSS inline, sem dependências externas).
