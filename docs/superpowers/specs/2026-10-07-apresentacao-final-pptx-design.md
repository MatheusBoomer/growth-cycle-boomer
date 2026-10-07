# Apresentação final gerada automaticamente (.pptx) — Design

**Data:** 2026-10-07
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** uma spec, implementada em duas entregas que funcionam sozinhas:
(A) roteiro + molde + script gerando o `.pptx` editável; (B) prévia em imagens
no app com comentários por slide e por região.

## 1. Objetivo

O planejamento termina numa apresentação para o prospect, no padrão do deck
"Sottile Jalecos | Diagnóstico + Estratégia de Mídia" (61 slides, fundo escuro
com malhas, tarjas numeradas, logo Boomer, Montserrat/Century Gothic). Hoje ela
é montada à mão; o subagente `designer-apresentacao` (Canva) depende de Brand
Template e de autofill do Canva, que não estão disponíveis.

Objetivo: gerar essa apresentação automaticamente, **nos mesmos moldes**, a
partir do que foi aprovado ao longo do planejamento, como um **.pptx editável**
(PowerPoint, Keynote, Google Slides), **sem app de terceiro**, com revisão em
duas camadas (roteiro, depois o deck) e comentários apontando slides e regiões
para orientar as correções do agente.

**Critério de sucesso:** para o `sottile-teste`, o deck gerado reproduz a
estrutura e o visual do PDF de referência (mesmos tipos de slide, posições,
fundo, fontes) com o conteúdo aprovado no app; o analista revisa no app, comenta
regiões, o agente corrige só o que foi apontado, e o `.pptx` aprovado abre
editável no Google Slides.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Formato final | `.pptx` editável (abre no PowerPoint e no Google Slides) |
| 2 | Origem do visual | O `.pptx` original exportado do Google Slides, reduzido a um molde com 1 slide por tipo |
| 3 | Revisão | Roteiro primeiro (conteúdo), depois o deck (visual) |
| 4 | Geração | Script Python (`python-pptx`), sem serviço externo |
| 5 | Identificação dos campos no molde | Texto alternativo (`campo:<nome>`), editável no Google Slides |
| 6 | Prévia no app | LibreOffice (pptx → pdf) + poppler (pdf → png por slide) |
| 7 | Comentários | Por slide e por região (retângulo), com recorte da região enviado ao agente |
| 8 | Canva | Subagente desativado e documentado como caminho futuro; o roteiro é o insumo comum |

## 3. Tipos de slide

Extraídos do deck de referência (números de página do PDF):

| Tipo | Campos | Modelo |
|---|---|---|
| `capa` | `prospect` | p.1 |
| `jornada` | fixo (6 seções) | p.2 |
| `divisoria` | `numero`, `titulo` (com negrito parcial) | p.3 |
| `grafico` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1 a 3) | p.4 |
| `tabela_lateral` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1 a 3) | p.18 |
| `imagem_larga` | `titulo`, `imagem`, `texto` | p.55 |
| `analises_2_colunas` | `esquerda` e `direita`: `{ "titulo", "itens" (1 a 4) }` | p.7 |
| `bullets` | `titulo`, `subtitulo`, `itens` (até 6) | p.27 |
| `cartoes` | `titulo`, `subtitulo`, `cartoes` (3) | p.26 |
| `benchmark` | `titulo`, `subtitulo`, `concorrente`, `imagens` (3), `conclusoes`, `link` | p.33 |
| `obrigado` | — | p.61 |

Ordem padrão do deck: capa → jornada → 01 Cenário atual → 02 Desafios →
03 Benchmarking → 04 Metas → 05 Cenários e impactos esperados → 06 Plano de ação
→ obrigado.

## 4. Roteiro (`roteiro-apresentacao.json`)

Escrito pelo agente, aprovado pelo analista. Formato:

```json
{
  "versao": 1,
  "prospect": "Sottile Jalecos",
  "slides": [
    { "tipo": "capa", "prospect": "Sottile Jalecos" },
    { "tipo": "divisoria", "numero": "01.", "titulo": "CENÁRIO **ATUAL**" },
    {
      "tipo": "grafico",
      "titulo": "Cenário Atual",
      "subtitulo": "**Investimento total** em mídia paga nos últimos 12 meses",
      "imagem": "entrega/ativos-aprovados/graficos/investimento-total-mensal.png",
      "conclusoes": ["Platô de investimento mensal, média em R$ 4.858/mês", "…"],
      "fonte": "secoes/03-macro-financeiro.md"
    }
  ]
}
```

