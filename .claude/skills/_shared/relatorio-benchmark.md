# Relatório detalhado de benchmark de concorrentes

Referenciado pela Skill 06 (`briefing-e-benchmark`, Fase 2) e pelo subagente
`pesquisador-benchmark`. Não copie este conteúdo para dentro de uma skill —
referencie este arquivo.

Vale **apenas para a pesquisa de concorrentes** (Skill 06, Fase 2). O
benchmarking de mercado nacional/internacional da Skill 07 continua em texto
livre — não gera este relatório.

## O que é

Um relatório HTML autocontido, no padrão visual da boomer (tema escuro, laranja
`#C86F00`), que apresenta a análise dos anúncios ativos de cada concorrente na
Biblioteca de Anúncios do Meta, do próprio prospect, e uma síntese estratégica.
É o artefato visual que pode ser mostrado ao prospect; **não substitui** os
blocos Lição + Evidência (esses continuam sendo produzidos — ver o agente).

## Base visual e onde salvar

- Base visual (não editar): `.claude/skills/_shared/benchmark-template.html`.
- Saída aprovada: `entrega/ativos-aprovados/benchmark/benchmark.html` do
  prospect. Nome estável, sem versionamento — uma nova aprovação sobrescreve
  (ver `regras-de-validacao.md`).
- O arquivo é **autocontido** (CSS inline, sem dependências externas), para
  abrir direto no navegador.

## Blocos obrigatórios

1. **Cabeçalho** — título com nome do prospect, data da pesquisa, nº de
   concorrentes analisados (com nomes) e a fonte.
2. **Um card por concorrente** da lista da seção 7 do briefing, contendo:
   - `view_all_page_id`, contagem aproximada de anúncios ativos, data de coleta;
   - **Links coletados** — a URL da Biblioteca de Anúncios de **cada** criativo
     analisado (`facebook.com/ads/library/?id=<AD_ID>`). Link por criativo é
     obrigatório;
   - **Um card por criativo analisado** (2 a 3 por marca, priorizando
     diversidade de formato), com badges e a tabela de atributos completa;
   - **Síntese** do concorrente, com suas palavras.
3. **Análise do próprio prospect** — no mesmo formato dos concorrentes.
4. **Síntese Estratégica Geral** — as perguntas fixas abaixo + 1 pergunta
   específica do prospect.
5. **Rodapé** boomer.

Não há bloco de ranking de barras — a intensidade de investimento é coberta
pela pergunta 6 da síntese.

## Tabela de atributos por criativo

Campo | Como preencher
---|---
Formato | Vídeo · Imagem estática · Carrossel · Catálogo (DPA)
Descrição visual | Descrição objetiva da peça, **com suas palavras**
Copy | Texto do anúncio **como observado**; truncar com "…" se longo
CTA | Botão do anúncio (Comprar agora, Saiba mais, Shop Now…)
Domínio | Domínio de destino do anúncio
Tom | Aspiracional · Relacional · Promocional · Institucional…
Foco | Buyer (consumidor final) · Seller (revenda/atacado)
Etapa de funil | Topo · Meio · Fundo
Plataformas | Facebook, Instagram, Messenger, Threads…
Início | Data de início da veiculação, se disponível; senão `—`
Versões | Nº de versões do criativo, se disponível; senão `—`
Impressões | Quando disponível; ads não-políticos no Brasil geralmente `—`

## Badges (classes CSS do template)

- Formato: `bm-badge-video`, `bm-badge-img`, `bm-badge-carousel`, `bm-badge-dpa`
- Foco: `bm-badge-buyer`, `bm-badge-seller`
- Funil: `bm-badge-topo`, `bm-badge-meio`, `bm-badge-fundo`

Cada card usa **1 badge de formato + 1 de foco + 1 de funil**.

## Perguntas fixas da Síntese Estratégica Geral

1. Como os concorrentes comunicam autenticidade e confiança?
2. Quem usa posicionamento de valor vs. promoção de preço?
3. Quais formatos predominam no mercado? (vídeo, carrossel, estático, catálogo)
4. Há uso de figura pública, fundador ou influenciador?
5. Como cada marca distribui seus anúncios pelo funil? (topo, meio, fundo)
6. Quem está investindo mais intensamente? (volume de anúncios ativos)
7. **Uma pergunta específica deste prospect**, derivada do gargalo/contexto do
   diagnóstico (ex.: separação buyer vs. seller; dependência de influenciador;
   ausência de topo de funil). Formular a partir do que apareceu nas Skills
   02–05, não uma pergunta genérica.

## Regras

- **Nunca inventar contagem de anúncios.** Sem acesso ou sem anúncios ativos,
  usar o bloco `bm-sem-anuncios` registrando o motivo, confirmado pelo Analista.
- **Copy é evidência observada** (transcrição do que o anúncio mostra),
  permitida no campo Copy e truncada quando longa. Já a Descrição visual, a
  Síntese e a Lição vão **com suas palavras** — nunca reaproveitar a copy de um
  concorrente como recomendação de criativo para o prospect.
- **PII** (`CLAUDE.md` raiz): a regra protege o cliente **final** do prospect.
  Influenciadores, creators e marcas que aparecem publicamente em anúncios não
  são PII e podem ser nomeados.
- Só reportar concorrentes da lista fornecida pelo Analista.
- Só salvar o `.html` depois da checagem manual do Analista (ver
  `regras-de-validacao.md`).
