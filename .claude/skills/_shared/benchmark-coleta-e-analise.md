# Benchmark Meta Ads — coleta e análise dos criativos

Referenciado pela etapa `briefing-e-benchmark` (Fase 2), hoje desativada em
`.claude/skills/_desativadas/`. Não copie este
conteúdo para dentro de uma skill — referencie este arquivo.

Adaptado de `docs/referencias/benchmark-meta-ads/references/coleta-e-analise.md`
(a versão original navegava a Biblioteca pelo Chrome). Aqui a coleta é feita
por `scripts/coleta_meta_ads.py`, via Apify, e o Claude analisa as imagens e
os quadros de vídeo baixados.

## Quem faz o quê

O script já garante, em código, as regras mecânicas da skill original — não
as refaça à mão:

- até 5 criativos por anunciante, os mais recentes primeiro;
- no máximo 1 catálogo (DPA) por anunciante, inclusive o próprio prospect;
- sem criativos duplicados (mesmo agrupamento de versões da Meta, ou mesmo
  texto e mesma imagem);
- anúncio cuja mídia não baixa é descartado e substituído pelo próximo;
- anunciante com menos de 10 anúncios ativos entra com todos, sem completar.

O Claude faz tudo que é interpretação: descrição visual, tom, foco, etapa de
funil, textos sobrepostos, quadro final dos vídeos e a síntese.

## Comandos

Rode sempre da raiz do projeto, com a ferramenta Bash e `timeout` de
600000 ms (a Apify leva de 1 a 3 minutos por chamada):

```bash
python3 scripts/coleta_meta_ads.py coletar --link "<link da página na Biblioteca>" --marca "Nome" --saida clientes/<slug>/dados/benchmark-meta
```

Sempre entre aspas no `--link` (o endereço tem `&`).

Se o comando sair com `ERRO:`, mostre a mensagem ao analista como veio (ela já
diz o que fazer: token, créditos, ffmpeg) e pare a Fase 2 até ele resolver.
Nunca tente coletar por outro caminho (navegador, Firecrawl, WebFetch da
Biblioteca).

## Link da página de cada anunciante

O script não procura páginas: cada anunciante precisa do link da página na
Biblioteca, informado pelo analista. Para o analista conseguir o link:
abra facebook.com/ads/library (país Brasil, todos os anúncios), busque o
nome da marca, clique no nome da **página** (não num anúncio) e copie o
endereço do navegador. O link certo tem `view_all_page_id=`.

Faltando link, peça ao analista no chat (todos os que faltam de uma vez) e
espere. É uma pergunta, não um entregável: não use `propor_entregavel`.

## Análise de cada criativo

Para cada anunciante, leia `resumo.md` da pasta da coleta. Para cada anúncio,
**abra com Read cada arquivo listado em "Mídia"** antes de escrever qualquer
coisa sobre ele. Preencha:

| Campo | De onde vem |
|---|---|
| Formato | `resumo.md` (já classificado pelo script) |
| Descrição visual | Das imagens/quadros: pessoas, produtos, textos sobrepostos, ambiente |
| Copy | `resumo.md` (Copy e Título) + textos sobrepostos vistos nas imagens/quadros |
| CTA | `resumo.md` |
| Domínio | `resumo.md` |
| Tom | Aspiracional / Promocional / Educativo / Relacional |
| Foco | Buyer / Seller / Ambos |
| Etapa de funil | Critérios abaixo |
| Plataformas | `resumo.md` |
| Início | `resumo.md` |
| Versões | `resumo.md` |
| Impressões | `resumo.md` (geralmente `—` no Brasil) |

**Etapa de funil (obrigatório seguir):**
- **Topo:** CTA "See details" ou "Visit Instagram profile" + domínio
  instagram.com. Objetivo: aquisição de audiência, awareness.
- **Meio:** CTA "Learn More"/"Saiba mais" + domínio próprio da marca.
  Objetivo: consideração, educação, engajamento.
- **Fundo:** CTA "Shop Now"/"Comprar agora", "Install Now", "Send WhatsApp
  message" + domínio próprio ou app. Objetivo: conversão direta.

**Formato:** o script já distingue vídeo, imagem, carrossel e catálogo. Se a
imagem mostrar claramente o layout de catálogo (grade com nome/preço do
produto) num anúncio marcado de outro jeito, registre como Catálogo (DPA) e
mencione na nota de coleta.

**Criativo dinâmico (várias pastas `video-1`, `video-2`… ou `imagem-1`, `imagem-2`… no
mesmo anúncio):** são variações do mesmo anúncio que a Meta alterna, não um carrossel.
Descreva o conceito comum, diga quantas variações há e o que muda entre elas. Anúncio sem
Copy no resumo costuma ter o texto na própria imagem: transcreva o que estiver legível.

**Vídeos:** os arquivos `video-N-quadro-1..5.jpg` são quadros em ordem de
tempo (~2 s, 25%, 50%, 75% e o final). Descreva a partir do primeiro quadro
com conteúdo (nunca de um quadro preto ou de transição), registre os textos
sobrepostos que aparecerem em qualquer quadro e descreva o quadro final. Se
o resumo avisar que não houve quadros, descreva a partir da capa
(`video-N-capa.jpg`) com o máximo de detalhe e diga isso na descrição. Não há
áudio: nunca descreva fala ou trilha.

**Integridade (obrigatório):** registre somente o que for visualmente
confirmado nas imagens ou que estiver no `resumo.md`. Se não der para
confirmar, use `—`. Nunca descreva ações, expressões ou conteúdos que não
estejam nas imagens.

## Síntese de cada anunciante

Ao terminar os criativos de um anunciante, escreva um parágrafo cobrindo:
formatos predominantes, tema central, posicionamento percebido, distribuição
por etapa de funil, uso de pessoas reais, e destaque comparativo frente aos
anunciantes já analisados. As "Notas de coleta" do `resumo.md` que forem
relevantes viram a "Nota de coleta" daquele anunciante no relatório.

## Arquivo de análise (checkpoint de retomada)

Ao terminar cada anunciante, acrescente o bloco dele a
`clientes/<slug>/dados/benchmark-meta/analise-benchmark.md`, em texto corrido
e sem tabelas: um parágrafo por anúncio com todos os campos, uma linha em
branco entre anúncios e entre anunciantes, e a síntese ao final de cada
anunciante. Comece o arquivo com `# ANÁLISE DE BENCHMARK - <PROSPECT>`.

Se a execução cair no meio, leia esse arquivo e retome do primeiro
anunciante que ainda não estiver nele. Não recolete quem já está.

## Ordem

Um anunciante por vez: os concorrentes na ordem do briefing, o prospect
sempre por último. Termine um (coleta, análise, síntese, arquivo de análise)
antes de começar o próximo.