Regras para o agente:

- **Imagens só de arquivos aprovados** (`entrega/ativos-aprovados/graficos/`) ou
  dos criativos já coletados pela Skill 06 (`dados/benchmark-meta/<marca>/midia/`).
  Nunca gerar gráfico novo.
- **Conclusões condensam as seções aprovadas** (`secoes/*.md`) em frases curtas,
  no estilo do deck de referência; nenhuma análise nova. Cada slide registra a
  seção de origem em `fonte`.
- `**…**` marca o trecho em negrito de títulos e subtítulos.
- Faltando material para um slide, o roteiro registra a lacuna
  (`"pendencia": "…"`) em vez de inventar.
- PII: as regras do `CLAUDE.md` raiz valem para o deck.

## 5. Molde (`.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx`)

- Cópia do deck original reduzida a 11 slides, um por tipo, com o conteúdo da
  Sottile substituído por textos de exemplo neutros. Fundo, logo e fontes vêm do
  arquivo (mestre e layout originais).
- Cada caixa de texto ou imagem que o script preenche tem **texto alternativo**
  `campo:<nome>` (ex.: `campo:titulo`, `campo:conclusoes`, `campo:imagem_2`) e o
  slide-modelo tem `tipo:<tipo>` nas anotações do apresentador (a capa não tem
  logo; as anotações também são editáveis no Google Slides), para o script
  localizar o modelo de cada tipo.
- Preparado uma vez por `scripts/preparar_molde_apresentacao.py` a partir do
  `.pptx` original (mapeamento página → tipo da seção 3); conferido pelo analista
  no Google Slides antes de ser versionado. O deck original (com dados do
  prospect) não vai para o git.
- Mudança futura de visual: editar o molde no Google Slides mantendo os textos
  alternativos e exportar de novo.

## 6. Script `scripts/gerar_apresentacao.py`

```
python3 scripts/gerar_apresentacao.py --roteiro <roteiro.json> --prospect clientes/<slug> \
  --output <arquivo.pptx> [--molde <molde.pptx>] [--previa <pasta>]
```

1. **Valida o roteiro:** tipos existentes no molde; campos obrigatórios; imagens
   existentes e dentro da pasta do prospect (recusa caminho fora); limites de
   itens por tipo. Estimativa de estouro de texto por caixa (caracteres × área)
   gera **aviso** com slide e campo. Erros em português, código ≠ 0.
2. **Monta:** duplica o slide-modelo de cada tipo na ordem do roteiro (copiando
   relações de imagem e hiperlinks), preenche os campos e remove os modelos.
   - Texto: mantém fonte, tamanho e cor do primeiro trecho da caixa original;
     `**…**` vira trecho em negrito.
   - Listas: cada item é um parágrafo com o marcador, recuo e espaçamento do
     primeiro parágrafo do modelo; parágrafos sobrando são removidos.
   - Imagens: encaixadas na área do modelo mantendo a proporção, centralizadas.
   - Link do benchmark: hiperlink no texto do campo `link`.
3. **Salva** o `.pptx` e grava `mapa-slides.json` ao lado: para cada slide, tipo,
   índice no roteiro e a caixa de cada campo em % do slide.
4. **Prévia (`--previa`)**, quando LibreOffice e poppler existem: `soffice
   --headless --convert-to pdf` e `pdftoppm -png -r 110` → `slide-01.png`…; sem
   eles, segue sem prévia e avisa.

Dependências novas: `python-pptx` (já instalado, 1.0.2). Sistema: LibreOffice
(`brew install --cask libreoffice`) e poppler (`brew install poppler`), mais a
fonte Montserrat (Google Fonts) para a prévia; Century Gothic ausente cai numa
fonte parecida só na prévia.

**Testes (pytest):** molde de teste mínimo gerado no próprio teste (2–3 tipos com
texto alternativo); duplicação e ordem; negrito parcial; listas com marcador;
encaixe de imagem sem distorção; hiperlink; remoção dos modelos; recusa de
imagem fora da pasta e de tipo inexistente; aviso de estouro; `mapa-slides.json`.

