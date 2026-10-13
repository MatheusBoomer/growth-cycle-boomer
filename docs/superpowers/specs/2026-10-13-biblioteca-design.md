# Biblioteca de imagens do prospect — Design

**Data:** 2026-10-13
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** uma spec. Uma aba "Biblioteca" na área de trabalho do prospect
(`apps/web`) que reúne todas as imagens do planejamento, filtradas por etapa,
com ampliação, título editável, troca de etapa e menção no chat.

## 1. Objetivo

Hoje as imagens de um prospect estão espalhadas e sem etapa no nome:

- gráficos aprovados em `entrega/ativos-aprovados/graficos/<nome>.png`
  (ex.: `cac-mensal.png`), sem indicação de etapa;
- propostas em `.app/propostas/<id>.png`;
- anexos do chat em `.app/anexos/<timestamp>-<nome>`, sem etapa;
- prints enviados como insumo em `contexto/brutos/prints-campanhas/`;
- criativos do benchmark em `dados/benchmark-meta/<marca>/midia/<anúncio>/`;
- prévias da apresentação em `.app/previas/<id>/slide-NN.png`.

Para citar um gráfico, o analista precisa lembrar o nome do arquivo e a etapa
de cabeça.

**Critério de sucesso:** no app rodando, o analista abre "Biblioteca" na
trilha, filtra por etapa (ou busca por nome), clica numa imagem, vê a imagem
ampliada com título, etapa e nome do arquivo, e com um clique a menciona no chat
da etapa em que está. Gráficos sem etapa conhecida aparecem em "Sem etapa" e o
analista os move de etapa e renomeia o título pela própria biblioteca.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | O que entra | Tudo: aprovados, propostas (pendentes; substituídas sob demanda), anexos, insumos de imagem, criativos do benchmark e prévias de slides |
| 2 | Imagens sem etapa conhecida | Vão para "Sem etapa"; o analista atribui a etapa à mão. Sem inferência pelo roteiro ou pelas SKILL.md |
| 3 | Onde abre | Item "Biblioteca" na trilha; a biblioteca cobre as colunas de chat e painel, sem desmontar o chat |
| 4 | Nome | Título automático + título editável salvo só na biblioteca. O arquivo no disco nunca é renomeado |
| 5 | Fonte da lista | Varredura das pastas a cada listagem + arquivo de ajustes manuais `.app/biblioteca.json`. Sem manifesto, sem cópia física |
| 6 | Benchmark | Um card por anúncio (capa), que abre todas as imagens do anúncio |
| 7 | Prévia de slides | Um card por apresentação, só a versão mais recente |
| 8 | Menção no chat | Vai para o chat da etapa selecionada na trilha, não para a etapa da imagem |

### Por que varredura e não manifesto

Manifesto exigiria registrar em cinco pontos (propor, aprovar, anexar, insumo,
coleta do benchmark) e ainda perderia o que nasce fora do app (terminal,
`scripts/coleta_meta_ads.py`). O volume por prospect é pequeno (dezenas de
gráficos, algumas centenas de criativos), então varrer na hora é rápido e nunca
fica dessincronizado. O único estado novo são os ajustes do analista.

## 3. Classificação

Cada item da biblioteca é:

```ts
type OrigemImagem =
  | "aprovado" | "proposta" | "substituido"
  | "anexo" | "insumo" | "benchmark" | "previa"

type EtapaBiblioteca = EtapaId | "sem-etapa" // EtapaId = "01".."08" | "final"

interface ItemBiblioteca {
  id: string            // = caminho (estável)
  caminho: string       // relativo à pasta do prospect; para grupos, a pasta do grupo
  origem: OrigemImagem
  etapa: EtapaBiblioteca
  titulo: string
  nomeArquivo: string   // nome real do arquivo (ou da pasta, em grupos)
  grupo?: { tipo: "anuncio"; marca: string } | { tipo: "previa" }
  imagens: string[]     // caminhos das imagens; 1 para item simples, N para grupo
  capa: string          // caminho da miniatura
  modificadoEm: string
}
```

