# Fase 2 — Geração do relatório (equivalente ao "Prompt 2")

Esta fase transforma o texto de análise da Fase 1 (arquivo
`ANÁLISE DE BENCHMARK - [CLIENTE] (OUTPUT PROMPT 1).md`) no relatório HTML
final. Rode-a em seguida à Fase 1, sem pausar para revisão — o texto
intermediário já está salvo à parte caso o usuário queira auditar depois.

## Template

Use `assets/template.html` como esqueleto **exato** — não modifique a
estrutura HTML, as classes CSS ou as cores. Esse template foi validado em
produção pela agência (conferido contra um relatório real já entregue a um
cliente), então qualquer alteração estrutural arrisca quebrar um layout que
já funciona. Copie o arquivo, substitua os placeholders (marcados entre
colchetes, ex. `[CLIENTE]`) pelo conteúdo real, e duplique os blocos
repetíveis (um `.bm-concorrente` por anunciante, um `.bm-ad-card` por
anúncio, uma `.bm-rank-row` por linha do ranking) quantas vezes forem
necessárias.

## Checklist obrigatório antes de escrever o HTML

- O arquivo final é salvo como `benchmark_[cliente].html` — nunca `.md`,
  nunca `.pdf`.
- Todo ID de anúncio é um link clicável, no formato:
  `<a href="https://www.facebook.com/ads/library/?id=ID" target="_blank" rel="noopener noreferrer">ID</a>`
  — os links devem abrir em nova aba (não substituir a aba onde está o
  relatório).
- A análise do cliente (Fase 2.5) vem depois dos concorrentes e antes da
  síntese estratégica geral.
- O cliente está incluído no ranking de intensidade de mídia.
- Toda tabela de anúncio inclui o campo "Etapa de funil".
- Máximo de 1 catálogo (DPA) por anunciante — incluindo o próprio cliente.
- Anúncios classificados como Catálogo (DPA) usam o badge
  `bm-badge bm-badge-dpa`.
- Concorrentes sem anúncios ativos aparecem com a seção
  `bm-sem-anuncios`: "Nenhum anúncio ativo encontrado no momento da pesquisa
  — confirmado pelo Analista."
- Quando a Fase 1 tiver registrado algo digno de nota sobre a coleta de um
  anunciante (poucos anúncios ativos, sem catálogo disponível, reuso forte
  de criativo), inclua um bloco `bm-nota` logo abaixo dos links coletados
  daquele anunciante, com a explicação em uma frase.

## Perguntas estratégicas

Responda comparando concorrentes e o próprio cliente. Se o briefing (Fase 0)
tiver trazido perguntas específicas, use-as. Caso contrário, use estas 7:

1. Como os concorrentes comunicam autenticidade e confiança?
2. Quais concorrentes têm campanhas separadas para buyers e sellers?
3. Quem usa posicionamento de valor vs. promoção de preço?
4. Quais formatos predominam no mercado? (vídeo, carrossel, estático,
   catálogo)
5. Há uso de figura pública, fundador ou influenciador?
6. Como cada marca distribui seus anúncios pelo funil? (topo, meio, fundo)
7. Quem está investindo mais intensamente? (volume de anúncios ativos)

Cada resposta deve comparar todos os anunciantes analisados nominalmente —
não é uma observação genérica de mercado, é uma comparação direta entre o
que foi encontrado em cada conta.

## Ranking de intensidade de mídia

Uma linha (`bm-rank-row`) por anunciante — concorrentes + cliente — ordenado
do maior para o menor volume de anúncios ativos. A largura da barra
(`bm-rank-bar`, `style="width:N%"`) é proporcional ao anunciante de maior
volume (que recebe 100%); os demais são calculados como
`(volume do anunciante / volume do maior) × 100`, arredondado.

## Atenção especial ao ranking

Mantenha a estrutura estética proposta no template — é a seção mais visual
do relatório e a mais fácil de descuidar ao copiar/colar conteúdo.

## Salvando e entregando

1. Salve o arquivo final como `benchmark_[cliente].html`.
2. Garanta que os links de anúncio abrem em nova aba ao serem clicados (não
   substituem a aba do relatório).
3. Entregue ao usuário tanto o HTML final quanto o arquivo de texto da Fase 1
   (para auditoria), e informe que, para exportar em PDF, basta abrir o
   arquivo no Chrome e usar Cmd+P/Ctrl+P → Destino: Salvar como PDF.

Só interrompa a execução antes de finalizar se a criação do relatório tiver
sido severamente comprometida (ex.: quase todos os concorrentes sem acesso
possível à Biblioteca de Anúncios) — nesse caso, pare e explique o que
aconteceu. Fora isso, execute o plano completo e só pare quando o relatório
estiver finalizado e entregue.