## 7. Integração no app

**Núcleo**
- Tipos de entregável novos: `roteiro` (`.json`, aprovado vai para
  `entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json`) e
  `apresentacao` (`.pptx`, aprovado vai para `entrega/apresentacao-final.pptx`).
- Comentários de entregável: `.app/comentarios/<entregavelId>.json` com lista de
  `{ id, slide, regiao: {x,y,w,h} em % | null, campo | null, texto, criadoEm,
  resolvido }`; rotas para criar, editar, apagar e enviar; o envio monta o texto
  do ajuste e usa o fluxo de "Pedir ajuste" existente; nova versão do entregável
  marca os anteriores como resolvidos.
- Rota de prévia: `GET /api/prospects/<slug>/entregaveis/<id>/previa` gera (uma
  vez por versão, em cache em `.app/previas/<id>/`) os PNGs e o mapa; `…/previa/<n>`
  serve cada slide. Recorte de região gerado com Pillow ao enviar comentários
  (`.app/comentarios/<id>/c<n>.png`, região destacada).
- Verificação do sistema: itens LibreOffice e poppler (não bloqueantes).

**Web**
- Card do roteiro: blocos por slide (tipo, título, miniatura do gráfico,
  conclusões, fonte) com "Comentar" por bloco.
- Visualizador de apresentação na coluna larga (como o relatório HTML): coluna de
  slides numerados; "Comentar" por slide; arrastar retângulo para comentar região
  (mostra o campo atingido pelo mapa); marcadores numerados; lista lateral de
  comentários editáveis; "Enviar N ajustes ao agente"; histórico de resolvidos
  recolhido; baixar `.pptx`.
- Sem LibreOffice: o card mostra só "Baixar .pptx" e a orientação de abrir no
  Google Slides.

**Texto enviado ao agente (exemplo)**

```
Ajustes na apresentação (versão 2):
1. Slide 12 · grafico "ROAS Global vs ROAS por plataforma" (roteiro #12)
   Região: conclusoes. Recorte: clientes/<slug>/.app/comentarios/<id>/c1.png
   "a 2ª conclusão está errada, a média é 0,40%"
2. Slide 18 · slide inteiro: "esse slide pode sair"
```

## 8. Skill `09-apresentacao-final` e processo

- Nova skill `.claude/skills/09-apresentacao-final/SKILL.md` e comando
  `/apresentacao-final` apontando para ela; `etapas.json` (etapa `final`) passa a
  usar a skill.
- Fluxo: conferir material das 6 seções em `ativos-aprovados/` (faltando,
  avisar de qual etapa vem) → roteiro → `propor_entregavel` tipo `roteiro` →
  aprovado → `gerar_apresentacao.py` → `propor_entregavel` tipo `apresentacao`
  → ajustes por comentários corrigem só o roteiro nos pontos citados e regeram →
  aprovado → encerramento como as demais etapas.
- No terminal: roteiro revisado no chat; o `.pptx` é a prévia.
- `designer-apresentacao`: marcado como desativado, com nota de que o roteiro
  aprovado é o insumo para um renderizador Canva futuro. `CLAUDE.md` raiz
  atualizado (ordem de execução e subagentes).

## 9. Entregas

- **A — Geração:** molde (preparo + conferência), `gerar_apresentacao.py` com
  testes, skill 09, tipos `roteiro`/`apresentacao` no núcleo, card do roteiro com
  aprovação/ajuste simples, download do `.pptx`. Valida: deck do `sottile-teste`
  comparado ao PDF de referência.
- **B — Prévia e comentários:** instalação LibreOffice/poppler/Montserrat,
  prévia em imagens, mapa de campos, comentários por slide e região, recortes,
  envio estruturado, verificação do sistema.

## 10. Fora do escopo

- Renderizador Canva e envio automático para o Google Drive/Slides.
- Edição direta do deck dentro do app (os ajustes passam pelo roteiro).
- Gráficos novos gerados na etapa final.
- Diagramas editáveis (o diagrama de estrutura de campanhas entra como imagem
  quando existir aprovado).