Formatos de imagem aceitos: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`. SVG fica
de fora (exigiria política de conteúdo própria; nenhum prospect tem SVG).

### 3.1 Regras por origem

| Origem | Arquivos | Etapa | Observação |
|---|---|---|---|
| `aprovado` | imagens em `entrega/ativos-aprovados/**` | do entregável com `status: "aprovado"` cujo `destinoAprovado(e)` é esse caminho; senão `sem-etapa` | Gráficos vindos do terminal caem em `sem-etapa` |
| `proposta` | `.app/propostas/<id>.<img>` de entregável `pendente` | do entregável | Etiqueta "Pendente" |
| `substituido` | `.app/propostas/<id>.<img>` de entregável `substituido` | do entregável | Só aparece com "Mostrar versões antigas" ligado |
| `anexo` | imagens em `.app/anexos/<etapa>/*` | a pasta `<etapa>` | Imagens soltas em `.app/anexos/*` (formato antigo) vão para `sem-etapa` |
| `insumo` | imagens dentro da pasta de destino de cada insumo do catálogo cujos `formatos` incluem extensão de imagem (ex.: `contexto/brutos/prints-campanhas/`) | a etapa dona do insumo no catálogo | Lê a pasta, não `estado.insumos` (que guarda só um arquivo por insumo) |
| `benchmark` | `dados/benchmark-meta/<marca>/midia/<anuncio>/*` | `06` | Um item por pasta `<anuncio>`; `capa` = primeiro arquivo cujo nome contém `capa`, senão o primeiro em ordem alfabética; `grupo.marca` = `<marca>` |
| `previa` | `.app/previas/<id>/slide-NN.png` | `final` | Só o `<id>` do entregável `apresentacao` mais recente (`criadoEm`) que tem prévia; um item com os slides em ordem |

Propostas de entregáveis `aprovado` não aparecem: a cópia aprovada já está em
`ativos-aprovados/`.

**Fica de fora:** `.app/rascunhos/**` (inclusive `_work/`), `.app/comentarios/**`
e prévias de versões anteriores da apresentação.

### 3.2 Título

Precedência:

1. `titulo` do ajuste manual;
2. `titulo` do entregável (aprovado, proposta, substituído);
3. nome do arquivo legível: sem extensão, sem o prefixo numérico de anexo
   (`1728830000000-`), `-` e `_` viram espaço, primeira letra maiúscula
   (`cac-mensal.png` → "Cac mensal");
4. para grupos: anúncio → "<marca> · anúncio <id>"; prévia → "Apresentação, prévia (N slides)".

### 3.3 Ajustes manuais

`.app/biblioteca.json`:

```json
{ "entrega/ativos-aprovados/graficos/cac-mensal.png": { "etapa": "04", "titulo": "CAC mensal (12 meses)" } }
```

- A chave é o `caminho` do item (para grupos, a pasta do grupo).
- `etapa` do ajuste sobrescreve a etapa calculada, em qualquer origem.
  `"sem-etapa"` é um valor válido.
- Ajuste para caminho que não existe mais é ignorado na leitura e removido na
  próxima gravação.
- JSON inválido é tratado como `{}` (com log de erro); a tela não quebra. A
  próxima gravação reescreve o arquivo.
- Só o app escreve esse arquivo (já está fora de `.app/rascunhos/`, então o
  hook de escrita do agente o bloqueia).

## 4. Componentes

### 4.1 Core (`packages/core`)

- **`src/biblioteca.ts`** (novo, puro, sem disco): `classificarBiblioteca({ arquivos, estado, catalogo, ajustes })`
  → `ItemBiblioteca[]`, ordenados por etapa (ordem de `ORDEM_ETAPAS`, depois
  `sem-etapa`) e, dentro da etapa, por `modificadoEm` decrescente. Também
  `tituloLegivel(nomeArquivo)` e `aplicarAjuste(ajustes, caminho, mudanca)`.
- **Leitura/gravação de ajustes** em `armazenamento.ts`: `lerAjustesBiblioteca(slug)`,
  `gravarAjustesBiblioteca(slug, ajustes)`.
- **Listagem de arquivos:** a biblioteca precisa ver `.app/propostas/`,
  `.app/anexos/` e `.app/previas/`. Criar `listarImagensDoProspect(slug)` em
  `armazenamento.ts` (filtra por extensão de imagem e exclui `.app/rascunhos/`
  e `.app/comentarios/`), sem mexer no `arquivoVisivel` usado pela listagem
  geral de arquivos.
- **`ServicoPlanejamento`** ganha:
  - `listarBiblioteca(slug)`: lista as imagens, lê o estado, o catálogo e os ajustes,
    chama `classificarBiblioteca`;
  - `ajustarBiblioteca(slug, caminho, { etapa?, titulo? })`: valida etapa
    (`ORDEM_ETAPAS` ou `"sem-etapa"`), valida que o caminho está dentro do
    prospect e existe, grava o ajuste e emite `{ tipo: "estado" }` no barramento.
    `titulo` vazio remove o título do ajuste (volta ao automático).
- **Anexos:** `salvarAnexo` passa a receber a etapa e a gravar em
  `.app/anexos/<etapa>/<timestamp>-<nomeSeguro>`. A rota de anexos já recebe
  a etapa e só precisa repassá-la.

### 4.2 Rotas (`apps/web/app/api/prospects/[slug]/`)

- `GET biblioteca` → `{ itens: ItemBiblioteca[] }`.
- `PATCH biblioteca` com `{ caminho, etapa?, titulo? }` → item atualizado;
  400 para etapa inválida ou caminho fora do prospect, 404 para caminho
  inexistente.
- `GET arquivo`: adicionar `image/webp` e `image/gif` ao mapa de MIME. Para
  imagens, trocar `no-store` por `cache-control: private, max-age=0, must-revalidate`
  com `Last-Modified` (do `mtime`) e resposta 304 para `If-Modified-Since`, para
  a grade não baixar tudo de novo a cada abertura.

### 4.3 Web (`apps/web/components/biblioteca/`)

- **Item na trilha** (`trilha-etapas.tsx`): "Biblioteca" abaixo do `<nav>` das
  etapas, com a contagem total de itens. Ativo quando a biblioteca está aberta.
- **`area-de-trabalho.tsx`**: estado `bibliotecaAberta`. Aberta, a biblioteca
  ocupa as colunas de chat e painel; o chat continua montado (escondido), no
  mesmo padrão do visualizador em tela cheia. Clicar numa etapa da trilha fecha
  a biblioteca e seleciona a etapa.
- **`biblioteca.tsx`**: topo com
  - pílulas de etapa com contagem: `Todas · 01 … 08 · Final · Sem etapa`
    (etapa sem itens aparece apagada, mas clicável);
  - busca por nome (no `titulo` e no `nomeArquivo`, sem diferenciar maiúsculas
    nem acentos);
  - menu de origem (Aprovados, Pendentes, Anexos, Insumos, Benchmark, Prévias;
    todas marcadas por padrão);
  - chave "Mostrar versões antigas" (desligada).
  Em "Todas", grade agrupada por etapa com cabeçalho ("02 · Contextualização
  estratégica", nome do catálogo); na 06, subgrupos por marca do benchmark.
- **`card-imagem.tsx`**: miniatura (`loading="lazy"`), título, etiqueta de
  origem, nome do arquivo em letra pequena; grupos mostram a contagem de
  imagens. Imagem que falha ao carregar vira ícone de arquivo quebrado + nome.
- **`imagem-ampliada.tsx`**: diálogo com a imagem grande; setas ←/→ (e teclado)
  percorrem os itens do filtro atual ou, em grupos, as imagens do grupo. Lateral
  com título editável (lápis), seletor de etapa, origem, caminho e botões
  **Mencionar no chat**, **Baixar** (rota `arquivo` com `download=1`) e
  **Mostrar no Finder** (rota `abrir-pasta`). Reaproveita a lógica de exibição
  de imagem do `VisualizadorArquivo`.
- **Mencionar no chat:** fecha a biblioteca e chama `mencionar(caminho)` do
  `contexto-visualizador`, que coloca a etiqueta no compositor da etapa
  selecionada na trilha. Em grupos, menciona a imagem que está na tela.
- **`hooks/use-biblioteca.ts`**: busca `GET biblioteca` ao abrir e refaz a busca a
  cada evento `estado` do SSE já existente; `ajustar()` faz o PATCH e atualiza
  o item localmente.

Filtros, busca e navegação são feitos no cliente sobre a lista inteira.
Textos de interface seguem a regra da agência coberta por
`sem-travessao.test.ts`: travessão só entre números (usar `·` ou vírgula).

## 5. Erros e casos de borda

- Prospect sem nenhuma imagem: estado vazio "Gráficos aprovados, anexos e o
  benchmark aparecem aqui".
- Filtro sem resultado: "Nenhuma imagem nesta etapa" (ou "para esta busca").
- Arquivo apagado entre a listagem e a abertura: o card mostra o ícone de
  quebrado; o próximo evento `estado` ou reabertura limpa a lista.
- `biblioteca.json` corrompido: tratado como vazio, erro no log do servidor.
- Falha no PATCH: toast com o erro; o título e a etapa voltam ao valor anterior.

## 6. Testes

`packages/core/test/biblioteca.test.ts` (vitest, dados falsos, sem disco):

- cada origem classificada com a etapa certa (aprovado com entregável, aprovado
  sem entregável → `sem-etapa`, proposta pendente, substituída, anexo na pasta
  da etapa, anexo solto, insumo pela pasta do catálogo, benchmark, prévia);
- precedência do título (ajuste > entregável > nome legível) e `tituloLegivel`;
- ajuste de etapa sobrescrevendo a etapa calculada, inclusive para `sem-etapa`;
- benchmark agrupado por anúncio, com a capa escolhida pela regra;
- só a prévia da apresentação mais recente;
- rascunhos e recortes de comentários fora;
- ajuste de caminho inexistente ignorado.

Em `servico-planejamento.test.ts` / `armazenamento.test.ts`: `salvarAnexo`
grava na pasta da etapa; `ajustarBiblioteca` rejeita etapa inválida e caminho
fora do prospect; `biblioteca.json` corrompido lido como `{}`.

**Verificação manual** no app rodando:

- `adda`: os 24 gráficos em "Sem etapa", a prévia da apresentação em "Final";
  mover um gráfico para a 03 e renomear o título persiste após recarregar.
- `sottile-teste`: o benchmark agrupado na 06 por marca, um card por anúncio.
- Anexar uma imagem no chat da 02: ela aparece na 02 sem recarregar a página.
- "Mencionar no chat" estando na 07 coloca a etiqueta no compositor da 07.

## 7. Fora do escopo

- Renomear, apagar ou mover arquivos no disco pela biblioteca.
- Upload direto na biblioteca (continua pelo chat e pelos insumos).
- Inferir a etapa de gráficos antigos pelo roteiro ou pelas SKILL.md.
- Migrar anexos antigos soltos em `.app/anexos/` para pastas de etapa.
- Seleção múltipla e ações em lote.
