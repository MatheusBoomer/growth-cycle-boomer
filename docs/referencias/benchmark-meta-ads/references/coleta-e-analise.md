# Fase 1 — Coleta & Análise (equivalente ao "Prompt 1")

Esta fase usa a ferramenta de navegador para visitar a Biblioteca de Anúncios
do Meta, coletar os anúncios ativos de cada concorrente + do cliente, e
analisar cada criativo individualmente. O resultado é um arquivo de texto
corrido que a Fase 2 usa para montar o relatório HTML.

Use o navegador preferido da sessão (Claude in Chrome por padrão). Se ele não
estiver disponível, use o navegador embutido do Claude como alternativa,
avisando o usuário da troca em uma frase.

## Antes de começar — acesso ao facebook.com

Nunca abra `facebook.com` diretamente em uma aba nova (pode disparar
verificação anti-bot). Em vez disso:

1. Abra `https://www.google.com`
2. Na mesma aba, navegue para `https://www.facebook.com/ads/library`

## Configure os filtros

- País: Brasil
- Categoria de anúncio: Todos os anúncios

## Loop principal — para cada concorrente do briefing + o cliente

Processe um anunciante por vez, do primeiro ao último, sempre terminando de
processar um antes de passar ao próximo (inclui achar a página, coletar IDs,
analisar os criativos e escrever a síntese). Isso evita perder contexto no
meio de um anunciante. **O cliente é sempre analisado por último**, mesmo se
vier antes na lista.

### 1. Encontre a página oficial

1. Pesquise o nome do anunciante na Biblioteca de Anúncios.
2. Não dê enter imediatamente após digitar — espere uns 10 segundos ou mais
   para as opções de página aparecerem.
3. Selecione a página oficial: maior número de seguidores, categoria
   coerente com o negócio.
4. Se não achar pesquisando só o nome e o nome for composto, tente pesquisar
   as duas palavras juntas sem espaço.
5. Confirme que a URL contém `view_all_page_id=` — se contiver
   `search_type=keyword_unordered`, clique no nome da página para navegar até
   ela de fato.
6. Anote: nome da página, `view_all_page_id`, volume aproximado de anúncios
   ativos.

Se o anunciante genuinamente não tiver nenhum anúncio ativo no momento da
pesquisa, registre isso e siga para o próximo — não invente conteúdo. No
relatório final essa conta aparece como "Nenhum anúncio ativo encontrado".

### 2. Extraia os IDs dos anúncios

1. Role a página até o fim para carregar todos os anúncios ativos.
2. Execute o script `scripts/extract_ad_ids.js` para extrair os IDs
   visíveis na página.
3. Colete no máximo **10 IDs por anunciante**, priorizando os mais recentes.

**Anúncios de catálogo (DPA) — como identificar antes de confirmar os 10 IDs:**
observe o card de cada anúncio na listagem. Anúncios de catálogo têm
características visuais distintas: layout em grade com 3 células (uma imagem
central maior e dois slots laterais menores), nome ou preço do produto abaixo
de cada imagem, imagens que variam entre usuários (geradas dinamicamente), e
às vezes o rótulo "Anúncio de catálogo" no próprio card.

**Regra obrigatória para catálogos — sem exceção:** dos 10 IDs coletados por
anunciante, no máximo 3 podem ser de catálogo (DPA), nunca mais. Se o
anunciante não tiver nenhum catálogo, não force — colete 10 criativos únicos.
Nunca inclua 4 ou mais catálogos na lista de um mesmo anunciante.

**Regra obrigatória de deduplicação — anúncios iguais com IDs diferentes:**
IDs diferentes não garantem criativos diferentes; um mesmo anúncio pode
aparecer com múltiplos IDs na listagem. Antes de confirmar os 10 IDs finais,
acesse cada um brevemente e verifique se o criativo (imagem principal, vídeo
ou copy) já apareceu em outro ID já selecionado. Se sim, descarte o duplicado
e substitua pelo próximo ID da lista. Os 10 IDs entregues devem representar
10 criativos visualmente distintos.

**Regra obrigatória para IDs que não carregam:** se ao acessar um ID a
página retornar erro, anúncio indisponível ou card vazio, descarte esse ID
imediatamente e substitua pelo próximo da lista. Nunca inclua na lista final
um ID que não carregou corretamente.

Se o anunciante tiver menos de 10 anúncios ativos no total, inclua todos
integralmente — não é preciso completar 10 artificialmente.

**Se algo digno de nota acontecer durante a coleta** (conta com poucos
anúncios ativos, sem nenhum catálogo disponível, forte reuso de um mesmo
criativo em dezenas de IDs, etc.), guarde uma frase curta sobre isso — vira a
"Nota de coleta" daquele anunciante no relatório final (ver
`references/geracao-relatorio.md`). Isso não é obrigatório para todo
anunciante, só quando houver algo que valha explicar.

Ao final desta etapa, tenha em memória uma lista estruturada assim para cada
anunciante:

```
---
[Nome do Anunciante]
view_all_page_id: XXXXXXXXX
Volume: ~N anúncios ativos
Coletado em: DD/MM/AAAA
IDs coletados:
- 1234567890 [Vídeo]
- 1234567891 [Imagem estática]
- 1234567892 [Catálogo DPA]
(continua para cada ID, identificando o formato ao lado)
---
```

### 3. Analise cada criativo individualmente

Para cada ID coletado, acesse `https://www.facebook.com/ads/library/?id=[ID]`.
Aguarde o carregamento completo, **sempre clique em "Ver detalhes do
anúncio"**, espere o anúncio ficar maior, e então preencha os campos abaixo.

| Campo | O que observar |
|---|---|
| Formato | Vídeo / Imagem estática / Carrossel / Catálogo (DPA) |
| Descrição visual | O que aparece: pessoas, produtos, textos sobrepostos, ambiente |
| Copy | Texto principal da legenda + textos sobrepostos visíveis no criativo |
| CTA | Botão de chamada para ação |
| Domínio | URL exibida abaixo do CTA |
| Tom | Aspiracional / Promocional / Educativo / Relacional |
| Foco | Buyer / Seller / Ambos |
| Etapa de funil | Topo / Meio / Fundo (critérios abaixo) |
| Plataformas | Ícones visíveis no modal |
| Início | "Veiculação iniciada em" |
| Versões | Número de versões do anúncio |
| Impressões | Badge de baixo volume, se presente |

Nunca deixe de buscar a descrição visual. Para tê-la com assertividade,
lembre-se de sempre clicar em "Ver detalhes do anúncio" antes de descrever.

**Critérios obrigatórios para classificação de Etapa de funil:**
- **Topo:** CTA "See details" ou "Visit Instagram profile" + domínio
  instagram.com. Objetivo: aquisição de audiência, awareness.
- **Meio:** CTA "Learn More"/"Saiba mais" + domínio próprio da marca.
  Objetivo: consideração, educação, engajamento.
- **Fundo:** CTA "Shop Now"/"Comprar agora", "Install Now", "Send WhatsApp
  message" + domínio próprio ou app. Objetivo: conversão direta, compra,
  instalação.

**Regras obrigatórias de classificação de formato:**
- Nunca classifique um vídeo como imagem estática. Verifique sempre se o
  criativo possui player de vídeo antes de classificar.
- Anúncios com layout de 3 células, nome/preço do produto abaixo da imagem e
  deeplink de produto = Catálogo (DPA), nunca imagem estática.
- Máximo de 1 catálogo (DPA) por anunciante — esta regra vale tanto para
  concorrentes quanto para o próprio cliente. Se ao analisar perceber que já
  incluiu 1 catálogo para este anunciante, substitua os demais catálogos por
  outro formato disponível nos IDs coletados.

**Regra obrigatória de integridade — registre somente o que for visualmente
confirmado:** nunca infira, suponha ou complete informações não verificadas.
Se um elemento visual não puder ser confirmado com certeza, registre "—"
naquele campo. Não descreva ações, expressões ou conteúdos que não foram
efetivamente observados na tela.

**Regra obrigatória de deduplicação (durante a análise):** se ao abrir um
anúncio perceber que o criativo (imagem, vídeo ou copy principal) é idêntico
a outro já analisado do mesmo anunciante — mesmo que o ID seja diferente —
descarte e acesse o próximo ID da lista.

**Regra obrigatória para IDs que não carregam (durante a análise):** se um
anúncio não carregar ou retornar página de erro, descarte e acesse o próximo
ID da lista. Nunca registre uma linha com todos os campos em "—" por falha
de carregamento — substitua por um ID válido.

### Regras para análise de vídeos

- Clique em "Ver detalhes do anúncio" e espere o vídeo ficar maior **antes**
  de dar play.
- Sempre localize e clique no botão de play para rodar o vídeo. Não saia do
  vídeo antes de assisti-lo.
- Nunca inicie a descrição pelo frame 0 — os primeiros frames costumam ser
  pretos ou de transição. Inicie a partir de 1,5 a 2 segundos de reprodução.
- Descreva: o conteúdo visual central, textos sobrepostos visíveis em
  qualquer momento do vídeo, e o frame final.
- Registre no campo Copy tanto o texto da legenda quanto qualquer texto
  sobreposto visível no vídeo.
- Se o vídeo não reproduzir no primeiro acesso, recarregue a página e tente
  novamente antes de desistir.
- Se após a segunda tentativa o vídeo ainda não reproduzir, descreva o frame
  de capa com o máximo de detalhe possível.

### 4. Escreva a síntese do anunciante

Após analisar todos os concorrentes, analise o próprio cliente com a mesma
estrutura (é sempre o último anunciante processado).

Ao final de cada anunciante, escreva um parágrafo de síntese cobrindo:
formatos predominantes, tema central, posicionamento percebido, distribuição
por etapa de funil, uso de pessoas reais, e destaque comparativo frente aos
demais anunciantes já analisados até aquele ponto.

Não demore mais que o necessário analisando um criativo — a partir do
momento que já tiver todas as informações necessárias, vá para o próximo.

## Saída desta fase

Ao terminar todos os anunciantes (concorrentes + cliente), escreva tudo em
texto corrido em um arquivo com o título `ANÁLISE DE BENCHMARK - [NOME DO
CLIENTE] (OUTPUT PROMPT 1).md`, sem tabelas. Organize pulando uma linha a
cada novo anúncio ou novo anunciante, mas sem necessidade de pular linha
entre os campos de um mesmo anúncio — pode colocar todos os campos de um
anúncio no mesmo parágrafo. Preencha todos os campos solicitados, a não ser
que a informação genuinamente não esteja disponível na Biblioteca de
Anúncios.

Esse arquivo é o checkpoint desta fase: salve-o assim que terminar, antes de
seguir para a Fase 2 (`references/geracao-relatorio.md`). Se a execução for
interrompida no meio da coleta, use o que já estiver salvo para retomar de
onde parou em vez de recomeçar do zero.
